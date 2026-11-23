import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import { chapters } from '../scripts/chapters-plugin.ts';
import { advanceStory, reachMinigame, seedSave, stateOf, waitReady, walkToChapterEnd, realInput } from './support/play.ts';
import { ORDER, indexOf } from '../src/order.ts';
import { chapterOf } from './support/script.ts';

const NEXT_BG = /\/assets\/bg-ch2-feast-(portrait|landscape)-[^/]+\.webp$/;
const NEXT_CHUNK = /\/assets\/chapter-saturnalia-[^/]+\.js$/;

const requested = (page: Page): string[] => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(new URL(request.url()).pathname));
  return urls;
};

test.describe('next chapter preload (SPEC R10)', () => {
  test('the next chapter script and its backdrops in the orientation in use are fetched while the puzzle is open, before Lật trang', async ({ page }, info) => {
    const urls = requested(page);
    await seedSave(page);
    await page.goto('/');
    await waitReady(page);
    await reachMinigame(page, info);
    expect((await stateOf(page)).game).not.toBeNull();
    await expect.poll(() => urls.some((u) => NEXT_CHUNK.test(u)), { message: 'chapter-saturnalia chunk requested during the puzzle' }).toBe(true);
    await expect.poll(() => urls.some((u) => NEXT_BG.test(u)), { message: 'saturnalia backdrop requested during the puzzle' }).toBe(true);
    const size = page.viewportSize()!;
    const used = size.width > size.height ? 'landscape' : 'portrait';
    const other = used === 'landscape' ? 'portrait' : 'landscape';
    expect(urls.filter((u) => NEXT_BG.test(u)).every((u) => u.includes(`-${used}-`))).toBe(true);
    expect(urls.some((u) => u.includes(`bg-ch2-feast-${other}`))).toBe(false);
  });

  test('the chapter change runs on what the preload fetched: with the chunk and the backdrops cut off after it, Lật trang still enters the chapter', async ({ page }, info) => {
    const urls = requested(page);
    await seedSave(page);
    await page.goto('/');
    await waitReady(page);
    await reachMinigame(page, info);
    await expect.poll(() => urls.some((u) => NEXT_BG.test(u)) && urls.some((u) => NEXT_CHUNK.test(u))).toBe(true);
    await page.waitForTimeout(500);
    await page.route(NEXT_BG, (route) => route.abort());
    await page.route('**/assets/chapter-saturnalia-*.js', (route) => route.abort());
    await walkToChapterEnd(page, info, realInput(info));
    expect((await stateOf(page)).shell.mode).toBe('story');
    expect((await stateOf(page)).story?.chapter).toBe('saturnalia');
  });
});

const afterPuzzle = (id: string): string => {
  const scenes = chapterOf(id).scenes;
  return scenes[scenes.findIndex((s) => s.beats.some((b) => b.t === 'minigame')) + 1]!.id;
};
const resumeAt = (chapter: string, scene = afterPuzzle(chapter)) => ({ schemaVersion: 1, name: 'Lan', furthest: chapter, chapter, scene });
const chunksOf = (urls: string[]): string[] => urls.filter((u) => /\/assets\/chapter-[^/]+\.js$/.test(u));

test.describe('next chapter preload: edges', () => {
  for (const [from, layer] of [['mistletoe', 'manger-lamp'], ['dec25', 'window-shadow']] as const) {
    test(`the scenery layer ${layer} is fetched with the preload of its chapter, before it is shown`, async ({ page }) => {
      const urls = requested(page);
      await seedSave(page, resumeAt(from));
      await page.goto('/');
      await waitReady(page);
      await expect.poll(() => urls.some((u) => new RegExp(`/assets/prop-${layer}-[^/]+\\.webp$`).test(u))).toBe(true);
    });
  }

  test('reloading into the scene after the puzzle runs the preload again', async ({ page }) => {
    const urls = requested(page);
    await seedSave(page, resumeAt('bethlehem'));
    await page.goto('/');
    await waitReady(page);
    await expect.poll(() => urls.filter((u) => /chapter-dec25-/.test(u)).length).toBe(1);
    await page.reload();
    await waitReady(page);
    await expect.poll(() => urls.filter((u) => /chapter-dec25-/.test(u)).length).toBe(2);
  });

  test('the last chapter fetches no other chapter', async ({ page }) => {
    const urls = requested(page);
    await seedSave(page, resumeAt('ending', 'dong-thoi-gian'));
    await page.goto('/');
    await waitReady(page);
    await page.waitForTimeout(3000);
    expect(chunksOf(urls)).toEqual([expect.stringContaining('chapter-ending-')]);
  });

  test('Lật trang while the preload is held and then fails: the failure ends in a reload or the network message, not a silent loading screen', async ({ page }, info) => {
    const held: Route[] = [];
    await page.route('**/assets/chapter-dec25-*.js', (route) => void held.push(route));
    let loads = 0;
    page.on('domcontentloaded', () => (loads += 1));
    await seedSave(page, resumeAt('bethlehem'));
    await page.goto('/');
    await waitReady(page);
    await expect.poll(() => held.length).toBeGreaterThan(0);
    for (let i = 0; i < 80 && (await stateOf(page)).shell.mode !== 'card'; i += 1) await advanceStory(page, info);
    await expect.poll(() => page.locator('#card-slot').evaluate((el) => el.childElementCount > 0)).toBe(true);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('loading');
    for (const route of held.splice(0)) await route.abort('connectionreset').catch(() => undefined);
    await expect
      .poll(async () => loads > 1 || (await page.locator('#net-error').isVisible().catch(() => false)), { timeout: 12_000, message: 'silent loading screen' })
      .toBe(true);
  });
});

test.describe('@bg ids at build time', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  const transform = (md: string, name: string, bakedDir?: string): unknown => {
    const plugin = chapters(bakedDir);
    const context = {
      error: (message: string): never => {
        throw new Error(message);
      },
    };
    return (plugin.transform as (this: typeof context, code: string, id: string) => unknown).call(context, md, `/story/chapters/${name}.md?chapter`);
  };

  test('every chapter script names only backdrops that stage-data.json has', () => {
    for (const file of readdirSync('story/chapters')) {
      const name = file.replace(/\.md$/, '');
      expect(() => transform(readFileSync(`story/chapters/${file}`, 'utf8'), name), file).not.toThrow();
    }
  });

  test('a chapter with an unknown @bg fails the build instead of falling back to a flat colour', () => {
    const md = '---\nid: t\ntitle: T\n---\n\n## a\n@bg khong-co-phong-nay\n> Một dòng.\n';
    expect(() => transform(md, 't')).toThrow(/khong-co-phong-nay/);
  });
  test('a chapter with an unknown @prop fails the build instead of dropping the prop', () => {
    const md = '---\nid: t\ntitle: T\n---\n\n## a\n@prop manger-lampp\n> Một dòng.\n';
    expect(() => transform(md, 't')).toThrow(/manger-lampp/);
  });

  test('a stale or missing bake fails with a message that names the fix, not a TypeError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stale-bake-'));
    try {
      const real = JSON.parse(readFileSync('art/baked/manifest.json', 'utf8')) as { geometry: { props: Record<string, unknown> } };
      const md = readFileSync('story/chapters/bethlehem.md', 'utf8');
      expect(() => transform(md, 'bethlehem', dir)).toThrow(/manifest\.json is missing.*npm run bake/);
      real.geometry.props = {};
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(real));
      expect(() => transform(md, 'bethlehem', dir)).toThrow(/no frame for prop manger-lamp.*npm run bake/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
