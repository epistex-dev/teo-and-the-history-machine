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

const script = chapterOf('ban1647');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('ban1647');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;

/**
 * Pieces: a the second-Tuesday rest day for scholars, apprentices and servants (ordinance text), b the London militia committees ordered to prevent disorder
 * (Commons Journal, Friday 24 December 1647), c carol singing banned (NAM, disputed: the ordinance text has no such word; only "carol" because HistoryExtra tells the Cornhill apprentices who
 * set up holly and ivy), d the ordinance passed on 10 June (HistoryExtra; the text of the ordinance is headed 8 June, disputed), e riots for Christmas at Ipswich (HistoryExtra),
 * x "the Christmas ban was Cromwell own doing" (legend; worded apart from the line of Qua Don).
 * Slots: s1 ordinance text, s2 Commons Journal of 24 December, s3 NAM (holds at most one piece), s4 HistoryExtra (at most two).
 * The answer: [a] [b] [c] [d e], with x left out: the ordinance text and the journal page do not name Cromwell, card 5 lets x sit only with the carol piece or the 10 June piece,
 * and NAM and HistoryExtra are full with those three. No card orders x off the board.
 * Tèo's frame, said aloud before the board: the ordinance text bans carols, so the rest-day piece and the carol piece both sit on it.
 * Before the board the script says only that the feast days are no longer kept: no 8/6, no Tuesday, no 10/6 (see the script test).
 */
const TRAP: Cell[] = [['a', 'c', 'd'], ['b'], [], []];
/**
 * Readers who see the cards hidden: the labels, the six pieces' wording, the rules, and the script (which no longer tells what the ordinance holds). Each builds one natural board on a clean page.
 *  - casual: has heard of Cromwell and the Army museum, takes the date and the ban to be what the ordinance says, riots to be history-magazine matter.
 *  - well read: knows Parliament and not Cromwell issued it, still takes the ordinance to carry the carol ban and its own date, leaves the legend off.
 *  - knows the two articles (NAM writes that carols were outlawed, HistoryExtra gives 10 June and Ipswich): wins blind, an accepted risk as in chapter 13. The slot labels are
 *    source names, so no honest extra card changes it; every card would have to invent a constraint.
 */
type Reader = [who: string, board: Cell[], result: 'wrong' | 'solved'];
const CASUAL: Cell[] = [['a', 'c', 'd'], ['b'], ['x'], ['e']];
const WELL_READ: Cell[] = [['a', 'c', 'd'], ['b'], [], ['e']];
const KNOWS_ARTICLES: Cell[] = [['a'], ['b'], ['c'], ['d', 'e']];
const READERS: Reader[] = [
  ['casual: ban and date on the ordinance, Cromwell with the Army museum, riots with the magazine', CASUAL, 'wrong'],
  ['well read: ordinance carries the ban and the date, the Cromwell piece left off', WELL_READ, 'wrong'],
  ['teo frame: the ordinance bans carols', TRAP, 'wrong'],
  ['Cromwell with the Army museum, the ban and the date with the magazine, the riots left off', [['a'], ['b'], ['x'], ['c', 'd']], 'wrong'],
  ['Cromwell with the magazine, the carol piece alone at the museum', [['a'], ['b'], ['c'], ['d', 'x']], 'wrong'],
  ['knows the NAM and HistoryExtra articles (accepted blind risk)', KNOWS_ARTICLES, 'solved'],
];
const SOLVED = file.solutions[0] as Cell[];

const IDS = file.tokens.map((t) => t.id).sort();
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
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'ban1647', chapter: 'ban1647', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 12 puzzle', () => {
  test('loads clean: a DOM puzzle with four sources, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'ban1647', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
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
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'ban1647'], { encoding: 'utf8' });
    expect(report).toMatch(/L2 steps 1 \[hypothesis e≠3\]/u);
    expect(report).not.toContain('EXEMPT');
    expect(report).toMatch(/valid answer space 8910 \(declared 8910\)/u);
    expect(report).toMatch(/without all sourced cards 8910 solution/u);
    expect(report).toMatch(/c1:1→9 c2:1→81 c3:1→5 c4:1→6 c5:1→3/u);
    const bots = [...report.matchAll(/(random|mash|hill-climber|local-search|tap-everything|bank order|idle|hold) ([\d.]+)%/gu)];
    expect(bots.length).toBeGreaterThanOrEqual(8);
    for (const [, name, pct] of bots) expect(Number(pct), name).toBeLessThanOrEqual(5);
    expect(reply(file, [['a'], ['b'], ['c', 'x'], ['d', 'e']] as Cell[], new Set())).toEqual({ type: 'format', reason: 'capacity' });
    const raw = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; l2: string; state: string; puzzle: string; format: string; input: string; goal: string }[];
    const row = raw.find((r) => r.id === 'ban1647');
    expect(row).toMatchObject({ state: 'full', puzzle: 'story/puzzles/ban1647.json', format: 'C', input: 'assign', goal: 'attribute-claims' });
    expect(row?.l2, 'the minigames row names the same hypothesis the checker finds').toContain('«Có bạo loạn đòi giữ lễ ở Ipswich» nằm ở «Bảo tàng Quân đội (NAM)»');
    expect(existsSync('story/puzzles/stubs/ban1647.json'), 'the stub goes once the full puzzle exists').toBe(false);
  });

  test('every card says what its constraint does, and no card orders the Cromwell piece, or any piece, off the board', () => {
    const raw = JSON.parse(readFileSync('story/puzzles/ban1647.json', 'utf8')) as {
      slots: { id: string; label: string; cap?: number | string; min?: number }[];
      tokens: { id: string; text: string; status: string }[];
      cards: { id: string; who: string; kind: string; status: string; text: string; do: unknown; evidence: string[]; url: string[] }[];
    };
    const card = (id: string) => raw.cards.find((c) => c.id === id)!;
    const ops = (c: { do: unknown }) => ([] as { op: string; t?: unknown }[]).concat(c.do as { op: string }[]);
    expect(raw.cards.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    for (const c of raw.cards) {
      expect(c.status).toBe('fact');
      expect(c.who.length).toBeGreaterThan(0);
      expect(c.evidence.length).toBeGreaterThan(0);
      expect(ops(c).map((d) => d.op), 'card ' + c.id + ' never takes a piece off the board by an order').not.toContain('unused');
      expect(c.url.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(raw.cards.flatMap((c) => ops(c).filter((d) => d.op === 'at' || d.op === 'notAt' || d.op === 'oneOf').filter((d) => (d as { t: string }).t === 'x'))), 'no card places or bars the Cromwell piece in a slot').toBe('[]');
    expect(card('c1')).toMatchObject({ kind: 'record', who: 'Văn bản sắc lệnh và Nhật ký Hạ viện', do: [{ op: 'at', t: 'a', s: 's1' }, { op: 'at', t: 'b', s: 's2' }] });
    expect(card('c2')).toMatchObject({ kind: 'inference', who: 'Suy ra từ văn bản sắc lệnh và Nhật ký Hạ viện' });
    expect(ops(card('c2')).map((d) => d.op + ':' + d.t + ':' + (d as unknown as { s: string }).s).sort(), 'the two originals do not hold the carol, 10 June or Ipswich pieces').toEqual(
      ['c', 'd', 'e'].flatMap((t) => ['s1', 's2'].map((s) => 'notAt:' + t + ':' + s)).sort(),
    );
    expect(card('c2').text).toBe('Hai nguồn ấy không ghi: hát carol, ngày 10/6, Ipswich.');
    expect(card('c3')).toMatchObject({ kind: 'inference', who: 'Suy ra từ NAM và HistoryExtra', do: [{ op: 'differ', t: ['c', 'd'] }] });
    expect(card('c3').text).toBe('Mảnh carol và mảnh ngày 10/6 thuộc hai nguồn khác nhau.');
    expect(card('c4')).toMatchObject({ kind: 'inference', who: 'Suy ra từ NAM và HistoryExtra', do: [{ op: 'differ', t: ['c', 'e'] }] });
    expect(card('c4').text).toBe('Mảnh carol và mảnh Ipswich thuộc hai nguồn khác nhau.');
    expect(card('c5')).toMatchObject({ kind: 'inference', who: 'Suy ra từ bốn nguồn' });
    expect(card('c5').evidence.join(' '), 'the evidence also holds why the Cromwell piece is on neither original').toContain('Be it Ordained, by the Lords and Commons in Parliament assembled');
    expect(card('c5').evidence.join(' ')).toContain('Committees of the Militia of London');
    expect(JSON.stringify(card('c5').do), 'a conditional: if x is placed it sits with c or with d').toBe(
      JSON.stringify([{ op: 'expr', e: ['or', ['not', ['placed', 'x']], ['eq', ['pos', 'x'], ['pos', 'c']], ['eq', ['pos', 'x'], ['pos', 'd']]] }]),
    );
    expect(card('c5').text).toBe('Mảnh về Cromwell, nếu đặt, cùng bài với mảnh carol hoặc mảnh ngày 10/6.');
    expect(card('c5').evidence.join(' ')).toContain('Oliver Cromwell supported the enforcement of these measures');
    expect(card('c5').evidence.join(' ')).toContain('personally responsible');
    expect(raw.slots.map((s) => s.label)).toEqual(['Văn bản sắc lệnh', 'Nhật ký Hạ viện 24/12', 'Bảo tàng Quân đội (NAM)', 'HistoryExtra']);
    expect(raw.slots.map((s) => s.cap)).toEqual(['any', 'any', 1, 2]);
    expect(raw.slots.map((s) => s.min)).toEqual([0, 0, 0, 0]);
    expect(Object.fromEntries(raw.tokens.map((t) => [t.id, t.status]))).toEqual({ a: 'fact', b: 'fact', c: 'disputed', d: 'disputed', e: 'fact', x: 'legend' });
    expect(file.solutions[0]).toEqual([['a'], ['b'], ['c'], ['d', 'e']]);
    // Source-faithful placements: the Cromwell piece has no home. Beside the true board it is wrong or over capacity in every slot, and leaving it off is the only winning board.
    for (const slot of [0, 1, 2, 3]) {
      const withX = SOLVED.map((c) => ([] as string[]).concat(c ?? [])) as Cell[];
      (withX[slot] as string[]).push('x');
      const t = reply(file, withX, new Set()).type;
      expect(t === 'wrong' || t === 'format', 'the Cromwell piece in slot ' + (slot + 1)).toBe(true);
      expect(t === 'solved', 'the Cromwell piece in slot ' + (slot + 1)).toBe(false);
    }
    expect(reply(file, SOLVED, new Set()).type).toBe('solved');
    // The disputed pieces have honest homes: each sits with the one source that says it, and nothing else solves with it elsewhere.
    expect(reply(file, [['a'], ['b'], ['d'], ['c', 'e']] as Cell[], new Set()).type).toBe('wrong');
    expect(reply(file, [['a', 'c'], ['b'], [], ['d', 'e']] as Cell[], new Set()).type).toBe('wrong');
  });

  test('wording: no piece, rule, question or prediction states a class, and the rules and the question say the same thing as the board', () => {
    const talk = /truyền thuyết|giả thuyết|người ta kể|lời đồn|chưa có nguồn|không có nguồn|chưa được chứng minh|chưa ai chứng minh|sai rồi|tranh cãi|không đúng/iu;
    for (const t of file.tokens as { text: string }[]) expect(t.text).not.toMatch(talk);
    const told = [(file as unknown as { question: string }).question, JSON.stringify((file as unknown as { rules: unknown }).rules), JSON.stringify(file.predict), ...file.hints.slice(0, 3).map((h) => h.text)];
    for (const s of told) {
      expect(s).not.toMatch(talk);
      expect(s, 'nothing before hint 4 names the Cromwell piece').not.toMatch(/Cromwell/iu);
    }
    const q = (file as unknown as { question: string }).question;
    expect(q).toContain('Bốn nguồn');
    expect(q).toContain('sáu mảnh');
    expect(q).not.toMatch(/không có chỗ/u);
    expect(file.slots).toHaveLength(4);
    expect(file.tokens).toHaveLength(6);
    const rules = (file as unknown as { rules: { text: string }[] }).rules.map((r) => r.text).join(' ');
    expect(rules).toMatch(/NAM nhận nhiều nhất một mảnh/u);
    expect(rules).toMatch(/HistoryExtra nhận nhiều nhất hai mảnh/u);
    expect(rules).toMatch(/Mảnh có thể không đặt/u);
    expect(rules).toMatch(/Kiểm tra chấm cả bốn nguồn một lượt/u);
    expect(file.predict).toEqual({ prompt: 'Văn bản sắc lệnh 1647 có nhắc holly hay carol không?', options: ['Có', 'Không', 'Chưa rõ'] });
    const reveal = (file as unknown as { reveal: { lines: string[] } }).reveal.lines.join(' ');
    expect(reveal, 'the reveal answers the prediction').toContain('Văn bản lệnh không nhắc holly hay carol');
    expect(reveal).toContain('không nhắc tên Cromwell');
    const hint3 = file.hints[2]?.text ?? '';
    expect(hint3).not.toMatch(/Ipswich|10\/6/u);
    for (const t of file.tokens as { text: string; id: string }[]) expect(t.text.toLowerCase(), 'a piece never repeats a slot label').not.toBe(file.slots.map((s) => (s as unknown as { label: string }).label.toLowerCase()).find((l) => l === t.text.toLowerCase()) ?? '');
  });

  test('the notebook is the research block word for word, and it backs the class of every piece', () => {
    const research = readFileSync('research/m0b-act-2.md', 'utf8');
    const at = research.indexOf('### 6.2 Sổ tay');
    const block = research.slice(at, research.indexOf('### 6.3', at));
    expect(at).toBeGreaterThan(0);
    const opened = (url: string) => {
      const rest = research.slice(0, at) + research.slice(at + block.length);
      for (let i = rest.indexOf(url); i >= 0; i = rest.indexOf(url, i + 1)) if (!rest.slice(Math.max(0, i - 2), i).includes('○')) return true;
      return false;
    };
    const nb = JSON.parse(readFileSync('story/notebook/ban1647.json', 'utf8')) as {
      status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]>;
    };
    const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
    expect(nb.status).toBe('verified');
    expect(nb.source).toBe('research/m0b-act-2.md');
    expect(nb.stamp).toBe(meta.chapters.find((c) => c.id === 'ban1647')?.stamp);
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
    const [date, rest, riots, restored, cromwell] = nb.full.fact!.map((p) => p.text);
    expect(date).toContain('Sắc lệnh ghi ngày 8/6/1647');
    expect(date, 'the 10 June claim of the disputed piece d is in the notebook as another source').toContain('Một nguồn khác ghi ngày 10/6');
    expect(nb.full.fact![0]!.sources.map((s) => s.url)).toContain('https://www.historyextra.com/period/stuart/no-christmas-under-cromwell-the-puritan-assault-on-christmas-during-the-1640s-and-1650s/');
    expect(tok('d')).toBe('Lệnh được thông qua ngày 10/6');
    expect(rest).toContain('thứ Ba thứ hai mỗi tháng');
    expect(tok('a')).toContain('thứ Ba thứ hai mỗi tháng');
    expect(riots).toContain('bạo loạn ủng hộ Giáng Sinh');
    expect(riots).toContain('Ipswich');
    expect(tok('e')).toBe('Có bạo loạn đòi giữ lễ ở Ipswich');
    expect(restored).toContain('1660');
    expect(cromwell).toContain('Cromwell không ban hành sắc lệnh 1647');
    expect(cromwell).toContain('Lord Protector từ tháng 12/1653');
    const dispute = nb.full.dispute![0]!.text;
    expect(dispute).toContain('Holly, ivy và carol');
    expect(dispute).toContain('văn bản sắc lệnh 1647 không nhắc tới những điều đó');
    expect(nb.full.dispute![0]!.sources.map((s) => s.url), 'both sides of the holly and carol dispute are named').toEqual([
      'https://www.nam.ac.uk/explore/war-christmas',
      'https://www.british-history.ac.uk/no-series/acts-ordinances-interregnum/p954',
    ]);
    expect(tok('c')).toBe('Hát carol bị cấm');
    expect(file.tokens.find((t) => t.id === 'c')?.text, 'only carol: HistoryExtra tells the Cornhill apprentices who set up holly and ivy').not.toMatch(/holly|ivy/iu);
    const legend = nb.full.legend![0]!.text;
    expect(legend).toMatch(/^Người ta kể rằng Cromwell một mình cấm Giáng Sinh/u);
    expect(legend).toContain('không đúng');
    expect(tok('x')).toBe('Lệnh cấm Giáng Sinh là việc riêng của Cromwell');
    expect(tok('x'), 'the piece does not echo the line of Quạ Đồn').not.toMatch(/ra lệnh/u);
    expect(nb.card[2]).toBe('Sắc lệnh này không do Cromwell ban hành.');
    expect(research, 'NAM sentence the holly piece rests on').toContain('Traditional decorations like holly and ivy were banned and singing carols was outlawed.');
  });

  test('every sourced card and piece quotes a sentence that stands in research/m0c-puzzles.md, and the ordinance and journal pages named there do not hold the claims card 2 says they lack', () => {
    const m0c = readFileSync('research/m0c-puzzles.md', 'utf8');
    const raw = JSON.parse(readFileSync('story/puzzles/ban1647.json', 'utf8')) as { tokens: { evidence: string[]; url: string[] }[]; cards: { evidence: string[]; url: string[] }[] };
    for (const x of [...raw.tokens, ...raw.cards]) {
      for (const e of x.evidence) expect(m0c, e).toContain(e);
      for (const u of x.url) expect(m0c, u).toContain(u);
    }
    expect(m0c).toContain('pro-Christmas riots also took place at Norwich and Ipswich');
    expect(m0c).toContain('on 10 June that year, parliament has passed an ordinance');
    const n12 = m0c.slice(m0c.indexOf('| N12 |'), m0c.indexOf('| N13 |'));
    expect(n12, 'N12 records that the NAM page has no 10 June and no Ipswich').toMatch(/Trang không có thứ Ba, ngày 10\/6, hình phạt/u);
    const n10 = m0c.slice(m0c.indexOf('| N10 |'), m0c.indexOf('| N11 |'));
    expect(n10, 'N10 records that the ordinance text has no Cromwell, 10/6, penalty, greenery, carol or Ipswich').toMatch(/không có tên Cromwell, ngày 10\/6, hình phạt, cây xanh, carol hay Ipswich/u);
    expect(m0c.slice(m0c.indexOf('| N11 |'), m0c.indexOf('| N12 |')), 'N11 records that the journal page has no Ipswich').toMatch(/holly, ivy, Ipswich, hình phạt/u);
  });

  test('blind oracle: slot labels and pieces say nothing of each other, and casual and well-read boards fail with the cards hidden, the reader who knows both articles wins (accepted risk)', () => {
    const boards = everyBoard();
    expect(boards, 'the checker\'s 8910 minus the empty board, which the page calls incomplete').toHaveLength(8909);
    const solved = boards.filter((at) => reply(file, board(at), new Set()).type === 'solved');
    expect(solved).toHaveLength(1);
    expect(board(solved[0] as Record<string, number>).map((c) => [...(c ?? [])].sort())).toEqual(SOLVED.map((c) => [...(c ?? [])].sort()));
    for (const [who, b, result] of READERS) expect(reply(file, b, new Set()).type, who).toBe(result);
    expect(READERS.filter(([, , r]) => r === 'solved').map(([, b]) => b), 'the only reader who wins blind is the one who knows both articles').toEqual([SOLVED]);
    expect(READERS.filter(([, , r]) => r === 'wrong'), 'five readers fail blind').toHaveLength(5);
    // Expert knowledge: a and b by label and content, the Cromwell piece not on either original. Weak expert: that is all. Strong expert: also that
    // neither original has the carol, 10 June and Ipswich pieces. Both leave the three modern claims to guesswork between the two articles.
    const weak = boards.filter((at) => at.a === 1 && at.b === 2 && at.x !== 1 && at.x !== 2);
    const strong = weak.filter((at) => [at.c, at.d, at.e].every((s) => s !== 1 && s !== 2));
    const full = strong.filter((at) => at.c! > 0 && at.d! > 0 && at.e! > 0 && at.x === 0);
    expect(weak.length, 'boards consistent with what the weak expert knows and the visible rules').toBe(273);
    expect(strong.length, 'boards consistent with what the strong expert knows and the visible rules').toBe(39);
    expect(full.map((at) => JSON.stringify(board(at))).sort(), 'the strong expert\'s full boards: the answer is one of three, and the expert\'s own pick is another').toEqual([
      JSON.stringify([['a'], ['b'], ['c'], ['d', 'e']]),
      JSON.stringify([['a'], ['b'], ['d'], ['c', 'e']]),
      JSON.stringify([['a'], ['b'], ['e'], ['c', 'd']]),
    ].sort());
    expect(weak.filter((at) => reply(file, board(at), new Set()).type === 'solved')).toHaveLength(1);
    expect(full.filter((at) => reply(file, board(at), new Set()).type !== 'solved'), 'a reader who knows only the originals has two wrong full boards beside the answer').toHaveLength(2);
    expect(full, 'accepted residual risk: a reader who trusts the capacities has at most three full boards, no card orders the Cromwell piece off NAM or HistoryExtra').toHaveLength(3);
    const row = (JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; note: string; wrongFrame: string }[]).find((r) => r.id === 'ban1647');
    expect(row?.note, 'the minigames note records the residual risk').toContain('273 → 39 → 3');
    expect((file as unknown as { wrongFrame: { cards: string[] } }).wrongFrame.cards, 'the wrong frame breaks on two named cards').toEqual(['c2', 'c3']);
    expect(row?.wrongFrame).toContain('Hai thẻ nêu tên');
    const labels = file.slots.map((s) => (s as unknown as { label: string }).label.toLowerCase());
    for (const t of file.tokens as { text: string }[]) for (const l of labels) expect(t.text.toLowerCase(), 'a piece never carries a slot label').not.toBe(l);
  });

  test('blind control (?preview=puzzle:ban1647, cards removed, saved state cleared): each reader submits one board on a fresh page; the real phase of the page decides, and only the reader who knows both articles wins', async ({ page }, info) => {
    for (const [who, b, result] of READERS) {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.goto('/?preview=puzzle:ban1647');
      await waitReady(page);
      await toBoard(page, info);
      await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((el) => el.remove()));
      await expect(page.locator('.pz-card')).toHaveCount(0);
      await fillBoard(page, info, b);
      await check(page, info);
      const g = await puzzleOf(page);
      if (result === 'solved') {
        await waitPuzzlePhase(page, 'reveal');
        continue;
      }
      expect(g.phase, who).toBe('board');
      expect(g.phase, who).not.toBe('reveal');
      expect(g.completed, who).toBe(false);
      expect(g.verdict, who).toContain('Chưa khớp với các thẻ.');
    }
  });

  test('the real board leaves the Cromwell piece in the bank', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, SOLVED);
    expect((await puzzleOf(page)).bank, 'the Cromwell piece stays in the bank on the true board').toEqual(['x']);
  });

  test('correct: real taps solve it with no wrong check and no hint, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, SOLVED);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await expect(page.locator('.pz-reveal')).toContainText('không nhắc holly hay carol');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(after.scene === gameScene ? linesBefore + 1 : 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:ban1647'))).toBeNull();
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

test.describe('chapter 12 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'ban1647')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('ban1647') + 1] as string;

  test('the crow is turned to the front before the scene shows it, and the script keeps the ordinance back from the board and brings the Christmas calendar page in after it', () => {
    const beats = script.scenes.find((s) => s.id === 'mat-so-nguoi')?.beats ?? [];
    const turn = beats.findIndex((b) => b.t === 'turn');
    const firstCrow = beats.findIndex((b) => (b.t === 'say' && b.who === 'qua-don') || (b.t === 'narr' && /Quạ Đồn/u.test(b.text)));
    expect(turn, 'a @turn qua-don front beat').toBeGreaterThanOrEqual(0);
    expect(turn).toBeLessThan(firstCrow);
    const text = expected.join('\n');
    expect(text).not.toMatch(/trang lịch tháng 12|ô 25\/12|cột thứ/u);
    const game = script.scenes.findIndex((s) => s.beats.some((b) => b.t === 'minigame'));
    const before = script.scenes.slice(0, game + 1).flatMap((s) => lines(s.beats)).join('\n');
    expect(before, 'before the board the script does not tell what the ordinance holds beyond the feast days').not.toMatch(/8\/6(?!\/1647)|10\/6|thứ Ba|học trò|thợ học việc|nếu chủ/u);
    expect(before, 'Tèo says the frame of the board before it: the ordinance bans carols').toMatch(/hát carol/u);
    const after = script.scenes.slice(game + 1).flatMap((s) => lines(s.beats));
    expect(after.findIndex((l) => /khe máy trượt thêm một trang lịch Giáng Sinh/u.test(l)), 'the Christmas calendar page of chapter 13 comes out of the machine slot after the board, before it is carried off').toBeGreaterThanOrEqual(0);
    expect(after.findIndex((l) => /khe máy trượt thêm một trang lịch Giáng Sinh/u.test(l))).toBeLessThan(after.findIndex((l) => /Trang lịch Giáng Sinh thì tôi mang theo/u.test(l)));
    expect(after[1], 'the first line after the board comes from the board: carols in the ordinance text and in NAM').toMatch(/hát carol/u);
  });

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'ban1647', chapter: 'ban1647', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'ban1647' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'ban1647' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['ban1647']);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 12 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'ban1647');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="ban1647"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
