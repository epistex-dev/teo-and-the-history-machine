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

const script = chapterOf('tree');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('tree');
const after = lineAfterMinigame(script, 'Lan');
type Card = { id: string; text: string; kind: string; status: string; do?: unknown };
const cards = (file as any).cards as Card[];
/** Tèo's frame: Tille and the excerpt say the same, and only the other notes carry the candle. Slots in order: Cả Tille và đoạn trích, Chỉ bản Tille, Chỉ đoạn trích Augsburger, Chỉ ghi chép nơi khác. */
const TRAP: Cell[] = [['a', 't', 'd', 'e', 'g'], [], [], ['f']];
/**
 * What readers build with the cards hidden, from the slot labels, the piece wording and the script before the board.
 * The pieces: a (paper roses), t (Zischgolt), d (Zischgold), e (square frame), g (v.v.), f (candle).
 * Casual: one note copied twice says the same, so every piece sits in "both", the candle too.
 * Well-read: the candle comes from other notes, and the two spellings sit in separate boxes; the frame and "v.v." read like part of the common text.
 * Tille reader: knows the Tille text (Zischgolt, "etc.", the frame) but not the excerpt, so the excerpt's spelling goes with the common text.
 * Expert: also knows the excerpt is the modernised spelling, so the two spellings split and the extras of Tille go with Tille. This board is the answer:
 * the one difference between the copies a reader cannot look up from the piece wording does not exist in the opened sources, so an expert who knows both texts needs no card (accepted risk, as in chapter 13).
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['a', 't', 'd', 'e', 'g', 'f'], [], [], []],
  wellRead: [['a', 'e', 'g'], ['t'], ['d'], ['f']],
  tilleReader: [['a', 'd'], ['t', 'e', 'g'], [], ['f']],
};
const EXPERT: Cell[] = [['a'], ['t', 'e', 'g'], ['d'], ['f']];
const FIT = 72;
const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'tree', chapter: 'tree', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 11 puzzle', () => {
  test('loads clean: a DOM puzzle with four boxes, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'tree', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('the puzzle is a full file with no stub left, no L2 exemption, and the checker finds an L2 step', () => {
    expect(existsSync('story/puzzles/stubs/tree.json')).toBe(false);
    expect(file).not.toHaveProperty('stub');
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'tree'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps [1-9]/);
    expect(out.stdout).not.toContain('EXEMPT');
  });

  test('the matrix row is full, names this file and repeats its cards and reveal', () => {
    const rows = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; state: string; puzzle: string; cards: { text: string; status: string }[]; reveal: string; solution: string; label: string }[];
    const row = rows.find((r) => r.id === 'tree')!;
    expect(row.state).toBe('full');
    expect(row.puzzle).toBe('story/puzzles/tree.json');
    expect(row.cards.map((c) => c.text)).toEqual(cards.map((c) => c.text));
    expect(row.cards.map((c) => c.status)).toEqual(cards.map((c) => c.status));
    expect(row.reveal).toBe(((file as any).reveal.lines as string[]).join(' '));
    expect(row.label).toBe((file as any).reveal.label);
    expect(row.solution).toContain('Chỉ ghi chép nơi khác: Nến');
    expect(row.solution).toContain('Chỉ đoạn trích Augsburger: Chữ «Zischgold»');
  });

  test('each card says what it encodes: its constraint is exactly its sentence, and no card reads as a record or a legend', () => {
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(cards.map((c) => [c.id, c.kind, c.status])).toEqual([
      ['c1', 'inference', 'fact'],
      ['c2', 'inference', 'fact'],
      ['c3', 'inference', 'fact'],
      ['c4', 'inference', 'fact'],
      ['c5', 'inference', 'fact'],
    ]);
    const count = (slots: string[], n: number) => ({ op: 'expr', e: ['eq', ['add', ...slots.map((s) => ['count', s, 'a', 't', 'd', 'e', 'g', 'f'])], n] });
    expect(by.c1!.text).toBe('Tille và đoạn trích Augsburger đều ghi: hoa hồng cắt từ giấy nhiều màu.');
    expect(JSON.stringify(by.c1!.do)).toBe(JSON.stringify([{ op: 'at', t: 'a', s: 's1' }]));
    expect(by.c2!.text).toBe('«v.v.», câu khung bốn cạnh và «Zischgolt» nằm ở cùng các bản.');
    expect(JSON.stringify(by.c2!.do)).toBe(JSON.stringify([{ op: 'same', t: ['e', 'g'] }, { op: 'same', t: ['t', 'e'] }]));
    expect(by.c3!.text).toBe('Bản Tille ghi đúng bốn trong sáu mảnh này.');
    expect(JSON.stringify(by.c3!.do)).toBe(JSON.stringify([count(['s1', 's2'], 4)]));
    expect(by.c4!.text).toBe('Đoạn trích ở Augsburger ghi đúng hai trong sáu mảnh này.');
    expect(JSON.stringify(by.c4!.do)).toBe(JSON.stringify([count(['s1', 's3'], 2)]));
    expect(JSON.stringify(by.c5!.do)).toBe(JSON.stringify([{ op: 'at', t: 'f', s: 's4' }]));
    for (const c of [by.c3!, by.c4!]) expect(c.text, 'a count card never says the copies differ').not.toMatch(/khác|nhiều hơn|ít hơn/u);
    expect((file as any).wrongFrame.cards, 'a pair of cards breaks the frame, neither is named as the discovery').toEqual(['c3', 'c4']);
  });

  test('the candle: the card names the two modern sources, no card carries a date, the 1708 letter is a boxwood branch, and nothing orders the piece off the board', () => {
    const c5 = cards.find((c) => c.id === 'c5')!;
    for (const w of ['Phần đọc được', 'Wissenschaftsjahr', 'Waldwissen', 'Tille không nhắc nến']) expect(c5.text, w).toContain(w);
    for (const c of cards) {
      expect(c.text, c.id + ' text carries no date').not.toMatch(/1611|1660|1708|Yale/u);
      expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/1611|1660|1708|"unused"/u);
    }
    expect(JSON.stringify((c5 as any).url)).not.toContain('yalebooks');
    expect(file.solutions[0]).toEqual([['a'], ['t', 'e', 'g'], ['d'], ['f']]);
    const f = (file as any).tokens.find((t: any) => t.id === 'f');
    expect(f.status).toBe('disputed');
    expect(f.text).toBe('Nến');
    const reveal = (file as any).reveal.lines.join(' ');
    expect(reveal).toContain('1611, khoảng 1660');
    expect(reveal).toMatch(/1708 chỉ nói cành hoàng dương/u);
    expect(reveal).toContain('«Zucker.»');
    const scriptText = JSON.stringify(script);
    expect(scriptText).toContain('Thư năm 1708 kể nến nhỏ trên một cành hoàng dương');
    expect(scriptText).not.toMatch(/và 1708|, 1708/u);
  });

  test('no piece, rule, question or early hint says which copy has what, what the candle or the legend is, or names a date', () => {
    const screen = JSON.stringify([(file as any).question, (file as any).rules, (file as any).hints.slice(0, 3), (file as any).tokens.map((t: any) => t.text)]);
    expect(screen).not.toMatch(/Luther|truyền thuyết|tranh cãi|giả thuyết|1611|1660|1708|Yale|Tille|Augsburger/u);
    expect(JSON.stringify((file as any).tokens)).not.toMatch(/Strasbourg|Luther|bản chép/u);
    for (const s of (file as any).slots) expect(s.label, s.id).not.toMatch(/nến|khung|hoa|zisch|v\.v/iu);
    expect((file as any).slots.map((s: any) => s.cap)).toEqual(['any', 'any', 'any', 'any']);
    expect((file as any).slots.map((s: any) => s.label)).toEqual(['Cả Tille và đoạn trích', 'Chỉ bản Tille', 'Chỉ đoạn trích Augsburger', 'Chỉ ghi chép nơi khác']);
    expect((file as any).rules.map((r: any) => r.text).join(' ')).not.toMatch(/nhiều nhất|nhận (một|hai)/u);
    expect(file.predict?.options).not.toContain('Phần ấy không ai đọc được');
  });

  test('every card is needed: with any one removed the others leave more than one board, and no card is a legend', () => {
    const all = new Set(cards.map((c) => c.id));
    expect(solutions(file, all) as number[][]).toHaveLength(1);
    for (const c of cards) {
      const rest = new Set([...all].filter((id) => id !== c.id));
      expect((solutions(file, rest) as number[][]).length, 'without ' + c.id).toBeGreaterThan(1);
    }
  });

  test('BLIND: the boards three readers and Tèo build with the cards hidden fail the checker; the expert board who knows both texts solves (accepted risk), and the boards fitting what the expert knows hold one right answer that is not the lumped one', () => {
    for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
      expect(reply(file, b, new Set()).type, who).not.toBe('solved');
      expect(sorted(b), who + ' is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    }
    expect(reply(file, EXPERT, new Set()).type, 'an expert who knows both texts and which copy spells which way needs no card').toBe('solved');
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const known: Record<string, number[]> = { a: [1, 2], t: [1, 2, 3], d: [1, 2, 3], e: [1, 2], g: [1, 2], f: [4] };
    const fit = all.filter((v) => Object.entries(known).every(([t, slots]) => slots.includes(v[M.tid.indexOf(t)] as number)));
    expect(fit.length, 'boards consistent with what the expert knows').toBeGreaterThanOrEqual(10);
    expect(fit.length).toBe(FIT);
    const right = solutions(file, new Set(cards.map((c) => c.id)), fit) as number[][];
    expect(right.length, 'exactly one of them agrees with every card').toBe(1);
    expect(sorted(answerOf(file, right[0] as number[]) as Cell[]), 'the answer is the file solution').toBe(sorted(file.solutions[0] as Cell[]));
    const lumped = fit.find((v) => ['a', 't', 'd', 'e', 'g'].every((t) => v[M.tid.indexOf(t)] === 1));
    expect(lumped, 'the lumped board is among them').toBeTruthy();
    expect(sorted(answerOf(file, lumped as number[]) as Cell[]), 'and it is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    expect(all.length).toBe((file as any).space);
    const row = (JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; note: string }[]).find((r) => r.id === 'tree')!;
    expect(row.note, 'the accepted expert risk is documented').toContain('Rủi ro chuyên gia được chấp nhận');
  });

  for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP, expert: EXPERT })) {
    test('BLIND in the page: with the cards removed from the page, the ' + who + (who === 'expert' ? ' board is accepted (documented expert risk)' : ' board is not accepted'), async ({ page }, info) => {
      await openPuzzle(page, 'tree');
      await toBoard(page, info);
      await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((e) => e.remove()));
      await expect(page.locator('.pz-card')).toHaveCount(0);
      await fillBoard(page, info, b);
      await check(page, info);
      if (who === 'expert') {
        await waitPuzzlePhase(page, 'reveal');
        expect((await puzzleOf(page)).wrong).toBe(0);
        return;
      }
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
    await expect(page.locator('.pz-reveal')).toContainText('không nhắc nến');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:tree'))).toBeNull();
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

test.describe('chapter 11 Sổ nguồn', () => {
  test('every line of the entry is verbatim in the research block, every link is opened, and the Luther legend is legend 0 for the ending', () => {
    const research = readFileSync('research/m0b-act-2.md', 'utf8');
    const start = research.indexOf('## 5. Chương 11');
    const block = research.slice(research.indexOf('### 5.2 Sổ tay', start), research.indexOf('### 5.3', start));
    const table = research.slice(start, research.indexOf('### 5.2', start));
    const entry = JSON.parse(readFileSync('story/notebook/tree.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(entry).toMatchObject({ id: 'tree', status: 'verified', source: 'research/m0b-act-2.md', stamp: 'TRANH CÃI' });
    expect(entry.card).toHaveLength(3);
    for (const line of entry.card) expect(block, line).toContain(line);
    for (const [section, points] of Object.entries(entry.full)) {
      for (const p of points) {
        expect(block, section + ': ' + p.text.slice(0, 40)).toContain(p.text);
        expect(p.sources.length).toBeGreaterThan(0);
        for (const s of p.sources) {
          expect(s.url).toMatch(/^https:\/\//);
          expect(table + block, s.url).toContain(s.url);
        }
      }
    }
    expect(entry.full.legend?.[0]?.text).toMatch(/^Người ta kể rằng Martin Luther/u);
    expect(Object.keys(entry.full).sort()).toEqual(['dispute', 'fact', 'legend']);
    const ending = JSON.parse(readFileSync('story/puzzles/ending.json', 'utf8')) as { conclusion: { bank: { notebook: string; label: string }[] } };
    const luther = ending.conclusion.bank.find((b) => b.notebook === 'tree.legend.0');
    expect(luther?.label).toBe('TRUYỀN THUYẾT');
  });
});

test.describe('chapter 11 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'tree')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('tree') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'tree', chapter: 'tree', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'tree' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'tree' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['tree']);
    expect(stamp).toBe('TRANH CÃI');
    expect(seen, 'chapter 11 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'tree');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="tree"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
