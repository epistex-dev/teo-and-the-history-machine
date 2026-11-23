import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ORDER } from '../src/order.ts';
import type { Beat } from '../src/story/types.ts';
import { expectClean, monitor } from './support/helpers.ts';
import {
  advanceStory,
  reachMinigame,
  realInput,
  seedSave,
  solveMinigame,
  stateOf,
  step,
  storedSave,
  storyOf,
  tap,
  typeName,
  waitReady,
} from './support/play.ts';
import { check, domPiece, fillBoard, press, puzzleFile, puzzleOf, toBoard, waitPuzzlePhase, wrongFill, type Cell } from './support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from './support/script.ts';
import { reply } from '../scripts/puzzles.mjs';

const script = chapterOf('yule');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('yule');
const after = lineAfterMinigame(script, 'Lan');
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
/** Quạ Đồn's frame: the more detail, the nearer the source, so Snorri's saga and King Hákon sit one column apart. */
const TRAP: Cell[] = [['B'], ['S'], null, ['P'], null, ['H'], null];

async function openAtGame(page: Page, info: TestInfo, query = '', size?: { width: number; height: number }): Promise<void> {
  if (size) await page.setViewportSize(size);
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: gameScene });
  await page.goto('/' + query);
  await waitReady(page);
  await reachMinigame(page, info);
}

async function afterGame(page: Page): Promise<void> {
  await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
  const s = await storyOf(page);
  expect(s.scene, 'the story goes on at the scene after the game').toBe(after.scene);
  expect(s.line?.text, 'exactly one completion: the first line after the game').toBe(after.text);
  expect(s.lineIndex, 'first line, none skipped').toBe(1);
}

const doubleTap = async (page: Page, info: TestInfo, selector: string): Promise<void> => {
  const b = (await page.locator(selector).boundingBox())!;
  if (info.project.use.hasTouch) {
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  } else {
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  }
};

const sizesOf = (page: Page): Promise<{ what: string; width: number; height: number }[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.pz-slot-btn, .pz-piece, .pz-check, .pz-hint-btn')].map((el) => {
      const r = el.getBoundingClientRect();
      return { what: el.className + ' ' + (el.textContent ?? '').slice(0, 20), width: r.width, height: r.height };
    }),
  );

const overflowX = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const out: string[] = [];
    const doc = document.scrollingElement as HTMLElement;
    if (doc.scrollWidth > doc.clientWidth) out.push('document');
    for (const el of document.querySelectorAll<HTMLElement>('.pz *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)) out.push(el.className || el.tagName);
    }
    return out;
  });

test.describe('chapter 3 puzzle', () => {
  test('loads clean: a DOM puzzle with two lanes of slots, five pieces and five cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'yule', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 5, of: 1 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents()).toEqual(file.predict?.options);
    await toBoard(page, info);
    const labels = await page.locator('.pz-slot-label').allTextContents();
    expect(labels.filter((l) => l.startsWith('Năm viết')), 'the lane of the years of writing').toHaveLength(3);
    expect(labels.filter((l) => l.startsWith('Thời được tả')), 'the lane of the times described').toHaveLength(4);
    const board = await puzzleOf(page);
    expect([...(board.bank ?? [])].sort(), 'all five pieces wait in the bank').toEqual(file.tokens.map((t) => t.id).sort());
    expect(Object.values(board.board ?? {}).flat()).toEqual([]);
    await expect(page.locator('.pz-card')).toHaveCount(5);
    await expect(page.locator('#mg-help')).toBeHidden();
    expect(await page.locator('#mg-hint').textContent()).toBe('');
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('no slot waits for the legend piece, and putting it in any slot never solves the puzzle', async ({ page }, info) => {
    expect(file.solutions.flat().flat(), 'the solution leaves the legend piece out').not.toContain('T');
    await openAtGame(page, info);
    await toBoard(page, info);
    const solution = file.solutions[0] as Cell[];
    const swapped = solution.map((c) => (c === 'B' || (Array.isArray(c) && c[0] === 'B') ? ['T'] : c));
    await fillBoard(page, info, swapped);
    await check(page, info);
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).completed).toBe(false);
  });

  test('the guess takes any answer, shows no verdict, and the reveal repeats it and names the legend', async ({ page }, info) => {
    await openAtGame(page, info);
    expect(await page.locator('.pz').innerText()).not.toMatch(/đúng|sai|chính xác/iu);
    await press(page.locator('.pz-option').first(), info);
    await waitPuzzlePhase(page, 'board');
    expect((await puzzleOf(page)).predicted).toBe(0);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await expect(page.locator('.pz-echo')).toContainText(file.predict?.options[0] ?? '');
    await expect(page.locator('.pz-reveal')).toContainText('Người ta kể rằng Yule kéo dài ba ngày');
    await expect(page.locator('.pz-reveal .stamp')).toHaveAttribute('data-stamp', 'SỰ THẬT');
  });
});

test.describe('R4 no-fail puzzle: the five strategies', () => {
  test('correct: real taps solve it with no wrong check and no hint, the save is cleared, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await afterGame(page);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:yule'))).toBeNull();
  });

  test('idle: nothing moves with the clock, no hint opens by itself, no ghost hand, and it never completes', async ({ page }, info) => {
    await openAtGame(page, info, '?manual=1');
    await toBoard(page, info);
    await fillBoard(page, info, [['B'], null, null, null, null, null, null]);
    const before = await puzzleOf(page);
    for (let i = 0; i < 4; i += 1) await step(page, 30_000);
    await page.waitForTimeout(500);
    const now = await puzzleOf(page);
    expect(now).toEqual(before);
    expect(now).toMatchObject({ phase: 'board', completed: false, hints: 0, hint: '', nudge: false, wrong: 0 });
    expect(await page.locator('.pz-ghost').count()).toBe(0);
    expect((await stateOf(page)).shell.mode).toBe('minigame');
  });

  test('mash: 200 random taps over the cards, the bank and the slots, whatever they hit, never complete it', async ({ page }, info) => {
    await openAtGame(page, info, '?manual=1');
    await toBoard(page, info);
    const area = (await page.locator('.pz').boundingBox())!;
    const bar = (await page.locator('.pz-bar').boundingBox())!;
    const vp = page.viewportSize()!;
    const box = { x: area.x, y: area.y, width: Math.min(area.width, vp.width - area.x), height: Math.min(bar.y, vp.height) - area.y - 4 };
    let seed = 7;
    const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i += 1) {
      await tap(page, info, box.x + rnd() * box.width, box.y + rnd() * box.height);
      if (i % 25 === 0) await page.waitForTimeout(40);
    }
    const g = await puzzleOf(page);
    expect(g.completed).toBe(false);
    expect(g.phase).not.toBe('reveal');
    expect((await stateOf(page)).shell.mode).toBe('minigame');
  });

  test('mash: Quạ Đồn\'s frame gets the plain wrong answer, marks no card and, after three tries, only offers the next hint', async ({ page }, info) => {
    expect(['trap', 'wrong'], 'the fill is the wrong frame the puzzle models').toContain(reply(file, TRAP, new Set()).type);
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, TRAP);
    for (let i = 1; i <= 3; i += 1) {
      await check(page, info);
      await expect.poll(async () => (await puzzleOf(page)).wrong).toBe(i);
      const g = await puzzleOf(page);
      expect(g.verdict).toContain('Chưa khớp với các thẻ.');
      expect(g.verdict).not.toContain('Đọc lại');
      expect(g.pointed, 'only a hint tier the player pressed marks a card').toEqual([]);
      expect(g.phase).toBe('board');
      expect(g.nudge).toBe(i === 3);
    }
    const g = await puzzleOf(page);
    expect(g).toMatchObject({ hints: 0, hint: '', completed: false });
    expect(g.verdict, 'the third wrong check offers the next tier').toMatch(/Gợi ý/u);
    await expect(page.locator('.pz-hint-btn')).toBeEnabled();
  });

  test('mash: a wrong fill and an empty check are answered without ending the puzzle, and nothing marks which slot is wrong', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await check(page, info);
    expect((await puzzleOf(page)).verdict, 'an empty board is answered "incomplete" and spends no check').toMatch(/Chưa đủ: còn 1 chỗ/u);
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).wrong).toBe(0);
    await fillBoard(page, info, wrongFill(file));
    await check(page, info);
    const g = await puzzleOf(page);
    expect(g).toMatchObject({ phase: 'board', completed: false, wrong: 1 });
    expect(g.verdict).not.toBe('');
    const marked = await page.locator('.pz-slot, .pz-piece').evaluateAll((els) => els.filter((e) => /đúng|sai|wrong|correct/iu.test(e.getAttribute('aria-label') ?? '')).length);
    expect(marked).toBe(0);
  });

  test('mash: a double tap on Kiểm tra counts as one check', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, wrongFill(file));
    await doubleTap(page, info, '.pz-check');
    await page.waitForTimeout(400);
    expect((await puzzleOf(page)).wrong, 'the second tap is swallowed').toBe(1);
  });

  test('hold: a piece carried over its slot and held for 60 s of game time places nothing until it is released', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'a held mouse drag is a desktop gesture');
    await openAtGame(page, info, '?manual=1');
    await toBoard(page, info);
    const piece = (await page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('yule', 'B') + '"]').boundingBox())!;
    const slot = (await page.locator('.pz-slot[data-slot="s1"] .pz-slot-btn').boundingBox())!;
    await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
    await page.mouse.down();
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 8 });
    await step(page, 30_000);
    await step(page, 30_000);
    expect((await puzzleOf(page)).board?.s1, 'held, not placed').toEqual([]);
    await page.mouse.up();
    await expect.poll(async () => (await puzzleOf(page)).board?.s1).toEqual(['B']);
    expect((await puzzleOf(page)).wrong).toBe(0);
  });

  test('hold: Enter held on Kiểm tra checks once; held on Lật trang the story goes on once and stays on its first line', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'no keyboard on touch devices');
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await page.locator('.pz-check').focus();
    await page.keyboard.down('Enter');
    for (let i = 0; i < 12; i += 1) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await waitPuzzlePhase(page, 'reveal');
    expect((await puzzleOf(page)).checks, 'one check, not one per repeat').toBe(0);
    await page.waitForTimeout(300);
    await page.locator('#pz-next').focus();
    await page.keyboard.down('Enter');
    for (let i = 0; i < 12; i += 1) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await afterGame(page);
    await page.waitForTimeout(1500);
    expect((await storyOf(page)).line?.text, 'no second completion').toBe(after.text);
  });

  test('help: the hint button is reachable by keyboard, opens one tier per press, and its last tier, Nhờ Cúc Cu soi tỏ, solves both lanes', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'no keyboard on touch devices');
    await openAtGame(page, info);
    await toBoard(page, info);
    let focused = false;
    for (let i = 0; i < 40 && !focused; i += 1) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.id === 'pz-hint');
    }
    expect(focused, 'Tab reaches the hint button').toBe(true);
    for (let i = 0; i < file.hints.length - 1; i += 1) {
      await page.waitForTimeout(280);
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await puzzleOf(page)).hints).toBe(i + 1);
    }
    await expect(page.locator('#pz-hint')).toHaveText('Nhờ Cúc Cu soi tỏ');
    await page.waitForTimeout(280);
    await page.keyboard.press('Enter');
    await waitPuzzlePhase(page, 'reveal');
  });

  test('help: asking Cúc Cu to the end and double-tapping Lật trang completes once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    for (let i = 0; i < file.hints.length; i += 1) {
      await page.waitForTimeout(280);
      await press(page.locator('#pz-hint'), info);
    }
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(280);
    await doubleTap(page, info, '#pz-next');
    await afterGame(page);
    await page.waitForTimeout(1500);
    expect((await storyOf(page)).line?.text, 'no second completion').toBe(after.text);
    expect((await storyOf(page)).lineIndex).toBe(1);
  });
});

test.describe('window and reload', () => {
  for (const [label, size] of [['portrait', PORTRAIT], ['landscape', LANDSCAPE], ['320 px wide', { width: 320, height: 568 }]] as const) {
    test(label + ': no sideways scroll on the guess, the board or the reveal, and every control is at least 44 px', async ({ page }, info) => {
      await openAtGame(page, info, '', size);
      expect(await overflowX(page)).toEqual([]);
      await toBoard(page, info);
      expect(await overflowX(page)).toEqual([]);
      for (const s of await sizesOf(page)) {
        expect(s.width, s.what + ' width').toBeGreaterThanOrEqual(43.5);
        expect(s.height, s.what + ' height').toBeGreaterThanOrEqual(43.5);
      }
      await fillBoard(page, info, file.solutions[0] as Cell[]);
      await check(page, info);
      await waitPuzzlePhase(page, 'reveal');
      expect(await overflowX(page)).toEqual([]);
    });
  }

  test('turning the phone keeps the placed pieces and a piece placed afterwards still lands', async ({ page }, info) => {
    await openAtGame(page, info, '', PORTRAIT);
    await toBoard(page, info);
    await fillBoard(page, info, [['B'], null, null, null, null, null, null]);
    await page.setViewportSize(LANDSCAPE);
    await page.waitForTimeout(250);
    expect((await puzzleOf(page)).board?.s1, 'the placement survives the turn').toEqual(['B']);
    await fillBoard(page, info, [null, null, ['S'], null, null, null, null]);
    expect((await puzzleOf(page)).board).toMatchObject({ s1: ['B'], s3: ['S'] });
    await page.setViewportSize(PORTRAIT);
    await page.waitForTimeout(250);
    expect((await puzzleOf(page)).board).toMatchObject({ s1: ['B'], s3: ['S'] });
  });

  test('reload in the middle of the board resumes at the start of the scene; the pieces are in the puzzle save, not the story save, and come back with the board', async ({ page }, info) => {
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
    expect(JSON.parse((await storedSave(page)) ?? 'null'), 'the board is not in the story save').toMatchObject({ scene: gameScene });
    expect(JSON.parse((await storedSave(page)) ?? 'null')).not.toHaveProperty('board');
    await reachMinigame(page, info);
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).board, 'the puzzle save brings the board back').toEqual(placed);
  });
});

test.describe('chapter 2 into chapter 3, the card and the Sổ nguồn', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? ['Dấu của Cúc Cu: ' + b.label] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'yule')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('yule') + 1] as string;

  test('from the game of chapter 2: the card of chapter 2, then every line of chapter 3 in order, the game in place, the card with SỰ THẬT and the next chapter', async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: 'doi-vai' });
    await page.goto('/');
    await waitReady(page);
    const seen: string[] = [];
    const games: string[] = [];
    const cards: string[] = [];
    let key = '';
    const deadline = Date.now() + 200_000;
    while (Date.now() < deadline) {
      const s = await stateOf(page);
      if (s.shell.mode === 'card') {
        const want = cards.length === 0 ? 'saturnalia' : 'yule';
        await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', want);
        cards.push(want + ':' + (await page.locator('#card-screen .stamp').textContent()));
        if (want === 'yule') break;
        await page.locator('#card-next').click();
        await expect.poll(async () => (await stateOf(page)).shell.mode).not.toBe('card');
        continue;
      }
      if (s.game) {
        games.push(s.game.id);
        await solveMinigame(page, realInput(info), info);
        continue;
      }
      if (s.shell.mode !== 'story' || (s.story?.chapter === 'yule' && !s.story.line && !s.story.asking)) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = s.story?.chapter + ':' + s.story?.scene + ':' + s.story?.lineIndex;
      if (s.story?.chapter === 'yule' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(games, 'the two mini games ran, in chapter order').toEqual(['saturnalia', 'yule']);
    expect(cards).toEqual(['saturnalia:TRANH CÃI', 'yule:' + stamp]);
    expect(stamp).toBe('SỰ THẬT');
    expect(seen, 'chapter 3 shows every script line once, in order, with the name filled in').toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(25);
    expect(expected.length).toBeLessThanOrEqual(40);
    const card = await stateOf(page);
    expect(card.shell.save).toMatchObject({ name: 'Lan', chapter: 'yule', furthest: 'yule' });
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'yule');
    await expect(page.locator('#card-screen .card-line')).toHaveCount(3);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync('story/chapters/' + nextId + '.md')) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    const cardsInBook = page.locator('#notebook-list .card');
    await expect(cardsInBook.nth(1)).toHaveAttribute('data-chapter', 'yule');
    await expect(cardsInBook.nth(1).locator('.stamp')).toHaveText(stamp);
    expectClean(m, baseURL!);
  });

  test('the wax candle is a prop in the long hall and is put down at the end of the chapter', async ({ page }, info) => {
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: script.scenes[0]?.id ?? '' });
    await page.goto('/');
    await waitReady(page);
    const props = async (): Promise<string[]> => ((await storyOf(page)) as unknown as { stage: { props: string[] } }).stage.props;
    for (let i = 0; i < 30 && !((await storyOf(page)).line?.text ?? '').includes('cây nến sáp cháy trên ghế'); i += 1) await advanceStory(page, info);
    await expect.poll(props).toContain('candle-wax');
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: gameScene });
    await page.goto('/');
    await waitReady(page);
    await reachMinigame(page, info);
    expect(await props(), 'still standing while the game runs').toContain('candle-wax');
    await solveMinigame(page, realInput(info), info);
    await afterGame(page);
    for (let i = 0; i < 30 && (await props()).includes('candle-wax'); i += 1) await advanceStory(page, info);
    expect(await props(), 'put down before the end of the chapter').not.toContain('candle-wax');
  });
});

test.describe('landscape phone: Quạ Đồn stays on screen', () => {
  for (const [chapter, scene] of [['saturnalia', 'qua-don'], ['yule', 'sanh-dai']] as const) {
    for (const font of ['normal', 'xlarge'] as const) {
      test('844 x 390, ' + chapter + ', font ' + font + ': the dialogue box is at most 150 css px and Quạ Đồn is on screen on every line', async ({ page }, info) => {
        await page.setViewportSize(LANDSCAPE);
        await page.addInitScript((f) => localStorage.setItem('teo:v1:settings', JSON.stringify({ version: 1, textSpeed: 'instant', autoAdvance: 'off', music: 70, sfx: 80, fontSize: f, reducedMotion: null })), font);
        await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: chapter, chapter, scene });
        await page.goto('/');
        await waitReady(page);
        let checked = 0;
        for (let i = 0; i < 14; i += 1) {
          const s = await storyOf(page);
          if (s.mode !== 'story' || s.scene !== scene) break;
          const dialogue = (await page.locator('.dialogue').boundingBox())!;
          expect(dialogue.height, 'dialogue box height').toBeLessThanOrEqual(150);
          const quado = page.locator('.figure[data-who="qua-don"]');
          if ((await quado.count()) > 0) {
            const r = await quado.evaluate((el) => {
              const box = el.getBoundingClientRect();
              return { top: box.top, left: box.left, right: box.right, bottom: box.bottom };
            });
            expect(r.top, 'Quạ Đồn starts below the top edge').toBeGreaterThanOrEqual(-1);
            expect(r.left).toBeGreaterThanOrEqual(-1);
            expect(r.right).toBeLessThanOrEqual(845);
            expect(r.bottom, 'and ends above the dialogue box').toBeLessThanOrEqual(dialogue.y + 1 + 0.06 * r.bottom);
            checked += 1;
          }
          await advanceStory(page, info);
        }
        expect(checked, 'Quạ Đồn was on screen for at least one line').toBeGreaterThan(0);
      });
    }
  }

  test('the name prompt in landscape keeps its box at 170 css px (the 150 px box plus the room the name row needs) with the input and the button inside', async ({ page }, info) => {
    await page.setViewportSize(LANDSCAPE);
    await page.addInitScript(() => localStorage.setItem('teo:v1:settings', JSON.stringify({ version: 1, textSpeed: 'instant', autoAdvance: 'off', music: 70, sfx: 80, fontSize: 'xlarge', reducedMotion: null })));
    await seedSave(page, { schemaVersion: 1, name: '', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten' });
    await page.goto('/');
    await waitReady(page);
    for (let i = 0; i < 10 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
    expect((await storyOf(page)).asking).toBe(true);
    const box = (await page.locator('.dialogue').boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(170);
    for (const sel of ['#name', '#name-done']) {
      const b = (await page.locator(sel).boundingBox())!;
      expect(b.y, sel).toBeGreaterThanOrEqual(box.y - 1);
      expect(b.y + b.height, sel).toBeLessThanOrEqual(box.y + box.height + 1);
    }
  });
});

test.describe('Cúc Cu stamps', () => {
  const rig = { stamp: JSON.parse(readFileSync('src/stamps/marks.json', 'utf8')) as { size: [number, number]; marks: Record<string, { label: string; text: [number, number, number, number] }> } };

  test('all five stamps wrap to at most 2 lines and fit the text box of their own mark', async ({ page }) => {
    await page.route(/\/assets\/notebook-[^/]+\.js$/, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      await route.fulfill({ response, body: body.replace(/(id:(["'`])mistletoe\2,[^{}]*?stamp:)(["'`])TRUYỀN THUYẾT\3/, '$1$3THEO TRUYỀN THỐNG$3') });
    });
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'carol', chapter: 'carol', scene: '' });
    await page.goto('/');
    await waitReady(page);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .stamp')).not.toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const count = await page.locator('#notebook-list .stamp').count();
    const found = [];
    for (let i = 0; i < count; i += 1) {
      const stamp = page.locator('#notebook-list .stamp').nth(i);
      await stamp.scrollIntoViewIfNeeded();
      const meta = await stamp.evaluate((el) => {
        const node = el as HTMLElement;
        node.style.transform = 'none';
        node.querySelector('img')!.style.visibility = 'hidden';
        const textEl = node.querySelector('.stamp-text') as HTMLElement;
        const s = node.getBoundingClientRect();
        const t = textEl.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(textEl);
        return {
          label: node.dataset.stamp ?? '',
          text: textEl.textContent,
          lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top / 4))).size,
          box: { x: t.left, y: t.top, width: t.width, height: t.height },
          unit: [(t.left - s.left) / s.width, (t.top - s.top) / s.height, t.width / s.width, t.height / s.height],
          font: parseFloat(getComputedStyle(textEl).fontSize),
        };
      });
      const pad = 6;
      const shot = await page.screenshot({ clip: { x: meta.box.x - pad, y: meta.box.y - pad, width: meta.box.width + 2 * pad, height: meta.box.height + 2 * pad } });
      const ink = await page.evaluate(
        async ([data]) => {
          const img = new Image();
          img.src = 'data:image/png;base64,' + data;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext('2d')!;
          g.drawImage(img, 0, 0);
          const px = g.getImageData(0, 0, c.width, c.height).data;
          const bg = [px[0], px[1], px[2]];
          let [x0, y0, x1, y1] = [c.width, c.height, 0, 0];
          for (let y = 0; y < c.height; y += 1)
            for (let x = 0; x < c.width; x += 1) {
              const o = (y * c.width + x) * 4;
              if (Math.abs(px[o]! - bg[0]!) + Math.abs(px[o + 1]! - bg[1]!) + Math.abs(px[o + 2]! - bg[2]!) > 150) {
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x + 1);
                y1 = Math.max(y1, y + 1);
              }
            }
          return { scale: img.width, x0, y0, x1, y1, empty: x1 === 0 };
        },
        [shot.toString('base64')] as const,
      );
      const k = ink.scale / (meta.box.width + 2 * pad);
      found.push({ ...meta, empty: ink.empty, ink: { left: ink.x0 / k - pad, top: ink.y0 / k - pad, right: ink.x1 / k - pad, bottom: ink.y1 / k - pad } });
    }
    const byLabel = new Map(found.map((f) => [f.label, f]));
    expect([...byLabel.keys()].sort()).toEqual(['SỰ THẬT', 'THEO KINH THÁNH', 'THEO TRUYỀN THỐNG', 'TRANH CÃI', 'TRUYỀN THUYẾT']);
    const [W, H] = rig.stamp.size;
    for (const mark of Object.values(rig.stamp.marks)) {
      const f = byLabel.get(mark.label)!;
      expect(f.text).toBe(mark.label);
      expect(f.lines, mark.label + ' lines').toBeLessThanOrEqual(2);
      expect(f.empty, mark.label + ' is drawn').toBe(false);
      expect(f.ink.left, mark.label + ' ink left').toBeGreaterThanOrEqual(-1);
      expect(f.ink.top, mark.label + ' ink top').toBeGreaterThanOrEqual(-1);
      expect(f.ink.right, mark.label + ' ink right').toBeLessThanOrEqual(f.box.width + 1);
      expect(f.ink.bottom, mark.label + ' ink bottom').toBeLessThanOrEqual(f.box.height + 1);
      const [x, y, w, h] = mark.text;
      expect(f.unit[0], mark.label + ' box x').toBeCloseTo(x / W, 2);
      expect(f.unit[1], mark.label + ' box y').toBeCloseTo(y / H, 2);
      expect(f.unit[2], mark.label + ' box width').toBeCloseTo(w / W, 2);
      expect(f.unit[3], mark.label + ' box height').toBeCloseTo(h / H, 2);
      expect(f.font, mark.label + ' is readable').toBeGreaterThanOrEqual(9);
    }
    expect(byLabel.get('THEO TRUYỀN THỐNG')?.lines, 'the longest label wraps to 2 lines').toBe(2);
  });
});

test.describe('size', () => {
  test('size-limit has an entry for the chapter 3 chunks and the built chunks are under 150 kB gzip', () => {
    const cfg = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as { path: string | string[]; limit: string }[];
    const entry = cfg.find((e) => [e.path].flat().some((p) => p.includes('dist/assets/pz-yule-')));
    expect(entry, 'an entry for dist/assets/pz-yule-*.js').toBeDefined();
    expect([entry?.path].flat()).toContain('dist/assets/chapter-yule-*.js');
    expect(entry?.limit).toBe('150 kB');
    const files = readdirSync('dist/assets').filter((f) => /^(pz|chapter)-yule-(?!cat-|lads-).*\.js$/.test(f));
    expect(files.length).toBe(2);
    const total = files.reduce((n, f) => n + gzipSync(readFileSync('dist/assets/' + f)).length, 0);
    expect(total).toBeLessThanOrEqual(150_000);
  });

  test('chapter 3 adds at most 250 kB of images and sound', () => {
    const own = readdirSync('dist/assets').filter((f) => /^(ch3|prop-candle|yule)[^/]*\.(svg|png|m4a)$/.test(f));
    const bytes = own.reduce((n, f) => n + gzipSync(readFileSync('dist/assets/' + f)).length, 0);
    expect(bytes).toBeLessThanOrEqual(250_000);
  });
});
