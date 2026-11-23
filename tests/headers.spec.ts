import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

function parse(text: string): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>();
  let current: Record<string, string> | null = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = {};
      rules.set(line.trim(), current);
    } else if (current) {
      const i = line.indexOf(':');
      current[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

test.describe('_headers and hosting', () => {
  test.beforeEach(({ baseURL }, info) => {
    test.skip(!baseURL || info.project.name !== 'desktop-chromium', 'HTTP-level checks run once');
  });
  const rules = parse(readFileSync('public/_headers', 'utf8'));

  test('page and asset headers match public/_headers; HTML has no foreign script', async ({ request }) => {
    const page = await request.get('/');
    expect(page.status()).toBe(200);
    const html = await page.text();
    for (const [name, value] of Object.entries(rules.get('/*')!)) {
      expect(page.headers()[name], `/ ${name}`).toBe(value);
    }
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag, 'script tag').toMatch(/src="\/assets\/[^"]+"/);
    expect(html).not.toMatch(/cloudflareinsights|beacon\.min|static\.cloudflare/i);
    expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>\s*\S/);

    const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)![1]!;
    const res = await request.get(asset);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/);
    for (const [name, value] of Object.entries(rules.get('/assets/*')!)) {
      expect(res.headers()[name], `${asset} ${name}`).toBe(value);
    }
    expect(res.headers()['content-security-policy']).toContain("script-src 'self'");
  });

  test('a missing chunk is a real 404, not index.html', async ({ request }) => {
    const res = await request.get('/assets/intro-DOESNOTEXIST.js');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type'] ?? '').not.toMatch(/javascript/);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });
});
