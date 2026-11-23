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

const script = chapterOf('santa-ny');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('santa-ny');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;
type Card = { id: string; text: string; kind: string; status: string; do?: unknown };
const cards = (file as any).cards as Card[];
/**
 * What readers build with the cards hidden, from the slot labels, the piece wording and the question.
 * The pieces: a (sleigh with reindeer), b (plump, jolly old man), c (North Pole), d (red coat), e (Sundblom's painting), m (Moore's name tied to the poem).
 * Slots in order: Bài thơ năm 1823, Tranh Nast, Quảng cáo, Nguồn khác (holds at most one piece, may stay empty).
 * readerA, readerB and readerC are the three blind readers of dbfb3fe, as they placed the pieces then (m stands where their last piece, the beardless turkey-cart
 * piece, stood: it no longer exists, the Moore piece took its place). readerA (casual): red coat, jolly and Sundblom with the advertisement.
 * readerB (knows the popular story): sleigh and jolly with the poem, red coat and North Pole with Nast, Sundblom with the advertisement, and the Moore piece with the poem
 * (the story says Moore wrote it); before this redesign the same board with the beardless piece in Nguồn khác solved blind. readerC (expert): the sleigh in Nguồn khác
 * because it was printed in 1821; no card says the poem is the earliest, so nothing true is contradicted, the board just is not what the opened sources say.
 * Casual (also Tèo's frame): red coat with the advertisement. Well-read: red coat to the older tradition. Jolly expert: Coca-Cola says its advertising shaped the jolly character.
 * Expert: also knows that Moore's name first appears in a book of 1837, so the leftover piece goes to Nguồn khác; this board is the answer (accepted risk, as in chapter 11).
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['a', 'b'], ['c'], ['d', 'e'], ['m']],
  wellRead: [['a', 'b'], ['c', 'm'], ['e'], ['d']],
  jollyExpert: [['a'], ['c', 'd'], ['b', 'e'], ['m']],
  readerA: [['a', 'm'], ['c'], ['b', 'd', 'e'], []],
  readerB: [['a', 'b', 'm'], ['c', 'd'], ['e'], []],
  readerC: [['b'], ['c', 'd'], ['e'], ['a']],
};
const TRAP: Cell[] = BLIND.casual!;
const EXPERT: Cell[] = [['a', 'b'], ['c', 'd'], ['e'], ['m']];
const FIT = 51;
const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'santa-ny', chapter: 'santa-ny', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 16 puzzle', () => {
  test('loads clean: a DOM puzzle with four boxes, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'santa-ny', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
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
    expect(existsSync('story/puzzles/stubs/santa-ny.json')).toBe(false);
    expect(file).not.toHaveProperty('stub');
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'santa-ny'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps 2 \[hypothesis a≠2 ; hypothesis a≠3\]/);
    expect(out.stdout).not.toContain('EXEMPT');
  });

  test('the matrix row is full, names this file and repeats its cards and reveal', () => {
    const rows = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; state: string; puzzle: string; cards: { text: string; status: string }[]; reveal: string; solution: string; label: string; note: string }[];
    const row = rows.find((r) => r.id === 'santa-ny')!;
    expect(row.state).toBe('full');
    expect(row.puzzle).toBe('story/puzzles/santa-ny.json');
    expect(row.cards.map((c) => c.text)).toEqual(cards.map((c) => c.text));
    expect(row.cards.map((c) => c.status)).toEqual(cards.map((c) => c.status));
    expect(row.reveal).toBe(((file as any).reveal.lines as string[]).join(' '));
    expect(row.label).toBe((file as any).reveal.label);
    expect(row.solution).toContain('Tranh Nast: Ở Bắc Cực + Áo đỏ');
    expect(row.solution).toContain('Quảng cáo: Hình do Haddon Sundblom vẽ');
    expect(row.solution).toContain('Nguồn khác: Tên Moore gắn với bài thơ');
    expect(row.note, 'the accepted expert risk is documented').toContain('Rủi ro chuyên gia được chấp nhận');
  });

  test('each card says what it encodes: its constraint is exactly its sentence, the hedge stays a hedge, and no card is a record of authorship', () => {
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(cards.map((c) => [c.id, c.kind, c.status])).toEqual([
      ['c1', 'inference', 'fact'],
      ['c2', 'modern', 'fact'],
      ['c3', 'modern', 'fact'],
      ['c4', 'modern', 'fact'],
      ['c5', 'modern', 'fact'],
    ]);
    expect(by.c1!.text).toBe('Suy ra từ Columbia: dáng béo tròn, vui tính và xe trượt tuyết tuần lộc kéo chung một nguồn.');
    expect(JSON.stringify(by.c1!.do)).toBe(JSON.stringify([{ op: 'same', t: ['a', 'b'] }]));
    expect(by.c2!.text).toBe('Coca-Cola ghi: trước năm 1931 đã có nhiều hình ông già Noel. Trang của hãng về Sundblom: áo đỏ có trước khi ông vẽ.');
    expect(JSON.stringify(by.c2!.do)).toBe(JSON.stringify([{ op: 'at', t: 'e', s: 's3' }, { op: 'notAt', t: 'd', s: 's3' }]));
    expect(by.c3!.text).toBe('HarpWeek ghi: trong bản thơ do Nast minh họa năm 1869, áo ông già Noel được đổi sang màu đỏ.');
    expect(JSON.stringify(by.c3!.do)).toBe(JSON.stringify([{ op: 'at', t: 'd', s: 's2' }]));
    expect(by.c4!.text, 'Nast may have been the first: the card keeps the hedge').toBe('HarpWeek ghi: ông già Noel ở Bắc Cực, có thể Nast vẽ sớm nhất.');
    expect(JSON.stringify(by.c4!.do), 'and its constraint is a choice, never a placement').toBe(JSON.stringify([{ op: 'oneOf', t: 'c', s: ['s2', 's4'] }]));
    expect(by.c5!.text, 'the name Moore is tied to the poem in 1837; who wrote it stays open').toBe('NYSL ghi: bài thơ năm 1823 in ra không đề tên tác giả; năm 1837, sách của Hoffman nêu tên Moore.');
    expect(JSON.stringify(by.c5!.do)).toBe(JSON.stringify([{ op: 'notAt', t: 'm', s: 's1' }, { op: 'at', t: 'm', s: 's4' }]));
    for (const c of cards) {
      expect(c.text, c.id + ' never says who wrote the poem').not.toMatch(/Livingston|1822|1844|phát minh|Sinterklaas|là tác giả|viết bài thơ/u);
      expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/"unused"|"used"/u);
    }
    expect((file as any).wrongFrame.cards, 'two cards break the frame, neither is named as the discovery').toEqual(['c2', 'c3']);
    const c = (file as any).tokens.find((t: any) => t.id === 'c');
    expect(c.status, 'the hedged piece is the disputed one').toBe('disputed');
    for (const id of ['a', 'b', 'd', 'e', 'm']) expect((file as any).tokens.find((t: any) => t.id === id).status, id).toBe('fact');
  });

  test('the red coat: Coca-Cola ads are not where it starts, and no piece, rule or hint says which hand holds what', () => {
    const screen = JSON.stringify([(file as any).question, (file as any).rules, (file as any).hints.slice(0, 3), (file as any).tokens.map((t: any) => t.text)]);
    expect(screen).not.toMatch(/Livingston|truyền thuyết|tranh cãi|giả thuyết|1869|1837|1858|Columbia|OSU|HarpWeek|NYSL|Hoffman|phát minh|nặc danh|không ghi tên/u);
    expect(JSON.stringify((file as any).tokens.map((t: any) => t.text)), 'a piece names its slot only for the Moore piece, which says only what it is tied to').not.toMatch(/Nast|quảng cáo|Nguồn khác|1837|sách/iu);
    expect(JSON.stringify((file as any).hints.slice(0, 3))).not.toMatch(/Bắc Cực|Áo đỏ/u);
    expect((file as any).slots.map((s: any) => s.label)).toEqual(['Bài thơ năm 1823', 'Tranh Nast', 'Quảng cáo', 'Nguồn khác']);
    expect((file as any).slots.map((s: any) => [s.cap, s.min])).toEqual([['any', 1], ['any', 1], ['any', 1], [1, 0]]);
    const rules = (file as any).rules.map((r: any) => r.text).join(' ');
    expect(rules, 'the rule says what the slots enforce').toContain('mỗi nơi nhận ít nhất một mảnh');
    expect(rules).toContain('Nguồn khác nhận nhiều nhất một mảnh');
    expect(file.predict?.options).toEqual(['Từ quảng cáo năm 1931', 'Từ trước năm 1931', 'Không ai biết']);
  });

  test('every card is needed: with any one removed the others leave more than one board, and no card is a legend', () => {
    const all = new Set(cards.map((c) => c.id));
    expect(solutions(file, all) as number[][]).toHaveLength(1);
    for (const c of cards) {
      const rest = new Set([...all].filter((id) => id !== c.id));
      expect((solutions(file, rest) as number[][]).length, 'without ' + c.id).toBeGreaterThan(1);
    }
  });

  test('the poem pieces sit in their slot only by the rules: nothing but the hand minimum and the card on the shared source puts them there', () => {
    const M = model(file) as { tid: string[] };
    const loose = (drop: string[]) => (solutions(file, new Set(cards.map((c) => c.id).filter((id) => !drop.includes(id)))) as number[][]).filter((v) => v[M.tid.indexOf('a')] !== 1).length;
    expect(loose([]), 'with every card the sleigh cannot sit anywhere but the poem').toBe(0);
    expect(loose(['c1']), 'without card 1 the sleigh has other places').toBeGreaterThan(0);
  });

  test('BLIND: the boards readers build with the cards hidden fail the checker; the boards fitting what the expert knows hold one right answer that is not the casual one; the expert board solves (accepted risk)', () => {
    for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
      expect(reply(file, b, new Set()).type, who).not.toBe('solved');
      expect(sorted(b), who + ' is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    }
    expect(reply(file, EXPERT, new Set()).type, "an expert who also knows that the name Moore first appears in 1837 needs no card").toBe('solved');
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const known: Record<string, number[]> = { a: [1, 4], b: [1, 3], c: [2, 4], d: [1, 2, 4], e: [3] };
    const fit = all.filter((v) => Object.entries(known).every(([t, slots]) => slots.includes(v[M.tid.indexOf(t)] as number)));
    expect(fit.length, 'boards consistent with what the expert knows').toBeGreaterThanOrEqual(10);
    expect(fit.length).toBe(FIT);
    const right = solutions(file, new Set(cards.map((c) => c.id)), fit) as number[][];
    expect(right.length, 'exactly one of them agrees with every card').toBe(1);
    expect(sorted(answerOf(file, right[0] as number[]) as Cell[]), 'the answer is the file solution').toBe(sorted(file.solutions[0] as Cell[]));
    const jolly = fit.find((v) => sorted(answerOf(file, v) as Cell[]) === sorted(BLIND.jollyExpert!));
    expect(jolly, 'the jolly expert board is among them').toBeTruthy();
    expect(sorted(answerOf(file, jolly as number[]) as Cell[]), 'and it is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    expect(all.length).toBe((file as any).space);
  });

  for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP, expert: EXPERT })) {
    test('BLIND in the page: with the cards removed from the page, the ' + who + (who === 'expert' ? ' board is accepted (documented expert risk)' : ' board is not accepted'), async ({ page }, info) => {
      await openPuzzle(page, 'santa-ny');
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
    await expect(page.locator('.pz-reveal')).toContainText('trước quảng cáo 1931');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(after.scene === gameScene ? linesBefore + 1 : 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:santa-ny'))).toBeNull();
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

  test('a board with an empty hand is incomplete and spends no check', async ({ page }, info) => {
    expect(reply(file, [['a', 'b', 'c', 'd', 'e'], [], [], ['m']], new Set()).type).toBe('incomplete');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['a', 'b', 'c', 'd', 'e'], [], [], ['m']]);
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

test.describe('chapter 16 script', () => {
  test('the three lines after the board name what the board shows, and no line speaks of a piece the puzzle does not have', () => {
    const text = JSON.stringify(script);
    expect(text).toContain('Bài thơ nặc danh giữ hai nét: xe trượt tuyết và dáng béo tròn vui tính.');
    expect(text).toContain('Áo đỏ về với tranh Nast, nét Bắc Cực có lẽ cũng vậy; hình do Sundblom vẽ nằm bên quảng cáo.');
    expect(text).toContain('Tên Moore nằm riêng ở ô Nguồn khác: dưới bài thơ năm 1823 không in tên ai, đến năm 1837 một cuốn sách mới nêu.');
    expect(text).not.toMatch(/chai nước ngọt|một người phát minh|gà tây/iu);
  });
});

test.describe('chapter 16 Sổ nguồn', () => {
  test('every line of the entry is verbatim in the research block, every link is opened, and the invention legend is legend 0 for the ending', () => {
    const research = readFileSync('research/m0b-act-3.md', 'utf8');
    const start = research.indexOf('### 3.3 ' + String.fromCharCode(96) + 'santa-ny' + String.fromCharCode(96));
    const heading = research.indexOf('### Sổ tay ' + String.fromCharCode(96) + 'santa-ny' + String.fromCharCode(96), start);
    expect(heading, 'the block has its own heading').toBeGreaterThan(start);
    const block = research.slice(heading, research.indexOf('### 3.4', heading));
    const table = research.slice(start, heading);
    const entry = JSON.parse(readFileSync('story/notebook/santa-ny.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(entry).toMatchObject({ id: 'santa-ny', status: 'verified', source: 'research/m0b-act-3.md', stamp: 'TRANH CÃI' });
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
    expect(entry.full.legend?.[0]?.text).toMatch(/^Người ta hay kể rằng Coca-Cola/u);
    expect(Object.keys(entry.full).sort()).toEqual(['dispute', 'fact', 'legend']);
    expect(entry.full.fact).toHaveLength(4);
    expect(entry.full.dispute).toHaveLength(3);
  });
});

test.describe('chapter 16 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'santa-ny')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('santa-ny') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'santa-ny', chapter: 'santa-ny', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'santa-ny' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'santa-ny' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['santa-ny']);
    expect(stamp).toBe('TRANH CÃI');
    expect(seen, 'chapter 16 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'santa-ny');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(2);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="santa-ny"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
