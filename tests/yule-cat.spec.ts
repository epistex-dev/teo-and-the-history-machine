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

const script = chapterOf('yule-cat');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('yule-cat');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;
type Card = { id: string; text: string; kind: string; status: string; do?: unknown };
const cards = (file as any).cards as Card[];
/**
 * What readers build with the cards hidden, from the slot labels, the piece wording and the script before the board (Cúc Cu's four sources in order;
 * Quạ Đồn's Viking line, which Cúc Cu calls unproven; these readers doubt the oldest-sounding piece and leave it out, a reader who trusts it builds TRAP).
 * The pieces: a (grabs those without a new coat, or takes their Christmas food), c (eats children), d (the cat watches the preparations),
 * e (from the Yule goat of Norway, in the last two centuries), f (probably much older), g (already in medieval books).
 * Slots in order: Jón Árnason, Nhà dân tộc học, Thư viện Quốc gia (holds at most one piece), Hai học giả (holds at most two).
 * Casual: both stories of what the cat does belong to the old book of tales; the library has nothing obvious to say and stays empty.
 * Well-read: knows Jón Árnason collected the tales and that ethnologists compare customs, so the Norwegian origin goes with the ethnologist.
 * Expert variant: knows the 1864 book only has the hedged line and that eating children came later, but takes the library for a place that tells nothing of its own,
 * so the retelling goes with the ethnologist's reading of the custom.
 * Expert: knows the 1864 book, the later retelling, and that Viking has no source; the one piece left over fits the one slot left. This board is the answer:
 * nothing in the opened sources separates it from what an expert already knows, so no card is needed (accepted risk, as in chapter 16).
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['a', 'c'], ['d'], [], ['e', 'f']],
  wellRead: [['a', 'c'], ['d', 'e'], [], ['f']],
  expertVariant: [['a'], ['c', 'd'], [], ['e', 'f']],
};
const TRAP: Cell[] = [['a'], ['d'], ['c'], ['f', 'g']];
const EXPERT: Cell[] = [['a'], ['d'], ['c'], ['e', 'f']];
const FIT = 154;
const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'yule-cat', chapter: 'yule-cat', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 15 puzzle', () => {
  test('loads clean: a DOM puzzle with four sources, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'yule-cat', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
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
    expect(existsSync('story/puzzles/stubs/yule-cat.json')).toBe(false);
    expect(file).not.toHaveProperty('stub');
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'yule-cat'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps 2 \[hypothesis e≠1 ; hypothesis e≠2\]/);
    expect(out.stdout).not.toContain('EXEMPT');
  });

  test('the matrix row is full, names this file and repeats its cards and reveal', () => {
    const rows = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; state: string; puzzle: string; cards: { text: string; status: string }[]; reveal: string; solution: string; label: string; note: string }[];
    const row = rows.find((r) => r.id === 'yule-cat')!;
    expect(row.state).toBe('full');
    expect(row.puzzle).toBe('story/puzzles/yule-cat.json');
    expect(row.cards.map((c) => c.text)).toEqual(cards.map((c) => c.text));
    expect(row.cards.map((c) => c.status)).toEqual(cards.map((c) => c.status));
    expect(row.reveal).toBe(((file as any).reveal.lines as string[]).join(' '));
    expect(row.solution).toContain('Thư viện Quốc gia: Ăn trẻ em chưa kịp có áo mới trước Giáng Sinh');
    expect(row.solution).toContain('để ngoài: Đã có mặt trong sách thời trung cổ');
    expect(row.note, 'the accepted expert risk is documented').toContain('Rủi ro chuyên gia được chấp nhận');
  });

  test('each card says what it encodes: the hedge stays the writer\'s own, the dispute stays undecided, and the Viking line is only a condition', () => {
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(cards.map((c) => [c.id, c.kind, c.status])).toEqual([
      ['c1', 'record', 'fact'],
      ['c2', 'modern', 'fact'],
      ['c3', 'modern', 'fact'],
      ['c4', 'modern', 'disputed'],
      ['c5', 'inference', 'fact'],
    ]);
    expect(by.c1!.text).toBe('Jón Árnason chép «tóm (ăn?)», dấu hỏi là của chính ông. Trang ấy không nêu riêng trẻ em.');
    expect(JSON.stringify(by.c1!.do), 'the question mark is his: the child-eating line is not on his page').toBe(JSON.stringify([{ op: 'at', t: 'a', s: 's1' }, { op: 'notAt', t: 'c', s: 's1' }]));
    expect(by.c2!.text).toBe('Thư viện Quốc gia ghi: theo truyện dân gian, con quái ăn trẻ em không kịp có áo mới trước lễ.');
    expect(JSON.stringify(by.c2!.do)).toBe(JSON.stringify({ op: 'at', t: 'c', s: 's3' }));
    expect(by.c3!.text).toBe('Nhà dân tộc học ghi: như nhiều sinh vật Giáng Sinh, Mèo Yule theo dõi việc chuẩn bị lễ, để ai cũng làm xong việc.');
    expect(JSON.stringify(by.c3!.do)).toBe(JSON.stringify({ op: 'at', t: 'd', s: 's2' }));
    expect(by.c4!.text, 'the card names both scholars and says only that both lines come from one article').toBe('Árni Björnsson cho rằng truyện sinh ra nhờ chuyện dê Yule; Guðmundur Ólafsson không đồng ý: có lẽ cổ hơn. Hai lời chung một bài.');
    expect(JSON.stringify(by.c4!.do), 'and its constraint is a shared source, never a verdict on who is right').toBe(JSON.stringify({ op: 'same', t: ['e', 'f'] }));
    expect(by.c5!.text).toBe('Suy ra: nguồn nào nói mèo đã có mặt trong sách thời trung cổ, nguồn ấy cũng nói truyện có lẽ cổ hơn nhiều.');
    expect(JSON.stringify(by.c5!.do), 'a condition satisfied by leaving the piece out, never an order to leave').toBe(JSON.stringify({ op: 'expr', e: ['or', ['not', ['placed', 'g']], ['eq', ['pos', 'g'], ['pos', 'f']]] }));
    for (const c of cards) {
      expect(c.text, c.id + ' leaves the year out and the legend\'s class phrase to its own card').not.toMatch(/1864|1862|Grýla/u);
      expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/"unused"|"used"/u);
    }
    expect((file as any).wrongFrame.cards, 'every card is part of what breaks the frame').toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    const cls = Object.fromEntries((file as any).tokens.map((t: any) => [t.id, t.status]));
    expect(cls).toEqual({ a: 'fact', c: 'legend', d: 'fact', e: 'disputed', f: 'disputed', g: 'decoy' });
    expect((file as any).slots[2]).toMatchObject({ lane: 'legend', accepts: ['legend'], cap: 1 });
  });

  test('no piece, rule or hint says which source holds what, and no piece names its source or its class', () => {
    const screen = JSON.stringify([(file as any).question, (file as any).rules, (file as any).hints.slice(0, 3), (file as any).tokens.map((t: any) => t.text)]);
    expect(screen).not.toMatch(/Árni|Guðmundur|Hrefna|Landsbókasafn|bbl\.is|Vísindavefur|truyền thuyết|tranh cãi|giả thuyết|1864|dấu hỏi/u);
    expect(JSON.stringify((file as any).tokens.map((t: any) => t.text))).not.toMatch(/Jón|dân tộc học|Thư viện|học giả|người ta kể|Người ta kể/u);
    expect(JSON.stringify((file as any).hints.slice(0, 3))).not.toMatch(/Viking|trẻ em|cổ hơn|Na Uy|đan áo/u);
    expect((file as any).slots.map((s: any) => s.label)).toEqual(['Jón Árnason', 'Nhà dân tộc học', 'Thư viện Quốc gia', 'Hai học giả']);
    expect((file as any).slots.map((s: any) => [s.cap, s.min])).toEqual([['any', 1], ['any', 1], [1, 0], [2, 1]]);
    const rules = (file as any).rules.map((r: any) => r.text).join(' ');
    expect(rules, 'the rules say what the slots enforce').toContain('Jón Árnason, Nhà dân tộc học và Hai học giả mỗi nguồn nhận ít nhất một mảnh');
    expect(rules).toContain('Thư viện Quốc gia nhận nhiều nhất một mảnh. Hai học giả nhận nhiều nhất hai mảnh');
    expect(file.predict?.options).toEqual(['Ăn thịt họ', 'Tóm họ', 'Dọa rồi tha']);
  });

  test('every card is needed: with any one removed the others leave more than one board, and no card is a legend', () => {
    const all = new Set(cards.map((c) => c.id));
    expect(solutions(file, all) as number[][]).toHaveLength(1);
    for (const c of cards) {
      const rest = new Set([...all].filter((id) => id !== c.id));
      expect((solutions(file, rest) as number[][]).length, 'without ' + c.id).toBeGreaterThan(1);
    }
  });

  test('the Viking line leaves the board only through the condition and the capacity of Hai học giả, never through an order', () => {
    const M = model(file) as { tid: string[] };
    const g = M.tid.indexOf('g');
    const all = new Set(cards.map((c) => c.id));
    const placed = (ids: Set<string>, f: unknown = file) => (solutions(f, ids, states(f)) as number[][]).filter((v) => v[g] !== 0).length;
    expect(placed(all), 'with every card the Viking line has no place').toBe(0);
    expect(placed(new Set([...all].filter((id) => id !== 'c5'))), 'without the condition it fits somewhere').toBeGreaterThan(0);
    const roomy = JSON.parse(JSON.stringify(file));
    roomy.slots[3].cap = 3;
    expect(placed(all, roomy), 'with room for a third piece the condition is met by sitting with the older line').toBeGreaterThan(0);
    const sol = solutions(file, all) as number[][];
    expect(sol[0]![g], 'the answer leaves it out').toBe(0);
  });

  test('BLIND: the boards readers build with the cards hidden fail the checker; the boards fitting what the expert knows hold one right answer; the expert board solves (accepted risk)', () => {
    for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
      expect(reply(file, b, new Set()).type, who).not.toBe('solved');
      expect(sorted(b), who + ' is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    }
    expect(reply(file, EXPERT, new Set()).type, 'an expert who knows the 1864 hedge, the later retelling and the missing Viking source needs no card').toBe('solved');
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const known: Record<string, number[]> = { a: [1], c: [0, 2, 3, 4], g: [0] };
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
      await openPuzzle(page, 'yule-cat');
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
    await expect(page.locator('.pz-reveal')).toContainText('dấu hỏi là của người chép');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(after.scene === gameScene ? linesBefore + 1 : 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:yule-cat'))).toBeNull();
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

  test('a board with an empty source is incomplete and spends no check', async ({ page }, info) => {
    expect(reply(file, [['a', 'c', 'd', 'e', 'f'], [], [], ['g']], new Set()).type).toBe('incomplete');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['a', 'c', 'd', 'e', 'f'], [], [], ['g']]);
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

test.describe('chapter 15 script', () => {
  test('the script before the board names the four sources in the order of the boxes and gives Quạ Đồn\'s line; the lines after it speak of the hedge and of a later retelling', () => {
    const text = JSON.stringify(script);
    expect(text).toContain('sách truyện dân gian của Jón Árnason, một nhà dân tộc học, Thư viện Quốc gia và hai học giả');
    expect(text).toContain('Mèo Yule có từ thời Viking.');
    expect(text).toContain('Của người chép. Ông ghi lại lời tin, chứ chưa dám chắc nó ăn.');
    expect(text).toContain('Người ta kể rằng nó ăn trẻ em: đó là lời kể sau.');
    expect(text).toContain('dẫn Árni Björnsson');
    expect(text).toContain('nhà khảo cổ Guðmundur Ólafsson');
  });
});

test.describe('chapter 15 Sổ nguồn', () => {
  test('every line of the entry is verbatim in the research block, every link is opened, and the legend is legend 0 for the ending', () => {
    const research = readFileSync('research/m0b-act-3.md', 'utf8');
    const start = research.indexOf('### 3.2 ' + String.fromCharCode(96) + 'yule-cat' + String.fromCharCode(96));
    const heading = research.indexOf('### Sổ tay ' + String.fromCharCode(96) + 'yule-cat' + String.fromCharCode(96), start);
    expect(heading, 'the block has its own heading').toBeGreaterThan(start);
    const block = research.slice(heading, research.indexOf('### 3.3', heading));
    const table = research.slice(start, heading);
    const entry = JSON.parse(readFileSync('story/notebook/yule-cat.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(entry).toMatchObject({ id: 'yule-cat', status: 'verified', source: 'research/m0b-act-3.md', stamp: 'TRUYỀN THUYẾT' });
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
    expect(entry.full.legend?.[0]?.text).toMatch(/^Người ta kể rằng con mèo ăn/u);
    expect(Object.keys(entry.full).sort()).toEqual(['dispute', 'fact', 'legend']);
    expect(entry.full.fact).toHaveLength(3);
    expect(entry.full.dispute).toHaveLength(2);
  });
});

test.describe('chapter 15 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'yule-cat')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('yule-cat') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'yule-cat', chapter: 'yule-cat', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'yule-cat' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'yule-cat' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['yule-cat']);
    expect(stamp).toBe('TRUYỀN THUYẾT');
    expect(seen, 'chapter 15 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'yule-cat');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(2);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="yule-cat"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
