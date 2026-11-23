import { expect, test } from '@playwright/test';
import { cleanName, NAME_MAX, NAME_MAX_MARKS, NAME_MAX_UNITS } from '../src/save.ts';
import { expectClean, open, openStory, state, step, tap, watch, waitReady } from './challenge/helpers.ts';
import { puzzleOf } from './support/puzzle.ts';
import { advanceStory, realInput, seedSave, solveMinigame, storedSave, storyOf, storyPoint, typeName } from './support/play.ts';
import { intro, lineAfterMinigame, lineOf, nameLine } from './support/script.ts';

test.describe.configure({ timeout: 90_000 });

const lineIndex = async (page: import('@playwright/test').Page): Promise<number> => (await storyOf(page)).lineIndex ?? -1;

const lineBeforeMinigame = (name: string): string => {
  for (const scene of intro.scenes) {
    const at = scene.beats.findIndex((b) => b.t === 'minigame');
    if (at < 0) continue;
    for (const beat of scene.beats.slice(0, at).reverse()) {
      const text = lineOf(beat, name);
      if (text !== null) return text;
    }
  }
  throw new Error('no line before the mini game');
};

test.describe('M2 round 1: story flow', () => {
  test('taps while the puzzle chunk is still loading do not run the story past the @minigame beat', async ({ page }, info) => {
    let release!: () => void;
    const gate = new Promise<void>((done) => (release = done));
    await page.route('**/assets/puzzle-*.js', async (route) => {
      await gate;
      await route.continue().catch(() => undefined);
    });
    await seedSave(page);
    await page.goto('/');
    await waitReady(page);
    for (let i = 0; i < 8 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
    await typeName(page, 'Lan');
    const p = await storyPoint(page);
    for (let i = 0; i < 16; i += 1) {
      await tap(page, info, p.x, p.y);
      await page.waitForTimeout(260);
    }
    expect((await storyOf(page)).line?.text, 'the story ran on while the mini game was loading').toBe(lineBeforeMinigame('Lan'));
    release();
    await expect.poll(async () => (await state(page)).game !== null, { timeout: 15_000 }).toBe(true);
    expect((await storyOf(page)).line?.text).toBe(lineBeforeMinigame('Lan'));
    await solveMinigame(page, realInput(info));
    expect((await storyOf(page)).line?.text, 'the first line after the game').toBe(lineAfterMinigame(intro, 'Lan').text);
  });

  test('holding Enter on the focused Lật trang button advances one line however long it is held', async ({ page }) => {
    await openStory(page);
    await page.waitForTimeout(300);
    await page.locator('#advance').focus();
    const start = await lineIndex(page);
    await page.keyboard.down('Enter');
    for (let i = 0; i < 7; i += 1) {
      await page.waitForTimeout(260);
      await page.keyboard.down('Enter');
    }
    await page.keyboard.up('Enter');
    await page.waitForTimeout(300);
    expect(await lineIndex(page), 'every key repeat clicked the button').toBe(start + 1);
  });
});

test.describe('M2 round 1: save from a newer build', () => {
  const newer = JSON.stringify({ schemaVersion: 2, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: 'sau-nay', extra: 'new-format-field' });

  test('it stays byte for byte, the player is told, and the story plays from memory, including a new game', async ({ page }, info) => {
    const w = watch(page);
    await seedSave(page, newer);
    await page.goto('/');
    await waitReady(page);
    const notice = page.locator('#save-newer');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText('Bản lưu đến từ phiên bản mới hơn — tải lại trang để cập nhật');
    expect((await state(page)).shell.storage).toMatchObject({ newerSave: true, warning: false });
    for (let i = 0; i < 20 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
    await typeName(page, 'Hạnh');
    await expect.poll(async () => (await storyOf(page)).line?.text ?? '').toContain(nameLine(intro, 'Hạnh'));
    expect((await state(page)).shell.save).toMatchObject({ name: 'Hạnh', chapter: 'intro' });
    expect(await storedSave(page), 'the newer save was written over').toBe(newer);
    await page.reload();
    await waitReady(page);
    await expect(notice).toBeVisible();
    expect(await storedSave(page)).toBe(newer);
    expect((await storyOf(page)).scene, 'a newer save is not played by this build').toBe('phong-ho-so');
    expectClean(w);
  });
});

test.describe('M2 round 1: chunk failure after a pagehide that did not unload', () => {
  test('a bfcache style pagehide without pageshow does not swallow the next chunk failure: one reload, then the story', async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener('pageshow', () => setTimeout(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })), 0));
    });
    const w = watch(page, { allowStatuses: [404], ignoreErrors: /Failed to load resource|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i });
    let hits = 0;
    await page.route('**/assets/chapter-intro-*.js', async (route) => {
      hits += 1;
      if (hits > 1) return route.continue();
      await new Promise((done) => setTimeout(done, 1000));
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
    });
    await page.goto('/');
    await waitReady(page);
    expect(w.loads(), 'the original document and one reload').toBe(2);
    await expect(page.locator('#net-error')).toBeHidden();
    expect(w.errors).toEqual([]);
  });
});

test.describe('M2 round 1: the puzzle never helps on its own clock', () => {
  test('a tap on the page at 15 s and 21 s more of stillness: no hint opens, no wrong move is counted', async ({ page }, info) => {
    await open(page, '?manual=1');
    await step(page, 15_000);
    const box = await page.locator('.pz').boundingBox();
    await tap(page, info, (box?.x ?? 0) + 4, (box?.y ?? 0) + 4);
    await step(page, 21_000);
    const g = await puzzleOf(page);
    expect(g.wrongTotal, 'a tap on the paper is not a wrong move').toBe(0);
    expect(g.hints, 'no hint opened on idle').toBe(0);
    expect(g.hint).toBe('');
  });
});

test.describe('M2 round 1: names', () => {
  test('a name that is 5000 combining marks is cut, so the next load still resumes the saved scene', async ({ page }, info) => {
    await seedSave(page);
    await page.goto('/');
    await waitReady(page);
    for (let i = 0; i < 8 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
    await page.locator('#name').fill('a' + '\u0301'.repeat(5000));
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    const name = (await state(page)).shell.save.name;
    expect(name.length).toBeLessThanOrEqual(NAME_MAX_UNITS);
    expect((await storedSave(page))?.length ?? 0).toBeLessThan(400);
    await page.reload();
    await waitReady(page);
    expect((await storyOf(page)).scene, 'the save was unreadable after the reload').toBe('hoi-ten');
    expect((await state(page)).shell.save.name).toBe(name);
  });
});

test.describe('cleanName', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });
  const graphemes = (s: string): string[] => Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  const marks = (s: string): number => (s.match(/\p{M}/gu) ?? []).length;

  test('keeps at most 24 grapheme clusters, 64 UTF-16 units and 2 combining marks per cluster', () => {
    for (const input of ['a' + '\u0301'.repeat(5000), 'x\u0323\u0302\u0301\u0300', '🇻🇳'.repeat(30), '🎅'.repeat(40), 'W'.repeat(100), ('e' + '\u0301'.repeat(9)).repeat(30)]) {
      const name = cleanName(input);
      expect(graphemes(name).length, input.slice(0, 6)).toBeLessThanOrEqual(NAME_MAX);
      expect(name.length, input.slice(0, 6)).toBeLessThanOrEqual(NAME_MAX_UNITS);
      for (const g of graphemes(name)) expect(marks(g)).toBeLessThanOrEqual(NAME_MAX_MARKS);
    }
  });

  test('a cluster is cut whole: flags never end in half', () => {
    const name = cleanName('🇻🇳'.repeat(30));
    expect([...name].length % 2).toBe(0);
    expect(name).toBe('🇻🇳'.repeat(16));
  });

  test('Vietnamese names with the most marks they need are kept as typed', () => {
    for (const name of ['Nguyễn Thị Ánh Tuyết', 'Trần Quốc Việt', 'Ặ Ẫ Ộ Ử Ữ Ệ þ ð ý', 'x\u0323\u0302']) expect(cleanName(name)).toBe(name.normalize('NFC'));
    expect(cleanName('Te\u0300o'.repeat(3))).toBe('Tèo'.repeat(3));
  });

  test('NFC runs after the invisible characters are removed', () => {
    const name = cleanName('e\u200d\u0300x');
    expect(name).toBe('èx');
    expect(name).toBe(name.normalize('NFC'));
  });
});
