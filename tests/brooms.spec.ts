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

const script = chapterOf('brooms');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('brooms');
const after = lineAfterMinigame(script, 'Lan');
const gameBeats = script.scenes.find((s) => s.id === gameScene)?.beats ?? [];
const linesBefore = gameBeats.slice(0, gameBeats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').length;
type Card = { id: string; text: string; kind: string; status: string; do?: unknown };
const cards = (file as any).cards as Card[];
/**
 * What readers build with the cards hidden, from the slot labels, the piece wording and the script before the board (Cúc Cu's museum, broadcaster and science site;
 * Quạ Đồn's line about a thousand years, which Tèo meets with "Nguồn đâu?", so every reader doubts it).
 * The pieces: a (troll, hulder, draug and the Devil walk), b (nearly every supernatural being goes out), c (confessions at witch trials were forced out),
 * d (broom and dung shovel set outside the barn door), h (hide all brooms and mops in the house), f (putting the brooms away that night is a very old custom).
 * Slots in order: Bảo tàng Na Uy, Trang tin khoa học, Đài NRK, Bản tin đại học (holds at most one piece).
 * Casual: a folk museum is where farm customs live, so the broom customs go with it, and the thousand-year line goes with the customs it echoes.
 * Well-read: knows the museum lists the creatures, the broadcaster's historian speaks of witch trials and the news item is where "hide the brooms" is repeated;
 * doubts the thousand years, but still files a farm custom under the museum.
 * Expert variant: knows those three facts (museum list, the historian, the missing source for a thousand years) and files the farm custom under the witch trials, since the
 * witches are the ones who ride brooms; nothing the expert knows separates this board from the answer.
 * Expert: reads forskning.no and knows both its lines, and which source says hide: that board is the answer (accepted risk: it needs the research itself, not general knowledge).
 */
const BLIND: Record<string, Cell[]> = {
  casual: [['a', 'd', 'f'], ['b'], ['c'], ['h']],
  wellRead: [['a', 'd'], ['b'], ['c'], ['h']],
  expertVariant: [['a'], ['b'], ['c', 'd'], ['h']],
};
const TRAP: Cell[] = [['a', 'f'], ['b', 'd'], ['c'], ['h']];
const EXPERT: Cell[] = [['a'], ['b', 'd'], ['c'], ['h']];
const FIT = 58;
const sorted = (cells: Cell[]) => JSON.stringify(cells.map((c) => [...(c ?? [])].sort()));

async function openAtGame(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'brooms', chapter: 'brooms', scene: gameScene });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info);
}

test.describe('chapter 19 puzzle', () => {
  test('loads clean: a DOM puzzle with four sources, six pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'brooms', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    await expect(page.locator('.pz-slot-label')).toHaveCount(4);
    expect([...((await puzzleOf(page)).bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('the puzzle is a full file with no stub left, no L2 exemption, and the checker finds two L2 steps; the chapter stays in the undated block', () => {
    expect(existsSync('story/puzzles/stubs/brooms.json')).toBe(false);
    expect(file).not.toHaveProperty('stub');
    expect(file).not.toHaveProperty('l2Exempt');
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'brooms'], { encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toMatch(/L2 steps 2 \[hypothesis b≠1 ; hypothesis b≠3\]/);
    expect(out.stdout).not.toContain('EXEMPT');
    const rows = spawnSync('node', ['scripts/check-minigames.mjs'], { encoding: 'utf8' });
    expect(rows.status, rows.stdout + rows.stderr).toBe(0);
    expect(rows.stdout).toContain('unknown-year block: befana, brooms');
  });

  test('no year or century on any card, piece, rule, hint or reveal line', () => {
    const shown = JSON.stringify([(file as any).title, (file as any).question, (file as any).predict, (file as any).rules, (file as any).hints, (file as any).reveal, (file as any).aha, (file as any).wrongFrame.text, cards.map((c) => [c.text, (c as any).who]), (file as any).tokens.map((t: any) => t.text), (file as any).slots.map((s: any) => s.label)]);
    expect(shown).not.toMatch(/\b1[0-9]{3}\b|\b20[0-9]{2}\b|thế kỷ/u);
  });

  test('the matrix row is full, names this file and repeats its cards and reveal', () => {
    const rows = JSON.parse(readFileSync('story/minigames.json', 'utf8')) as { id: string; state: string; puzzle: string; cards: { text: string; status: string }[]; reveal: string; solution: string; label: string; note: string; thin?: boolean }[];
    const row = rows.find((r) => r.id === 'brooms')!;
    expect(row.state).toBe('full');
    expect(row.puzzle).toBe('story/puzzles/brooms.json');
    expect(row.cards.map((c) => c.text)).toEqual(cards.map((c) => c.text));
    expect(row.cards.map((c) => c.status)).toEqual(cards.map((c) => c.status));
    expect(row.reveal).toBe(((file as any).reveal.lines as string[]).join(' '));
    expect(row.solution).toContain('NRK: Lời khai ở phiên xử phù thủy bị ép ra');
    expect(row.solution).toContain('để ngoài: Cất chổi đêm ấy là tục rất lâu đời');
    expect(row.label, 'the chapter stamp stays the dangerous-night stamp').toBe('SỰ THẬT');
    expect(row.note, 'the accepted expert risk is documented').toContain('Rủi ro chuyên gia được chấp nhận');
  });

  test('each card says what it encodes: each source says its own line, the two broom lines contradict and no card says who is right, and the thousand years is only a condition', () => {
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(cards.map((c) => [c.id, c.kind, c.status])).toEqual([
      ['c1', 'modern', 'fact'],
      ['c2', 'inference', 'disputed'],
      ['c3', 'modern', 'fact'],
      ['c4', 'modern', 'disputed'],
      ['c5', 'inference', 'fact'],
    ]);
    expect(by.c1!.text).toBe('Audun Kjus ở Bảo tàng Dân gian Na Uy ghi: troll, hulder, draug và cả Quỷ đi lại đêm Giáng Sinh.');
    expect(JSON.stringify(by.c1!.do)).toBe(JSON.stringify([{ op: 'at', t: 'a', s: 's1' }]));
    expect(by.c2!.text, 'the card says that two lines share one popular article with no origin given, not which source that is').toBe('Suy ra: hai lời chung một bài báo phổ biến, không nêu nguồn gốc: gần như mọi sinh vật siêu nhiên; chổi ngoài cửa chuồng.');
    expect(JSON.stringify(by.c2!.do)).toBe(JSON.stringify([{ op: 'same', t: ['b', 'd'] }]));
    expect(by.c3!.text).toBe('Sử gia Hagen trên đài NRK: lời khai ở các phiên xử phù thủy bị ép ra.');
    expect(JSON.stringify(by.c3!.do)).toBe(JSON.stringify([{ op: 'at', t: 'c', s: 's3' }]));
    expect(by.c4!.text, 'the news item says hide; it is only what the item says').toBe('Bản tin Đại học Northeastern ghi: người Na Uy giấu hết chổi và giẻ lau trong nhà.');
    expect(JSON.stringify(by.c4!.do)).toBe(JSON.stringify([{ op: 'at', t: 'h', s: 's4' }]));
    expect(by.c5!.text).toBe('Suy ra: nguồn nào nói cất chổi đêm ấy là tục rất lâu đời, nguồn ấy cũng nói giấu chổi trong nhà.');
    expect(JSON.stringify(by.c5!.do), 'a condition satisfied by leaving the piece out, never an order to leave').toBe(JSON.stringify([{ op: 'expr', e: ['or', ['not', ['placed', 'f']], ['eq', ['pos', 'f'], ['pos', 'h']]] }]));
    for (const c of cards) {
      expect(c.text, c.id + ' carries no year').not.toMatch(/\b1[0-9]{3}\b|\b20[0-9]{2}\b|thế kỷ|Vardø|máu/u);
      expect(JSON.stringify(c.do ?? []), c.id).not.toMatch(/"unused"|"used"/u);
    }
    expect(JSON.stringify(cards.filter((c) => c.id !== 'c5').map((c) => c.text)), 'only the condition card repeats the rumour').not.toMatch(/nghìn năm/u);
    expect(by.c2!.text + by.c4!.text, 'no card says which of hide and outside is true').not.toMatch(/đúng|sai|thật|bịa/u);
    expect((file as any).wrongFrame.cards, 'the cards that break the frame').toEqual(['c4', 'c5']);
    const cls = Object.fromEntries((file as any).tokens.map((t: any) => [t.id, t.status]));
    expect(cls).toEqual({ a: 'fact', b: 'fact', c: 'fact', d: 'disputed', h: 'disputed', f: 'decoy' });
    expect((file as any).slots[3]).toMatchObject({ cap: 1, min: 0 });
  });

  test('no piece, rule or hint says which source holds what, and no piece names its source or its class', () => {
    const screen = JSON.stringify([(file as any).question, (file as any).rules, (file as any).hints.slice(0, 3), (file as any).tokens.map((t: any) => t.text)]);
    expect(screen).not.toMatch(/Hagen|Kjus|Grønli|Bratberg|tranh cãi|truyền thuyết|giả thuyết|người ta kể|chưa có nguồn/u);
    expect(JSON.stringify((file as any).tokens.map((t: any) => t.text))).not.toMatch(/Norsk|forskning|NRK|Northeastern|bản tin|bài báo|Bảo tàng|sử gia|trang tin/u);
    expect(JSON.stringify((file as any).hints.slice(0, 3))).not.toMatch(/nghìn năm|giấu|ngoài cửa|cửa chuồng|giẻ lau|Quỷ|phù thủy/u);
    expect((file as any).slots.map((s: any) => s.label)).toEqual(['Bảo tàng Na Uy', 'Trang tin khoa học', 'Đài NRK', 'Bản tin đại học']);
    expect((file as any).slots.map((s: any) => [s.cap, s.min])).toEqual([['any', 1], ['any', 1], ['any', 1], [1, 0]]);
    const rules = (file as any).rules.map((r: any) => r.text).join(' ');
    expect(rules, 'the rules say what the slots enforce').toContain('Bảo tàng Na Uy, trang tin khoa học, đài NRK: mỗi nơi nhận ít nhất một mảnh.');
    expect(rules).toContain('Bản tin đại học: nhiều nhất một mảnh.');
    expect(file.predict?.options).toEqual(['Giấu chổi đi', 'Để chổi ngoài cửa', 'Mỗi nguồn nói một khác']);
  });

  test('every card is needed: with any one removed the others leave more than one board', () => {
    const all = new Set(cards.map((c) => c.id));
    expect(solutions(file, all) as number[][]).toHaveLength(1);
    for (const c of cards) {
      const rest = new Set([...all].filter((id) => id !== c.id));
      expect((solutions(file, rest) as number[][]).length, 'without ' + c.id).toBeGreaterThan(1);
    }
  });

  test('the thousand-year line leaves the board only through the condition and the capacity of the news item, never through an order', () => {
    const M = model(file) as { tid: string[] };
    const f = M.tid.indexOf('f');
    const all = new Set(cards.map((c) => c.id));
    const placed = (ids: Set<string>, p: unknown = file) => (solutions(p, ids, states(p)) as number[][]).filter((v) => v[f] !== 0).length;
    expect(placed(all), 'with every card the thousand-year line has no place').toBe(0);
    expect(placed(new Set([...all].filter((id) => id !== 'c5'))), 'without the condition it fits somewhere').toBeGreaterThan(0);
    const roomy = JSON.parse(JSON.stringify(file));
    roomy.slots[3].cap = 2;
    expect(placed(all, roomy), 'with room for a second piece the condition is met by sitting with the hidden-brooms line').toBeGreaterThan(0);
    const sol = solutions(file, all) as number[][];
    expect(sol[0]![f], 'the answer leaves it out').toBe(0);
  });

  test('BLIND: the boards readers build with the cards hidden fail the checker; the boards fitting what the expert knows hold one right answer; the full-knowledge board solves (accepted risk)', () => {
    for (const [who, b] of Object.entries({ ...BLIND, trap: TRAP })) {
      expect(reply(file, b, new Set()).type, who).not.toBe('solved');
      expect(sorted(b), who + ' is not the answer').not.toBe(sorted(file.solutions[0] as Cell[]));
    }
    expect(reply(file, EXPERT, new Set()).type, 'an expert who knows both forskning.no lines and the news item needs no card').toBe('solved');
    const M = model(file) as { tid: string[] };
    const all = states(file) as number[][];
    const known: Record<string, number[]> = { a: [1], c: [3], f: [0] };
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
      await openPuzzle(page, 'brooms');
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
    await expect(page.locator('.pz-reveal')).toContainText('nói để ngoài cửa chuồng');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    const s = await storyOf(page);
    expect(s.scene).toBe(after.scene);
    expect(s.line?.text).toBe(after.text);
    expect(s.lineIndex).toBe(after.scene === gameScene ? linesBefore + 1 : 1);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:brooms'))).toBeNull();
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
    expect(reply(file, [['a', 'b', 'c', 'd'], [], [], ['h']], new Set()).type).toBe('incomplete');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [['a', 'b', 'c', 'd'], [], [], ['h']]);
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

test.describe('chapter 19 script', () => {
  test('the script gives Quạ Đồn\'s line, then says the rumour has no source and the sources contradict each other, and carries no Vardø, blood or year of a trial', () => {
    const text = JSON.stringify(script);
    expect(text).toContain('Người Na Uy giấu chổi từ cả nghìn năm.');
    expect(text).toContain('Giấu chổi từ cả nghìn năm: chưa ai chứng minh.');
    expect(text).toContain('Lại kể ngược nhau: giấu trong nhà, hay để ngoài cửa.');
    expect(text, 'the script carries no Vardø, no blood and no year of a trial').not.toMatch(/Vardø|máu|1663|1661/u);
  });
});

test.describe('chapter 19 Sổ nguồn', () => {
  test('every line of the entry is verbatim in the research block, every link is opened, and the dispute is the unverified hide-the-brooms line', () => {
    const research = readFileSync('research/m0b-act-3.md', 'utf8');
    const start = research.indexOf('### 3.6 ' + String.fromCharCode(96) + 'brooms' + String.fromCharCode(96));
    const heading = research.indexOf('### Sổ tay ' + String.fromCharCode(96) + 'brooms' + String.fromCharCode(96), start);
    expect(heading, 'the block has its own heading').toBeGreaterThan(start);
    const block = research.slice(heading, research.indexOf('## 4.', heading));
    const table = research.slice(start, heading);
    const entry = JSON.parse(readFileSync('story/notebook/brooms.json', 'utf8')) as { id: string; status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
    expect(entry).toMatchObject({ id: 'brooms', status: 'verified', source: 'research/m0b-act-3.md', stamp: 'SỰ THẬT' });
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
    expect(entry.full.dispute).toHaveLength(1);
    expect(entry.full.dispute?.[0]?.text).toMatch(/^Một số bài viết nói người Na Uy giấu chổi/u);
    expect(JSON.stringify(entry), 'no Vardø, no blood').not.toMatch(/Vardø|máu/u);
  });
});

test.describe('chapter 19 from the start to the Sổ nguồn card', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'brooms')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('brooms') + 1] as string;

  test('every script line once and in order, the game in place, then the card with its stamp', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'brooms', chapter: 'brooms', scene: '' });
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
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'brooms' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'brooms' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games).toEqual(['brooms']);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 19 shows every script line once, in order, with the name filled in').toEqual(expected);
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'brooms');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    await expect(page.locator('#card-screen .card-line')).toHaveCount(2);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card[data-chapter="brooms"] .stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });
});
