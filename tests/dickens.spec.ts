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

const script = chapterOf('dickens');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('dickens');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;
type Card = { id: string; text: string; kind: string; status: string; do?: unknown };
const cards = (file as any).cards as Card[];
/**
 * What readers build with the cards hidden, from the slot labels, the piece wording, the rule 'Mảnh có thể không đặt' and the script before the board
 * (Tèo's rule 'oldest first, newest last', his frame 'if the book made the whole feast every other custom stands after it', the kiss under mistletoe from an earlier chapter).
 * Pieces: b (kiss under mistletoe), c (tree at Windsor), d (commercial card), e (the book), f (picture of the Victoria and Albert tree in the newspaper), g (Prince Albert brought the tree to Britain).
 * Notches 1 to 4, oldest first, at most two pieces each; a piece may stay out.
 * Casual: reads the book as the anchor of the year and puts the Albert story beside it, the card beside the picture.
 * Well-read (the popular story, reader B of c40f544 with the Albert piece in front of him): the tree came with Albert around 1840, so it joins the Windsor tree as the arrival of the tree; the card and the book of 1843 share a notch.
 * Expert variant: knows the 1843 pair, the 1848 picture and the kiss, reads Victoria and Albert as the popularisers and puts the Albert piece with the newspaper picture.
 * Expert: knows the Royal Collection page names Charlotte and that Albert only popularised the tree, so the Albert piece has no notch; this board is the answer (accepted risk).
 * The old reader B board (carol, kiss, Windsor, book and card, picture) is this board with the carol dropped: with no Albert piece it was the plain chronology and solved.
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['b'], ['c'], ['e', 'g'], ['d', 'f']],
  wellRead: [['b'], ['c', 'g'], ['d', 'e'], ['f']],
  expertVariant: [['b'], ['c'], ['d', 'e'], ['f', 'g']],
};
const TRAP: Cell[] = [['e'], ['b'], ['c'], ['d', 'f']];
const EXPERT: Cell[] = [['b'], ['c'], ['d', 'e'], ['f']];
const FIT = 12;
const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'dickens', chapter: 'dickens', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 18 puzzle', () => {
  test('loads clean: a DOM puzzle with four notches, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'dickens', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('the puzzle is a full file with no stub left, no L2 exemption, and the checker finds two L2 steps', () => {
    expect(existsSync('story/puzzles/stubs/dickens.json')).toBe(false);
    expect(file).not.toHaveProperty('stub');
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'dickens'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps 2 \[hypothesis d≠2 ; hypothesis d≠4\]/);
    expect(out.stdout).not.toContain('EXEMPT');
  });

  test('the matrix row is full, names this file, repeats its cards and reveal, and documents the settled axis and the accepted expert risk', () => {
    const rows = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; state: string; puzzle: string; cards: { text: string; status: string }[]; reveal: string; solution: string; label: string; note: string; format: string; input: string; goal: string }[];
    const row = rows.find((r) => r.id === 'dickens')!;
    expect(row).toMatchObject({ state: 'full', puzzle: 'story/puzzles/dickens.json', format: 'M', input: 'order', goal: 'age-customs', label: 'SỰ THẬT' });
    expect(row.cards.map((c) => c.text)).toEqual(cards.map((c) => c.text));
    expect(row.cards.map((c) => c.status)).toEqual(cards.map((c) => c.status));
    expect(row.reveal).toBe(((file as any).reveal.lines as string[]).join(' '));
    expect(row.solution).toContain('Nấc 3: Thiệp Giáng Sinh thương mại + Cuốn A Christmas Carol');
    expect(row.solution).toContain('để ngoài: Hoàng thân Albert đưa cây thông vào Anh');
    expect(row.note, 'the bible cell it replaces is named').toContain('cũ / mới 1843 / chưa rõ');
    expect(row.note, 'the accepted expert risk is documented').toContain('Rủi ro chuyên gia được chấp nhận');
  });

  test('each card says what it encodes: the ends are only "nothing older" and "nothing newer", the pair shares a notch, the Albert card gives only a decade and is only a condition', () => {
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(cards.map((c) => [c.id, c.kind, c.status])).toEqual([
      ['c1', 'inference', 'fact'],
      ['c2', 'inference', 'fact'],
      ['c3', 'inference', 'fact'],
      ['c4', 'inference', 'fact'],
      ['c5', 'inference', 'fact'],
    ]);
    expect(by.c1!.text, 'the Albert piece, with only a decade, is the exception').toBe('Suy ra: trong các mảnh được nguồn ghi rõ năm, hình cây trên báo có bản ghi mới nhất.');
    expect(JSON.stringify(by.c1!.do)).toBe(JSON.stringify({ op: 'at', t: 'f', s: 's4' }));
    expect(by.c2!.text, 'the card was commissioned in the year the book came out; the sources do not separate them').toBe('Suy ra: thiệp thương mại được đặt làm đúng năm cuốn sách ra. Hai nguồn không nói cái nào có trước.');
    expect(JSON.stringify(by.c2!.do), 'the sources do not separate them, so they share a notch').toBe(JSON.stringify({ op: 'same', t: ['d', 'e'] }));
    expect(by.c3!.text).toBe('Suy ra: không mảnh nào có bản ghi xưa hơn hôn dưới tầm gửi.');
    expect(JSON.stringify(by.c3!.do)).toBe(JSON.stringify({ op: 'at', t: 'b', s: 's1' }));
    expect(by.c4!.text).toBe('Suy ra: cây ở Windsor có bản ghi xưa hơn tấm thiệp thương mại.');
    expect(JSON.stringify(by.c4!.do)).toBe(JSON.stringify({ op: 'before', t: ['c', 'd'] }));
    expect(by.c5!.text, 'one decade, shared with the card and with the picture, so no single notch holds the piece apart from both').toBe('Suy ra: V&A chỉ cho Albert một thập niên, trùng cả thiệp lẫn hình trên báo. Mảnh Albert, nếu đặt, chung nấc với cả hai.');
    for (const c of cards) expect(c.text, c.id + ' says it is a inference').toMatch(/^Suy ra:/u);
    expect(JSON.stringify(by.c5!.do), 'a condition met by leaving the piece out, never an order to leave').toBe(JSON.stringify({ op: 'expr', e: ['or', ['not', ['placed', 'g']], ['and', ['eq', ['pos', 'g'], ['pos', 'd']], ['eq', ['pos', 'g'], ['pos', 'f']]]] }));
    const orders = cards.flatMap((c) => [].concat((c.do ?? []) as never)).filter((d: any) => d.op === 'before' || d.op === 'between');
    expect(JSON.stringify(orders), 'no card puts the book before the card or the card before the book').not.toMatch(/"t":\["d","e"\]|"t":\["e","d"\]/u);
    for (const c of cards) {
      expect(c.text, c.id + ' shows no year or number, so the order is not read off a figure').not.toMatch(/\d/u);
      expect(c.text, c.id).not.toMatch(/đầu tiên|1784|1800|1843|1848/u);
      expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/"unused"|"used"/u);
    }
    expect((file as any).wrongFrame.cards, 'the pair that breaks the frame').toEqual(['c2', 'c4']);
    const cls = Object.fromEntries((file as any).tokens.map((t: any) => [t.id, t.status]));
    expect(cls).toEqual({ b: 'fact', c: 'fact', d: 'fact', e: 'fact', f: 'fact', g: 'disputed' });
    expect((file as any).tokens.filter((t: any) => t.required).map((t: any) => t.id).sort()).toEqual(['b', 'c', 'd', 'e', 'f']);
  });

  test('no piece, rule, question or hint gives a year, a source or a verdict, and the rules say what the notches enforce', () => {
    const screen = JSON.stringify([(file as any).question, (file as any).rules, (file as any).hints.slice(0, 3), (file as any).tokens.map((t: any) => t.text), (file as any).predict]);
    expect(screen).not.toMatch(/\d{3,4}|Royal Collection|English Heritage|Postal Museum|British Library|Birmingham|V&A|Cathedral|Smithsonian|Charlotte|thế kỷ|đầu tiên|tranh cãi|quá/u);
    expect((file as any).slots.map((s: any) => s.label)).toEqual(['Nấc 1 (xưa nhất)', 'Nấc 2', 'Nấc 3', 'Nấc 4 (mới nhất)']);
    expect((file as any).slots.map((s: any) => [s.cap, s.min])).toEqual([[2, 1], [2, 1], [2, 1], [2, 1]]);
    const rules = (file as any).rules.map((r: any) => r.text).join(' ');
    expect(rules).toContain('Nấc nào cũng cần ít nhất một mảnh, và nhận nhiều nhất hai mảnh. Mảnh có thể không đặt.');
    expect(rules).toContain('chung nấc là nguồn không tách trước sau');
    expect(file.predict?.options).toEqual(['Không mảnh nào', 'Hai mảnh', 'Bốn mảnh']);
    expect((file as any).question).toContain('theo các nguồn đã mở');
  });

  test('every card is needed: with any one removed the others leave more than one board', () => {
    const all = new Set(cards.map((c) => c.id));
    expect(solutions(file, all) as number[][]).toHaveLength(1);
    for (const c of cards) {
      const rest = new Set([...all].filter((id) => id !== c.id));
      expect((solutions(file, rest) as number[][]).length, 'without ' + c.id).toBeGreaterThan(1);
    }
  });

  test('the Albert piece leaves the board only through the condition and the capacity of a notch, never through an order', () => {
    const M = model(file) as { tid: string[] };
    const g = M.tid.indexOf('g');
    const all = new Set(cards.map((c) => c.id));
    const placed = (ids: Set<string>, f: unknown = file) => (solutions(f, ids, states(f)) as number[][]).filter((v) => v[g] !== 0).length;
    expect(placed(all), 'with every card the Albert piece has no place').toBe(0);
    expect(placed(new Set([...all].filter((id) => id !== 'c5'))), 'without the condition it fits somewhere').toBeGreaterThan(0);
    const roomy = JSON.parse(JSON.stringify(file));
    roomy.slots.forEach((s: any) => { s.cap = 4; s.min = 0; });
    expect(placed(all, roomy), 'with room for four pieces in one notch the condition is met beside the card and the picture').toBeGreaterThan(0);
    const sol = solutions(file, all) as number[][];
    expect(sol[0]![g], 'the answer leaves it out').toBe(0);
  });

  test('BLIND: the boards readers build with the cards hidden fail the checker; the boards fitting what the expert knows hold one right answer; the expert board solves (accepted risk)', () => {
    for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
      expect(reply(file, b, new Set()).type, who).not.toBe('solved');
      expect(sorted(b), who + ' is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    }
    expect(reply(file, EXPERT, new Set()).type, 'an expert who knows the Royal Collection page and the 1843 and 1848 records needs no card').toBe('solved');
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const ix = (t: string) => M.tid.indexOf(t);
    const fit = all.filter((v) => v[ix('d')] === v[ix('e')] && v[ix('f')] === 4 && v[ix('b')] === 1);
    expect(fit.length, 'boards consistent with what the expert knows (the card and the book share a year, the picture is newest, the kiss is oldest)').toBeGreaterThanOrEqual(10);
    expect(fit.length).toBe(FIT);
    const right = solutions(file, new Set(cards.map((c) => c.id)), fit) as number[][];
    expect(right.length, 'exactly one of them agrees with every card').toBe(1);
    expect(sorted(answerOf(file, right[0] as number[]) as Cell[]), 'the answer is the file solution').toBe(sorted(file.solutions[0] as Cell[]));
    const variant = fit.find((v) => sorted(answerOf(file, v) as Cell[]) === sorted(BLIND.expertVariant!));
    expect(variant, 'the expert variant is among them').toBeTruthy();
    expect(sorted(answerOf(file, variant as number[]) as Cell[]), 'and it is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    const placedG = fit.filter((v) => v[ix('g')] !== 0).length;
    expect(placedG, 'most boards that fit the expert place the Albert piece somewhere, and none of them is the answer').toBeGreaterThan(fit.length / 2);
    expect(all.length).toBe((file as any).space);
  });

  for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP, expert: EXPERT })) {
    test('BLIND in the page: with the cards removed from the page, the ' + who + (who === 'expert' ? ' board is accepted (documented expert risk)' : ' board is not accepted'), async ({ page }, info) => {
      await openPuzzle(page, 'dickens');
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
    await expect(page.locator('.pz-reveal')).toContainText('Hoàng hậu Charlotte đưa cây vào');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(after.scene === gameScene ? linesBefore + 1 : 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:dickens'))).toBeNull();
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

  test('a board with an empty notch is incomplete and spends no check', async ({ page }, info) => {
    expect(reply(file, [['b', 'c'], ['d', 'e'], ['f', 'g'], []], new Set()).type).toBe('incomplete');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['b', 'c'], ['d', 'e'], ['f', 'g'], []]);
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

test.describe('chapter 18 script', () => {
  test('the script before the board names the six pieces in step with the board, and the lines after it match where the pair and the picture sit', () => {
    const text = JSON.stringify(script);
    expect(text).toContain('Một tấm thẻ cũ rời trang giấy: hôn dưới tầm gửi.');
    expect(text).toContain('Năm thẻ mới. Sách, thiệp. Cây ở Windsor, hình cây trên báo, cây của Albert.');
    expect(text).toContain('mảnh thứ sáu nằm ngoài');
    expect(text).toContain('Nó đứng nấc thứ ba, chia nấc với một tấm thiệp.');
    expect(text).toContain('Hai mảnh có bản ghi trước năm 1843. Cây ở Windsor: Hoàng hậu Charlotte dựng năm 1800, sớm nhất được biết ở Anh.');
    expect(text).toContain('Hình cây nhà Victoria và Albert lên báo năm 1848.');
    expect(text).toContain('Royal Collection ghi Charlotte đưa cây vào Anh. Đại học Birmingham và V&A ghi Albert, nhưng chỉ nói thập niên 1840; mảnh Albert đứng ngoài.');
    expect(text).not.toContain('bài carol');
    expect(text).not.toContain('Saturnalia');
    expect(text).not.toContain('Bốn tục kia');
    expect(text).not.toContain('Nấc cuối');
    expect(text).not.toContain('đầu tiên');
  });
});

test.describe('chapter 18 Sổ nguồn', () => {
  test('every line of the entry is verbatim in the research block, every link is opened, and the legend is legend 0 for the ending', () => {
    const research = readFileSync('research/m0b-act-3.md', 'utf8');
    const bt = String.fromCharCode(96);
    const start = research.indexOf('### 3.5 ' + bt + 'dickens' + bt);
    const heading = research.indexOf('### Sổ tay ' + bt + 'dickens' + bt, start);
    expect(heading, 'the block has its own heading').toBeGreaterThan(start);
    const block = research.slice(heading, research.indexOf('### 3.6', heading));
    const table = research.slice(start, heading);
    const entry = JSON.parse(readFileSync('story/notebook/dickens.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(entry).toMatchObject({ id: 'dickens', status: 'verified', source: 'research/m0b-act-3.md', stamp: 'SỰ THẬT' });
    expect(entry.card).toHaveLength(2);
    for (const line of entry.card) expect(block, line).toContain(line);
    for (const [section, points] of Object.entries(entry.full)) {
      for (const p of points) {
        expect(block, section + ': ' + p.text.slice(0, 40)).toContain(p.text);
        expect(p.sources.length).toBeGreaterThan(0);
        for (const s of p.sources) {
          expect(s.url).toMatch(/^https:\/\//);
          expect(table, s.url).toContain(s.url);
          expect(block, s.url).toContain(s.url);
        }
      }
    }
    expect(entry.full.legend?.[0]?.text).toMatch(/^Người ta hay gọi Dickens/u);
    expect(Object.keys(entry.full).sort()).toEqual(['dispute', 'fact', 'legend']);
    expect(entry.full.fact).toHaveLength(4);
    expect(entry.full.dispute).toHaveLength(1);
    expect(entry.full.fact?.[2]?.text, 'the tree line the cards lean on').toContain('Hoàng hậu Charlotte');
  });
});
test.describe('chapter 18 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'dickens')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('dickens') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'dickens', chapter: 'dickens', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'dickens' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'dickens' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['dickens']);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 18 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'dickens');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(2);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="dickens"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
