import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ORDER } from '../src/order.ts';
import type { Beat } from '../src/story/types.ts';
import { expectClean, monitor } from './support/helpers.ts';
import { advanceStory, reachMinigame, seedSave, solveMinigame, realInput, stateOf, storedSave, storyOf, typeName, waitReady } from './support/play.ts';
import { check, fillBoard, openPuzzle, press, puzzleFile, puzzleOf, toBoard, waitPuzzlePhase, wrongFill, type Cell } from './support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from './support/script.ts';
import { answerOf, model, reply, solutions, states } from '../scripts/puzzles.mjs';

const script = chapterOf('bethlehem');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('bethlehem');
const after = lineAfterMinigame(script, 'Lan');
/** Tèo's frame: the whole familiar scene is in the Gospels, so the ox and ass image sits in century 1. Slots in order: 1, 2, 3, 4, 5, 8. */
const TRAP: Cell[] = [['d'], ['a'], ['b', 'c'], ['k'], [], []];
/**
 * What three readers build with the cards hidden, the pieces being a (the cave story), b (magi image), c (the word "king"),
 * d (ox and ass image), k (the Epiphany feast named), t (the number three, whose sources disagree).
 * Casual: the familiar scene is old, so everything sits early. Well-read: kings from Tertullian, the images late, the ox and ass
 * medieval, the three from Origen. Expert: every date right, and the number three put where BAR has it.
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['d', 'b'], ['a', 'c'], ['t', 'k'], [], [], []],
  wellRead: [[], ['a'], ['c', 't'], ['b', 'k'], [], ['d']],
  expert: [[], ['a', 't'], ['b', 'c'], ['d', 'k'], [], []],
};

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'bethlehem', chapter: 'bethlehem', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 5 puzzle', () => {
  test('loads clean: a DOM puzzle with six centuries, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'bethlehem', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(6);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('the puzzle has no L2 exemption and the checker finds an L2 step', () => {
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'bethlehem'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps [1-9]/);
    expect(out.stdout).not.toContain('EXEMPT');
  });

  test('no card, piece or slot takes a side on the stable or says an animal is absent; slot ids follow their labels; no screen text puts the names in the 8th century', () => {
    const cards = (file as any).cards as { id: string; text: string; kind: string; do: unknown }[];
    for (const c of cards) expect(c.text, c.id).not.toMatch(/chuồng|Ba Vua|không có con vật/u);
    for (const t of file.tokens) expect(t.text, t.id).not.toMatch(/chuồng|Ba Vua|Melchior/u);
    for (const s of (file as any).slots) {
      expect(s.label, s.id).not.toMatch(/Ba Vua|chuồng/u);
      expect(s.id, s.label).toBe('th' + String(s.label).replace(/\D/g, ''));
    }
    for (const f of ['story/puzzles/bethlehem.json', 'story/notebook/bethlehem.json', 'story/chapters/bethlehem.md', 'story/minigames.json']) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/chỉ gặp từ khoảng thế kỷ 8/u);
    }
    expect(JSON.stringify((file as any).tokens)).not.toContain('Melchior');
  });

  test('the number three: the card says what each source places it with, and the cards plus capacity two keep it off the board', () => {
    const three = (file as any).tokens.find((t: any) => t.status === 'disputed');
    expect(three.id).toBe('t');
    const cards = (file as any).cards as { id: string; text: string; kind: string; do: unknown }[];
    const mentions = cards.filter((c) => /"t":"t"|"placed","t"|"pos","t"/u.test(JSON.stringify(c.do)));
    expect(mentions.map((c) => c.id)).toEqual(['c5']);
    expect(mentions[0]?.kind).toBe('inference');
    expect(JSON.stringify(mentions[0]?.do)).toContain('"placed"');
    expect(mentions[0]?.text).toMatch(/BAR cùng thế kỷ với chuyện hang/u);
    expect(mentions[0]?.text).toMatch(/HĐGMVN, với ý “vua”/u);
    expect(mentions[0]?.text).toMatch(/cả hai nguồn phải đồng ý/u);
    expect(mentions[0]?.text).not.toMatch(/Yale/u);
    expect(JSON.stringify(mentions[0]?.do)).toBe(JSON.stringify([{ op: 'expr', e: ['or', ['not', ['placed', 't']], ['and', ['eq', ['pos', 't'], ['pos', 'a']], ['eq', ['pos', 't'], ['pos', 'c']]]] }]));
    expect((file as any).question).toMatch(/các nguồn trên thẻ đồng ý/u);
    expect((file as any).rules[0].text).toBe('Mỗi mảnh đặt vào thế kỷ mà các nguồn trên thẻ đồng ý. Nguồn không đồng ý thì mảnh để ngoài.');
    expect(JSON.stringify((file as any).rules)).not.toContain('sớm nhất');
    const all = (file as any).cards.map((c: any) => c.id) as string[];
    // placed, the number three sits with the cave piece and the "king" piece (a at century 2), and card 2 pulls the magi image in: four pieces in one century
    for (const cap of [2, 3, 4]) {
      const loose = JSON.parse(JSON.stringify(file)) as any;
      for (const s of loose.slots) s.cap = cap;
      const sols = solutions(loose, new Set(all)) as number[][];
      const at = (model(loose) as { tid: string[] }).tid.indexOf('t');
      expect(sols.length, 'capacity ' + cap).toBeGreaterThan(0);
      const placedT = sols.filter((v) => (v[at] ?? 0) > 0).length;
      if (cap < 4) expect(placedT, 'capacity ' + cap + ': four pieces cannot share a century').toBe(0);
      else expect(placedT, 'capacity 4 is the first where capacity alone no longer keeps it off').toBeGreaterThan(0);
    }
  });

  test('card 2 says only what it encodes: no century but the first, and the image dated by BAR alone', () => {
    const c2 = (file as any).cards.find((c: any) => c.id === 'c2');
    expect(c2.text.match(/\d+/g)).toEqual(['1']);
    expect(c2.text).not.toMatch(/Yale/u);
    expect(JSON.stringify(c2.do)).toBe(JSON.stringify([{ op: 'notAt', t: 'c', s: 'th1' }, { op: 'same', t: ['b', 'c'] }]));
  });

  test('the number three stays off the board in the solution, and putting it on the board never solves the puzzle', async ({ page }, info) => {
    expect(file.solutions.flat().flat(), 'the solution leaves the piece out').not.toContain('t');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, BLIND.expert as Cell[]);
    await check(page, info);
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).completed).toBe(false);
  });

  test('BLIND: the boards three readers build with the cards hidden all fail the checker; at least ten boards fit what the expert knows, one is right, and it is not the fullest', () => {
    for (const [who, b] of Object.entries(BLIND)) {
      expect(reply(file, b, new Set()).type, who).not.toBe('solved');
      expect(JSON.stringify(b), who + ' is not the answer').not.toBe(JSON.stringify(file.solutions[0]));
    }
    const ids = (file as any).tokens.map((t: any) => t.id) as string[];
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const known: Record<string, number> = { a: 2, c: 3, k: 4 };
    const fit = all.filter((v) => Object.entries(known).every(([t, s]) => v[M.tid.indexOf(t)] === s));
    expect(fit.length, 'boards consistent with what the expert knows and the visible rules').toBeGreaterThanOrEqual(10);
    expect(fit.length).toBe(283);
    const right = (solutions(file, new Set((file as any).cards.map((c: any) => c.id)), fit) as number[][]);
    expect(right.length, 'exactly one of them agrees with every card').toBe(1);
    const placed = (v: number[]) => v.filter((x) => x > 0).length;
    expect(placed(right[0] as number[]), 'the answer leaves a piece out, the fullest fit places all six').toBeLessThan(Math.max(...fit.map(placed)));
    const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));
    expect(sorted(answerOf(file, right[0] as number[]) as Cell[]), 'the answer is the file solution').toBe(sorted(file.solutions[0] as Cell[]));
    expect(ids.length).toBe(6);
  });

  for (const [who, b] of Object.entries(BLIND)) {
    test('BLIND in the page: with the cards removed from the page, the ' + who + ' board is not accepted', async ({ page }, info) => {
      await openPuzzle(page, 'bethlehem');
      await toBoard(page, info);
      await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((e) => e.remove()));
      await expect(page.locator('.pz-card')).toHaveCount(0);
      await fillBoard(page, info, b);
      await check(page, info);
      await expect.poll(async () => (await puzzleOf(page)).wrong).toBe(1);
      expect((await puzzleOf(page)).phase).toBe('board');
      expect((await puzzleOf(page)).completed).toBe(false);
    });
  }

  test('correct: real taps solve it with no wrong check and no hint, the reveal names the claim, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await expect(page.locator('.pz-reveal')).toContainText('thế kỷ 4');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:bethlehem'))).toBeNull();
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

test.describe('chapter 5 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'bethlehem')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('bethlehem') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'bethlehem', chapter: 'bethlehem', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'bethlehem' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'bethlehem' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['bethlehem']);
    expect(stamp).toBe('THEO KINH THÁNH');
    expect(seen, 'chapter 5 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'bethlehem');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="bethlehem"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
