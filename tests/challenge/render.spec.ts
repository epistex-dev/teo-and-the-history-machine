import { expect, test } from '@playwright/test';
import { expectClean, freshContext, open, openStory, setHidden, state, typeName, waitReady, watch } from './helpers.ts';
import { advanceStory, seedSave } from '../support/play.ts';
import { puzzleOf } from '../support/puzzle.ts';
import { intro, nameLine } from '../support/script.ts';

test.describe.configure({ timeout: 150_000 });

const overflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({
    sw: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));

test.describe('rendering (the puzzle is DOM: nothing to upload, nothing can turn black)', () => {
  for (const dpr of [1, 2, 3]) {
    test(`dpr=${dpr}: the puzzle is DOM only, readable ink on paper, no overflow`, async ({ browser }, info) => {
      const context = await freshContext(browser, info, { deviceScaleFactor: dpr });
      try {
        const page = await context.newPage();
        const w = watch(page);
        await open(page);
        expect((await state(page)).shell.viewport.dpr).toBe(dpr);
        expect((await puzzleOf(page)).kind).toBe('puzzle');
        expect(await page.locator('canvas').count(), 'no canvas anywhere').toBe(0);
        const o = await overflow(page);
        expect(o.sw).toBeLessThanOrEqual(0);
        expect(o.sh).toBeLessThanOrEqual(0);
        const ink = await page.locator('.pz').evaluate((el) => {
          const c = getComputedStyle(el);
          return { color: c.color, bg: getComputedStyle(document.body).backgroundColor };
        });
        expect(ink.color, 'text colour is not the background colour').not.toBe(ink.bg);
        expectClean(w);
      } finally {
        await context.close();
      }
    });
  }

  test('rotate to landscape and back, and hide/show: the puzzle stays on screen without overflow', async ({ page }) => {
    await open(page);
    const vp = page.viewportSize() ?? { width: 390, height: 664 };
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForTimeout(400);
    expect((await overflow(page)).sw).toBeLessThanOrEqual(0);
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
    expect((await overflow(page)).sw).toBeLessThanOrEqual(0);
    await setHidden(page, true);
    await page.waitForTimeout(200);
    await setHidden(page, false);
    await expect(page.locator('.pz')).toBeVisible();
  });

  for (const name of ['Tiếng Việt có dấu', 'Ặ Ẫ Ộ Ử Ữ Ệ þ ð ý']) {
    test(`Vietnamese text "${name}" reaches the dialogue exactly and fits inside the box and the viewport`, async ({ page }, info) => {
      await seedSave(page);
      await page.goto('/');
      await waitReady(page);
      for (let i = 0; i < 40 && !(await state(page)).story?.asking; i += 1) await advanceStory(page, info);
      expect((await state(page)).story?.asking).toBe(true);
      await typeName(page, name);
      const expected = nameLine(intro, name);
      await expect.poll(async () => (await state(page)).story?.line?.text).toBe(expected);
      expect((await state(page)).shell.save.name).toBe(name);
      const box = await page.evaluate(() => {
        const line = document.getElementById('line') as HTMLElement;
        const dialog = document.querySelector('.dialogue') as HTMLElement;
        const r = line.getBoundingClientRect();
        const d = dialog.getBoundingClientRect();
        return { text: line.textContent, fits: line.scrollHeight <= line.clientHeight + 1, line: { bottom: r.bottom, left: r.left, right: r.right }, dialog: { bottom: d.bottom, left: d.left, right: d.right }, vh: innerHeight, vw: innerWidth };
      });
      expect(box.text, 'the DOM shows the same text').toBe(expected);
      expect(box.fits, 'no clipped line').toBe(true);
      expect(box.line.left).toBeGreaterThanOrEqual(box.dialog.left);
      expect(box.line.right).toBeLessThanOrEqual(box.dialog.right + 1);
      expect(box.line.bottom).toBeLessThanOrEqual(box.dialog.bottom);
      expect(box.dialog.bottom).toBeLessThanOrEqual(box.vh + 1);
      expect(box.dialog.right).toBeLessThanOrEqual(box.vw + 1);
    });
  }

  test('the story is DOM only, no canvas, no scrollbars, no page overflow', async ({ page }) => {
    await openStory(page);
    expect(await page.locator('canvas').count(), 'the story is DOM only').toBe(0);
    const story = await overflow(page);
    expect(story.sw).toBeLessThanOrEqual(0);
    expect(story.sh).toBeLessThanOrEqual(0);
  });
});
