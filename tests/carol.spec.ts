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

const script = chapterOf('carol');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('carol');
const after = lineAfterMinigame(script, 'Lan');
/** Quạ Đồn's frame: the oldest carols were written for church, so the piece that says so sits with the oldest manuscripts. */
const TRAP: Cell[] = [['a', 'f'], ['b'], ['c'], ['e']];

/**
 * What a reader with no cards builds from the rung labels, the piece words and the lines before the board.
 * casual: takes Quạ Đồn's line as true, so the church carol sits with the oldest manuscripts; knows no date for the carols of other feasts, so leaves them out.
 * wellRead: doubts the line ("Nguồn đâu?") and drops it; the carol of a feast and secular looks like the Boar's Head feast carol, so it goes beside it.
 * expert: knows manuscripts < Boar's Head < Herrick < Stainer and doubts the line; has no date for the carols of other feasts, so leaves both pieces out.
 */
const BLIND = {
  casual: [['a', 'f'], ['b'], ['c'], ['e']],
  wellRead: [['a'], ['b', 'g'], ['c'], ['e']],
  expert: [['a'], ['b'], ['c'], ['e']],
} satisfies Record<string, Cell[]>;

/** A reader who already knows the half and drops Quạ Đồn's line builds the answer itself: the aha, one board in 21, not a reading the words push. */
const KNOWS_THE_HALF: Cell[] = [['a', 'g'], ['b'], ['c'], ['e']];

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'carol', chapter: 'carol', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

const raw = JSON.parse(readFileSync('story/puzzles/carol.json', 'utf8')) as {
  slots: { cap?: number | string; min?: number }[];
  tokens: { id: string; text: string; status: string }[];
  cards: { id: string; kind: string; status: string; do: unknown; text: string; evidence: string[] }[];
  predict: unknown;
  reveal: { lines: string[] };
};

test.describe('chapter 8 puzzle', () => {
  test('loads clean: a DOM puzzle with four rungs, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'carol', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('one hypothesis step and no exemption: with Boar\'s Head on rung 3 the second rung is empty, a plain wrong', async () => {
    expect(file, 'the puzzle carries no L2 exemption').not.toHaveProperty('l2Exempt');
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'carol'], { encoding: 'utf8' });
    expect(report).toMatch(/L2 steps 1 \[hypothesis /u);
    expect(report).not.toContain('EXEMPT');
    expect(reply(file, [['a', 'g'], ['b', 'c', 'e'], [], []] as Cell[], new Set()).type).toBe('format');
    expect(reply(file, [['a', 'g'], [], ['b', 'c'], ['e']] as Cell[], new Set()).type).toBe('incomplete');
    expect(reply(file, [['a', 'g'], ['c'], ['b'], ['e']] as Cell[], new Set()).type).toBe('wrong');
  });

  test('card 5 is a real source card: it sets the church piece against the manuscripts as a condition, never orders it off the board, and the cards leave it no rung', async () => {
    const c5 = raw.cards.find((c) => c.id === 'c5');
    expect(c5?.kind).toBe('inference');
    expect(c5?.status).toBe('fact');
    expect((c5 as unknown as { who: string }).who).toBe('Suy ra từ Cathedral Music Trust');
    expect(c5?.text, 'no Tèo card: the source is Cathedral Music Trust').not.toContain('Tèo');
    expect(c5?.text).toMatch(/Rất khó có chuyện/u);
    expect(c5?.evidence.join(' ')).toContain('highly unlikely that any of these were conceived to be performed in church');
    const d = JSON.stringify(c5?.do);
    expect(d, 'a conditional: placed only if it holds').toContain('"placed","f"');
    expect(d).not.toContain('"unused"');
    expect(d, 'card 5 names the piece it is set against').toContain('"a"');
    expect(raw.slots.every((s) => s.cap === 2 && s.min === 1)).toBe(true);
    const fTok = raw.tokens.find((t) => t.id === 'f');
    expect(fTok).toMatchObject({ text: 'Carol cổ nhất viết cho nhà thờ', status: 'decoy' });
    expect(fTok?.text, 'the piece reuses no verb of Quạ Đồn or Tèo').not.toMatch(/soạn|hát|ra đời/u);
    expect(raw.tokens.find((t) => t.id === 'b')?.text, 'the piece does not say what card 3 says').not.toMatch(/in lần đầu/u);
    expect(JSON.stringify(raw), 'the decoy does not say "from long ago"').not.toMatch(/từ xưa/u);
    expect(JSON.stringify(raw.predict), 'the prediction names no piece').not.toMatch(/nhà thờ|thế tục|Boar|Stainer|Herrick/u);
    const solved = file.solutions[0] as Cell[];
    expect(solved.flat().flat(), 'the solution leaves the decoy out').not.toContain('f');
    for (let at = 0; at < solved.length; at += 1) {
      const cell = solved[at];
      const board = solved.map((c, i) => (i === at ? ([] as string[]).concat(c ?? [], 'f') : c)) as Cell[];
      if (Array.isArray(cell) && cell.length >= 2) {
        expect(reply(file, board, new Set()), 'over capacity on rung ' + (at + 1)).toEqual({ type: 'format', reason: 'capacity' });
      } else {
        expect(reply(file, board, new Set()).type, 'the decoy on rung ' + (at + 1)).toBe('wrong');
      }
    }
    expect(reply(file, [['a'], ['b', 'f'], ['c'], ['e']] as Cell[], new Set()).type, 'g left out is a wrong, not a solution').toBe('wrong');
  });

  test('every card says what it encodes and cites its source sentence from research/', () => {
    const research = readFileSync('research/m0b-act-2.md', 'utf8') + readFileSync('research/m0c-puzzles.md', 'utf8');
    const norm = (t: string) => t.normalize('NFC').replaceAll('’', "'").replaceAll('“', '"').replaceAll('”', '"');
    for (const c of raw.cards) {
      expect(c.evidence.length, c.id).toBeGreaterThan(0);
      for (const e of c.evidence) expect(norm(research), c.id + ': ' + e).toContain(norm(e));
    }
    const byId = (id: string) => raw.cards.find((c) => c.id === id)!;
    expect(byId('c2').text).toMatch(/Khoảng nửa carol chép tay nói về lễ khác hoặc thế tục/u);
    expect(byId('c2').kind, 'the second sentence is the game\'s own reading').toBe('inference');
    expect(byId('c3').text).toMatch(/in lần đầu/u);
    expect(research, 'the Stainer sentence is in research').toContain('John Stainer included carols in Choral Evensong at St Paul’s in 1878');
    expect(JSON.stringify([raw.tokens, raw.cards.map((c) => c.text)]), 'straight apostrophes in pieces and cards').not.toContain('’');
    expect(JSON.stringify(byId('c2').do)).toContain('"same"');
    expect(byId('c1').text).toMatch(/xưa nhất/u);
  });

  test('1426 is Audelay\'s book, not the birth of carols: the notebook date is the 13th century and the reveal keeps the hedge', async () => {
    const nb = JSON.parse(readFileSync('story/notebook/carol.json', 'utf8')) as { card: string[]; full: { fact: { text: string }[] } };
    expect(nb.card.join(' ')).toContain('thế kỷ 13–15');
    expect(nb.card.join(' ')).not.toContain('1426');
    expect(nb.card.join(' ')).toContain('Nhiều khả năng');
    expect(nb.full.fact.some((x) => x.text.includes('ghi năm 1426'))).toBe(true);
    expect(raw.reveal.lines.join(' ')).toMatch(/Nhiều khả năng/u);
    expect(raw.reveal.lines.join(' ')).toContain('thế kỷ 13');
    expect(JSON.stringify(raw)).not.toContain('1426');
    const row = (JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string }[]).find((r) => r.id === 'carol');
    expect(JSON.stringify(row)).not.toMatch(/từ xưa/u);
  });

  test('blind control (?preview=puzzle:carol, cards removed, a clean page per reader): the readers\' boards fail, and the one reader who knows the half solves it', async ({ page }, info) => {
    const open = async (): Promise<void> => {
      await page.goto('/?preview=puzzle:carol');
      await waitReady(page);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await waitReady(page);
      await toBoard(page, info);
      await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((el) => el.remove()));
      await expect(page.locator('.pz-card')).toHaveCount(0);
    };
    for (const [reader, board] of Object.entries(BLIND)) {
      expect(reply(file, board, new Set()).type, reader).not.toBe('solved');
      await open();
      await fillBoard(page, info, board);
      expect((await puzzleOf(page)).board, reader + ': the board is the one the reader built').toEqual(Object.fromEntries(board.map((cell, at) => [`s${at + 1}`, cell]).filter(([, cell]) => (cell as string[]).length > 0).map(([k, cell]) => [k, [...(cell as string[])].sort()])) as never);
      await check(page, info);
      const g = await puzzleOf(page);
      expect(g.phase, reader).toBe('board');
      expect(g.completed, reader).toBe(false);
      expect(g.verdict, reader).toContain('Chưa khớp với các thẻ.');
    }
    expect(JSON.stringify(file.predict), 'the prediction asks the chapter question and names no group').not.toMatch(/Giáng Sinh|lễ khác|thế tục/u);
    await open();
    await fillBoard(page, info, KNOWS_THE_HALF);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
  });

  test('blind count: what the expert knows and the visible rules leave 21 boards, and exactly one is the answer', () => {
    const ids = ['a', 'b', 'c', 'e', 'g', 'f'];
    const boards: Cell[][] = [];
    const walk = (at: number, rung: number[]): void => {
      if (at === ids.length) {
        const cells = [1, 2, 3, 4].map((r) => ids.filter((_, i) => rung[i] === r));
        if (cells.some((c) => c.length < 1 || c.length > 2)) return;
        const [a, b, c, e] = rung as [number, number, number, number];
        if (a > 0 && a < b && b < c && c < e) boards.push(cells as Cell[]);
        return;
      }
      for (let r = 0; r <= 4; r += 1) walk(at + 1, [...rung, r]);
    };
    walk(0, []);
    expect(boards).toHaveLength(21);
    for (const [reader, board] of Object.entries(BLIND)) expect(boards.map((b) => JSON.stringify(b)), reader + ' is one of the 21').toContain(JSON.stringify(board));
    expect(boards.filter((b) => reply(file, b, new Set()).type === 'solved')).toEqual([file.solutions[0]]);
    const natural = boards.filter((b) => (b[0] as string[]).includes('f'));
    expect(natural.length, 'the most natural reading (the decoy beside the manuscripts) is not the answer').toBeGreaterThan(0);
    expect(natural.every((b) => reply(file, b, new Set()).type !== 'solved')).toBe(true);
  });

  test('the decoy stays off the board in the solution, and putting it on the board never solves the puzzle', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['a'], ['g', 'f'], ['b', 'c'], ['e']]);
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
    await expect(page.locator('.pz-reveal')).toContainText('thế kỷ 13');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    const beats = script.scenes.find((x) => x.id === gameScene)!.beats;
    expect(s.lineIndex).toBe(beats.slice(0, beats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length + 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:carol'))).toBeNull();
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

test.describe('chapter 8 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'carol')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('carol') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'carol', chapter: 'carol', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'carol' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'carol' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['carol']);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 8 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'carol');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="carol"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
