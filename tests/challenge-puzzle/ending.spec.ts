import { expect, test, type Page } from '@playwright/test';
import { check, fillBoard, press, waitPuzzlePhase } from '../support/puzzle.ts';
import { clearBlanks, cool, domClick, openPuzzle, openSeeded, pickPiece, puzzleFile, puzzleOf, rng, waitGame, type Cell } from './helpers.ts';

const file = puzzleFile('ending');
const C = file.conclusion as NonNullable<typeof file.conclusion>;
const OK = [0, 1, 2, 3, 4, 6];

const fillBlanks = async (page: Page, pieces: (number | null)[]): Promise<void> => {
  for (const [i, j] of pieces.entries()) {
    if (j === null) continue;
    await pickPiece(page, j);
    await domClick(page, '.pz-blank[data-blank="' + i + '"]');
  }
};
const check1 = async (page: Page): Promise<void> => {
  await cool(page);
  await domClick(page, '#pz-check');
};
const conclusion = (page: Page): Promise<void> => openSeeded(page, 'ending', { phase: 'conclusion' });

test.describe('the conclusion step', () => {
  test('the bank has more pieces than blanks and a decoy that carries no label of any blank', async ({ page }) => {
    await conclusion(page);
    expect(await page.locator('.pz-blank').count()).toBe(C.blanks.length);
    expect(await page.locator('.pz-piece').count()).toBe(C.bank.length);
    expect(C.bank.length).toBeGreaterThan(C.blanks.length);
    expect(C.bank.filter((p) => !C.blanks.some((b) => b.label === p.label)).map((p) => p.label)).toEqual(['CHƯA CÓ NGUỒN']);
  });

  test('a right piece for every blank solves it; two pieces of one label swapped solve it too', async ({ page }) => {
    await conclusion(page);
    await fillBlanks(page, [1, 0, 3, 2, 6, 4]);
    await check1(page);
    await waitPuzzlePhase(page, 'verdict');
  });

  for (const blank of [0, 1, 2, 3, 4, 5]) {
    test('the decoy in blank ' + (blank + 1) + ' with every other blank right never solves', async ({ page }) => {
      await conclusion(page);
      const pieces: (number | null)[] = [...OK];
      pieces[blank] = 5;
      await fillBlanks(page, pieces);
      await check1(page);
      const p = await puzzleOf(page);
      expect(p.phase).toBe('conclusion');
      expect(p.verdict).toBe('Chưa khớp.');
    });
  }

  test('a piece of the wrong kind in the wrong group, or every group rotated, never solves', async ({ page }) => {
    await conclusion(page);
    for (const pieces of [[4, 1, 2, 3, 0, 6], [2, 3, 4, 6, 0, 1], [0, 1, 4, 6, 2, 3], [6, 4, 3, 2, 1, 0]]) {
      await fillBlanks(page, pieces);
      await check1(page);
      expect((await puzzleOf(page)).phase, pieces.join(',')).toBe('conclusion');
      await clearBlanks(page);
    }
  });

  test('30 seeded random fills solve exactly when each blank holds a distinct piece of its label', async ({ page }) => {
    await conclusion(page);
    const rand = rng(4242);
    for (let t = 0; t < 30; t += 1) {
      const bag = [0, 1, 2, 3, 4, 5, 6];
      const pieces: (number | null)[] = C.blanks.map(() => bag.splice(Math.floor(rand() * bag.length), 1)[0] ?? null);
      const expected = pieces.every((j, i) => j !== null && C.bank[j]?.label === C.blanks[i]?.label);
      await clearBlanks(page);
      await fillBlanks(page, pieces);
      await check1(page);
      const p = await puzzleOf(page);
      expect(p.phase === 'verdict', pieces.join(',')).toBe(expected);
      if (expected) return;
    }
  });

  test('a piece lives in one blank: tapping a filled blank lifts it and the next blank takes it', async ({ page }) => {
    await conclusion(page);
    await fillBlanks(page, [0]);
    await domClick(page, '.pz-blank[data-blank="0"]');
    let p = await puzzleOf(page);
    expect([p.conclusion?.selected, p.conclusion?.filled[0]]).toEqual([0, null]);
    await domClick(page, '.pz-blank[data-blank="3"]');
    p = await puzzleOf(page);
    expect(p.conclusion?.filled.filter(Boolean)).toEqual([C.bank[0]?.text]);
    expect(p.conclusion?.filled[3]).toBe(C.bank[0]?.text);
  });

  test('checking with k blanks filled says how many are missing and counts nothing wrong', async ({ page }) => {
    await conclusion(page);
    for (let k = 0; k < 6; k += 1) {
      await check1(page);
      const p = await puzzleOf(page);
      expect(p.verdict, 'with ' + k + ' filled').toContain('còn ' + (6 - k) + ' chỗ');
      expect([p.wrong, p.wrongTotal, p.conclusion?.wrong, p.nudge]).toEqual([0, 0, 0, false]);
      await fillBlanks(page, [...Array(k).fill(null), OK[k] as number]);
    }
  });

  test('a wrong check changes nothing on the blanks or pieces and says the same thing for one wrong blank or for six', async ({ page }) => {
    await conclusion(page);
    await fillBlanks(page, [0, 1, 2, 3, 4, 5]);
    const grab = (): Promise<string> => page.locator('.pz-conclusion').evaluate((el) => el.outerHTML);
    const before = await grab();
    await check1(page);
    const oneWrong = (await puzzleOf(page)).verdict;
    expect(await grab()).toBe(before);
    expect(before).not.toMatch(/aria-invalid|data-(?:ok|wrong|correct|right|error)/iu);
    await clearBlanks(page);
    await fillBlanks(page, [4, 6, 0, 1, 2, 3]);
    await check1(page);
    expect((await puzzleOf(page)).verdict).toBe(oneWrong);
  });

  test('the nudge comes after exactly 3 wrong conclusion checks, the answer hint stays closed, a hint ends the run', async ({ page }) => {
    await conclusion(page);
    await fillBlanks(page, [0, 1, 2, 3, 4, 5]);
    const seen: boolean[] = [];
    for (let i = 1; i <= 4; i += 1) {
      await check1(page);
      const p = await puzzleOf(page);
      expect([p.wrong, p.conclusion?.wrong]).toEqual([i, i]);
      seen.push(p.nudge);
      expect(p.hints).toBe(0);
    }
    expect(seen).toEqual([false, false, true, true]);
    await cool(page);
    await domClick(page, '#pz-hint');
    const p = await puzzleOf(page);
    expect([p.nudge, p.wrong, p.hints]).toEqual([false, 0, 1]);
  });

  test('board wrong checks do not carry into the conclusion', async ({ page }, info) => {
    await openPuzzle(page, 'ending');
    await page.evaluate(() => localStorage.clear());
    await openSeeded(page, 'ending', { phase: 'board', wrongRun: 2, wrongTotal: 2, checks: 2 });
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await waitPuzzlePhase(page, 'conclusion');
    const p = await puzzleOf(page);
    expect([p.wrong, p.hints, p.nudge, p.conclusion?.wrong]).toEqual([0, 0, false, 0]);
  });

  test('three conclusion hints: Gợi ý, Gợi ý 2/3, then Nhờ Cúc Cu soi tỏ, which writes the sentence over wrong pieces and shows the verdict', async ({ page }) => {
    await conclusion(page);
    await fillBlanks(page, [5, 4, 3, 2, 1, 0]);
    await expect(page.locator('#pz-hint')).toHaveText('Gợi ý');
    await cool(page);
    await domClick(page, '#pz-hint');
    await expect(page.locator('#pz-hint')).toHaveText('Gợi ý 2/3');
    await cool(page);
    await domClick(page, '#pz-hint');
    await expect(page.locator('#pz-hint')).toHaveText('Nhờ Cúc Cu soi tỏ');
    expect((await puzzleOf(page)).phase).toBe('conclusion');
    await cool(page);
    await domClick(page, '#pz-hint');
    await waitPuzzlePhase(page, 'verdict');
  });

  test('the last conclusion tier says Cúc Cu wrote the sentence; a sentence the player wrote keeps the match text', async ({ page }) => {
    await conclusion(page);
    for (let i = 0; i < 3; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
    }
    await waitPuzzlePhase(page, 'verdict');
    const helped = (await page.locator('.pz-reveal').textContent()) ?? '';
    expect(helped).toMatch(/Cúc Cu (đã )?viết hộ/u);
    expect(helped).not.toMatch(/Đã khớp|Câu kết của Tèo|!|(^|[^\p{L}])bạn([^\p{L}]|$)/iu);
    expect(await page.locator('.pz > .sr-only').textContent()).not.toMatch(/đã khớp/u);
    await conclusion(page);
    await fillBlanks(page, OK);
    await check1(page);
    await waitPuzzlePhase(page, 'verdict');
    expect(await page.locator('.pz-reveal').textContent()).toMatch(/Đã khớp/u);
  });

  test('reloading at the conclusion after the last tier still credits Cúc Cu in the result, not Đã khớp', async ({ page }) => {
    await conclusion(page);
    for (let i = 0; i < 3; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
    }
    await waitPuzzlePhase(page, 'verdict');
    await page.reload();
    await waitGame(page, 'ending');
    const resumed = await puzzleOf(page);
    expect(resumed.phase).toBe('conclusion');
    expect(resumed.conclusion?.filled.every(Boolean)).toBe(true);
    await check1(page);
    await waitPuzzlePhase(page, 'verdict');
    const text = (await page.locator('.pz-reveal').textContent()) ?? '';
    expect(text).toMatch(/Cúc Cu viết hộ/u);
    expect(text).not.toMatch(/Đã khớp|Câu kết của Tèo/u);
  });

  test('finding 9: after reload back to conclusion with helped set, a player change clears helped so solving credits Tèo', async ({ page }) => {
    await conclusion(page);
    for (let i = 0; i < 3; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
    }
    await waitPuzzlePhase(page, 'verdict');
    await page.reload();
    await waitGame(page, 'ending');
    const resumed = await puzzleOf(page);
    expect(resumed.phase).toBe('conclusion');
    await domClick(page, '.pz-blank[data-blank="0"]');
    await domClick(page, '.pz-blank[data-blank="0"]');
    await check1(page);
    await waitPuzzlePhase(page, 'verdict');
    const text = (await page.locator('.pz-reveal').textContent()) ?? '';
    expect(text).toMatch(/Đã khớp/u);
    expect(text).toMatch(/Câu kết của Tèo/u);
    expect(text).not.toMatch(/Cúc Cu (đã )?viết hộ/u);
  });

  test('the verdict repeats the player\'s own sentence: every chosen piece in its place with its label stamp, never the decoy', async ({ page }) => {
    await conclusion(page);
    await fillBlanks(page, [1, 0, 3, 2, 6, 4]);
    await check1(page);
    await waitPuzzlePhase(page, 'verdict');
    const final = page.locator('.pz-final');
    await expect(final).toBeVisible();
    const bold = await final.locator('b').allInnerTexts();
    expect(bold, 'the pieces in the final sentence').toEqual([1, 0, 3, 2, 6, 4].map((j) => C.bank[j]?.text));
    const stamps = await final.locator('.stamp').evaluateAll((els) => els.map((e) => [e.getAttribute('data-stamp'), e.textContent]));
    expect(stamps, 'the stamps of the final sentence').toEqual(C.blanks.map((b) => [b.label, b.label]));
    await expect(final).not.toContainText('CHƯA CÓ NGUỒN');
  });

  test('the verdict after Cúc Cu fills it also shows pieces and stamps', async ({ page }) => {
    await conclusion(page);
    for (let i = 0; i < 3; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
    }
    await waitPuzzlePhase(page, 'verdict');
    expect(await page.locator('.pz-final b').allInnerTexts()).toHaveLength(6);
    expect((await page.locator('.pz-final .stamp').allInnerTexts()).filter(Boolean)).toHaveLength(6);
  });

  test('every piece shows the same number of source links, so none is singled out by its sources', async ({ page }) => {
    await conclusion(page);
    const counts = await page.locator('.pz-piece-row').evaluateAll((rows) => rows.map((r) => r.querySelectorAll('a').length));
    expect(counts).toHaveLength(C.bank.length);
    expect(counts.every((n) => n >= 1)).toBe(true);
    expect(new Set(counts).size, 'link counts per piece: ' + counts.join(',')).toBe(1);
  });

  test('every piece names its source with a safe link; tapping a link selects nothing', async ({ page }) => {
    await conclusion(page);
    const links = await page.locator('.pz-piece-row a').evaluateAll((as) => as.map((a) => ({ href: (a as HTMLAnchorElement).href, target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? '' })));
    expect(links, 'one link per address of every piece').toHaveLength(C.bank.reduce((n, p) => n + ([] as string[]).concat((p as { url?: string | string[] }).url ?? []).length, 0));
    for (const l of links) {
      expect(l.href).toMatch(/^https:\/\//u);
      expect(l.target).toBe('_blank');
      expect(l.rel).toMatch(/noopener/u);
    }
    await page.evaluate(() => document.addEventListener('click', (e) => (e.target as HTMLElement).closest('a') && e.preventDefault(), true));
    await domClick(page, '.pz-piece-row a');
    const p = await puzzleOf(page);
    expect(p.conclusion?.selected).toBeNull();
    expect(p.conclusion?.filled.every((f) => f === null)).toBe(true);
  });
});
