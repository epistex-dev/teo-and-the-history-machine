import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { awaitsSource } from './support/size-limit.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const bin = (name: string) => join(root, 'node_modules/.bin', name);

test.describe('build gates and deploy guard', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'static checks, run once');
  });

  test('size, test and deploy always build first, and deploy measures before it uploads', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    expect(scripts.presize).toBe('npm run build');
    expect(scripts.pretest).toBe('npm run build');
    const deploy = scripts['deploy:staging'] ?? '';
    const order = [deploy.indexOf('guard:staging'), deploy.indexOf('npm run size'), deploy.indexOf('npm run measure'), deploy.search(/wrangler pages\s+deploy/)];
    expect(order.every((i) => i >= 0), deploy).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(deploy).not.toContain('commit-dirty');
  });

  test('npm test checks story/minigames.json before the browser tests', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    expect(scripts.test).toMatch(/^node scripts\/check-minigames\.mjs && playwright test/);
    const run = spawnSync('node', ['scripts/check-minigames.mjs'], { cwd: root, encoding: 'utf8' });
    expect(run.status, run.stdout + run.stderr).toBe(0);
  });

  test('size-limit has a first-load entry and a per-chunk entry of at most 150 kB, neither a catch-all glob', () => {
    const entries = JSON.parse(read('.size-limit.json')) as { name: string; path: string | string[]; limit: string }[];
    const first = entries.find((e) => /first load/i.test(e.name));
    const chunk = entries.find((e) => /chunk/i.test(e.name));
    expect(first, 'first-load entry').toBeTruthy();
    expect(chunk, 'per-chunk entry').toBeTruthy();
    expect(parseFloat(first?.limit ?? '9999')).toBeLessThanOrEqual(600);
    expect(parseFloat(chunk?.limit ?? '9999')).toBeLessThanOrEqual(150);
    for (const entry of entries) expect([entry.path].flat(), entry.name).not.toContain('dist/assets/*.js');
    const results = JSON.parse(execFileSync(bin('size-limit'), ['--json', '--ignore-missing'], { cwd: root, encoding: 'utf8' })) as { name: string; passed: boolean; size: number }[];
    const measured = entries.filter((e) => ![e.path].flat().every(awaitsSource));
    expect(results.map((r) => r.name)).toEqual(measured.map((e) => e.name));
    expect(results.map((r) => r.passed)).toEqual(measured.map(() => true));
  });

  test('measure asserts the 1 MB first-load budget instead of only printing it', () => {
    const ok = spawnSync('node', ['tests/support/measure-dist.mjs'], { cwd: root, encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    const summary = JSON.parse(ok.stdout.trim().split('\n').pop() ?? '{}') as { firstLoadGzipKB: number; firstLoadFiles: string[] };
    expect(summary.firstLoadGzipKB, 'shell, chapter 1 art and fonts, measured from a real page load').toBeGreaterThan(100);
    expect(summary.firstLoadGzipKB).toBeLessThanOrEqual(1000);
    expect(summary.firstLoadFiles.some((f) => /assets\/chapter-intro-/.test(f)), 'chapter 1 script chunk in the first load').toBe(true);
    expect(summary.firstLoadFiles.filter((f) => /assets\/(intro|pz-[^/]*|puzzle|chapter-(?!intro-))[^/]*\.js$/.test(f)), 'the puzzle, its player and later chapters wait for the first tap').toEqual([]);
    const over = spawnSync('node', ['tests/support/measure-dist.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, FIRST_LOAD_MAX_BYTES: '1000' } });
    expect(over.status).not.toBe(0);
  });

  test.describe('guard:staging with a fake wrangler', () => {
    const base = process.env.TMPDIR ?? '/var/tmp';
    const work = join(base, 'Game');
    let fake = '';
    let tmp = '';

    test.beforeAll(() => {
      mkdirSync(work, { recursive: true });
      tmp = mkdtempSync(join(work, 'guard-'));
      fake = join(tmp, 'wrangler');
      const source = [
        '#!/usr/bin/env node',
        'const args = process.argv.slice(2).join(" ");',
        'if (process.env.FAKE_FAIL) { console.error("not logged in"); process.exit(1); }',
        'const out = args.startsWith("pages project list") ? process.env.FAKE_PROJECTS : process.env.FAKE_DEPLOYMENTS;',
        'console.log(out);',
        '',
      ].join('\n');
      writeFileSync(fake, source);
      chmodSync(fake, 0o755);
    });
    test.afterAll(() => rmSync(tmp, { recursive: true, force: true }));

    const project = JSON.stringify([{ 'Project Name': 'teo-co-may-lich-su' }]);
    const deployments = (...rows: [string, string][]) => JSON.stringify(rows.map(([Environment, Branch]) => ({ Environment, Branch })));
    const guard = (env: Record<string, string>) =>
      spawnSync('node', ['scripts/guard-staging.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, WRANGLER_BIN: fake, ...env } });

    test('passes when branch staging is a preview deployment', () => {
      const run = guard({ FAKE_PROJECTS: project, FAKE_DEPLOYMENTS: deployments(['Preview', 'staging'], ['Production', 'main']) });
      expect(run.status, run.stderr).toBe(0);
    });

    test('passes for a fresh branch when another branch is the production one', () => {
      const run = guard({ FAKE_PROJECTS: project, FAKE_DEPLOYMENTS: deployments(['Production', 'main']) });
      expect(run.status, run.stderr).toBe(0);
    });

    test('aborts when the staging branch deploys to the live environment', () => {
      const run = guard({ FAKE_PROJECTS: project, FAKE_DEPLOYMENTS: deployments(['Production', 'staging']) });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain('staging');
    });

    test('aborts when nothing proves staging is a preview branch', () => {
      expect(guard({ FAKE_PROJECTS: project, FAKE_DEPLOYMENTS: '[]' }).status).not.toBe(0);
      expect(guard({ FAKE_PROJECTS: project, FAKE_DEPLOYMENTS: deployments(['Preview', 'feature']) }).status).not.toBe(0);
    });

    test('aborts when the project does not exist yet', () => {
      const run = guard({ FAKE_PROJECTS: '[]', FAKE_DEPLOYMENTS: deployments(['Preview', 'staging']) });
      expect(run.status).not.toBe(0);
    });

    test('aborts when wrangler fails or prints something else than JSON', () => {
      expect(guard({ FAKE_FAIL: '1', FAKE_PROJECTS: project, FAKE_DEPLOYMENTS: '[]' }).status).not.toBe(0);
      expect(guard({ FAKE_PROJECTS: 'oops', FAKE_DEPLOYMENTS: '[]' }).status).not.toBe(0);
    });
  });
});
