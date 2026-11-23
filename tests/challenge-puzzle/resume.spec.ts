import { expect, test, type Page } from '@playwright/test';
import { monitor } from '../support/helpers.ts';
import { stubIds } from '../support/stubs.ts';
import { advanceStory, isTouch, reachMinigame, seedSave, stateOf, START_OF_MINIGAME, typeName, waitReady } from '../support/play.ts';
import { answerPredict, check, fillBoard, helpPuzzle, press, skipDemo, toBoard, waitPuzzlePhase } from '../support/puzzle.ts';
import {
  cool,
  clearBoard,
  domClick,
  domPiece,
  expectStoryAt,
  invariants,
  KEY,
  lineAfter,
  openInStory,
  openPuzzle,
  openSeeded,
  pickPiece,
  placeAll,
  puzzleFile,
  puzzleOf,
  stored,
  storedReal,
  storyLine,
  waitGame,
  type Cell,
} from './helpers.ts';

const reload = async (page: Page, id: string): Promise<void> => {
  await page.reload();
  await waitGame(page, id);
};

const WRONG: Cell[] = [['hyp'], ['xm', 'sun'], ['birth']];

test.describe('reload at every phase', () => {
  test('predict: stays on the question and keeps no answer', async ({ page }) => {
    await openPuzzle(page, 'dec25');
    await reload(page, 'dec25');
    const p = await puzzleOf(page);
    expect([p.phase, p.predicted]).toEqual(['predict', null]);
  });

  test('intro example: reload keeps the example and the guess, and the guess shows again at the reveal', async ({ page }, info) => {
    await openPuzzle(page, 'intro');
    await answerPredict(page, info, 2);
    await reload(page, 'intro');
    const p = await puzzleOf(page);
    expect([p.phase, p.predicted]).toEqual(['demo', 2]);
    await skipDemo(page, info);
    await reload(page, 'intro');
    expect((await puzzleOf(page)).phase).toBe('board');
    expect((await puzzleOf(page)).predicted).toBe(2);
  });

  test('mid-board: placements, the held piece is dropped, counts and the guess come back; the board is still checked right', async ({ page }) => {
    const file = puzzleFile('dec25');
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, file, WRONG);
    await cool(page);
    await domClick(page, '#pz-check');
    await domClick(page, '.pz-bank [data-piece="' + domPiece('dec25', 'c380') + '"]');
    const before = await puzzleOf(page);
    await reload(page, 'dec25');
    const after = await puzzleOf(page);
    expect(after.board).toEqual(before.board);
    expect([after.checks, after.wrong, after.wrongTotal]).toEqual([before.checks, before.wrong, before.wrongTotal]);
    expect(after.selected, 'a held piece is not stored').toBeNull();
    expect(await invariants(page, file)).toEqual([]);
    await clearBoard(page);
    await placeAll(page, file, [['list'], ['sun', 'xm'], ['c380']]);
    await cool(page);
    await domClick(page, '#pz-check');
    await waitPuzzlePhase(page, 'reveal');
  });

  test('after a hint: the tier count, its text and the card it points at come back', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    for (let i = 0; i < 2; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
    }
    const before = await puzzleOf(page);
    expect(before.pointed.length).toBe(1);
    await reload(page, 'dec25');
    const after = await puzzleOf(page);
    expect([after.hints, after.hint]).toEqual([before.hints, before.hint]);
    await expect(page.locator('#pz-hint')).toHaveAttribute('data-next', '3');
  });

  test('after a hint: the card the hint points at is still marked after a reload', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await cool(page);
    await domClick(page, '#pz-hint');
    await cool(page);
    await domClick(page, '#pz-hint');
    const before = await puzzleOf(page);
    await reload(page, 'dec25');
    expect((await puzzleOf(page)).pointed).toEqual(before.pointed);
  });

  test('the nudge survives a reload, and the wrong run keeps counting across it', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, puzzleFile('dec25'), WRONG);
    for (let i = 0; i < 2; i += 1) {
      await cool(page);
      await domClick(page, '#pz-check');
    }
    await reload(page, 'dec25');
    let p = await puzzleOf(page);
    expect([p.wrong, p.nudge]).toEqual([2, false]);
    await cool(page);
    await domClick(page, '#pz-check');
    p = await puzzleOf(page);
    expect([p.wrong, p.nudge], 'third wrong check after a reload').toEqual([3, true]);
    await reload(page, 'dec25');
    p = await puzzleOf(page);
    expect([p.wrong, p.nudge], 'after reloading with the nudge showing').toEqual([3, true]);
  });

  test('reveal: reload shows the same reveal and the guess; Lật trang then ends the puzzle once and clears the save', async ({ page }, info) => {
    const m = monitor(page);
    await openPuzzle(page, 'dec25');
    await answerPredict(page, info, 1);
    await fillBoard(page, info, puzzleFile('dec25').solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    const lines = await page.locator('.pz-reveal').innerText();
    await reload(page, 'dec25');
    expect((await puzzleOf(page)).phase).toBe('reveal');
    expect(await page.locator('.pz-reveal').innerText()).toBe(lines);
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).game).toBeNull();
    expect(await stored(page, 'dec25')).toBeNull();
    await page.goto('/');
    await waitReady(page);
    expect((await stateOf(page)).game).toBeNull();
    expect(m.pageErrors).toEqual([]);
  });

  test('solved: a reload before the story moves on never opens the puzzle again', async ({ page }, info) => {
    const m = monitor(page);
    await openInStory(page, info, 'intro');
    await toBoard(page, info);
    await fillBoard(page, info, puzzleFile('intro').solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await expectStoryAt(page, lineAfter('intro'));
    await page.reload();
    await waitReady(page);
    for (let i = 0; i < 30; i += 1) {
      const s = await stateOf(page);
      expect(s.game, 'the solved puzzle opens again after a reload').toBeNull();
      if (s.story?.asking) await typeName(page, 'Lan');
      else if (s.shell.mode === 'story' && s.story?.line?.text === lineAfter('intro')) break;
      else await advanceStory(page, info);
    }
    expect(await storyLine(page)).toBe(lineAfter('intro'));
    const save = JSON.parse((await page.evaluate(() => localStorage.getItem('teo:v1:save'))) ?? '{}') as { puzzles?: string[] };
    expect(save.puzzles, 'the save marks the solved puzzle').toContain('intro');
    expect(m.pageErrors).toEqual([]);
  });

  test('intro in the story: reload at the reveal brings the reveal back and finishing continues with the one line after', async ({ page }, info) => {
    await openInStory(page, info, 'intro');
    await toBoard(page, info);
    await fillBoard(page, info, puzzleFile('intro').solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.reload();
    await waitReady(page);
    await reachMinigame(page, info, 'Lan');
    await waitGame(page, 'intro');
    expect((await puzzleOf(page)).phase).toBe('reveal');
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await expectStoryAt(page, lineAfter('intro'));
    expect(await storedReal(page, 'intro')).toBeNull();
  });

  test('ending: reload at the reveal goes on to the conclusion; reload there keeps the filled blanks AND the hints and wrong run', async ({ page }, info) => {
    await openSeeded(page, 'ending', { phase: 'reveal' });
    await reload(page, 'ending');
    expect((await puzzleOf(page)).phase).toBe('reveal');
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await waitPuzzlePhase(page, 'conclusion');
    await pickPiece(page, 0);
    await domClick(page, '.pz-blank[data-blank="0"]');
    await pickPiece(page, 5);
    await domClick(page, '.pz-blank[data-blank="1"]');
    await pickPiece(page, 1);
    await domClick(page, '.pz-blank[data-blank="2"]');
    await pickPiece(page, 2);
    await domClick(page, '.pz-blank[data-blank="3"]');
    await pickPiece(page, 3);
    await domClick(page, '.pz-blank[data-blank="4"]');
    await pickPiece(page, 4);
    await domClick(page, '.pz-blank[data-blank="5"]');
    for (let i = 0; i < 2; i += 1) {
      await cool(page);
      await domClick(page, '#pz-check');
    }
    await cool(page);
    await domClick(page, '#pz-hint');
    const before = await puzzleOf(page);
    expect(before.conclusion?.filled.every(Boolean)).toBe(true);
    await reload(page, 'ending');
    const after = await puzzleOf(page);
    expect(after.phase).toBe('conclusion');
    expect(after.conclusion?.filled, 'filled blanks').toEqual(before.conclusion?.filled);
    expect(after.hints, 'conclusion hints opened before the reload').toBe(before.hints);
    expect(after.hint, 'the hint text on screen').toBe(before.hint);
    expect(after.conclusion?.wrong, 'wrong conclusion checks').toBe(before.conclusion?.wrong);
  });

  test('ending: after two wrong conclusion checks and a reload, the third wrong check still raises the nudge', async ({ page }) => {
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    for (let j = 0; j < 6; j += 1) {
      await pickPiece(page, [0, 5, 1, 2, 3, 4][j] as number);
      await domClick(page, '.pz-blank[data-blank="' + j + '"]');
    }
    for (let i = 0; i < 2; i += 1) {
      await cool(page);
      await domClick(page, '#pz-check');
    }
    expect((await puzzleOf(page)).wrong).toBe(2);
    await reload(page, 'ending');
    await cool(page);
    await domClick(page, '#pz-check');
    const p = await puzzleOf(page);
    expect([p.wrong, p.nudge]).toEqual([3, true]);
  });

  test('ending: filled correctly by the player, checked, then reload at the verdict: the sentence is back and one more check ends it once', async ({ page }, info) => {
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    for (let j = 0; j < 6; j += 1) {
      await pickPiece(page, [0, 1, 2, 3, 4, 6][j] as number);
      await domClick(page, '.pz-blank[data-blank="' + j + '"]');
    }
    await cool(page);
    await domClick(page, '#pz-check');
    await waitPuzzlePhase(page, 'verdict');
    await reload(page, 'ending');
    const p = await puzzleOf(page);
    expect(['conclusion', 'verdict']).toContain(p.phase);
    if (p.phase === 'conclusion') {
      expect(p.conclusion?.filled.every(Boolean)).toBe(true);
      await cool(page);
      await press(page.locator('#pz-check'), info);
      await waitPuzzlePhase(page, 'verdict');
    }
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).game).toBeNull();
    expect(await stored(page, 'ending')).toBeNull();
  });

  test('ending: Cúc Cu fills the sentence (third conclusion hint), then reload at the verdict: the answer is not thrown away', async ({ page }, info) => {
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    await cool(page);
    for (let i = 0; i < 3; i += 1) {
      await domClick(page, '#pz-hint');
      await cool(page);
    }
    await waitPuzzlePhase(page, 'verdict');
    await reload(page, 'ending');
    const p = await puzzleOf(page);
    expect(['conclusion', 'verdict']).toContain(p.phase);
    if (p.phase === 'conclusion') {
      expect(p.conclusion?.filled.every(Boolean), 'the solved sentence is back').toBe(true);
      await cool(page);
      await press(page.locator('#pz-check'), info);
      await waitPuzzlePhase(page, 'verdict');
    }
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).game).toBeNull();
    expect(await stored(page, 'ending')).toBeNull();
  });
});

const BASE = { phase: 'board', predicted: 0, opened: 0, wrongRun: 0, wrongTotal: 0, checks: 0, found: [], cWrong: 0, board: [[], [], []], fills: null, hint: '', nudge: false };
const ENDING_SHAPE = { phase: 'board', predicted: 1, opened: 2, wrongRun: 1, wrongTotal: 4, checks: 4, found: [], cWrong: 0, board: [['d'], ['t'], ['k'], ['l'], ['h']], fills: [0, 1, 2, 3, 4, 5], hint: 'Gợi ý 2/5: x', nudge: false };

const CASES: { name: string; value: string; id?: string; check?: (p: Awaited<ReturnType<typeof puzzleOf>>) => void }[] = [
  { name: 'text that is not JSON', value: 'not json {' },
  { name: 'an empty string', value: '' },
  { name: 'a JSON array', value: '[]' },
  { name: 'the word "board" as a JSON string', value: '"board"' },
  { name: 'a number', value: '7' },
  { name: 'a phase that is not a phase', value: JSON.stringify({ ...BASE, phase: '__proto__' }) },
  { name: 'the phase verdict, which is never saved', value: JSON.stringify({ ...BASE, phase: 'verdict' }) },
  { name: 'the conclusion phase of a puzzle with no conclusion', value: JSON.stringify({ ...BASE, phase: 'conclusion', fills: [0, 1] }) },
  { name: 'board phase with no board field', value: JSON.stringify({ phase: 'board' }) },
  { name: 'a board that is an object, not an array', value: JSON.stringify({ ...BASE, board: { s1: ['hyp'] } }), check: (p) => expect(Object.values(p.board ?? {}).flat()).toEqual([]) },
  { name: 'tokens that do not exist', value: JSON.stringify({ ...BASE, board: [['ghost'], ['x', 'y'], ['z']] }), check: (p) => expect(Object.values(p.board ?? {}).flat()).toEqual([]) },
  { name: 'the same token in every rung', value: JSON.stringify({ ...BASE, board: [['hyp'], ['hyp'], ['hyp', 'hyp']] }), check: (p) => expect(Object.values(p.board ?? {}).flat()).toEqual(['hyp']) },
  { name: 'cells holding numbers, objects, nulls and nested arrays', value: JSON.stringify({ ...BASE, board: [[['hyp']], [{ a: 1 }, null, 5], [null, 'xm']] }), check: (p) => expect(Object.values(p.board ?? {}).flat()).toEqual(['xm']) },
  { name: 'counters that are negative, fractional, text or huge', value: JSON.stringify({ ...BASE, opened: -3, wrongRun: 1.5, wrongTotal: '7', checks: 1e12, cWrong: null }), check: (p) => { for (const n of [p.hints, p.wrong, p.wrongTotal, p.checks]) expect(Number.isInteger(n) && n >= 0, 'counter ' + n).toBe(true); } },
  { name: 'a guess of -1', value: JSON.stringify({ ...BASE, predicted: -1 }), check: (p) => expect(p.predicted === null || (p.predicted >= 0 && p.predicted < 3), 'predicted ' + p.predicted).toBe(true) },
  { name: 'a guess of 99', value: JSON.stringify({ ...BASE, predicted: 99 }), check: (p) => expect(p.predicted).toBeNull() },
  { name: 'found solutions that are not solutions', value: JSON.stringify({ ...BASE, found: ['a', 'b', 7, null] }), check: (p) => expect(p.found, 'found vs of').toBeLessThanOrEqual(p.of) },
  { name: 'a hint text that is an object', value: JSON.stringify({ ...BASE, opened: 2, hint: { x: 1 } }) },
  { name: 'a 2 MB hint text', value: JSON.stringify({ ...BASE, opened: 1, hint: 'x'.repeat(2_000_000) }) },
  { name: 'a prototype key', value: '{"__proto__":{"phase":"board"},"constructor":{"prototype":{"phase":"reveal"}}}' },
  { name: 'the nudge flag set on the reveal', value: JSON.stringify({ ...BASE, phase: 'reveal', nudge: true }) },
  { name: 'the save of the ending puzzle (five rungs, a conclusion) under the dec25 key', value: JSON.stringify(ENDING_SHAPE), check: (p) => expect(Object.values(p.board ?? {}).flat()).toEqual([]) },
];

test.describe('corrupted or foreign saved values for teo:v1:puzzle:dec25', () => {
  for (const c of CASES) {
    test(c.name + ': the puzzle opens, the board is sane, and Cúc Cu can still finish it', async ({ page }, info) => {
      const m = monitor(page);
      await openPuzzle(page, 'dec25');
      await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [KEY('dec25'), c.value]);
      await reload(page, 'dec25');
      const p = await puzzleOf(page);
      expect(['predict', 'demo', 'board', 'reveal']).toContain(p.phase);
      expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
      for (const n of [p.hints, p.wrong, p.wrongTotal, p.checks]) expect(Number.isInteger(n) && n >= 0, 'counter ' + n).toBe(true);
      c.check?.(p);
      expect(m.pageErrors, 'page errors').toEqual([]);
      await helpPuzzle(page, info);
      expect(await stored(page, 'dec25')).toBeNull();
    });
  }

  test('intro (one piece per slot): a saved board with two pieces in one slot is cut to the slot size', async ({ page }) => {
    await openPuzzle(page, 'intro');
    const ids = puzzleFile('intro').tokens.map((t) => t.id);
    await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [KEY('intro'), JSON.stringify({ ...BASE, board: [ids.slice(0, 3), [], ids.slice(3), []] })]);
    await reload(page, 'intro');
    const p = await puzzleOf(page);
    expect(p.phase).toBe('board');
    expect(await invariants(page, puzzleFile('intro'))).toEqual([]);
  });

  test('saturnalia (one piece per slot): the same, and Kiểm tra on what is there says Chưa khớp without an error', async ({ page }) => {
    const m = monitor(page);
    await openPuzzle(page, 'saturnalia');
    const ids = puzzleFile('saturnalia').tokens.map((t) => t.id);
    await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [KEY('saturnalia'), JSON.stringify({ ...BASE, board: [ids, [], [], [], [], [], []] })]);
    await reload(page, 'saturnalia');
    expect(await invariants(page, puzzleFile('saturnalia'))).toEqual([]);
    await cool(page);
    await domClick(page, '#pz-check');
    expect((await puzzleOf(page)).phase).toBe('board');
    expect(m.pageErrors).toEqual([]);
  });
});

test.describe('storage that refuses to work', () => {
  test('every write throws: the puzzle still plays through to the hand-over', async ({ page }, info) => {
    const m = monitor(page);
    await page.addInitScript(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string): void {
        if (String(key).startsWith('teo:v1:puzzle')) throw new DOMException('full', 'QuotaExceededError');
        return real.call(this, key, value);
      };
    });
    await openPuzzle(page, 'dec25');
    await answerPredict(page, info, 0);
    await fillBoard(page, info, puzzleFile('dec25').solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await expect.poll(async () => (await stateOf(page)).game).toBeNull();
    expect(m.pageErrors).toEqual([]);
  });

  test('every read throws: the puzzle opens fresh', async ({ page }) => {
    const m = monitor(page);
    await page.addInitScript(() => {
      const real = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key: string): string | null {
        if (String(key).startsWith('teo:v1:puzzle')) throw new DOMException('denied', 'SecurityError');
        return real.call(this, key);
      };
    });
    await openPuzzle(page, 'dec25');
    expect((await puzzleOf(page)).phase).toBe('predict');
    expect(m.pageErrors).toEqual([]);
  });
});

test.describe('chunks that fail to load', () => {
  const walk = async (page: Page, info: import('@playwright/test').TestInfo): Promise<'error' | 'game'> => {
    for (let i = 0; i < 60; i += 1) {
      if (await page.locator('#net-error').isVisible()) return 'error';
      const s = await stateOf(page).catch(() => null);
      if (s?.game) return 'game';
      if (s?.story?.asking) await typeName(page, 'Lan').catch(() => undefined);
      else if (s && s.shell.mode === 'story') await advanceStory(page, info).catch(() => undefined);
      else await page.waitForTimeout(80);
    }
    throw new Error('neither the puzzle nor the network message showed');
  };

  for (const [name, re] of [['data chunk pz-intro', /\/assets\/pz-intro-[^/]+\.js$/], ['player chunk puzzle', /\/assets\/puzzle-[^/]+\.js$/], ['player stylesheet puzzle', /\/assets\/puzzle-[^/]+\.css$/]] as const) {
    test('story: the ' + name + ' stays 404: the network message shows, no puzzle half-drawn, no loop', async ({ page }, info) => {
      const m = monitor(page);
      let hits = 0;
      await page.route(re, (route) => {
        hits += 1;
        return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
      });
      await seedSave(page);
      await page.goto('/');
      await waitReady(page).catch(() => undefined);
      expect(await walk(page, info)).toBe('error');
      await expect(page.locator('#net-error')).toContainText('Kiểm tra mạng');
      expect(await page.locator('.pz').count(), 'a half-drawn puzzle behind the message').toBe(0);
      await page.waitForTimeout(1500);
      expect(m.loads(), 'page loads').toBeLessThanOrEqual(3);
      expect(hits).toBeGreaterThan(0);
    });

    test('story: the ' + name + ' fails once: one reload and the puzzle opens', async ({ page }, info) => {
      let hits = 0;
      await page.route(re, (route) => {
        hits += 1;
        return hits === 1 ? route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }) : route.continue();
      });
      await seedSave(page);
      await page.goto('/');
      await waitReady(page).catch(() => undefined);
      expect(await walk(page, info)).toBe('game');
      expect((await stateOf(page)).game?.id).toBe('intro');
      await expect(page.locator('#net-error')).toBeHidden();
    });
  }

  test('preview: a 404 on the data chunk ends in the network message, not in a page stuck on loading', async ({ page }) => {
    const m = monitor(page);
    await page.route(/\/assets\/pz-dec25-[^/]+\.js$/, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }));
    await page.goto('/?preview=puzzle:dec25');
    await expect
      .poll(async () => (await page.locator('#net-error').isVisible()) || (await stateOf(page).catch(() => null))?.shell.phase === 'ready', { timeout: 15_000 })
      .toBe(true);
    expect(m.pageErrors, 'unhandled rejection').toEqual([]);
  });
});

test.describe('?preview=puzzle:<id>', () => {
  for (const id of ['nope', ...new Set([stubIds()[0], stubIds().at(-1)].filter((s): s is string => s !== undefined)), 'INTRO', '', 'intro%20x', '..%2Fintro', 'a'.repeat(3000), '__proto__', 'constructor', 'intro.json', 'dec25%0Aintro', 'dec25%00']) {
    test('unknown or malformed id ' + JSON.stringify(id.length > 30 ? id.slice(0, 12) + '…' : id) + ' opens the normal story and no puzzle', async ({ page }, info) => {
      test.skip(isTouch(info) && id.length > 30, 'a long URL is checked once');
      const m = monitor(page);
      await seedSave(page);
      await page.goto('/?preview=puzzle:' + id);
      await waitReady(page);
      const s = await stateOf(page);
      expect(s.shell.mode).toBe('story');
      expect(s.game).toBeNull();
      expect(await page.locator('.pz').count()).toBe(0);
      expect(m.pageErrors).toEqual([]);
      expect(m.consoleErrors).toEqual([]);
    });
  }

  test('opening a puzzle by preview and finishing it leaves the saved story exactly as it was', async ({ page }, info) => {
    const save = { schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten' };
    await seedSave(page, save);
    await page.goto('/?preview=puzzle:ending');
    await waitGame(page, 'ending');
    await helpPuzzle(page, info);
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    const after = JSON.parse((await page.evaluate(() => localStorage.getItem('teo:v1:save'))) ?? 'null');
    expect(after).toEqual(save);
    expect(await stored(page, 'ending')).toBeNull();
  });

  test('a preview does not disturb the progress key of the real chapter-1 puzzle', async ({ page }) => {
    await seedSave(page, START_OF_MINIGAME);
    await page.goto('/?preview=puzzle:dec25');
    await waitGame(page, 'dec25');
    await expect(page.locator('.pz')).toHaveCount(1);
    expect(await storedReal(page, 'intro')).toBeNull();
  });
});
