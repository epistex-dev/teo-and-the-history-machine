import { expect, test } from '@playwright/test';
import { advanceStory, seedSave, stateOf, typeName, waitReady } from './support/play.ts';
import { solvePuzzle } from './support/puzzle.ts';

const SIZES = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 640, height: 360 },
  { width: 375, height: 667 },
  { width: 320, height: 568 },
  { width: 390, height: 844 },
];

test.describe('the Sổ nguồn card screen: the card reads as one sheet, its text keeps a height, Lật trang and Xem đủ stay in reach', () => {
  for (const size of SIZES) {
    // nicholas ends the act, so its card carries the continue-code box; the others are plain cards
    for (const chapter of ['bethlehem', 'nicholas', 'mistletoe', 'dec25', 'yule']) {
      test(`${chapter} at ${size.width}x${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: chapter, chapter, scene: '' });
        await page.goto(`/?preview=card:${chapter}`);
        await waitReady(page);
        const card = page.locator('#card-slot .card'), screen = page.locator('#card-screen'), button = page.locator('#card-next'), more = page.locator('#card-slot summary');
        await expect(card).toBeVisible();
        const rect = async (l: typeof card) => (await l.boundingBox())!;
        const overlap = (a: { y: number; height: number }, b: { y: number; height: number }): number => Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

        // the card text keeps a readable height at first view, code box or not
        const first = overlap(await rect(card), await rect(screen));
        expect(first, `visible card height at first view (viewport ${size.height})`).toBeGreaterThanOrEqual(0.4 * size.height);

        // one sheet: nothing of the card sticks out below its paper, whatever the scroll
        const paper = await card.evaluate((el) => { const b = el.getBoundingClientRect(); return [...el.children].map((c) => c.getBoundingClientRect().bottom - b.bottom); });
        for (const d of paper) expect(d, 'a card child below the card frame').toBeLessThanOrEqual(1);

        if (size.width > size.height && size.height <= 520) {
          const bar = (await page.locator('.bar-actions').boundingBox())!, c = await rect(card);
          expect(c.x + c.width, 'card clear of the THOẠI/MENU bar').toBeLessThanOrEqual(bar.x);
        }

        // Xem đủ is tappable for real (the click fails when another element covers it), then folds away again
        await more.scrollIntoViewIfNeeded();
        const m = await rect(more), b = await rect(button), s = await rect(screen);
        expect(overlap(m, b) === 0 || overlap(m, s) === 0 || m.y >= b.y + b.height || m.y + m.height <= b.y, 'Xem đủ under Lật trang').toBe(true);
        await more.click();
        await expect(page.locator('#card-slot details')).toHaveAttribute('open', '');
        await more.click();

        // Lật trang: reachable by scrolling, whole on screen, tappable, at least 44 px high
        await screen.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const end = await rect(button);
        expect(end.y, 'top edge').toBeGreaterThanOrEqual(0);
        expect(end.y + end.height, 'bottom edge inside the viewport at the end of the scroll').toBeLessThanOrEqual(size.height);
        expect(end.height, 'touch target').toBeGreaterThanOrEqual(44);
        await button.click({ trial: true });

        // when the card continues below the fold the screen shows it: the bottom edge fades
        await screen.evaluate((el) => el.scrollTo(0, 0));
        const cue = await screen.evaluate((el) => ({ scrolls: el.scrollHeight > el.clientHeight + 1, mask: getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage }));
        if (cue.scrolls) expect(cue.mask, 'fade cue at the bottom edge of a card that continues').not.toBe('none');
      });
    }
  }
});

test('a card opens at its top after the previous card was scrolled to its end', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: '' });
  await page.goto('/');
  await waitReady(page);
  const cards: string[] = [];
  for (let i = 0; i < 200 && cards.length < 2; i += 1) {
    const st = await stateOf(page);
    if (st.shell.mode === 'card') {
      await expect(page.locator('#card-slot .card')).toBeVisible();
      const screen = page.locator('#card-screen');
      if (cards.length === 1) {
        expect(await screen.evaluate((el) => el.scrollTop), 'second card opens scrolled to the top').toBe(0);
        cards.push('second');
        break;
      }
      expect(await screen.evaluate((el) => el.scrollHeight > el.clientHeight + 50), 'the first card scrolls at this size').toBe(true);
      await screen.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      expect(await screen.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
      cards.push('first');
      await page.locator('#card-next').click();
    } else if (st.game) await solvePuzzle(page, info);
    else if (st.story?.asking) await typeName(page, 'Lan');
    else if (st.shell.mode === 'story') await advanceStory(page, info);
    else await page.waitForTimeout(50);
  }
  expect(cards).toEqual(['first', 'second']);
});
