import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ORDER } from '../src/order.ts';
import type { Beat } from '../src/story/types.ts';
import { expectClean, monitor } from './support/helpers.ts';
import { advanceStory, reachMinigame, seedSave, solveMinigame, realInput, stateOf, storedSave, storyOf, typeName, waitReady } from './support/play.ts';
import { check, fillBoard, press, puzzleFile, puzzleOf, toBoard, waitPuzzlePhase, wrongFill, type Cell } from './support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from './support/script.ts';
import { reply } from '../scripts/puzzles.mjs';

const script = chapterOf('nicholas');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('nicholas');
const after = lineAfterMinigame(script, 'Lan');
/** Tèo's frame: the story of the gold through the window has a record from the saint's own time, so it sits with the start of his cult. */
const TRAP: Cell[] = [['k', 'v'], ['m'], ['j'], ['b']];

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'nicholas', chapter: 'nicholas', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 7 puzzle', () => {
  test('loads clean: a DOM puzzle with four rungs, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'nicholas', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('one hypothesis step and no exemption: filling the rung that two lives sharing a rung leave empty with the unsettled piece is a plain wrong', async () => {
    expect(file, 'the puzzle carries no L2 exemption').not.toHaveProperty('l2Exempt');
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'nicholas'], { encoding: 'utf8' });
    expect(report).toMatch(/L2 steps 1 \[hypothesis /u);
    expect(report).not.toContain('EXEMPT');
    expect(reply(file, [['k'], ['p'], ['m', 'v', 'j'], ['b']] as Cell[], new Set())).toEqual({ type: 'format', reason: 'capacity' });
    expect(reply(file, [['k'], ['p'], ['m', 'v'], ['j', 'b']] as Cell[], new Set()).type).toBe('wrong');
  });

  test('card 5 sets the unsettled piece against other pieces as a condition, never orders it off the board, and the cards leave it no rung', async () => {
    const raw = JSON.parse(readFileSync('story/puzzles/nicholas.json', 'utf8')) as {
      slots: { cap?: number | string }[];
      tokens: { id: string; text: string }[];
      cards: { id: string; kind: string; do: unknown; text: string }[];
    };
    const c5 = raw.cards.find((c) => c.id === 'c5');
    expect(c5?.kind).toBe('inference');
    const d = JSON.stringify(c5?.do);
    expect(d, 'a conditional: placed only if it holds').toContain('"placed","p"');
    expect(d).not.toContain('"unused"');
    for (const id of ['k', 'm']) expect(d, 'card 5 names the piece it is set against: ' + id).toContain('"' + id + '"');
    expect(c5?.text).toMatch(/Chỉ theo Cioffari mới có chỗ/u);
    expect(raw.slots.every((s) => s.cap === 2)).toBe(true);
    const pTok = raw.tokens.find((t) => t.id === 'p');
    const vTok = raw.tokens.find((t) => t.id === 'v');
    expect(pTok?.text).toBe('Bài tán dương');
    expect(vTok?.text).toBe('Chuyện túi vàng ném qua cửa sổ');
    expect(vTok?.text, 'the piece names no record').not.toMatch(/tiểu sử|Michael|sớm nhất/u);
    expect(JSON.stringify(file.predict), 'the prediction names no record').not.toMatch(/tiểu sử|Michael/u);
    const solved = file.solutions[0] as Cell[];
    for (let at = 0; at < solved.length; at += 1) {
      const cell = solved[at];
      const board = solved.map((c, i) => (i === at ? ([] as string[]).concat(c ?? [], 'p') : c)) as Cell[];
      if (Array.isArray(cell) && cell.length >= 2) {
        expect(reply(file, board, new Set()), 'over capacity on rung ' + (at + 1)).toEqual({ type: 'format', reason: 'capacity' });
      } else {
        expect(reply(file, board, new Set()).type, 'the piece on rung ' + (at + 1)).toBe('wrong');
      }
    }
    for (const rung2Board of [
      [['k'], ['p'], ['m', 'v'], ['j', 'b']],
      [['k'], ['p', 'm'], ['v', 'j'], ['b']],
      [['k'], ['p', 'v'], ['m', 'j'], ['b']],
    ] as Cell[][]) {
      expect(reply(file, rung2Board, new Set()).type).toBe('wrong');
    }
  });

  test('notebook matches 814–842/843 and represents Lendering early-sources accurately', async () => {
    const nb = JSON.parse(readFileSync('story/notebook/nicholas.json', 'utf8')) as {
      full: { fact: { text: string }[]; dispute: { text: string }[] };
    };
    expect(nb.full.fact.some((x) => x.text.includes('814–842/843'))).toBe(true);
    expect(nb.full.fact.some((x) => /\b814–843\b/.test(x.text))).toBe(false);
    const dowry = nb.full.dispute[0]?.text ?? '';
    expect(dowry).toContain('Lendering');
    expect(dowry).toContain('có thật');
    expect(dowry).toContain('Philostratus');
  });

  test('blind control (?preview=puzzle:nicholas, cards removed): wrong frame and natural boards fail', async ({ page }, info) => {
    await page.goto('/?preview=puzzle:nicholas');
    await waitReady(page);
    await toBoard(page, info);
    await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((el) => el.remove()));
    await expect(page.locator('.pz-card')).toHaveCount(0);
    // Without cards a reader who knows Myra < Michael < John < Bari puts the gold story beside Myra (legend as old as the cult) or leaves it out; neither is the answer.
    const naturalBoards: Cell[][] = [
      TRAP,
      [['k', 'v'], ['p'], ['m', 'j'], ['b']],
      [['k'], ['p'], ['m', 'v'], ['j', 'b']],
      [['k'], ['v'], ['m', 'j'], ['b']],
      [['k'], ['p', 'v'], ['m'], ['j', 'b']],
      [['k'], ['m'], ['j'], ['b']],
      [['k'], ['m'], ['j'], ['b', 'v']],
      [['k', 'v'], ['m'], ['j'], ['b']],
    ];
    for (const board of naturalBoards) {
      await fillBoard(page, info, board);
      await check(page, info);
      const g = await puzzleOf(page);
      expect(g.phase).toBe('board');
      expect(g.completed).toBe(false);
      expect(g.verdict).toContain('Chưa khớp với các thẻ.');
    }
  });

  test('the unsettled piece stays off the board in the solution, and putting it on the board never solves the puzzle', async ({ page }, info) => {
    expect(file.solutions.flat().flat(), 'the solution leaves the unsettled piece out').not.toContain('p');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['k'], ['p'], ['v', 'm'], ['j', 'b']]);
    expect((await puzzleOf(page)).bank).toEqual([]);
    await check(page, info);
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).completed).toBe(false);
  });

  test('correct: real taps solve it with no wrong check and no hint, the reveal names the claim, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await expect(page.locator('.pz-reveal')).toContainText('tiểu sử còn lại sớm nhất');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:nicholas'))).toBeNull();
  });

  test("Tèo's frame gets the plain wrong answer, marks no card and, after three tries, only offers the next hint", async ({ page }, info) => {
    expect(['trap', 'wrong'], 'the fill is the wrong frame the puzzle models').toContain(reply(file, TRAP, new Set()).type);
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, TRAP);
    for (let i = 1; i <= 3; i += 1) {
      await check(page, info);
      await expect.poll(async () => (await puzzleOf(page)).wrong).toBe(i);
      const g = await puzzleOf(page);
      expect(g.verdict).toContain('Chưa khớp với các thẻ.');
      expect(g.pointed, 'only a hint tier the player pressed marks a card').toEqual([]);
      expect(g.phase).toBe('board');
      expect(g.nudge).toBe(i === 3);
    }
    const g = await puzzleOf(page);
    expect(g).toMatchObject({ hints: 0, hint: '', completed: false });
    expect(g.verdict).toMatch(/Gợi ý/u);
  });

  test('reload in the middle of the board resumes at the start of the scene; the pieces are in the puzzle save and come back with the board', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, wrongFill(file));
    const placed = (await puzzleOf(page)).board;
    await page.reload();
    await waitReady(page);
    const s = await stateOf(page);
    expect(s.shell.mode).toBe('story');
    expect(s.story?.scene).toBe(gameScene);
    expect(s.game).toBeNull();
    expect(JSON.parse((await storedSave(page)) ?? 'null')).not.toHaveProperty('board');
    await reachMinigame(page, info);
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).board).toEqual(placed);
  });
});

test.describe('chapter 7 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'nicholas')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('nicholas') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'nicholas', chapter: 'nicholas', scene: '' });
    await page.goto('/');
    await waitReady(page);
    const seen: string[] = [];
    const games: string[] = [];
    let key = '';
    const deadline = Date.now() + 200_000;
    while (Date.now() < deadline) {
      const s = await stateOf(page);
      if (s.shell.mode === 'card') break;
      if (s.game) {
        games.push(s.game.id);
        await solveMinigame(page, realInput(info), info);
        continue;
      }
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'nicholas' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'nicholas' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['nicholas']);
    expect(stamp).toBe('TRUYỀN THUYẾT');
    expect(seen, 'chapter 7 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'nicholas');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="nicholas"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
