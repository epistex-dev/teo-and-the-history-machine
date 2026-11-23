import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

test.describe('Open Graph tags and image (R14)', () => {
  test('the page parsed by a browser has each Open Graph and Twitter tag exactly once, with sane lengths and one host for both images', async ({ page }) => {
    await page.goto('/');
    const tags = await page.evaluate(() =>
      [...document.querySelectorAll('meta[property], meta[name]')].map((m) => ({ key: m.getAttribute('property') ?? m.getAttribute('name') ?? '', content: m.getAttribute('content') ?? '' })),
    );
    const count = (key: string) => tags.filter((t) => t.key === key).length;
    const get = (key: string) => tags.find((t) => t.key === key)?.content ?? '';
    for (const key of ['og:type', 'og:title', 'og:description', 'og:image', 'og:image:alt', 'og:locale', 'og:site_name', 'twitter:card', 'twitter:image', 'description']) {
      expect(count(key), key + ' appears ' + count(key) + ' times').toBe(1);
      expect(get(key).trim(), key + ' is empty').not.toBe('');
    }
    expect(await page.title()).toBe(get('og:title'));
    expect(get('og:title').length).toBeLessThanOrEqual(70);
    expect(get('og:description').length).toBeLessThanOrEqual(200);
    expect(get('description').length).toBeLessThanOrEqual(170);
    expect(get('og:image:alt').length).toBeLessThanOrEqual(420);
    expect(get('og:image:type')).toBe('image/png');
    expect(new URL(get('og:image')).host).toBe(new URL(get('twitter:image')).host);
    expect(new URL(get('og:image')).search, 'the image URL carries no query').toBe('');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('vi');
    for (const t of tags) expect(t.content, t.key + ' holds markup or a stray entity').not.toMatch(/[<>]|&(?!amp;)\w+;/);
  });

  test('the preview image has no alpha holes (messengers paint transparent pixels black), is 1200 x 630, and is served as a PNG that is not sniffed', async ({ request, baseURL }) => {
    const res = await request.get(new URL('/og.png', baseURL).toString());
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    const png = PNG.sync.read(await res.body());
    expect([png.width, png.height]).toEqual([1200, 630]);
    let transparent = 0;
    for (let i = 3; i < png.data.length; i += 4) if (png.data[i]! < 255) transparent += 1;
    expect(transparent, 'pixels that are not fully opaque').toBe(0);
    const colours = new Set<number>();
    for (let i = 0; i < png.data.length; i += 4 * 37) colours.add((png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!);
    expect(colours.size, 'a picture, not a flat colour').toBeGreaterThan(20);
  });

  test('no readable text is printed in the preview image (the description sits in the tags, never in the picture)', async ({ request, baseURL }, info) => {
    let tesseract = true;
    try {
      execFileSync('tesseract', ['--version'], { stdio: 'ignore' });
    } catch {
      tesseract = false;
    }
    test.skip(!tesseract, 'tesseract is not installed');
    const bytes = await (await request.get(new URL('/og.png', baseURL).toString())).body();
    const dir = join(process.env.TMPDIR ?? '/var/tmp', 'Game', 'ch-m2b-og-' + info.project.name);
    mkdirSync(dir, { recursive: true });
    try {
      const file = join(dir, 'og.png');
      writeFileSync(file, bytes);
      const found: string[] = [];
      for (const psm of ['11', '6']) {
        const tsv = execFileSync('tesseract', [file, 'stdout', '-l', 'eng+vie', '--psm', psm, 'tsv'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        for (const row of tsv.split('\n').slice(1)) {
          const cols = row.split('\t');
          const conf = Number(cols[10]);
          const word = (cols[11] ?? '').trim();
          if (conf >= 70 && /\p{L}{3,}/u.test(word)) found.push(word + ' (' + conf + ')');
        }
      }
      expect(found, 'words OCR reads in the picture').toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
