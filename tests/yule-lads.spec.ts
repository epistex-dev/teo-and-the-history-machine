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

const script = chapterOf('yule-lads');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('yule-lads');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;
type Card = { id: string; text: string; kind: string; status: string; do?: unknown };
const cards = (file as any).cards as Card[];
/**
 * What readers build with the cards hidden, from the slot labels, the piece wording and the script before the board (Cúc Cu's three records: the 18th-century manuscript, the 1862 print and today's calendar;
 * the piece saying the names were there a hundred years before the printed book reads like the claim nobody sourced, so every reader leaves it out).
 * The pieces: a (the number thirteen, older than the printed book), h (no lad has a name yet), b (the first lad comes down thirteen days before Christmas, one more each day),
 * d (Faldafeykir is the seventh lad), e (Hurðaskellir is the seventh lad), g (the thirteen names were there a hundred years before the printed book).
 * Slots in order: Bản chép tay thế kỷ 18 (holds at most two pieces), Jón Árnason 1862 (needs at least two), Lịch Iceland ngày nay.
 * Casual: both seventh-lad names are names, so both go with the book of names; a rule about days goes with the calendar.
 * Well-read: knows the 1932 poem fixed the names, so the line about having no names yet belongs to the book that came before it; days again go with the calendar,
 * and Hurðaskellir, the name everyone knows, goes with it.
 * Expert variant: knows the rule is in the 1862 book, the number thirteen is old and the crow's line has no record, but takes Hurðaskellir for the book's name and Faldafeykir for the later calendar's.
 * Expert: knows the rule is the book's, Faldafeykir the book's name and Hurðaskellir the calendar's; this board is the answer: nothing in the opened sources separates it from what an expert
 * already knows, so no card is needed (accepted risk, as in chapters 15 and 16).
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['a', 'h'], ['d', 'e'], ['b']],
  wellRead: [['a'], ['d', 'h'], ['b', 'e']],
  expertVariant: [['a', 'h'], ['b', 'e'], ['d']],
};
const TRAP: Cell[] = [['a', 'g'], ['b', 'd'], ['e']];
const EXPERT: Cell[] = [['a', 'h'], ['b', 'd'], ['e']];
const FIT = 18;
const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'yule-lads', chapter: 'yule-lads', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 14 puzzle', () => {
  test('loads clean: a DOM puzzle with three boxes, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'yule-lads', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(3);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('the puzzle is a full file with no stub left, no L2 exemption, and the checker finds two L2 steps', () => {
    expect(existsSync('story/puzzles/stubs/yule-lads.json')).toBe(false);
    expect(file).not.toHaveProperty('stub');
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'yule-lads'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps 2 \[hypothesis h≠2 ; hypothesis h≠3\]/);
    expect(out.stdout).not.toContain('EXEMPT');
  });

  test('the matrix row is full, names this file, repeats its cards and reveal, and counts days, never nights', () => {
    const rows = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; state: string; puzzle: string; aha: string; cards: { text: string; status: string }[]; reveal: string; solution: string; label: string; note: string }[];
    const row = rows.find((r) => r.id === 'yule-lads')!;
    expect(row.state).toBe('full');
    expect(row.puzzle).toBe('story/puzzles/yule-lads.json');
    expect(row.cards.map((c) => c.text)).toEqual(cards.map((c) => c.text));
    expect(row.cards.map((c) => c.status)).toEqual(cards.map((c) => c.status));
    expect(row.reveal).toBe(((file as any).reveal.lines as string[]).join(' '));
    expect(row.aha).toBe((file as any).aha);
    expect(row.solution).toContain('để ngoài: Mười ba tên có trước sách in trăm năm');
    expect(row.solution).toContain('Lịch Iceland ngày nay: Hurðaskellir là chàng thứ bảy');
    expect(row.note, 'the accepted expert risk is documented').toContain('Rủi ro chuyên gia được chấp nhận');
    expect(JSON.stringify([file, row]), 'the unit is the day').not.toMatch(/đêm|tối|Chỉ một đêm/iu);
    expect(JSON.stringify([file, row]), 'no Grýla and no child-eating').not.toMatch(/Grýla|Leppalúði|ăn thịt|ăn trẻ/u);
  });

  test('each card says what it encodes: names are absent before 1862, the rule is the book\'s, the calendar has Hurðaskellir and not Faldafeykir, two inferences and no more, and the line about old names is only a condition', () => {
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(cards.map((c) => [c.id, c.kind, c.status])).toEqual([
      ['c1', 'modern', 'fact'],
      ['c2', 'record', 'fact'],
      ['c3', 'modern', 'fact'],
      ['c4', 'inference', 'fact'],
      ['c5', 'inference', 'fact'],
    ]);
    expect(cards.filter((c) => c.kind === 'inference'), 'at most two inference cards').toHaveLength(2);
    expect(cards.every((c) => (c as any).who && (c as any).url?.length && (c as any).evidence?.length)).toBe(true);
    expect(by.c1!.text).toBe('Theo Árni Björnsson, tên các chàng chưa thấy ở đâu trước năm 1862.');
    expect(JSON.stringify(by.c1!.do), 'no name sits in the manuscript, and the card says nothing about what does').toBe(JSON.stringify([{ op: 'notAt', t: 'd', s: 's1' }, { op: 'notAt', t: 'e', s: 's1' }]));
    expect(by.c2!.text).toBe('Jón Árnason chép năm 1862: chàng đầu xuống núi cách Giáng Sinh mười ba ngày, mỗi ngày thêm một.');
    expect(JSON.stringify(by.c2!.do)).toBe(JSON.stringify([{ op: 'at', t: 'b', s: 's2' }]));
    expect(by.c3!.text).toBe('Lịch ngày nay đếm từ 12/12: Hurðaskellir 18/12, Ketkrókur 23/12, Kertasníkir 24/12. Không có Faldafeykir.');
    expect(JSON.stringify(by.c3!.do)).toBe(JSON.stringify([{ op: 'at', t: 'e', s: 's3' }, { op: 'notAt', t: 'd', s: 's3' }]));
    expect((by.c3 as any).evidence, 'the start of the count is on the card').toContain('12. desember byrja gömlu jólasveinarnir að koma til byggða');
    expect(by.c4!.text).toBe('Suy ra: lời về số mười ba, cùng lời chưa có tên, thuộc một bản ghi.');
    expect(JSON.stringify(by.c4!.do), 'a shared source, never a verdict on which').toBe(JSON.stringify([{ op: 'same', t: ['a', 'h'] }]));
    expect(by.c5!.text).toBe('Suy ra: nguồn nào nói mười ba tên có trước sách in trăm năm, nguồn ấy cũng nói con số mười ba sớm chừng ấy.');
    expect(JSON.stringify(by.c5!.do), 'a condition satisfied by leaving the piece out or by sitting with the old number, never an order to leave or a box for it').toBe(JSON.stringify([{ op: 'expr', e: ['or', ['not', ['placed', 'g']], ['eq', ['pos', 'g'], ['pos', 'a']]] }]));
    for (const c of cards) {
      expect(c.text, c.id).not.toMatch(/đêm|tối|1932|Grýla/u);
      expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/"unused"|"used"/u);
    }
    expect((file as any).wrongFrame.cards, 'every card is part of what breaks the frame').toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    const cls = Object.fromEntries((file as any).tokens.map((t: any) => [t.id, t.status]));
    expect(cls).toEqual({ a: 'fact', b: 'fact', d: 'fact', e: 'fact', g: 'decoy', h: 'fact' });
    expect((file as any).tokens, 'each wording fits only its own record: the 1862 list also has thirteen names, so no piece says only the number').toHaveLength(6);
  });

  test('no piece, rule or hint says which record holds what, and the guess does not hand over the answer', () => {
    const screen = JSON.stringify([(file as any).question, (file as any).rules, (file as any).hints.slice(0, 3), (file as any).tokens.map((t: any) => t.text)]);
    expect(screen).not.toMatch(/Árni|Vísindavefur|Landsbókasafn|truyền thuyết|tranh cãi|giả thuyết|đêm|tối/u);
    expect(JSON.stringify((file as any).tokens.map((t: any) => t.text))).not.toMatch(/Jón|Lịch|bản ghi|thơ|1862|1932|Người ta kể|người ta kể/u);
    expect((file as any).slots.map((s: any) => s.label)).toEqual(['Bản chép tay thế kỷ 18', 'Jón Árnason 1862', 'Lịch Iceland ngày nay']);
    expect((file as any).slots.map((s: any) => [s.cap, s.min])).toEqual([[2, 1], ['any', 2], ['any', 1]]);
    expect(screen, 'no box and no question names a class').not.toMatch(/không có trong|nằm riêng|để ngoài/u);
    const rules = (file as any).rules.map((r: any) => r.text).join(' ');
    expect(rules, 'the rules say what the slots enforce').toContain('Mỗi ô nhận ít nhất một mảnh, riêng Jón Árnason nhận ít nhất hai. Bản chép tay nhận nhiều nhất hai mảnh.');
    expect(file.predict?.options).toEqual(['Thơ năm 1932', 'Sách in năm 1862', 'Bản chép tay thế kỷ 18']);
  });

  test('every card is needed: with any one removed the others leave more than one board, and no card is a legend', () => {
    const all = new Set(cards.map((c) => c.id));
    expect(solutions(file, all) as number[][]).toHaveLength(1);
    for (const c of cards) {
      const rest = new Set([...all].filter((id) => id !== c.id));
      expect((solutions(file, rest) as number[][]).length, 'without ' + c.id).toBeGreaterThan(1);
    }
  });

  test('the line about old names leaves the board only through the condition and the capacity of the manuscript, never through an order or a box of its own', () => {
    const M = model(file) as { tid: string[] };
    const g = M.tid.indexOf('g');
    const all = new Set(cards.map((c) => c.id));
    const placed = (ids: Set<string>, p: unknown = file) => (solutions(p, ids, states(p)) as number[][]).filter((v) => v[g] !== 0).length;
    expect(placed(all), 'with every card the line has no place').toBe(0);
    expect(placed(new Set([...all].filter((id) => id !== 'c5'))), 'without the condition it fits somewhere').toBeGreaterThan(0);
    const roomy = JSON.parse(JSON.stringify(file));
    roomy.slots[0].cap = 3;
    expect(placed(all, roomy), 'with room for a third piece the condition is met by sitting with the old number').toBeGreaterThan(0);
    const sol = (solutions(file, all) as number[][])[0]!;
    const byId = Object.fromEntries(M.tid.map((t, i) => [t, sol[i]]));
    expect(byId).toEqual({ e: 3, b: 2, h: 1, g: 0, a: 1, d: 2 });
  });

  test('BLIND: the boards readers build with the cards hidden fail the checker; the boards fitting what the expert knows hold one right answer; the expert board solves (accepted risk)', () => {
    for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
      expect(reply(file, b, new Set()).type, who).toBe('wrong');
      expect(sorted(b), who + ' is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    }
    expect(reply(file, EXPERT, new Set()).type, 'an expert who knows the rule, the name and the calendar needs no card').toBe('solved');
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const known: Record<string, number[]> = { a: [1], b: [2], g: [0] };
    const fit = all.filter((v) => Object.entries(known).every(([t, slots]) => slots.includes(v[M.tid.indexOf(t)] as number)));
    expect(fit.length, 'boards consistent with what the expert knows').toBeGreaterThanOrEqual(10);
    expect(fit.length).toBe(FIT);
    const right = solutions(file, new Set(cards.map((c) => c.id)), fit) as number[][];
    expect(right.length, 'exactly one of them agrees with every card').toBe(1);
    expect(sorted(answerOf(file, right[0] as number[]) as Cell[]), 'the answer is the file solution').toBe(sorted(file.solutions[0] as Cell[]));
    const variant = fit.find((v) => sorted(answerOf(file, v) as Cell[]) === sorted(BLIND.expertVariant!));
    expect(variant, 'the expert variant is among them').toBeTruthy();
    expect(sorted(answerOf(file, variant as number[]) as Cell[]), 'and it is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    expect(all.length).toBe((file as any).space);
  });

  for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP, expert: EXPERT })) {
    test('BLIND in the page: with the cards removed from the page, the ' + who + (who === 'expert' ? ' board is accepted (documented expert risk)' : ' board is not accepted'), async ({ page }, info) => {
      await openPuzzle(page, 'yule-lads');
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

  test('correct: real taps solve it with no wrong check and no hint, the reveal names the record, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await expect(page.locator('.pz-reveal')).toContainText('Số mười ba có trong bản chép tay thế kỷ 18');
    await expect(page.locator('.pz-reveal')).toContainText('24/12');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(after.scene === gameScene ? linesBefore + 1 : 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:yule-lads'))).toBeNull();
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

  test('a board with an empty box or a thin 1862 box is incomplete and spends no check', async ({ page }, info) => {
    const thin: Cell[] = [['a', 'h'], ['b'], ['d', 'e']];
    expect(reply(file, [['a', 'h'], [], ['b', 'd', 'e']], new Set()).type).toBe('incomplete');
    expect(reply(file, thin, new Set()).type, 'the 1862 box needs two pieces').toBe('incomplete');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, thin);
    await check(page, info);
    expect((await puzzleOf(page)).checks).toBe(0);
    expect((await puzzleOf(page)).wrong).toBe(0);
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

test.describe('chapter 14 script', () => {
  test('the board scene has the minigame beat, Quạ Đồn speaks before it and the lines after it come back to the count', () => {
    const scene = script.scenes.find((s) => s.id === gameScene)!;
    const at = scene.beats.findIndex((b) => b.t === 'minigame');
    expect(at).toBeGreaterThan(0);
    expect(JSON.stringify(scene.beats.slice(0, at))).toContain('Quạ Đồn');
    expect(after.text.length).toBeGreaterThan(0);
  });
});

test.describe('chapter 14 Sổ nguồn', () => {
  test('every line of the entry is verbatim in the research block, every link is opened, and the legend is legend 0 for the ending', () => {
    const research = readFileSync('research/m0b-act-3.md', 'utf8');
    const tick = String.fromCharCode(96);
    const start = research.indexOf('### 3.1 ' + tick + 'yule-lads' + tick);
    const heading = research.indexOf('### Sổ tay ' + tick + 'yule-lads' + tick, start);
    expect(heading, 'the block has its own heading').toBeGreaterThan(start);
    const block = research.slice(heading, research.indexOf('### 3.2', heading));
    const table = research.slice(start, heading);
    expect(block, 'the line the format never forbade is back').toContain('- *Theo Kinh Thánh hoặc theo truyền thống:* không có; ẩn mục.');
    const entry = JSON.parse(readFileSync('story/notebook/yule-lads.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(entry).toMatchObject({ id: 'yule-lads', status: 'verified', source: 'research/m0b-act-3.md', stamp: 'SỰ THẬT' });
    expect(entry.card).toHaveLength(3);
    for (const line of entry.card) expect(block, line).toContain(line);
    for (const [section, points] of Object.entries(entry.full)) {
      for (const p of points) {
        expect(block, section + ': ' + p.text.slice(0, 40)).toContain(p.text);
        expect(p.sources.length).toBeGreaterThan(0);
        for (const s of p.sources) {
          expect(s.url).toMatch(/^https:\/\//);
          expect(block, s.url).toContain(s.url);
        }
      }
    }
    void table;
    expect(entry.full.legend?.[0]?.text).toMatch(/^Người ta kể rằng chàng đầu tiên/u);
    expect(Object.keys(entry.full).sort()).toEqual(['dispute', 'fact', 'legend']);
    expect(entry.full.fact).toHaveLength(4);
    expect(entry.full.dispute).toHaveLength(2);
  });
});

test.describe('chapter 14 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'yule-lads')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('yule-lads') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'yule-lads', chapter: 'yule-lads', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'yule-lads' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'yule-lads' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['yule-lads']);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 14 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'yule-lads');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="yule-lads"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
