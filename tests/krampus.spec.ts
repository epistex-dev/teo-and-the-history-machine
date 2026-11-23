import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ORDER } from '../src/order.ts';
import type { Beat } from '../src/story/types.ts';
import { expectClean, monitor } from './support/helpers.ts';
import { advanceStory, reachMinigame, seedSave, solveMinigame, realInput, stateOf, storedSave, storyOf, typeName, waitReady } from './support/play.ts';
import { check, fillBoard, press, puzzleFile, puzzleOf, toBoard, waitPuzzlePhase, wrongFill, type Cell } from './support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from './support/script.ts';
import { answerOf, reply, states } from '../scripts/puzzles.mjs';

const script = chapterOf('krampus');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('krampus');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;

/** Tèo's frame: the horns, fur and bells are old, so they sit on the oldest sheet beside the Percht hunt. */
const TRAP: Cell[] = [['pc', 'mk', 'fb'], ['yg'], ['nm'], ['org']];
/** The board a reader builds who knows the costume is later than the Percht hunt, the name later than the costume and the Hel claim last. */
const WINNER: Cell[] = [['pc'], ['yg', 'mk', 'fb'], ['nm'], ['org']];
/**
 * Boards readers build with the cards hidden, from the slot labels and the pieces alone. The three pieces of the villages stay together
 * (the grouping the reviewer expects most) and the four groups sit on four sheets; every one of these loses except WINNER.
 */
const TRIO: string[] = ['yg', 'mk', 'fb'];
const READERS: [string, Cell[]][] = [
  ['tèo: the costume is the oldest', [TRIO, ['pc'], ['nm'], ['org']]],
  ['tèo: the hunters wear it', TRAP],
  ['origin: the Hel tale is the oldest', [['org'], ['pc'], TRIO, ['nm']]],
  ['hel before the name', [['pc'], TRIO, ['org'], ['nm']]],
  ['name before the costume', [['pc'], ['nm'], TRIO, ['org']]],
];

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'krampus', chapter: 'krampus', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

const researchBlock = (): string => {
  const research = readFileSync('research/m0b-act-2.md', 'utf8');
  return research.slice(research.indexOf('### 3.2 Sổ tay'), research.indexOf('### 3.3'));
};

test.describe('chapter 9 puzzle', () => {
  test('loads clean: a DOM puzzle with four sheets, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'krampus', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('one hypothesis step, no exemption, every card needed, one answer, bots under 5%', () => {
    expect(file, 'the puzzle carries no L2 exemption').not.toHaveProperty('l2Exempt');
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'krampus'], { encoding: 'utf8' });
    expect(report).toMatch(/L2 steps 1 \[hypothesis fb≠3\]/u);
    expect(report).not.toContain('EXEMPT');
    expect(report).toContain('solutions: 1 (declared 1)');
    expect(report).toMatch(/c1:1→3 c2:1→8 c3:1→8 c4:1→3 c5:1→4/u);
    const bots = [...(report.match(/bots, P\(solve within 12 checks\): (.*)/u)?.[1] ?? '').matchAll(/([\w-]+(?: [\w-]+)?) ([\d.]+)%/gu)].map((m) => [m[1], Number(m[2])] as const);
    expect(bots.length).toBeGreaterThanOrEqual(8);
    for (const [name, p] of bots) expect(p, name).toBeLessThanOrEqual(5);
  });

  test('every card rests on a sentence of the research, and the Sổ nguồn is the research block word for word', () => {
    const block = researchBlock();
    const research = readFileSync('research/m0b-act-2.md', 'utf8');
    const raw = JSON.parse(readFileSync('story/puzzles/krampus.json', 'utf8')) as { cards: { id: string; evidence: string[]; url: string[]; kind: string; text: string }[]; tokens: { id: string; status: string }[] };
    for (const c of raw.cards) {
      expect(c.evidence.length, c.id).toBeGreaterThan(0);
      for (const e of c.evidence) expect(research, c.id + ': ' + e).toContain(e);
    }
    const nb = JSON.parse(readFileSync('story/notebook/krampus.json', 'utf8')) as { status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(nb).toMatchObject({ id: 'krampus', status: 'verified', source: 'research/m0b-act-2.md', stamp: 'SỰ THẬT' });
    expect(nb.card).toHaveLength(3);
    for (const line of nb.card) expect(block, line).toContain(line);
    expect(Object.keys(nb.full).sort()).toEqual(['fact', 'legend', 'tradition']);
    for (const points of Object.values(nb.full)) {
      for (const p of points) {
        expect(block, p.text).toContain(p.text);
        for (const s of p.sources) expect(block, s.url).toContain(s.url);
      }
    }
    const legend = raw.tokens.filter((t) => t.status === 'legend');
    expect(legend.map((t) => t.id)).toEqual(['org']);
    expect(nb.full.legend?.[0]?.text).toContain('Hel');
    expect(nb.full.legend?.[0]?.text).toContain('Chưa có bằng chứng viết nào');
    expect(nb.full.fact?.map((f) => f.text).join(' ')).toMatch(/1582[\s\S]*Giữa thế kỷ 19[\s\S]*cuối thế kỷ 19/u);
  });

  test('blind oracle: labels and pieces name no source, the script names none before the board, and the natural boards of the readers fail with the cards hidden', () => {
    expect(file.slots.map((s) => (s as { label?: string }).label)).toEqual(['Tờ 1 (cũ nhất)', 'Tờ 2', 'Tờ 3', 'Tờ 4 (mới nhất)']);
    const text = JSON.stringify(file.tokens.map((x) => x.text)).toLowerCase();
    for (const leak of ['chưa tả', 'trang phục', 'dießen', 'bưu thiếp', 'sách báo', 'bản ghi']) expect(text, leak).not.toContain(leak);
    const beats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
    const before = beats.slice(0, beats.findIndex((x) => x.t === 'minigame')).map((x) => (x.t === 'say' || x.t === 'narr' ? x.text : '')).join('\n');
    for (const name of ['Dießen', 'bưu thiếp', 'sách báo', 'tờ thứ']) expect(before, 'the scene names no sheet before the board: ' + name).not.toContain(name);
    expect(file.solutions).toHaveLength(1);
    expect(file.solutions[0]).toEqual(WINNER);
    for (const [who, board] of READERS) expect(reply(file, board, new Set()).type, who + ' ' + JSON.stringify(board)).toBe('wrong');
    const sts = states(file);
    const at = Object.fromEntries(file.tokens.map((x, i) => [x.id, i])) as Record<string, number>;
    const family = sts.filter((v) => v.every((x) => x > 0) && v[at.yg!] === v[at.mk!] && v[at.mk!] === v[at.fb!] && new Set([v[at.yg!], v[at.pc!], v[at.nm!], v[at.org!]]).size === 4);
    expect(family, 'the four natural groups on four sheets').toHaveLength(24);
    expect(family.filter((v) => reply(file, answerOf(file, v), new Set()).type === 'solved'), 'only the order that dates the costume after the hunt wins').toHaveLength(1);
    const report = execFileSync('node', ['scripts/puzzles.mjs', 'check', 'krampus'], { encoding: 'utf8' });
    expect(report, 'each card is needed: without it the solver finds more boards').toMatch(/c1:1→3 c2:1→8 c3:1→8 c4:1→3 c5:1→4/u);
  });

  test('blind control (?preview=puzzle:krampus, cards removed, saved state cleared): one board per reader on a fresh page; every natural board but the one that dates the costume fails', async ({ page }, info) => {
    for (const [who, board] of [...READERS, ['winner', WINNER]] as [string, Cell[]][]) {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.goto('/?preview=puzzle:krampus');
      await waitReady(page);
      await toBoard(page, info);
      await page.evaluate(() => document.querySelectorAll('.pz-cards, .pz-card').forEach((el) => el.remove()));
      await expect(page.locator('.pz-card')).toHaveCount(0);
      await fillBoard(page, info, board);
      await check(page, info);
      if (who === 'winner') {
        await waitPuzzlePhase(page, 'reveal');
        continue;
      }
      const g = await puzzleOf(page);
      expect(g.phase, who).toBe('board');
      expect(g.completed, who).toBe(false);
      expect(g.verdict, who).toContain('Chưa khớp với các thẻ.');
    }
  });

  test('the Hel piece belongs on the modern sheet only: on any other sheet it never solves', async ({ page }, info) => {
    expect(file.solutions[0]?.[3]).toEqual(['org']);
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['pc', 'org'], ['yg', 'mk', 'fb'], ['nm'], []]);
    await check(page, info);
    expect((await puzzleOf(page)).completed).toBe(false);
    expect((await puzzleOf(page)).phase).toBe('board');
  });

  test('correct: real taps solve it with no wrong check and no hint, the reveal names the claim, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await expect(page.locator('.pz-reveal')).toContainText('chưa ai chứng minh');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(linesBefore + 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:krampus'))).toBeNull();
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

test.describe('chapter 9 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'krampus')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('krampus') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'krampus', chapter: 'krampus', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'krampus' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'krampus' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['krampus']);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 9 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'krampus');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="krampus"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
