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

const script = chapterOf('befana');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('befana');
const after = lineAfterMinigame(script, 'Lan');
/** Tèo's frame: every dated form is the old woman's name, so she has a record from the oldest form on. */
const TRAP: Cell[] = [['a', 'w'], ['b'], ['c'], ['e'], ['h']];
/** Readers with no card, from the piece texts and what they know outside the game (the cards were not read to build these). */
const CASUAL: Cell[] = [['h'], ['a'], ['b'], ['c'], ['e', 'w']];
const WELL_READ: Cell[] = [['e'], ['b'], ['c'], ['a'], ['w']];
const EXPERT: Cell[] = [['b'], ['a'], ['c'], ['e'], ['w']];

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'befana', chapter: 'befana', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 10 puzzle', () => {
  test('loads clean: a DOM puzzle with five rungs, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'befana', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(5);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('one hypothesis step and no exemption: the rung left empty when Bifania sits on rung 3 is not a board', () => {
    expect(file, 'the puzzle carries no L2 exemption').not.toHaveProperty('l2Exempt');
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'befana'], { encoding: 'utf8' });
    expect(report).toMatch(/L2 steps 1 \[hypothesis /u);
    expect(report).not.toContain('EXEMPT');
    expect(reply(file, [['a'], ['b', 'c', 'e'], [], [], ['w']] as Cell[], new Set())).toEqual({ type: 'format', reason: 'capacity' });
    expect(reply(file, [['a'], ['b'], ['c'], [], ['e', 'w']] as Cell[], new Set()).type).toBe('incomplete');
    expect(reply(file, [['a'], ['c'], ['e'], ['b'], ['w']] as Cell[], new Set()).type).toBe('wrong');
  });

  test('card 5 is a conditional that a spare rung would satisfy; only the five rungs keep the unsettled piece off, and no card orders it away', () => {
    const raw = JSON.parse(readFileSync('story/puzzles/befana.json', 'utf8')) as {
      slots: { cap?: number | string }[];
      tokens: { id: string; text: string }[];
      cards: { id: string; kind: string; status: string; do: unknown; text: string }[];
    };
    const c5 = raw.cards.find((c) => c.id === 'c5');
    expect(c5?.kind).toBe('inference');
    expect(c5?.status).toBe('disputed');
    const d = JSON.stringify(c5?.do);
    expect(d, 'a conditional: placed only if it holds').toContain('"placed","h"');
    expect(d).not.toContain('"unused"');
    expect(d, 'card 5 names the piece it is set against').toContain('"a"');
    for (const c of raw.cards.filter((x) => x.id !== 'c5')) expect(JSON.stringify(c.do), c.id + ' says nothing about the unsettled piece').not.toContain('"h"');
    expect(c5?.text).toMatch(/Treccani/u);
    expect(c5?.text).toMatch(/Britannica Kids/u);
    expect(c5?.text).toMatch(/Nếu đặt Strenia thì chỉ được đặt trước Bitfanie/u);
    expect(raw.slots.every((s) => s.cap === 2)).toBe(true);
    const pattern = /^[^\s(]+ \([^)]+\)$/u;
    for (const tk of raw.tokens) expect(tk.text, 'every piece text has the one form "name (place or author)"').toMatch(pattern);
    expect(JSON.stringify(file.predict), 'the prediction names no record').not.toMatch(/Pulci|Siena|Arezzo|Florence|Villani|\d{3,4}/u);
    const sat = execFileSync(
      'node',
      [
        '--input-type=module',
        '-e',
        "import { load, states, solutions, answerOf } from './scripts/puzzles.mjs'; const p = load('befana'); p.slots = [{ id: 's0', label: 'x', cap: 2, min: 1 }, ...p.slots]; console.log(JSON.stringify(solutions(p, undefined, states(p)).map((v) => answerOf(p, v))));",
      ],
      { encoding: 'utf8' },
    );
    expect(JSON.parse(sat), 'with one rung more, the conditional lets the piece in before Bitfanie and nothing else changes').toEqual([[['h'], ['a'], ['b'], ['c'], ['e'], ['w']]]);
    const solved = file.solutions[0] as Cell[];
    for (let at = 0; at < solved.length; at += 1) {
      const board = solved.map((c, i) => (i === at ? ([] as string[]).concat(c ?? [], 'h') : c)) as Cell[];
      expect(reply(file, board, new Set()).type, 'the piece on rung ' + (at + 1)).toBe('wrong');
    }
  });

  test('Sổ nguồn: the card and every point are the research Sổ tay block word for word, every link was opened (✔), the stamp is the chapter stamp', () => {
    const research = readFileSync('research/m0b-act-2.md', 'utf8');
    const block = research.slice(research.indexOf('### 4.2 Sổ tay'), research.indexOf('### 4.3'));
    const checked = research.replace(block, '');
    const opened = (url: string) => {
      for (let at = checked.indexOf(url); at >= 0; at = checked.indexOf(url, at + 1)) if (!checked.slice(Math.max(0, at - 2), at).includes('○')) return true;
      return false;
    };
    const nb = JSON.parse(readFileSync('story/notebook/befana.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(nb).toMatchObject({ id: 'befana', status: 'verified', source: 'research/m0b-act-2.md', stamp: 'TRUYỀN THUYẾT' });
    expect(nb.card).toHaveLength(3);
    for (const line of nb.card) expect(block, line).toContain(line);
    for (const points of Object.values(nb.full)) {
      for (const p of points) {
        expect(block, p.text).toContain(p.text);
        expect(p.sources.length, p.text.slice(0, 40)).toBeGreaterThan(0);
        for (const s of p.sources) {
          expect(s.url).toMatch(/^https?:\/\//);
          expect(opened(s.url), 'not a ✔ URL in research: ' + s.url).toBe(true);
        }
      }
    }
    expect(Object.keys(nb.full).sort()).toEqual(['dispute', 'fact', 'legend', 'tradition']);
    expect(nb.full.dispute?.[0]?.text).toContain('Chưa bên nào được chứng minh');
    expect(nb.card.join(' ')).toContain('chưa tìm thấy bản ghi sớm nhất của truyện');
  });

  test('blind control (?preview=puzzle:befana, cards removed): the readers and the wrong frame fail; 60 boards fit an expert, one is the answer', async ({ page }, info) => {
    const perms = (xs: string[]): string[][] => (xs.length < 2 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
    // An expert knows Villani wrote before Pulci and that Strenia is disputed (left off): every order of the five other pieces with Villani before Pulci fits that and the rules.
    const fits = perms(['a', 'b', 'c', 'e', 'w']).filter((q) => q.indexOf('e') < q.indexOf('w')).map((q) => q.map((x) => [x]) as Cell[]);
    const verdicts = fits.map((b) => reply(file, b, new Set()).type);
    expect(fits).toHaveLength(60);
    expect(verdicts.filter((v) => v === 'solved')).toHaveLength(1);
    expect(verdicts.filter((v) => v === 'wrong')).toHaveLength(59);
    expect(file.solutions[0], 'the answer is not the descent from Epifania').not.toEqual(WELL_READ);
    await page.goto('/?preview=puzzle:befana');
    await waitReady(page);
    await toBoard(page, info);
    await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((el) => el.remove()));
    await expect(page.locator('.pz-card')).toHaveCount(0);
    for (const board of [CASUAL, WELL_READ, EXPERT, TRAP]) {
      expect(reply(file, board, new Set()).type).toBe('wrong');
      await fillBoard(page, info, board);
      await check(page, info);
      const g = await puzzleOf(page);
      expect(g.phase).toBe('board');
      expect(g.completed).toBe(false);
      expect(g.verdict).toContain('Chưa khớp với các thẻ.');
    }
  });

  test('the chapter script keeps the voice rules the checker can count: 25 words a line, 12 words between marks, 2 commas a sentence, no "đầu tiên" outside the crow', () => {
    const words = (s: string) => s.trim().split(/\s+/u).filter(Boolean).length;
    const bad: string[] = [];
    for (const beat of script.scenes.flatMap((s) => s.beats)) {
      if (beat.t !== 'say' && beat.t !== 'narr') continue;
      const text = beat.text;
      if (words(text) > 25) bad.push('over 25 words: ' + text);
      for (const part of text.split(/[,;:.!?…]+\s*/u)) if (words(part) > 12) bad.push('over 12 words between marks: ' + part);
      for (const sentence of text.split(/(?<=[.!?…])\s+/u)) if ((sentence.match(/,/g) ?? []).length > 2) bad.push('over 2 commas: ' + sentence);
      if (beat.t === 'say' && beat.who !== 'Quạ Đồn' && /(?:^|[^\p{L}])(?:đầu tiên|luôn|từ xưa|cổ xưa)(?![\p{L}])/iu.test(text)) bad.push('reserved word: ' + text);
    }
    expect(bad).toEqual([]);
  });

  test('the unsettled piece stays off the board in the solution, and putting it on the board never solves the puzzle', async ({ page }, info) => {
    expect(file.solutions.flat().flat(), 'the solution leaves the unsettled piece out').not.toContain('h');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['h'], ['a'], ['b'], ['c', 'e'], ['w']]);
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
    await expect(page.locator('.pz-reveal')).toContainText('gắn với Lễ Hiển Linh');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:befana'))).toBeNull();
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

test.describe('chapter 10 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'befana')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('befana') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'befana', chapter: 'befana', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'befana' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'befana' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['befana']);
    expect(stamp).toBe('TRUYỀN THUYẾT');
    expect(seen, 'chapter 10 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'befana');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="befana"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
