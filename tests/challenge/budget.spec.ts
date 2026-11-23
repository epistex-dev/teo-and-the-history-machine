import { expect, test } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ORDER } from '../../src/order.ts';
import { awaitsSource, globRegex } from '../support/size-limit.ts';
import { expectClean, open, solveInRealTime, watch } from './helpers.ts';

const root = process.cwd();
const dist = join(root, 'dist');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const distFiles = () => walk(dist).map((p) => relative(dist, p));

function parseHeaders(text: string): { path: string; headers: Record<string, string> }[] {
  const rules: { path: string; headers: Record<string, string> }[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) rules.push({ path: line.trim(), headers: {} });
    else {
      const i = line.indexOf(':');
      const rule = rules[rules.length - 1];
      if (rule) rule.headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

test.describe('budget and build output (static, against dist/)', () => {
  test('size-limit passes and reports at most 600 kB gzip', () => {
    const out = execFileSync(join(root, 'node_modules/.bin/size-limit'), ['--json', '--ignore-missing'], { cwd: root, encoding: 'utf8' });
    const results = JSON.parse(out) as { passed: boolean; size: number; sizeLimit: number }[];
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.passed).toBe(true);
      expect(r.sizeLimit).toBeLessThanOrEqual(600_000);
      expect(r.size).toBeLessThanOrEqual(600_000);
    }
  });

  test('size-limit really fails when the budget is exceeded (the gate is not vacuous)', () => {
    const js = distFiles().filter((f) => f.endsWith('.js')).map((f) => join('dist', f));
    const run = spawnSync(join(root, 'node_modules/.bin/size-limit'), ['--limit', '10 kB', ...js], { cwd: root, encoding: 'utf8' });
    expect(run.status).not.toBe(0);
  });

  test('.size-limit.json: gzip, limit <= 600 kB, glob covers every JS file in dist', () => {
    const cfg = JSON.parse(read('.size-limit.json')) as { path: string | string[]; limit: string; gzip?: boolean }[];
    expect(cfg.length).toBeGreaterThan(0);
    for (const entry of cfg) {
      expect(entry.gzip).toBe(true);
      const m = /^(\d+(?:\.\d+)?)\s*(kB|KB|kb|MB|mb)$/.exec(entry.limit);
      expect(m, `limit format ${entry.limit}`).not.toBeNull();
      const kb = Number(m?.[1]) * (/m/i.test(m?.[2] ?? '') ? 1000 : 1);
      expect(kb).toBeLessThanOrEqual(600);
    }
    const outsideAssets = distFiles().filter((f) => /\.m?js$/.test(f) && !/^assets\/[^/]+\.js$/.test(f));
    expect(outsideAssets, 'JS files the size-limit glob dist/assets/*.js does not see').toEqual([]);
  });

  test('independent gzip -9 total of all JS in dist is within 600 kB', () => {
    const total = distFiles()
      .filter((f) => /\.m?js$/.test(f))
      .reduce((sum, f) => sum + gzipSync(readFileSync(join(dist, f)), { level: 9 }).length, 0);
    expect(total).toBeGreaterThan(50_000);
    expect(total).toBeLessThanOrEqual(600_000);
  });

  test('every dist/assets/*.js is covered by a .size-limit.json entry', () => {
    const cfg = JSON.parse(read('.size-limit.json')) as { path: string | string[] }[];
    const globs = cfg.flatMap((e) => (Array.isArray(e.path) ? e.path : [e.path]));
    const js = distFiles().filter((f) => /\.m?js$/.test(f)).map((f) => `dist/${f}`);
    expect(js.length).toBeGreaterThan(3);
    const uncovered = js.filter((f) => !globs.some((g) => globRegex(g).test(f)));
    expect(uncovered, 'JS chunks no size-limit entry measures').toEqual([]);
    const dead = globs.filter((g) => !js.some((f) => globRegex(g).test(f)) && !awaitsSource(g));
    expect(dead, 'size-limit globs that match no file although their chapter script or puzzle exists').toEqual([]);
  });

  test('every chapter in ORDER has a size-limit entry of at most 150 kB for its script and puzzle chunks, written before the chapter', () => {
    const cfg = JSON.parse(read('.size-limit.json')) as { path: string | string[]; limit: string }[];
    for (const id of ORDER) {
      const own = [`dist/assets/chapter-${id}-*.js`, `dist/assets/pz-${id}-*.js`];
      const entry = cfg.find((e) => parseFloat(e.limit) <= 150 && own.every((g) => [e.path].flat().includes(g)));
      expect(entry, `an entry of at most 150 kB for ${own.join(' and ')}`).toBeDefined();
    }
  });

  test('dist holds only index.html, 404.html, _headers, og.png, fonts/OFL-EBGaramond.txt and assets/*.js|css|svg|webp|woff2 (no maps, no stray files)', () => {
    const bad = distFiles().filter((f) => !(['index.html', '404.html', '_headers', 'og.png', 'fonts/OFL-EBGaramond.txt'].includes(f) || /^assets\/[^/]+\.(js|css|svg|webp|woff2)$/.test(f)));
    expect(bad).toEqual([]);
  });

  test('index.html: one same-origin module script, no inline script, no absolute URLs except the og:image and twitter:image meta tags, chapter and mini game chunks not preloaded', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.[1]).toMatch(/type="module"/);
    expect(scripts[0]?.[1]).toMatch(/src="\/assets\/[^"]+\.js"/);
    expect(scripts[0]?.[2]?.trim()).toBe('');
    expect(html.replace(/(<meta\s+(?:property="og:image"|name="twitter:image")\s+content=")https:\/\/[^"]+/g, '$1')).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html, 'chapter and mini game chunks are imported dynamically, not linked from the shell').not.toMatch(/(?:chapter-)?intro-[A-Za-z0-9_-]+\.js/);
  });

  test('the shell chunk imports the chapter and the puzzle player with dynamic import()', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const entry = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(entry).toBeTruthy();
    const code = readFileSync(join(dist, entry as string), 'utf8');
    expect(code).toMatch(/import\(\s*["'`]\.\/chapter-intro-[A-Za-z0-9_-]+\.js["'`]\s*\)|__vitePreload\([^)]*chapter-intro-/);
    expect(code).toMatch(/import\(\s*["'`]\.\/puzzle-[A-Za-z0-9_-]+\.js["'`]\s*\)|__vitePreload\([^)]*["'`]\.\/puzzle-/);
    expect(code.length, 'entry chunk size (shell + story player + save)').toBeLessThan(50_000);
  });

  test('the entry chunk holds no chapter data: backdrop layouts, prop tables and Quạ Đồn\'s prose notes live in the chapter chunks only', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const entry = readFileSync(join(dist, /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1] as string), 'utf8');
    for (const marker of ['perchRoot:[', 'size:[390,844]', 'letter-blurred', 'ch2-feast', 'ch3-hall', 'ch4-corridor', 'ch5-bethlehem', 'ch6-vault', 'ch7-harbour', 'ch8-yard', 'ch9-village', 'ch10-kitchen', 'ch11-parlour', 'ch12-street', 'ch13-church', 'candle-wax', 'vp:[195,340]']) expect(entry.includes(marker), marker).toBe(false);
    const chunks = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'));
    const chapter = (id: string) => readFileSync(join(dist, 'assets', chunks.find((f) => f.startsWith(`chapter-${id}-`)) as string), 'utf8');
    expect(chapter('intro').includes('vp:[195,340]'), 'intro plate layout').toBe(true);
    expect(chapter('saturnalia').includes('bg-ch2-feast-portrait'), 'saturnalia plate').toBe(true);
    expect(chapter('yule').includes('bg-ch3-hall-portrait'), 'yule plate').toBe(true);
    expect(chapter('yule').includes('candle-wax'), 'yule prop').toBe(true);
    for (const [id, plate] of [['mistletoe', 'ch4-corridor'], ['bethlehem', 'ch5-bethlehem'], ['dec25', 'ch6-vault'], ['nicholas', 'ch7-harbour'], ['carol', 'ch8-yard'], ['krampus', 'ch9-village'], ['befana', 'ch10-kitchen'], ['tree', 'ch11-parlour'], ['ban1647', 'ch12-street'], ['silent-night', 'ch13-church']]) {
      expect(chapter(id as string).includes(`bg-${plate}-portrait`), `${id} portrait plate`).toBe(true);
      expect(chapter(id as string).includes(`bg-${plate}-landscape`), `${id} landscape plate`).toBe(true);
    }
    for (const f of chunks) expect(/perchOn/.test(readFileSync(join(dist, 'assets', f), 'utf8')), `Quạ Đồn's prose notes in ${f}`).toBe(false);
  });

  test('dist/_headers is byte-identical to public/_headers', () => {
    expect(readFileSync(join(dist, '_headers'), 'utf8')).toBe(read('public/_headers'));
  });

  test('_headers: strict CSP, no unsafe-*, no foreign host, Cloudflare limits respected', () => {
    const text = read('public/_headers');
    const rules = parseHeaders(text);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.length).toBeLessThanOrEqual(100);
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(2000);
    const all = rules.find((r) => r.path === '/*');
    expect(all, 'a /* rule').toBeTruthy();
    const h = all?.headers ?? {};
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBeTruthy();
    const csp = h['content-security-policy'] ?? '';
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|\*|https?:|wss?:/);
    for (const r of rules) {
      expect(r.path.startsWith('/')).toBe(true);
      for (const [name, value] of Object.entries(r.headers)) {
        expect(name).toMatch(/^[a-z0-9-]+$/);
        expect(value.length).toBeGreaterThan(0);
      }
    }
    const assets = rules.find((r) => r.path === '/assets/*');
    expect(assets?.headers['cache-control']).toMatch(/immutable/);
    for (const r of rules.filter((x) => x.path === '/*' || x.path === '/' || x.path.includes('.html'))) {
      expect(r.headers['cache-control'] ?? '', `${r.path} must not be cached immutably (stale shell after a deploy)`).not.toMatch(/immutable|max-age=([1-9]\d{3,})/);
    }
  });
});

test.describe('deploy safety (static)', () => {
  test('every deploy command in package.json targets branch=staging and nothing named production', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    let seen = 0;
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      if (!/wrangler|pages deploy|pages publish|deploy/.test(cmd)) continue;
      seen += 1;
      expect(cmd, `script ${name}`).toMatch(/--branch[= ]staging(\s|$)/);
      expect(cmd, `script ${name}`).not.toMatch(/--branch[= ](main|master|production|prod)\b/);
      expect(`${name} ${cmd}`).not.toMatch(/prod(uction)?\b/i);
    }
    expect(seen, 'a staging deploy script exists').toBeGreaterThan(0);
  });

  test('wrangler.toml pins no production route, account, zone or environment', () => {
    const toml = read('wrangler.toml');
    expect(toml).not.toMatch(/^\s*\[env/m);
    expect(toml).not.toMatch(/^\s*(routes?|account_id|zone_id|zone_name|pattern|workers_dev)\s*=/m);
    expect(toml).not.toMatch(/production/i);
  });

  test('no tracked script outside tests/challenge deploys without --branch=staging', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(json|toml|ya?ml|sh|mjs|cjs|js|ts|fish)$/.test(f) && !f.startsWith('tests/challenge/') && f !== 'package-lock.json');
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(root, f), 'utf8');
      for (const line of text.split('\n')) {
        if (/pages\s+(deploy|publish)|wrangler\s+(deploy|publish)/.test(line) && !/--branch[= ]staging(\s|"|'|$)/.test(line)) offenders.push(`${f}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no workflow auto-deploys, and the tests never default to a hosted URL', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    expect(files.filter((f) => f.startsWith('.github/workflows/'))).toEqual([]);
    const cfg = read('playwright.config.ts');
    expect(cfg).toMatch(/BASE_URL/);
    expect(cfg).toMatch(/\?\? 'http:\/\/127\.0\.0\.1:\d+'/);
    expect(cfg).not.toMatch(/pages\.dev|workers\.dev/);
  });
});

test.describe('served behaviour', () => {
  test('first load transfers <= 600 kB gzip of JS and <= 1 MB gzip in total, all from one origin', async ({ page }) => {
    const w = watch(page);
    const sizes: { url: string; gz: number }[] = [];
    page.on('response', async (res) => {
      if (!/\.(js|css)(\?|$)/.test(res.url()) && res.request().resourceType() !== 'document') return;
      const body = await res.body().catch(() => Buffer.alloc(0));
      sizes.push({ url: res.url(), gz: gzipSync(body, { level: 9 }).length });
    });
    await open(page);
    await page.waitForTimeout(300);
    const js = sizes.filter((s) => /\.js/.test(s.url)).reduce((a, s) => a + s.gz, 0);
    const total = sizes.reduce((a, s) => a + s.gz, 0);
    expect(js, 'the measurement saw the shell, chapter 1 and the puzzle player').toBeGreaterThan(25_000);
    expect(js).toBeLessThanOrEqual(600_000);
    expect(total).toBeLessThanOrEqual(1_000_000);
    expectClean(w);
  });

  test('headers on /, on a hashed asset and on a 404 all carry the /* rule; assets are immutable; a missing chunk is a real 404', async ({ page, request }) => {
    const rules = parseHeaders(read('public/_headers'));
    const base = rules.find((r) => r.path === '/*')?.headers ?? {};
    const assetUrls: string[] = [];
    page.on('request', (r) => {
      if (/\/assets\/.+\.js$/.test(r.url())) assetUrls.push(r.url());
    });
    await open(page);
    expect(assetUrls.length).toBeGreaterThan(0);
    const targets = ['/', assetUrls[0] as string, '/assets/does-not-exist-1a2b3c.js', '/nope/../nothing', '/%2e%2e/%2e%2e/etc/passwd'];
    for (const t of targets) {
      const res = await request.get(t);
      const h = res.headers();
      for (const [name, value] of Object.entries(base)) expect(h[name], `${name} on ${t} (${res.status()})`).toBe(value);
      if (t.includes('does-not-exist') || t.startsWith('/nope') || t.includes('passwd')) {
        expect(res.status(), t).toBe(404);
        expect(h['content-type'] ?? '').not.toMatch(/javascript/);
      }
    }
    const js = await request.get(assetUrls[0] as string);
    expect(js.headers()['cache-control']).toMatch(/immutable/);
    expect(js.headers()['content-type']).toMatch(/javascript/);
    const home = await request.get('/');
    expect(home.headers()['cache-control'] ?? '').not.toMatch(/immutable/);
  });

  test('the CSP is enforced by the browser: foreign script, inline script, foreign fetch and image are all blocked', async ({ page }) => {
    await open(page);
    const result = await page.evaluate(async () => {
      const violations: string[] = [];
      document.addEventListener('securitypolicyviolation', (e) => violations.push(e.effectiveDirective));
      const foreign = new URL(location.href);
      foreign.port = String(Number(location.port) + 9);
      const s = document.createElement('script');
      s.src = `${foreign.origin}/x.js`;
      document.head.append(s);
      const inline = document.createElement('script');
      inline.textContent = 'window.__inline = 1';
      document.head.append(inline);
      const img = new Image();
      img.src = `${foreign.origin}/p.png`;
      let fetched = 'blocked';
      await fetch(`${foreign.origin}/`, { mode: 'no-cors' }).then(() => (fetched = 'sent'), () => undefined);
      await new Promise((r) => setTimeout(r, 300));
      return { violations, inline: (window as unknown as { __inline?: number }).__inline, fetched };
    });
    expect(result.inline).toBeUndefined();
    expect(result.fetched).toBe('blocked');
    expect(result.violations.some((d) => d.startsWith('script-src'))).toBe(true);
    expect(result.violations).toContain('img-src');
    expect(result.violations).toContain('connect-src');
  });

  test('no service worker, no websocket, no foreign host across a full play session', async ({ page, context }) => {
    const w = watch(page);
    await open(page);
    await solveInRealTime(page);
    await page.reload();
    await open(page);
    expect(context.serviceWorkers()).toHaveLength(0);
    expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations())?.length ?? 0)).toBe(0);
    expect(w.requests.filter((u) => !u.startsWith(new URL(page.url()).origin))).toEqual([]);
    expectClean(w);
  });
});
