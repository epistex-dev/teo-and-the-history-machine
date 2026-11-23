import { expect, test, type Page } from '@playwright/test';
import { isTouch, seedSave, stateOf, waitReady } from './support/play.ts';
import { domPiece, fillBoard, puzzleFile, puzzleOf, toBoard } from './support/puzzle.ts';
import { openPreview, PREVIEW, PUZZLES, seedStorage, waitGame, waitPhase } from './challenge-final/helpers.ts';

test.describe.configure({ timeout: 90_000 });

for (const id of PUZZLES) {
  test(id + ': the board pieces and the chips carry opaque ids, never the ids of the puzzle file', async ({ page }, info) => {
    await openPreview(page, id, { [PREVIEW(id)]: JSON.stringify({ phase: 'board' }) });
    await waitPhase(page, 'board');
    const file = puzzleFile(id);
    const tokens = file.tokens.map((t) => t.id);
    const read = (): Promise<{ pieces: string[]; keys: string[] }> =>
      page.evaluate(() => ({
        pieces: [...document.querySelectorAll<HTMLElement>('.pz-board [data-piece]')].map((e) => e.dataset.piece ?? ''),
        keys: [...document.querySelectorAll<HTMLElement>('.pz-board [data-fk]')].map((e) => e.dataset.fk ?? ''),
      }));
    const before = await read();
    expect(before.pieces.length, 'every piece is in the bank').toBe(tokens.length);
    expect(new Set(before.pieces).size, 'the ids are distinct').toBe(tokens.length);
    expect(before.pieces.filter((p) => tokens.includes(p)), 'a piece wears the id of its token').toEqual([]);
    expect(before.keys.filter((k) => tokens.some((t) => k === 'piece:' + t || k === 'chip:' + t)), 'a focus key carries a token id').toEqual([]);
    expect([...before.pieces].sort(), 'the page and the test derive the same ids').toEqual(tokens.map((t) => domPiece(id, t)).sort());
    await fillBoard(page, info, file.solutions[0] as never);
    const after = await read();
    expect(after.pieces.filter((p) => tokens.includes(p)), 'a chip wears the id of its token').toEqual([]);
    expect(after.keys.filter((k) => tokens.some((t) => k.endsWith(':' + t))), 'a focus key carries a token id once placed').toEqual([]);
  });
}

const quota = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if ((window as unknown as { __full?: boolean }).__full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      set.call(this, k, v);
    };
  });
};
const full = (page: Page, on: boolean): Promise<void> => page.evaluate((v) => void ((window as unknown as { __full: boolean }).__full = v), on);

test('the warning about progress not being saved hides again once the writes work', async ({ page }) => {
  await quota(page);
  await seedStorage(page, {});
  await page.goto('/?preview=puzzle:dec25');
  await waitGame(page, 'dec25');
  await page.locator('.pz-option').last().click();
  await full(page, true);
  await page.waitForTimeout(300);
  await page.locator('#pz-hint').click();
  await expect(page.locator('#storage-warning')).toBeVisible();
  expect((await stateOf(page)).shell.storage.persistent).toBe(false);
  await full(page, false);
  await page.waitForTimeout(300);
  await page.locator('#pz-hint').click();
  await expect.poll(async () => (await stateOf(page)).shell.storage.persistent).toBe(true);
  await expect(page.locator('#storage-warning'), 'the warning is gone with the fault').toBeHidden();
});

test('the letter screen still lets the player go on when the letter cannot be loaded', async ({ page }) => {
  await page.route(/\/assets\/pz-ending-[^/]+\.js$/u, (route) => route.abort());
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'end' });
  await page.goto('/');
  await waitReady(page);
  for (let i = 0; i < 3 && !(await page.locator('#net-error').isVisible().catch(() => false)); i += 1) {
    await waitReady(page).catch(() => undefined);
    await page.locator('#end-card').click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  await expect(page.locator('#net-error'), 'the second failure of the chunk shows the error').toBeVisible();
  await expect(page.locator('#namecard-hint')).toHaveText('Không đọc được lá thư.');
  await page.evaluate(() => document.getElementById('namecard-next')?.click());
  await expect.poll(async () => (await stateOf(page)).shell.mode, 'Xong leaves the letter screen').toBe('end');
});

test('the tab is hidden while a piece is dragged: no ghost stays, nothing is placed, the next tap works', async ({ page }, info) => {
  test.skip(isTouch(info), 'a mouse drag is a desktop gesture');
  await openPreview(page, 'saturnalia');
  await toBoard(page, info);
  const piece = (await page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('saturnalia', 'r') + '"]').boundingBox())!;
  const slot = (await page.locator('.pz-slot[data-slot="s5"] .pz-slot-btn').boundingBox())!;
  const visibility = (hidden: boolean): Promise<void> =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
  await page.mouse.down();
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 6 });
  expect(await page.locator('.pz-ghost').count(), 'the drag is on').toBe(1);
  await visibility(true);
  expect(await page.locator('.pz-ghost').count(), 'the ghost is gone when the tab hides').toBe(0);
  await visibility(false);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const p = await puzzleOf(page);
  expect(p.board?.s5, 'a drag cut short by hiding drops nothing').toEqual([]);
  expect([p.selected, p.checks, p.wrongTotal]).toEqual([null, 0, 0]);
  await page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('saturnalia', 'r') + '"]').click();
  await page.locator('.pz-slot[data-slot="s5"] .pz-slot-btn').click();
  expect((await puzzleOf(page)).board?.s5, 'the next tap works').toEqual(['r']);
});
