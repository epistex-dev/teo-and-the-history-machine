import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ORDER } from '../src/order.ts';
import type { Beat } from '../src/story/types.ts';
import { expectClean, monitor } from './support/helpers.ts';
import { advanceStory, reachMinigame, seedSave, solveMinigame, realInput, stateOf, storedSave, storyOf, typeName, waitReady } from './support/play.ts';
import { check, fillBoard, press, puzzleFile, puzzleOf, toBoard as reachBoard, waitPuzzlePhase, wrongFill, type Cell } from './support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from './support/script.ts';
import { reply } from '../scripts/puzzles.mjs';

const script = chapterOf('silent-night');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('silent-night');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;
const without = (id: string) => ({ ...file, cards: file.cards.filter((c) => c.id !== id) });

/**
 * Pieces: g Gruber's commission (two solo voices, choir, guitar), a Mohr tenor and guitar with Gruber bass, f the church singers repeat the last four bars (disputed),
 * c the lost original, k the oldest copy, e the mouse and the guitar (legend).
 * Slots: s1 Gruber 1854, s2 Oberndorf museum, s3 Salzburg museum, s4 Salzburgerland (legend lane). Slot labels are source names and say nothing of a piece's class.
 * Tèo's frame (Quạ Đồn): Gruber's account tells the whole night, so the commission, the voices and the choir all sit on his page.
 */
const TRAP: Cell[] = [['g', 'a', 'f'], [], ['c', 'k'], ['e']];
/**
 * Readers who see the cards hidden: the labels, the six pieces' wording, the rules. Each submits one natural board.
 * Accepted blind risk (as in chapter 9): the slot labels are source names, so a reader who knows what each of the four sources says
 * places the pieces by name and wins without a card. No honest extra card changes that, since the answer is the source-name board.
 */
type Reader = [who: string, board: Cell[], result: 'wrong' | 'solved'];
const READERS: Reader[] = [
  ['by source name: commission to Gruber, voices and choir to Oberndorf, copies to Salzburg, the mouse tale to Salzburgerland (a reader who knows the four sources)', [['g'], ['a', 'f'], ['c', 'k'], ['e']], 'solved'],
  ['gruber tells everything', TRAP, 'wrong'],
  ['the local museum knows the night', [[], ['g', 'a', 'f'], ['c', 'k'], ['e']], 'wrong'],
  ['commission and voices on Gruber, choir at the museum', [['g', 'a'], ['f'], ['c', 'k'], ['e']], 'wrong'],
  ['choir left out, the rest by label', [['g', 'a'], [], ['c', 'k'], ['e']], 'wrong'],
  ['choir left out as disputed, voices at the museum', [['g'], ['a'], ['c', 'k'], ['e']], 'wrong'],
  ['voices and choir on Gruber, commission at the museum', [['a', 'f'], ['g'], ['c', 'k'], ['e']], 'wrong'],
  ['every piece placed, the mouse tale with the copies', [['g'], ['a', 'f'], ['c', 'k', 'e'], []], 'wrong'],
];
const SOLVED = file.solutions[0] as Cell[];

const IDS = file.tokens.map((t) => t.id);
const board = (at: Record<string, number>): Cell[] => file.slots.map((_, i) => IDS.filter((t) => at[t] === i + 1));
/** Every board the page accepts for a check (right size, no slot over capacity, no slot below its minimum). */
function everyBoard(): Record<string, number>[] {
  const out: Record<string, number>[] = [];
  const go = (i: number, at: Record<string, number>): void => {
    if (i === IDS.length) {
      const t = reply(file, board(at), new Set()).type;
      if (t !== 'format' && t !== 'incomplete') out.push({ ...at });
      return;
    }
    for (let s = 0; s <= file.slots.length; s += 1) go(i + 1, { ...at, [IDS[i] as string]: s });
  };
  go(0, {});
  return out;
}

/** The skip button and the first bank piece can share a spot: the page ignores a tap there within the double-tap pause. */
async function toBoard(page: Page, info: TestInfo): Promise<void> {
  await reachBoard(page, info);
  await page.waitForTimeout(400);
}

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'silent-night', chapter: 'silent-night', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 13 puzzle', () => {
  test('loads clean: a DOM puzzle with four sources, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'silent-night', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('one hypothesis step on the real path and no exemption, bots under 5 percent, and without the sourced cards nothing is decided', async () => {
    expect(file, 'the puzzle carries no L2 exemption').not.toHaveProperty('l2Exempt');
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'silent-night'], { encoding: 'utf8' });
    expect(report).toMatch(/L2 steps 1 \[hypothesis a≠1\]/u);
    expect(report).not.toContain('EXEMPT');
    expect(report).toMatch(/valid answer space 9990 \(declared 9990\)/u);
    expect(report).toMatch(/without all sourced cards 9990 solution/u);
    expect(report).toMatch(/c1:1→3 c2:1→2 c3:1→3 c4:1→16 c5:1→5/u);
    const bots = [...report.matchAll(/(random|mash|hill-climber|local-search|tap-everything|bank order|idle|hold) ([\d.]+)%/gu)];
    expect(bots.length).toBeGreaterThanOrEqual(8);
    for (const [, name, pct] of bots) expect(Number(pct), name).toBeLessThanOrEqual(5);
    expect(reply(file, [['g', 'a', 'f', 'c'], [], ['k'], ['e']] as Cell[], new Set())).toEqual({ type: 'format', reason: 'capacity' });
    const raw = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; l2: string; state: string; puzzle: string }[];
    const row = raw.find((r) => r.id === 'silent-night');
    expect(row).toMatchObject({ state: 'full', puzzle: 'story/puzzles/silent-night.json' });
    expect(row?.l2, 'the minigames row names the same hypothesis the checker finds').toContain('«Mohr hát tenor và đệm guitar, Gruber hát bass» nằm ở «Gruber, 1854»');
    expect(existsSync('story/puzzles/stubs/silent-night.json'), 'the stub goes once the full puzzle exists').toBe(false);
  });

  test('every card says what its constraint does: a source claim is an at, an inference names its source, the disputed choir is never ordered off the board', () => {
    const raw = JSON.parse(readFileSync('story/puzzles/silent-night.json', 'utf8')) as {
      slots: { id: string; label: string; cap?: number | string; lane?: string; accepts?: string[] }[];
      tokens: { id: string; text: string; status: string }[];
      cards: { id: string; who: string; kind: string; status: string; text: string; do: unknown }[];
    };
    const card = (id: string) => raw.cards.find((c) => c.id === id)!;
    const ops = (c: { do: unknown }) => ([] as { op: string }[]).concat(c.do as { op: string }[]);
    expect(raw.cards.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    for (const c of raw.cards) {
      expect(c.status).toBe('fact');
      expect(ops(c).map((d) => d.op), 'card ' + c.id + ' never takes a piece off the board by an order').not.toContain('unused');
      expect(ops(c).map((d) => d.op)).not.toContain('notAt');
      expect(c.who.length).toBeGreaterThan(0);
    }
    expect(card('c1')).toMatchObject({ kind: 'inference', who: 'Suy ra từ Gruber, 1854', do: { op: 'count', t: ['g', 'a', 'f'], s: 's1', n: 1 } });
    expect(card('c2')).toMatchObject({ kind: 'inference', who: 'Suy ra từ Bảo tàng Oberndorf', do: { op: 'count', t: ['g', 'a', 'f'], s: 's2', n: 2 } });
    expect(card('c2').text, 'the card says what the museum page says: it has the two pieces the Gruber account lacks').toBe('Về hợp xướng và giọng hát: bảo tàng Oberndorf có hai mảnh mà bản kể Gruber không có.');
    expect(card('c3')).toMatchObject({ kind: 'inference', who: 'Suy ra từ Bảo tàng Oberndorf', do: { op: 'same', t: ['a', 'f'] } });
    expect(card('c4')).toMatchObject({ kind: 'modern', who: 'Bảo tàng Salzburg', do: [{ op: 'at', t: 'c', s: 's3' }, { op: 'at', t: 'k', s: 's3' }] });
    expect(card('c4').text).toMatch(/1820/u);
    expect(card('c5')).toMatchObject({ kind: 'modern', who: 'Salzburgerland', do: { op: 'at', t: 'e', s: 's4' } });
    expect(card('c5').text).toMatch(/1909/u);
    expect(card('c5').text).toMatch(/1954/u);
    expect(raw.slots.map((s) => s.label)).toEqual(['Gruber, 1854', 'Bảo tàng Oberndorf', 'Bảo tàng Salzburg', 'Salzburgerland']);
    expect(raw.tokens.find((t) => t.id === 'f')?.status, 'the choir piece is disputed, not a decoy').toBe('disputed');
    expect(raw.tokens.find((t) => t.id === 'e')?.status).toBe('legend');
    expect(raw.slots.find((s) => s.id === 's4')).toMatchObject({ lane: 'legend', accepts: ['legend'] });
    expect(file.solutions[0]).toEqual([['g'], ['a', 'f'], ['c', 'k'], ['e']]);
    // The choir has an honest home at the museum that tells it, and every other source refuses it.
    expect(reply(file, [['g', 'f'], ['a'], ['c', 'k'], ['e']] as Cell[], new Set()).type).toBe('wrong');
    for (const slot of [0, 1, 2]) {
      const moved = SOLVED.map((c) => ([] as string[]).concat(c ?? []).filter((t) => t !== 'f')) as Cell[];
      moved[slot] = ([] as string[]).concat(moved[slot] ?? [], 'f');
      expect(reply(file, moved, new Set()).type === 'solved', 'the choir in slot ' + (slot + 1)).toBe(slot === 1);
    }
    expect(reply(file, [['g'], ['a'], ['c', 'k'], ['e']] as Cell[], new Set()).type, 'leaving the choir off the board never solves').toBe('wrong');
  });

  test('wording: no piece, rule, question or prediction states a class, and the rules and the question say the same thing as the board', () => {
    const talk = /truyền thuyết|giả thuyết|người ta kể|lời đồn|chưa có nguồn|không có nguồn|chưa được chứng minh|chưa ai chứng minh|sai rồi|tranh cãi|không đúng/iu;
    for (const t of file.tokens as { text: string }[]) expect(t.text).not.toMatch(talk);
    const told = [(file as unknown as { question: string }).question, JSON.stringify((file as unknown as { rules: unknown }).rules), JSON.stringify(file.predict), ...file.hints.slice(0, 3).map((h) => h.text)];
    for (const s of told) {
      expect(s).not.toMatch(talk);
      expect(s, 'nothing before hint 4 names the mouse piece').not.toMatch(/chuột/iu);
    }
    const q = (file as unknown as { question: string }).question;
    expect(q).toContain('Bốn nguồn');
    expect(q).toContain('sáu mảnh');
    expect(q).not.toMatch(/không có chỗ/u);
    expect(file.slots).toHaveLength(4);
    expect(file.tokens).toHaveLength(6);
    const rules = (file as unknown as { rules: { text: string }[] }).rules.map((r) => r.text).join(' ');
    expect(rules).toMatch(/Gruber, 1854 nhận nhiều nhất 3 mảnh/u);
    expect(rules).toMatch(/Salzburgerland nhận nhiều nhất một mảnh/u);
    expect(rules).toMatch(/Mảnh có thể không đặt/u);
    expect(rules).toMatch(/Kiểm tra chấm cả bốn nguồn một lượt/u);
    const [, , long] = file.predict?.options ?? [];
    expect(long).toBe('Hơn ba mươi năm sau');
    expect(1854 - 1818, 'the reveal counts the years the script counts').toBe(36);
    const reveal = (file as unknown as { reveal: { lines: string[] } }).reveal.lines.join(' ');
    expect(reveal).toContain('ba mươi sáu năm');
    expect(reveal).toMatch(/một bảo tàng/u);
    expect(reveal, 'the reveal does not say the choir sang').not.toMatch(/ca đoàn đã hát|hợp xướng đã hát/u);
    const hint3 = file.hints[2]?.text ?? '';
    expect(hint3).not.toMatch(/ca đoàn|hợp xướng/u);
  });

  test('the notebook is the research block word for word, and it backs the class of every piece', () => {
    const research = readFileSync('research/m0b-act-2.md', 'utf8');
    const at = research.indexOf('### 7.2 Sổ tay');
    const block = research.slice(at, research.indexOf('### 7.3', at));
    expect(at).toBeGreaterThan(0);
    const opened = (url: string) => {
      const rest = research.slice(0, at) + research.slice(at + block.length);
      for (let i = rest.indexOf(url); i >= 0; i = rest.indexOf(url, i + 1)) if (!rest.slice(Math.max(0, i - 2), i).includes('○')) return true;
      return false;
    };
    const nb = JSON.parse(readFileSync('story/notebook/silent-night.json', 'utf8')) as {
      status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]>;
    };
    const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
    expect(nb.status).toBe('verified');
    expect(nb.source).toBe('research/m0b-act-2.md');
    expect(nb.stamp).toBe(meta.chapters.find((c) => c.id === 'silent-night')?.stamp);
    expect(nb.card).toHaveLength(3);
    for (const line of nb.card) expect(block, 'card line: ' + line).toContain(line);
    for (const points of Object.values(nb.full)) {
      for (const p of points) {
        expect(block, p.text).toContain(p.text);
        expect(p.sources.length).toBeGreaterThan(0);
        for (const s of p.sources) {
          expect(s.url).toMatch(/^https:\/\//u);
          expect(opened(s.url), 'not a ✔ URL in research: ' + s.url).toBe(true);
        }
      }
    }
    expect(Object.keys(nb.full).sort()).toEqual(['dispute', 'fact', 'legend']);
    const tok = (id: string) => file.tokens.find((t) => t.id === id)?.text ?? '';
    const [words, night, roles, copy] = nb.full.fact!.map((p) => p.text);
    expect(words).toContain('viết lời bài hát năm 1816');
    expect(night).toContain('Gruber viết ngày 30/12/1854, gần đúng 36 năm sau');
    expect(night).toContain('không nêu ai hát giọng nào');
    expect(tok('g')).toMatch(/hai giọng solo, hợp xướng và guitar/u);
    expect(roles).toContain('Mohr hát giọng tenor và chơi guitar, Gruber hát bass');
    expect(roles, 'the voice roles belong to the two sites, not to Gruber').toMatch(/^Theo stillenacht\.at và bảo tàng Stille Nacht/u);
    expect(tok('a')).toMatch(/tenor.*guitar.*bass/u);
    expect(copy).toContain('Bản gốc 1818 đã mất');
    expect(copy).toContain('khoảng năm 1820');
    expect(tok('c')).toBe('Bản gốc đã mất');
    expect(tok('k')).toContain('1820');
    const choir = nb.full.dispute![0]!.text;
    expect(choir).toContain('ca đoàn nhà thờ lặp bốn ô nhịp cuối');
    expect(choir).toContain('không dẫn nguồn sơ cấp');
    expect(nb.full.dispute![0]!.sources.map((s) => s.url)).toContain('https://www.stille-nacht-museum.at/en/silent-nightholy-night/');
    expect(tok('f')).toBe('Ca đoàn nhà thờ lặp bốn ô nhịp cuối');
    const legend = nb.full.legend![0]!.text;
    expect(legend).toMatch(/^Người ta kể rằng một con chuột/u);
    expect(legend).toContain('không đúng');
    expect(tok('e')).toMatch(/Chuột/u);
    expect(nb.card[1]).toContain('trong các nguồn đã mở, chỉ một bảo tàng kể ca đoàn nhà thờ lặp phần kết');
    expect(research, 'S3 carries the museum sentence the second card rests on').toContain('written for two solo voices, choir, and guitar accompaniment');
    expect(nb.card[2]).toContain('không chứng minh được');
    for (const t of [...Object.values(nb.full).flat().map((p) => p.text), ...nb.card]) expect(t, 'the notebook never says the choir sang as fact').not.toMatch(/hợp xướng đã hát|ca đoàn đã hát/u);
  });

  test('blind oracle: slot labels and pieces say nothing of each other, and every reader\'s natural board fails with the cards hidden, except the one placing by source name', () => {
    const boards = everyBoard();
    expect(boards, 'the checker\'s 9990 minus the empty board, which the page calls incomplete').toHaveLength(9989);
    const solved = boards.filter((at) => reply(file, board(at), new Set()).type === 'solved');
    expect(solved).toHaveLength(1);
    expect(board(solved[0] as Record<string, number>).map((c) => [...(c ?? [])].sort())).toEqual(SOLVED.map((c) => [...(c ?? [])].sort()));
    for (const [who, b, result] of READERS) expect(reply(file, b, new Set()).type, who).toBe(result);
    expect(READERS.filter(([, , r]) => r === 'solved').map(([, b]) => b), 'the only reader who wins blind is the one placing by source name').toEqual([SOLVED]);
    expect(READERS.filter(([, b]) => !b.flat().flat().includes('f')), 'two readers leave the choir out').toHaveLength(2);
    expect(READERS.filter(([, , r]) => r === 'wrong'), 'seven readers fail blind').toHaveLength(7);
    const labels = file.slots.map((s) => (s as unknown as { label: string }).label.toLowerCase());
    for (const t of file.tokens as { text: string }[]) for (const l of labels) expect(t.text.toLowerCase(), 'a piece never carries a slot label').not.toBe(l);
  });

  test('blind control (?preview=puzzle:silent-night, cards removed, saved state cleared): each reader submits one board on a fresh page and it fails, except the reader placing by source name (accepted risk)', async ({ page }, info) => {
    for (const [who, b, result] of READERS) {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.goto('/?preview=puzzle:silent-night');
      await waitReady(page);
      await toBoard(page, info);
      await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((el) => el.remove()));
      await expect(page.locator('.pz-card')).toHaveCount(0);
      await fillBoard(page, info, b);
      await check(page, info);
      if (result === 'solved') {
        await waitPuzzlePhase(page, 'reveal');
        continue;
      }
      const g = await puzzleOf(page);
      expect(g.phase, who).toBe('board');
      expect(g.completed, who).toBe(false);
      expect(g.verdict, who).toContain('Chưa khớp với các thẻ.');
    }
  });

  test('the choir piece on Gruber\'s page never solves, and the real board leaves nothing in the bank', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['g', 'f'], ['a'], ['c', 'k'], ['e']]);
    expect((await puzzleOf(page)).bank).toEqual([]);
    await check(page, info);
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).completed).toBe(false);
  });

  test('correct: real taps solve it with no wrong check and no hint, the reveal counts the years, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, SOLVED);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await expect(page.locator('.pz-reveal')).toContainText('ba mươi sáu năm');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(linesBefore + 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:silent-night'))).toBeNull();
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

test.describe('chapter 13 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'silent-night')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('silent-night') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'silent-night', chapter: 'silent-night', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'silent-night' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'silent-night' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['silent-night']);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 13 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'silent-night');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="silent-night"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
