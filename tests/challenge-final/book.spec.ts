import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { reachMinigame, seedSave, stateOf, waitReady } from '../support/play.ts';
import { check, fillBoard, press, toBoard, waitPuzzlePhase } from '../support/puzzle.ts';
import { puzzleFile, puzzleOf, type Cell } from './helpers.ts';

test.describe.configure({ timeout: 120_000 });

const AT_GEARS = { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'rap-may' };
const AT_END = { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'end' };

/** Asks for the Sổ nguồn from the menu the way a player does; leaves no dialog open. */
async function askNotebook(page: Page): Promise<{ opened: boolean; cards: number; note: boolean }> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-notebook').click();
  await page.waitForTimeout(350);
  const out = await page.evaluate(() => ({
    opened: (document.getElementById('notebook-dialog') as HTMLDialogElement).open,
    cards: document.querySelectorAll('#notebook-list article.card').length,
    note: !document.getElementById('menu-note')?.hidden,
  }));
  for (let i = 0; i < 3 && (await page.locator('dialog[open]').count()) > 0; i += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
  }
  return out;
}

async function fillConclusion(page: Page, info: TestInfo): Promise<void> {
  const file = puzzleFile('ending');
  const c = file.conclusion as NonNullable<typeof file.conclusion>;
  const used = new Set<number>();
  for (const [i, blank] of c.blanks.entries()) {
    const j = c.bank.findIndex((p, k) => p.label === blank.label && !used.has(k));
    used.add(j);
    await press(page.locator('.pz-conclusion').getByRole('button', { name: (c.bank[j] as { text: string }).text, exact: true }), info);
    await press(page.locator('.pz-blank[data-blank="' + i + '"]'), info);
  }
}

const toGears = async (page: Page, info: TestInfo): Promise<void> => {
  await seedSave(page, AT_GEARS);
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info, 'Lan');
};

const CLOSED = { opened: false, note: true };

test('ending: the Sổ nguồn stays shut at the question and on the gear board, also after a reload on the board, and opens at the conclusion, at its verdict and after, also after a reload', async ({ page }, info) => {
  await toGears(page, info);
  expect((await puzzleOf(page)).phase).toBe('predict');
  let book = await askNotebook(page);
  expect({ opened: book.opened, note: book.note }, 'at the question').toEqual(CLOSED);
  await toBoard(page, info);
  const solution = puzzleFile('ending').solutions[0] as Cell[];
  const half = solution.map((cell, i) => (i < 2 ? cell : null));
  await fillBoard(page, info, half);
  book = await askNotebook(page);
  expect({ opened: book.opened, note: book.note }, 'on the board').toEqual(CLOSED);
  await page.reload();
  await waitReady(page);
  await reachMinigame(page, info, 'Lan');
  const back = await puzzleOf(page);
  expect(back.phase, 'the board came back').toBe('board');
  expect(Object.values(back.board ?? {}).flat().length, 'with the pieces').toBeGreaterThan(0);
  book = await askNotebook(page);
  expect({ opened: book.opened, note: book.note }, 'on the board after a reload').toEqual(CLOSED);
  await fillBoard(page, info, solution.map((cell, i) => (i < 2 ? null : cell)));
  await check(page, info);
  await waitPuzzlePhase(page, 'reveal');
  await page.waitForTimeout(300);
  await press(page.locator('.pz-next'), info);
  await waitPuzzlePhase(page, 'conclusion');
  book = await askNotebook(page);
  expect(book.opened, 'at the conclusion').toBe(true);
  expect(book.cards, 'a card per finished chapter').toBeGreaterThan(5);
  await page.reload();
  await waitReady(page);
  await reachMinigame(page, info, 'Lan');
  expect((await puzzleOf(page)).phase).toBe('conclusion');
  book = await askNotebook(page);
  expect(book.opened, 'at the conclusion after a reload').toBe(true);
  await fillConclusion(page, info);
  await check(page, info);
  await waitPuzzlePhase(page, 'verdict');
  book = await askNotebook(page);
  expect(book.opened, 'at the verdict').toBe(true);
  await page.waitForTimeout(300);
  await press(page.locator('.pz-next'), info);
  await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
  book = await askNotebook(page);
  expect(book.opened, 'back in the story').toBe(true);
});

test('ending: a Sổ nguồn opened while the gear board is still loading is not left open over it', async ({ page }, info) => {
  await page.route(/\/assets\/pz-ending-[^/]+\.js$/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4500));
    await route.continue();
  });
  await seedSave(page, AT_GEARS);
  await page.goto('/');
  await waitReady(page);
  let still = 0;
  for (let i = 0; i < 40 && still < 3; i += 1) {
    const s = await stateOf(page);
    if (s.game) break;
    const before = `${s.story?.scene}|${s.story?.beat}`;
    await page.locator('#advance').click({ timeout: 2000 });
    await page.waitForTimeout(260);
    const after = await stateOf(page);
    still = `${after.story?.scene}|${after.story?.beat}` === before ? still + 1 : 0;
  }
  expect((await stateOf(page)).game, 'the board is still loading').toBeNull();
  await page.locator('#menu-open').click();
  await page.locator('#menu-notebook').click();
  await expect(page.locator('#notebook-dialog')).toHaveJSProperty('open', true);
  await expect.poll(async () => (await stateOf(page)).game?.id, { timeout: 15_000 }).toBe('ending');
  const g = await puzzleOf(page);
  expect(g.phase).toBe('predict');
  expect(await page.locator('#notebook-dialog').evaluate((d) => (d as HTMLDialogElement).open), 'the cards are gears now: the Sổ nguồn does not stay open over the gear board').toBe(false);
});

test('the end screen: the Sổ nguồn opens with its cards, again after a reload', async ({ page }) => {
  await seedSave(page, AT_END);
  await page.goto('/');
  await waitReady(page);
  for (const round of [1, 2]) {
    expect((await stateOf(page)).shell.mode, 'round ' + round).toBe('end');
    await page.locator('#end-notebook').click();
    await expect(page.locator('#notebook-dialog')).toHaveJSProperty('open', true);
    expect(await page.locator('#notebook-list article.card').count()).toBeGreaterThan(5);
    await page.keyboard.press('Escape');
    await page.reload();
    await waitReady(page);
  }
});
