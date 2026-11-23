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

const script = chapterOf('mistletoe');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('mistletoe');
const after = lineAfterMinigame(script, 'Lan');
/** Tèo's frame: Baldur's mistletoe leads to the kiss, so the kiss record sits in Snorri's Prose Edda alongside the Baldur oath. */
const TRAP: Cell[] = [['f', 'w'], ['b'], ['h'], ['i']];
const without = (id: string) => ({ ...file, cards: file.cards.filter((c) => c.id !== id) });
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'mistletoe', chapter: 'mistletoe', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 4 puzzle', () => {
  test('loads clean: a DOM puzzle with four sources, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'mistletoe', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('one hypothesis step and no exemption: card 5 sets the kissing-bough hypothesis piece against the comic-opera piece as a condition, and capacity leaves it no source', async () => {
    expect(file, 'the puzzle carries no L2 exemption').not.toHaveProperty('l2Exempt');
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'mistletoe'], { encoding: 'utf8' });
    expect(report).toMatch(/L2 steps 1 \[hypothesis w≠4\]/u);
    expect(report).not.toContain('EXEMPT');
    const raw = JSON.parse(readFileSync('story/puzzles/mistletoe.json', 'utf8')) as {
      slots: { cap?: number | string }[];
      cards: { id: string; kind: string; do: unknown; text: string }[];
    };
    const c5 = raw.cards.find((c) => c.id === 'c5');
    expect(c5?.kind).toBe('inference');
    const d = JSON.stringify(c5?.do);
    expect(d, 'a conditional: placed only if it holds').toContain('"placed","k"');
    expect(d).not.toContain('"unused"');
    expect(d, 'card 5 names the placed piece it is set against').toContain('"w"');
    expect(raw.slots.every((s) => s.cap === 2)).toBe(true);
    const overfull: Cell[] = [['f'], ['b'], ['k'], ['w', 'h', 'i']];
    const splitPair: Cell[] = [['f'], ['b'], ['h'], ['w', 'i']];
    const extraInS4: Cell[] = [['f'], ['b'], ['w', 'h'], ['i', 'k']];
    expect(reply(file, overfull, new Set())).toEqual({ type: 'format', reason: 'capacity' });
    expect(reply(file, splitPair, new Set()).type).toBe('wrong');
    expect(reply(file, extraInS4, new Set()).type).toBe('wrong');
    expect(reply(without('c3'), splitPair, new Set()).type, 'card 3 alone pairs the poem and the comic-opera in the same article').toBe('solved');
    expect(reply(without('c5'), extraInS4, new Set()).type, 'card 5 alone keeps the kissing-bough piece tied to the comic-opera source').toBe('solved');
  });

  test('blind control (?preview=puzzle:mistletoe, cards removed): wrong frame and natural boards fail', async ({ page }, info) => {
    await page.goto('/?preview=puzzle:mistletoe');
    await waitReady(page);
    await toBoard(page, info);
    await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((el) => el.remove()));
    await expect(page.locator('.pz-card')).toHaveCount(0);
    const naturalBoards: Cell[][] = [
      TRAP,
      [['f'], ['b', 'w'], ['h'], ['i']],
      [['f'], ['b'], ['h', 'k'], ['w', 'i']],
      [['f'], ['b'], ['w', 'k'], ['h', 'i']],
      [['f'], ['b'], ['h', 'w'], ['i', 'k']],
      [['f'], ['b'], ['h'], ['w', 'i']],
      [['b'], ['f'], ['w', 'h'], ['i']],
    ];
    for (const board of naturalBoards) {
      expect(reply(file, board, new Set()).type, JSON.stringify(board)).toBe('wrong');
      await fillBoard(page, info, board);
      await check(page, info);
      const g = await puzzleOf(page);
      expect(g.phase).toBe('board');
      expect(g.completed).toBe(false);
      expect(g.verdict).toContain('Chưa khớp với các thẻ.');
    }
  });

  test('the hypothesis piece stays off the board in the solution, and putting it in a source never solves the puzzle', async ({ page }, info) => {
    expect(file.solutions.flat().flat(), 'the solution leaves the hypothesis piece out').not.toContain('k');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['f'], ['b'], ['w', 'h'], ['i', 'k']]);
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
    await expect(page.locator('.pz-reveal')).toContainText('chưa ai chứng minh');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(linesBefore + 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:mistletoe'))).toBeNull();
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

test.describe('chapter 4 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'mistletoe')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('mistletoe') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'mistletoe', chapter: 'mistletoe', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'mistletoe' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'mistletoe' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['mistletoe']);
    expect(stamp).toBe('TRUYỀN THUYẾT');
    expect(seen, 'chapter 4 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'mistletoe');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="mistletoe"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
