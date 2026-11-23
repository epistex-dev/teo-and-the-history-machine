import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ORDER } from '../src/order.ts';
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
  storyPoint,
  tap,
  typeName,
  waitReady,
} from './support/play.ts';
import { check, domPiece, fillBoard, helpPuzzle, press, puzzleFile, puzzleOf, solvePuzzle, toBoard, waitPuzzlePhase, wrongFill, type Cell } from './support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from './support/script.ts';
import type { Beat } from '../src/story/types.ts';

const script = chapterOf('saturnalia');
const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
const file = puzzleFile('saturnalia');
const after = lineAfterMinigame(script, 'Lan');
const DAYS = ['19/12', '20/12', '21/12', '22/12', '23/12', '24/12', '25/12'];
const PORTRAIT = { width: 390, height: 664 };
const LANDSCAPE = { width: 844, height: 390 };
/** Quạ Đồn's frame: the three pieces of the wrong frame in their slots, the rest empty. */
const TRAP: Cell[] = [null, ['k'], null, ['p'], null, ['n'], null];

async function openAtGame(page: Page, info: TestInfo, query = ''): Promise<void> {
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: gameScene });
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

test.describe('chapter 2 puzzle', () => {
  test('loads clean: a DOM puzzle with seven day slots, six pieces and four cards, starting on the guess', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtGame(page, info);
    expect(await puzzleOf(page)).toMatchObject({ id: 'saturnalia', kind: 'puzzle', phase: 'predict', completed: false, checks: 0, wrong: 0, hints: 0, cards: 4, of: 1 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('.pz-option').allTextContents(), 'the guess offers the three end days').toEqual(file.predict?.options);
    await toBoard(page, info);
    expect(await page.locator('.pz-slot-label').allTextContents(), 'one slot per day of the strip, in order').toEqual(DAYS);
    const board = await puzzleOf(page);
    expect(board.bank).toHaveLength(6);
    expect([...(board.bank ?? [])].sort()).toEqual(file.tokens.map((t) => t.id).sort());
    expect(Object.values(board.board ?? {}).flat(), 'nothing is placed for the player').toEqual([]);
    await expect(page.locator('.pz-card')).toHaveCount(4);
    await expect(page.locator('#mg-help')).toBeHidden();
    expect(await page.locator('#mg-hint').textContent()).toBe('');
    await page.waitForTimeout(400);
    expectClean(m, baseURL!);
  });

  test('the guess takes any day, shows no verdict, and the reveal repeats it', async ({ page }, info) => {
    await openAtGame(page, info);
    expect(await page.locator('.pz').innerText()).not.toMatch(/đúng|sai|chính xác/iu);
    await press(page.locator('.pz-option').nth(2), info);
    await waitPuzzlePhase(page, 'board');
    expect((await puzzleOf(page)).predicted).toBe(2);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await expect(page.locator('.pz-echo')).toContainText(file.predict?.options[2] ?? '');
    await expect(page.locator('.pz-reveal')).toContainText('Saturnalia không rơi vào 25/12');
    await expect(page.locator('.pz-reveal .stamp')).toHaveAttribute('data-stamp', 'SỰ THẬT');
  });
});

test.describe('R4 no-fail puzzle: the five strategies', () => {
  test('correct: real taps solve it with no wrong check and no hint, the save is cleared, and the story goes on once', async ({ page }, info) => {
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    expect(Object.fromEntries(Object.entries((await puzzleOf(page)).board ?? {}).filter(([, v]) => v.length)), 'the pieces the player tapped in').toEqual({ s1: ['m'], s3: ['t'], s5: ['r'] });
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expect(await puzzleOf(page)).toMatchObject({ wrong: 0, wrongTotal: 0, hints: 0, completed: false });
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await afterGame(page);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:saturnalia'))).toBeNull();
  });

  test('idle: nothing moves, no hint opens by itself, no ghost hand, and it never completes', async ({ page }, info) => {
    await openAtGame(page, info, '?manual=1');
    await toBoard(page, info);
    await fillBoard(page, info, wrongFill(file).map((c, i) => (i === 0 ? c : null)));
    const before = await puzzleOf(page);
    await step(page, 30_000);
    await step(page, 30_000);
    await step(page, 30_000);
    await step(page, 30_000);
    await page.waitForTimeout(500);
    const after2 = await puzzleOf(page);
    expect(after2).toEqual(before);
    expect(after2).toMatchObject({ phase: 'board', completed: false, hints: 0, hint: '', nudge: false, wrong: 0 });
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
    let seed = 5;
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
    const afterEmpty = (await puzzleOf(page)).wrong as number;
    expect(afterEmpty).toBe(0);
    await fillBoard(page, info, wrongFill(file));
    await check(page, info);
    const g = await puzzleOf(page);
    expect(g).toMatchObject({ phase: 'board', completed: false, wrong: afterEmpty + 1 });
    expect(g.verdict).not.toBe('');
    const marked = await page.locator('.pz-slot, .pz-piece').evaluateAll((els) => els.filter((e) => /đúng|sai|wrong|correct/iu.test(e.getAttribute('aria-label') ?? '')).length);
    expect(marked).toBe(0);
  });

  test('hold: a piece carried over its slot and held for 60 s of game time places nothing until it is released', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'a held mouse drag is a desktop gesture');
    await openAtGame(page, info, '?manual=1');
    await toBoard(page, info);
    const piece = (await page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('saturnalia', 'r') + '"]').boundingBox())!;
    const slot = (await page.locator('.pz-slot[data-slot="s5"] .pz-slot-btn').boundingBox())!;
    await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
    await page.mouse.down();
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 8 });
    await step(page, 30_000);
    await step(page, 30_000);
    expect((await puzzleOf(page)).board?.s5, 'held, not placed').toEqual([]);
    await page.mouse.up();
    await expect.poll(async () => (await puzzleOf(page)).board?.s5).toEqual(['r']);
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

  test('help: the hint button is reachable by keyboard, opens one tier per press, and its last tier, Nhờ Cúc Cu soi tỏ, solves the strip', async ({ page }, info) => {
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

  test('keys held while nothing is focused (Enter, Space, arrows) complete nothing', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'no keyboard on touch devices');
    await openAtGame(page, info, '?manual=1');
    await toBoard(page, info);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (const key of ['Enter', ' ', 'ArrowRight', 'ArrowDown']) {
      await page.keyboard.down(key);
      for (let i = 0; i < 8; i += 1) await page.keyboard.down(key);
      await page.keyboard.up(key);
      await step(page, 30_000);
    }
    const g = await puzzleOf(page);
    expect(g).toMatchObject({ phase: 'board', completed: false, hints: 0 });
    expect((await stateOf(page)).shell.mode).toBe('minigame');
  });
});

test.describe('window and reload', () => {
  for (const [label, size] of [['portrait', PORTRAIT], ['landscape', LANDSCAPE], ['320 px wide', { width: 320, height: 568 }]] as const) {
    test(label + ': no sideways scroll on the guess, the board or the reveal, and every control is at least 44 px', async ({ page }, info) => {
      await page.setViewportSize(size);
      await openAtGame(page, info);
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
    await page.setViewportSize(PORTRAIT);
    await openAtGame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, [null, null, null, null, ['r'], null, null]);
    expect((await puzzleOf(page)).board?.s5).toEqual(['r']);
    await page.setViewportSize(LANDSCAPE);
    await page.waitForTimeout(250);
    expect((await puzzleOf(page)).board?.s5, 'the placement survives the turn').toEqual(['r']);
    await fillBoard(page, info, [['m'], null, null, null, null, null, null]);
    expect((await puzzleOf(page)).board).toMatchObject({ s1: ['m'], s5: ['r'] });
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

  test('help ended chapter 1, so chapter 2 starts clean: no hint, no wrong count, its own guess, no canvas', async ({ page }, info) => {
    const m = monitor(page);
    await seedSave(page);
    await page.goto('/?manual=1');
    await waitReady(page);
    await reachMinigame(page, info);
    expect((await stateOf(page)).game?.id).toBe('intro');
    await helpPuzzle(page, info);
    let reached = false;
    for (let i = 0; i < 80 && !reached; i += 1) {
      const s = await stateOf(page);
      if (s.game?.id === 'saturnalia') reached = true;
      else if (s.game) throw new Error('chapter 1 game again');
      else if (s.shell.mode === 'minigame') await step(page, 100);
      else if (s.story?.asking) await typeName(page, 'Lan');
      else await advanceStory(page, info);
    }
    expect(reached, 'chapter 2 puzzle reached').toBe(true);
    expect(await puzzleOf(page)).toMatchObject({ phase: 'predict', completed: false, wrong: 0, wrongTotal: 0, hints: 0, hint: '', checks: 0 });
    await expect(page.locator('#mg-help')).toBeHidden();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('#mg-hint').textContent()).toBe('');
    await solveMinigame(page, realInput(info), info);
    await afterGame(page);
    expect(m.pageErrors).toEqual([]);
    expect(m.consoleErrors).toEqual([]);
  });
});

test.describe('chunk failures on chapter 2', () => {
  const chunk = (page: Page, failures: number): { hits: number } => {
    const counter = { hits: 0 };
    void page.route('**/assets/pz-saturnalia-*.js', (route) => {
      counter.hits += 1;
      if (counter.hits > failures) return route.continue();
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
    });
    return counter;
  };

  async function walk(page: Page, info: TestInfo, until: () => Promise<boolean>): Promise<void> {
    for (let i = 0; i < 60; i += 1) {
      try {
        if (await until()) return;
        const s = await stateOf(page);
        if (s.story?.asking) await typeName(page, 'Lan');
        else if (s.shell.mode === 'story') await advanceStory(page, info);
        else await page.waitForTimeout(100);
      } catch {
        await page.waitForTimeout(200);
      }
    }
    throw new Error('the walk did not reach its goal');
  }

  test('the puzzle chunk fails once: one reload, then the puzzle runs from the scene start', async ({ page }, info) => {
    const c = chunk(page, 1);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: gameScene });
    await page.goto('/');
    await waitReady(page);
    await walk(page, info, async () => (await stateOf(page)).game?.id === 'saturnalia');
    expect(c.hits).toBeGreaterThanOrEqual(2);
    expect(m.loads(), 'the original load and one reload').toBeLessThanOrEqual(2);
    expect((await puzzleOf(page)).phase).toBe('predict');
  });

  test('the puzzle chunk is dead: one reload, the message with the retry button, no loop, no blank stage', async ({ page }, info) => {
    const c = chunk(page, 999);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: gameScene });
    await page.goto('/');
    await waitReady(page);
    await walk(page, info, async () => (await page.locator('#net-error').isVisible()) === true);
    await page.waitForTimeout(1500);
    expect(m.loads(), 'no reload loop').toBeLessThanOrEqual(3);
    expect(c.hits).toBeLessThanOrEqual(4);
    expect((await stateOf(page)).shell.phase).toBe('network-error');
    await expect(page.locator('#net-error')).toContainText('Kiểm tra mạng rồi thử lại');
  });
});

test.describe('chapter 1 into chapter 2, the card and the Sổ nguồn', () => {
  const lines = (beats: Beat[]): string[] =>
    beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : b.t === 'stamp' ? [`Dấu của Cúc Cu: ${b.label}`] : []));
  const expected = script.scenes.flatMap((s) => lines(s.beats));
  const meta = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { chapters: { id: string; stamp: string | null }[] };
  const stamp = meta.chapters.find((c) => c.id === 'saturnalia')?.stamp ?? '';
  const nextId = ORDER[ORDER.indexOf('saturnalia') + 1] as string;

  test('from the end of chapter 1: every line of chapter 2 in order, the game in the right place, then the card with its stamp and the next chapter', async ({ page, baseURL }, info) => {
    test.setTimeout(120_000);
    const m = monitor(page);
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'kim-ket' });
    await page.goto('/');
    await waitReady(page);
    const seen: string[] = [];
    let key = '';
    let played = false;
    for (let i = 0; i < 150; i += 1) {
      const s = await stateOf(page);
      if (s.shell.mode === 'card') break;
      if (s.game) {
        expect(s.game.id).toBe('saturnalia');
        await solveMinigame(page, realInput(info), info);
        played = true;
        continue;
      }
      if (s.shell.mode === 'minigame' || (s.story?.chapter === 'saturnalia' && !s.story.line && s.shell.mode !== 'card')) {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      const at = `${s.story?.chapter}:${s.story?.scene}:${s.story?.lineIndex}`;
      if (s.story?.chapter === 'saturnalia' && text && at !== key) {
        key = at;
        seen.push(text);
      }
      await advanceStory(page, info);
    }
    expect(played, 'the mini game ran between the lines').toBe(true);
    expect(seen, 'chapter 2 shows every script line once, in order, with the name filled in').toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(25);
    const card = await stateOf(page);
    expect(card.shell.mode).toBe('card');
    await expect(page.locator('#card-screen .stamp')).toHaveText(stamp);
    expect(stamp).toBe('TRANH CÃI');
    await expect(page.locator('#card-screen .card')).toHaveAttribute('data-chapter', 'saturnalia');
    expect(card.shell.save).toMatchObject({ name: 'Lan', chapter: 'saturnalia', furthest: 'saturnalia' });
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.furthest).toBe(nextId);
    const next = await stateOf(page);
    if (existsSync(`story/chapters/${nextId}.md`)) expect(next.story?.chapter).toBe(nextId);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    const cards = page.locator('#notebook-list .card');
    await expect(cards.first()).toHaveAttribute('data-chapter', 'saturnalia');
    await expect(cards.first().locator('.stamp')).toHaveText(stamp);
    await expect(cards.first().locator('.card-line')).not.toHaveCount(0);
    expectClean(m, baseURL!);
  });

  for (const [label, size] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]] as const) {
    test(`the feast hall is mapped and the stage fits in ${label}: Quạ Đồn stands on the machine roof clear of Cúc Cu and Tèo, Tèo's feet above the dialogue box`, async ({ page, baseURL }, info) => {
      const m = monitor(page);
      await page.setViewportSize(size);
      await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: script.scenes[1]?.id ?? '' });
      await page.goto('/');
      await waitReady(page);
      for (let i = 0; i < 12 && !(await storyOf(page)).cast?.some((c) => c.name === 'Quạ Đồn'); i += 1) await advanceStory(page, info);
      expect((await storyOf(page)).bg?.id).toBe('ban-tiec-saturnalia-roma');
      expect(await page.locator('#backdrop-portrait').getAttribute('src')).toContain('ch2-feast-portrait');
      expect(await page.locator('#backdrop-landscape').getAttribute('srcset')).toContain('ch2-feast-landscape');
      const box = async (who: string) => {
        const figure = page.locator(`.figure[data-who="${who}"]`);
        if ((await figure.count()) === 0) return null;
        return figure.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
      };
      const quado = (await box('qua-don'))!;
      expect(quado, 'Quạ Đồn is on the stage').toBeTruthy();
      const machine = (await page.locator('.machine').boundingBox())!;
      expect(quado.bottom, 'Quạ Đồn perches on the machine roof').toBeLessThanOrEqual(machine.y + machine.height * 0.35);
      const dialogue = (await page.locator('.dialogue').boundingBox())!;
      const story = (await page.locator('#story').boundingBox())!;
      const cast = (await storyOf(page)).cast as unknown as { name: string; box: { feet: number } | null }[];
      for (const [who, name] of [['teo', 'Tèo'], ['cuc-cu', 'Cúc Cu'], ['qua-don', 'Quạ Đồn']] as const) {
        const figure = cast.find((c) => c.name === name);
        expect(figure?.box, `${who} has a stage box`).toBeTruthy();
        expect(story.y + (figure?.box as { feet: number }).feet, `${who} feet above the dialogue box`).toBeLessThanOrEqual(dialogue.y);
      }
      const cuc = await box('cuc-cu');
      if (cuc) {
        const touching = await page.evaluate(() => {
          const drawn = (who: string): Uint8ClampedArray => {
            const canvas = document.createElement('canvas');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const g = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            for (const img of document.querySelectorAll<HTMLImageElement>(`.figure[data-who="${who}"] img`)) {
              if (img.hidden || !img.naturalWidth) continue;
              const r = img.getBoundingClientRect();
              g.drawImage(img, r.left, r.top, r.width, r.height);
            }
            return g.getImageData(0, 0, canvas.width, canvas.height).data;
          };
          const a = drawn('cuc-cu');
          const b = drawn('qua-don');
          let n = 0;
          for (let i = 3; i < a.length; i += 4) if ((a[i] as number) > 32 && (b[i] as number) > 32) n += 1;
          return n;
        });
        expect(touching, 'drawn pixels of Quạ Đồn and Cúc Cu that overlap (the sprite frames have transparent margins, so frames may)').toBe(0);
      }
      expectClean(m, baseURL!);
    });
  }

  test('taps while chapter 2 is still loading change nothing: no page error, and the first line of chapter 2 is the one shown', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/assets\/chapter-saturnalia-[^/]+\.js$/, async (route) => {
      await gate;
      await route.continue();
    });
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'kim-ket' });
    await page.goto('/');
    await waitReady(page);
    for (let i = 0; i < 20; i += 1) {
      const s = await storyOf(page);
      if (s.lineIndex === s.sceneLines) break;
      await advanceStory(page, info);
    }
    const last = await storyOf(page);
    expect(last.lineIndex, 'the last line of chapter 1 is on screen').toBe(last.sceneLines);
    const p = await storyPoint(page);
    for (let i = 0; i < 5; i += 1) {
      await tap(page, info, p.x, p.y);
      await page.waitForTimeout(260);
    }
    release();
    await expect.poll(async () => (await stateOf(page)).story?.scene, { timeout: 8000 }).toBe(script.scenes[0]?.id);
    const first = await storyOf(page);
    expect(first.lineIndex, 'the first line, not one past it').toBe(1);
    expect(first.scene).toBe(script.scenes[0]?.id);
    expectClean(m, baseURL!);
  });

  test('a save at chapter 2 resumes at the scene it names; the Sổ nguồn lists no card before the chapter is done', async ({ page }) => {
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: script.scenes[1]?.id });
    await page.goto('/');
    await waitReady(page);
    expect((await storyOf(page)).scene).toBe(script.scenes[1]?.id);
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list')).toContainText('Chưa có thẻ nào');
  });
});

test.describe('size', () => {
  test('size-limit has entries for the chapter 2 chunks and the built chunks are under 150 kB gzip', () => {
    const cfg = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as { path: string | string[]; limit: string }[];
    const entry = cfg.find((e) => [e.path].flat().some((p) => p.includes('dist/assets/pz-saturnalia-')));
    expect(entry, 'an entry for dist/assets/pz-saturnalia-*.js').toBeDefined();
    expect([entry?.path].flat()).toContain('dist/assets/chapter-saturnalia-*.js');
    expect(entry?.limit).toBe('150 kB');
    const files = readdirSync('dist/assets').filter((f) => /^(pz|chapter)-saturnalia-.*\.js$/.test(f));
    expect(files.length).toBe(2);
    const total = files.reduce((n, f) => n + gzipSync(readFileSync('dist/assets/' + f)).length, 0);
    expect(total).toBeLessThanOrEqual(150_000);
  });
});
