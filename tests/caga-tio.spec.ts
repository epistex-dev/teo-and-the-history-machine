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

const script = chapterOf('caga-tio');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('caga-tio');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;
type Card = { id: string; text: string; kind: string; status: string; do?: unknown };
const cards = (file as any).cards as Card[];
/**
 * What readers build with the cards hidden, from the slot labels, the piece wording and the script before the board (Tèo's lines, one per part of the custom and not listed; Quạ Đồn's line,
 * which Cúc Cu calls disputed; Cúc Cu's four sources in the order of the boxes).
 * The pieces: a (the song, printed in a book about Blanes), b (the hitting of a Tió placed at the hearth), c (the blanket on the end without a face, 24/12),
 * d (children hit it with sticks to make it 'poop' sweets), g (at first no face and no barretina), f (every part is from ancient times).
 * Slots in order: Bảo tàng Catalonia; Nhà nhân học, qua Betevé; Đài phát thanh Mỹ; Kho ca khúc Catalan (holds at most two pieces).
 * Casual: the song is for the song archive, the face and the hat for the anthropologist, the blanket for the radio, and the two lines about hitting (hearth, sticks)
 * look like one thing, so both go to the museum, which describes customs; the sweeping line sounds like Quạ Đồn's disputed one, so f stays out.
 * Well-read: knows an archive keeps songs and a museum keeps objects of a custom (the stick), and that a radio report tells the whole night, blanket and hitting at the hearth together.
 * Expert: knows the earliest song record (the archive), that the face and the hat are modern (the anthropologist), that the museum and the radio only describe today's custom
 * (stick, blanket) and that nobody says every part is ancient. What the expert cannot know without the cards is the one thing only the 1886 record says: that the book also has
 * the hitting at the hearth. So the expert leaves b out, and a board without b breaks the card that puts b with the song.
 * An expert who has also read Càntut's page gets the answer without a card (accepted risk, in the matrix note).
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['b', 'd'], ['g'], ['c'], ['a']],
  wellRead: [['d'], ['g'], ['b', 'c'], ['a']],
  expert: [['d'], ['g'], ['c'], ['a']],
};
const TRAP: Cell[] = [['d'], ['g', 'f'], ['c'], ['a', 'b']];
const FIT = 24;
const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'caga-tio', chapter: 'caga-tio', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 17 puzzle', () => {
  test('loads clean: a DOM puzzle with four sources, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'caga-tio', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('the puzzle is a full file with no stub left, no L2 exemption, and the checker finds three L2 steps', () => {
    expect(existsSync('story/puzzles/stubs/caga-tio.json')).toBe(false);
    expect(file).not.toHaveProperty('stub');
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'caga-tio'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps 3 \[hypothesis a≠1 ; hypothesis a≠2 ; hypothesis a≠3\]/);
    expect(out.stdout).not.toContain('EXEMPT');
  });

  test('the matrix row is full, names this file and repeats its cards and reveal', () => {
    const rows = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; state: string; puzzle: string; cards: { text: string; status: string }[]; reveal: string; solution: string; label: string; note: string }[];
    const row = rows.find((r) => r.id === 'caga-tio')!;
    expect(row.state).toBe('full');
    expect(row.puzzle).toBe('story/puzzles/caga-tio.json');
    expect(row.cards.map((c) => c.text)).toEqual(cards.map((c) => c.text));
    expect(row.cards.map((c) => c.status)).toEqual(cards.map((c) => c.status));
    expect(row.reveal).toBe(((file as any).reveal.lines as string[]).join(' '));
    expect(row.solution).toContain('Kho ca khúc Catalan: Bài hát đập Tió, in trong sách về làng Blanes + Đập Tió ở bếp lửa');
    expect(row.solution).toContain('để ngoài: Mọi phần của Tió đều lâu đời');
    expect(row.note, 'the accepted expert risk is documented').toContain('Rủi ro chuyên gia được chấp nhận');
  });

  test('each card says what it encodes: each source keeps its own line, the 1886 book gives only a shared source, the Betevé card also refuses its own box to the all-ancient line, and that line is otherwise only a condition', () => {
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(cards.map((c) => [c.id, c.kind, c.status])).toEqual([
      ['c1', 'modern', 'fact'],
      ['c2', 'modern', 'fact'],
      ['c3', 'modern', 'fact'],
      ['c4', 'inference', 'fact'],
      ['c5', 'inference', 'fact'],
    ]);
    expect(by.c1!.text).toBe('Bảo tàng ghi: nhờ những đòn gậy của trẻ con, người ta giả vờ Tió ỉa ra kẹo và quà.');
    expect(JSON.stringify(by.c1!.do)).toBe(JSON.stringify({ op: 'at', t: 'd', s: 's1' }));
    expect(by.c2!.text).toBe('NPR ghi: đêm 24/12, người ta phủ chăn lên đầu không có mặt của Tió.');
    expect(JSON.stringify(by.c2!.do)).toBe(JSON.stringify({ op: 'at', t: 'c', s: 's3' }));
    expect(by.c3!.text).toBe('Betevé ghi: Tió vốn không mặt, không mũ; cả hai phổ biến từ khoảng thập niên 1970. Tục bắt Tió «ỉa» mới hơn gốc cổ.');
    expect(JSON.stringify(by.c3!.do), 'the face line, and the source that itself calls the pooping newer is not the one that says every part is ancient').toBe(JSON.stringify([{ op: 'at', t: 'g', s: 's2' }, { op: 'notAt', t: 'f', s: 's2' }]));
    expect(by.c4!.text, 'the card says the book has both lines, and names no source box').toBe('Suy ra: sách in năm 1886 chép bài hát, kèm câu về việc đập Tió ở bếp lửa; hai lời ấy chung một nguồn.');
    expect(JSON.stringify(by.c4!.do), 'a shared source, never a place').toBe(JSON.stringify({ op: 'same', t: ['a', 'b'] }));
    expect(by.c5!.text).toBe('Suy ra: nguồn nào nói mọi phần của Tió đều lâu đời, nguồn ấy nêu niên đại bài hát. Chỉ sách 1886 và Betevé nêu.');
    expect(JSON.stringify(by.c5!.do), 'a condition satisfied by leaving the piece out or by the two sources that date the song, never an order to leave').toBe(JSON.stringify({ op: 'expr', e: ['or', ['not', ['placed', 'f']], ['eq', ['pos', 'f'], ['pos', 'a']], ['eq', ['pos', 'f'], 2]] }));
    expect((by.c4 as any).who).toBe('Suy ra từ Càntut (sách 1886)');
    for (const c of cards) expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/"unused"|"used"/u);
    for (const c of cards.filter((x) => x.id !== 'c3')) expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/"notAt"/u);
    expect((file as any).wrongFrame.cards, 'every card is part of what breaks the frame').toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    const cls = Object.fromEntries((file as any).tokens.map((t: any) => [t.id, t.status]));
    expect(cls).toEqual({ a: 'fact', b: 'fact', c: 'fact', d: 'fact', g: 'fact', f: 'decoy' });
  });

  test('no piece, rule or hint says which source holds what, and no piece names its source or its class', () => {
    const screen = JSON.stringify([(file as any).question, (file as any).rules, (file as any).hints.slice(0, 3), (file as any).tokens.map((t: any) => t.text)]);
    expect(screen).not.toMatch(/Josep|Fornés|Betevé|NPR|Gencat|Càntut|Cortils|1886|1970|ngoại giáo|tranh cãi|giả thuyết|truyền thuyết/u);
    expect(JSON.stringify((file as any).tokens.map((t: any) => t.text))).not.toMatch(/Bảo tàng|nhà nhân học|Đài|Kho ca khúc|người ta kể|Người ta kể/u);
    expect(JSON.stringify((file as any).hints.slice(0, 3))).not.toMatch(/bếp lửa|mặt|mũ|chăn|gậy|Blanes/u);
    expect((file as any).slots.map((s: any) => s.label)).toEqual(['Bảo tàng Catalonia', 'Nhà nhân học, qua Betevé', 'Đài phát thanh Mỹ', 'Kho ca khúc Catalan']);
    expect((file as any).slots.map((s: any) => [s.cap, s.min])).toEqual([['any', 1], ['any', 1], ['any', 1], [2, 1]]);
    const rules = (file as any).rules.map((r: any) => r.text).join(' ');
    expect(rules, 'the rules say what the slots enforce').toContain('Mỗi nguồn nhận ít nhất một mảnh. Kho ca khúc Catalan nhận nhiều nhất hai mảnh.');
    expect(file.predict?.options).toEqual(['Bài hát đập Tió', 'Chiếc gậy', 'Khuôn mặt và chiếc mũ']);
  });

  test('every card is needed: with any one removed the others leave more than one board, and no card is a legend', () => {
    const all = new Set(cards.map((c) => c.id));
    expect(solutions(file, all) as number[][]).toHaveLength(1);
    for (const c of cards) {
      const rest = new Set([...all].filter((id) => id !== c.id));
      expect((solutions(file, rest) as number[][]).length, 'without ' + c.id).toBeGreaterThan(1);
    }
  });

  test('the all-ancient line leaves the board only through the condition and the capacity of Kho ca khúc Catalan, never through an order', () => {
    const M = model(file) as { tid: string[] };
    const f = M.tid.indexOf('f');
    const all = new Set(cards.map((c) => c.id));
    const placed = (ids: Set<string>, p: unknown = file) => (solutions(p, ids, states(p)) as number[][]).filter((v) => v[f] !== 0).length;
    expect(placed(all), 'with every card the line has no place').toBe(0);
    expect(placed(new Set([...all].filter((id) => id !== 'c5'))), 'without the condition it fits somewhere').toBeGreaterThan(0);
    const roomy = JSON.parse(JSON.stringify(file));
    roomy.slots[3].cap = 3;
    expect(placed(all, roomy), 'with room for a third piece the condition is met by sitting with the song').toBeGreaterThan(0);
    const sol = solutions(file, all) as number[][];
    expect(sol[0]![f], 'the answer leaves it out').toBe(0);
  });

  test('BLIND: the boards readers build with the cards hidden fail the checker; the boards fitting what the expert knows hold one right answer, which is not the expert board', () => {
    for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
      expect(reply(file, b, new Set()).type, who).toBe('wrong');
      expect(sorted(b), who + ' is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    }
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const known: Record<string, number[]> = { a: [4], g: [2], f: [0] };
    const fit = all.filter((v) => Object.entries(known).every(([t, slots]) => slots.includes(v[M.tid.indexOf(t)] as number)));
    expect(fit.length, 'boards consistent with what the expert knows').toBeGreaterThanOrEqual(10);
    expect(fit.length).toBe(FIT);
    const right = solutions(file, new Set(cards.map((c) => c.id)), fit) as number[][];
    expect(right.length, 'exactly one of them agrees with every card').toBe(1);
    expect(sorted(answerOf(file, right[0] as number[]) as Cell[]), 'the answer is the file solution').toBe(sorted(file.solutions[0] as Cell[]));
    const expert = fit.find((v) => sorted(answerOf(file, v) as Cell[]) === sorted(BLIND.expert!));
    expect(expert, 'the expert board is among them').toBeTruthy();
    const known2: Record<string, number[]> = { ...known, d: [1], c: [3] };
    const fit2 = all.filter((v) => Object.entries(known2).every(([t, slots]) => slots.includes(v[M.tid.indexOf(t)] as number)));
    expect(fit2.length, 'even knowing the museum and the radio lines leaves five boards for the hearth line').toBe(5);
    expect(all.length).toBe((file as any).space);
  });

  for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
    test('BLIND in the page: with the cards removed from the page, the ' + who + ' board is not accepted', async ({ page }, info) => {
      await openPuzzle(page, 'caga-tio');
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
    await expect(page.locator('.pz-reveal')).toContainText('khoảng thập niên 1970');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(after.scene === gameScene ? linesBefore + 1 : 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:caga-tio'))).toBeNull();
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
    expect(reply(file, [['a', 'b', 'c', 'd', 'g'], [], [], ['f']], new Set()).type).toBe('incomplete');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['a', 'b', 'c', 'd', 'g'], [], [], ['f']]);
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

test.describe('chapter 17 script', () => {
  test('the script before the board gives Tèo\'s line about his draft, Quạ Đồn\'s line and the four sources in the order of the boxes; the lines after it speak of the song record, the plain log and what is undated', () => {
    const text = JSON.stringify(script);
    expect(text).toContain('Tôi ghi tục ấy thành từng dòng, mỗi việc một dòng.');
    expect(text).toContain('Tió có gốc là nghi lễ ngoại giáo mùa đông cổ.');
    expect(text).toContain('Chuyện đã gọi là cổ thì người ta nghe, mấy ai hỏi lại.');
    expect(text).toContain('Một bảo tàng Catalonia, một nhà nhân học, một đài phát thanh Mỹ và một kho ca khúc Catalan.');
    expect(text).toContain('Bài hát đập Tió chỉ thấy ghi từ cuối thế kỷ 19.');
    expect(text).toContain('Theo nhà nhân học Fornés, qua Betevé: Tió ban đầu là khúc củi trơn. Không mặt, không mũ.');
    expect(text).toContain('Còn chăn và gậy: chưa biết niên đại.');
  });
});

test.describe('chapter 17 Sổ nguồn', () => {
  test('every line of the entry is verbatim in the research block, every link is opened, and there is no legend', () => {
    const research = readFileSync('research/m0b-act-3.md', 'utf8');
    const start = research.indexOf('### 3.4 ' + String.fromCharCode(96) + 'caga-tio' + String.fromCharCode(96));
    const heading = research.indexOf('### Sổ tay ' + String.fromCharCode(96) + 'caga-tio' + String.fromCharCode(96), start);
    expect(heading, 'the block has its own heading').toBeGreaterThan(start);
    const block = research.slice(heading, research.indexOf('### 3.5', heading));
    const table = research.slice(start, heading);
    const entry = JSON.parse(readFileSync('story/notebook/caga-tio.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(entry).toMatchObject({ id: 'caga-tio', status: 'verified', source: 'research/m0b-act-3.md', stamp: 'TRANH CÃI' });
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
    expect(Object.keys(entry.full).sort()).toEqual(['dispute', 'fact']);
    expect(entry.full.fact).toHaveLength(3);
    expect(entry.full.dispute).toHaveLength(2);
    expect(entry.full.dispute?.[0]?.text).toMatch(/^Phía cổ:/u);
    expect(entry.full.dispute?.[1]?.text).toMatch(/^Phía thận trọng:/u);
  });
});

test.describe('chapter 17 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'caga-tio')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('caga-tio') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'caga-tio', chapter: 'caga-tio', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'caga-tio' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'caga-tio' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['caga-tio']);
    expect(stamp).toBe('TRANH CÃI');
    expect(seen, 'chapter 17 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'caga-tio');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(2);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="caga-tio"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
