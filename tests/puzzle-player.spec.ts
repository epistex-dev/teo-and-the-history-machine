import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { slimPuzzle } from '../src/puzzle/slim.ts';
import { expectClean, monitor } from './support/helpers.ts';
import { openAtMinigame, stateOf, step, tap, waitReady } from './support/play.ts';
import { stubAudio } from './challenge/helpers.ts';
import { clearBoard, KEY, LANDSCAPE, openSeeded, REAL_KEY, SMALL } from './challenge-puzzle/helpers.ts';
import {
  answerPredict,
  check,
  domPiece,
  fillBoard,
  openPuzzle,
  press,
  puzzleFile,
  puzzleOf,
  skipDemo,
  solvePuzzle,
  toBoard,
  waitPuzzlePhase,
  wrongFill,
} from './support/puzzle.ts';

const IDS = ['intro', 'dec25', 'ending', 'saturnalia', 'yule'];

async function toBoardOf(page: Page, info: TestInfo, id: string): Promise<void> {
  await openPuzzle(page, id);
  await toBoard(page, info);
}

test.describe('puzzle player: solving', () => {
  for (const id of IDS) {
    test(id + ': tapping the right pieces into the right slots solves it and hands back to the story', async ({ page, baseURL }, info) => {
      const m = monitor(page);
      await openPuzzle(page, id);
      await solvePuzzle(page, info);
      await expect.poll(async () => (await stateOf(page)).game, { timeout: 8000 }).toBeNull();
      await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).not.toBe('minigame');
      expectClean(m, baseURL as string);
    });
  }

  test('chapter 1 opens the puzzle in the story and finishing it continues the story', async ({ page }, info) => {
    await openAtMinigame(page, info);
    const p = await puzzleOf(page);
    expect(p.id).toBe('intro');
    expect(await page.locator('canvas').count()).toBe(0);
    await solvePuzzle(page, info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
  });

  test('the predict step takes a guess and shows no verdict on it', async ({ page }, info) => {
    await openPuzzle(page, 'dec25');
    const text = await page.locator('.pz').innerText();
    expect(text).not.toMatch(/đúng|sai|chính xác/iu);
    await answerPredict(page, info, 0);
    expect((await puzzleOf(page)).predicted).toBe(0);
  });
});

test.describe('puzzle player: strategies that must not win', () => {
  for (const id of IDS) {
    test(id + ': an empty board, the bank in its own order and a wrong fill never solve it', async ({ page }, info) => {
      const file = puzzleFile(id);
      await toBoardOf(page, info, id);
      await check(page, info);
      expect((await puzzleOf(page)).phase).toBe('board');
      expect((await puzzleOf(page)).verdict).toMatch(/Chưa (?:đủ|khớp)/u);
      const order = (await puzzleOf(page)).order;
      const bankOrder = file.slots.map((_, i) => (order[i] ? [order[i] as string] : null));
      await fillBoard(page, info, bankOrder);
      await check(page, info);
      const p = await puzzleOf(page);
      expect(['board']).toContain(p.phase);
      await fillBoard(page, info, wrongFill(file));
      await check(page, info);
      expect((await puzzleOf(page)).completed).toBe(false);
    });
  }

  test('idle for minutes: nothing opens, nothing completes, no hint appears by itself', async ({ page }, info) => {
    await toBoardOf(page, info, 'dec25');
    await page.evaluate(() => window.advanceTime(120_000));
    await page.waitForTimeout(500);
    const p = await puzzleOf(page);
    expect(p).toMatchObject({ phase: 'board', completed: false, hints: 0, hint: '', nudge: false });
    expect(await page.locator('.pz-ghost').count()).toBe(0);
  });

  test('mashing check and hint with taps: no completion, one hint step per press at most', async ({ page }, info) => {
    await toBoardOf(page, info, 'dec25');
    for (let i = 0; i < 30; i += 1) {
      await page.locator('.pz-check').dispatchEvent('click');
      await page.locator('.pz-slot-btn').first().dispatchEvent('click');
    }
    const p = await puzzleOf(page);
    expect(p.completed).toBe(false);
    expect(p.phase).toBe('board');
    expect(p.hints).toBe(0);
    const before = (await puzzleOf(page)).hints;
    for (let i = 0; i < 12; i += 1) await page.locator('.pz-hint-btn').dispatchEvent('click');
    expect((await puzzleOf(page)).hints - before).toBe(1);
  });

  test('holding Enter on check and on hint never completes the puzzle or runs the ladder', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'no keyboard on touch devices');
    await toBoardOf(page, info, 'dec25');
    await page.locator('.pz-check').focus();
    await page.keyboard.down('Enter');
    for (let i = 0; i < 20; i += 1) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await page.locator('.pz-hint-btn').focus();
    await page.keyboard.down('Space');
    for (let i = 0; i < 20; i += 1) await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    const p = await puzzleOf(page);
    expect(p.completed).toBe(false);
    expect(p.hints).toBeLessThanOrEqual(1);
  });
});

test.describe('puzzle player: hints and the nudge', () => {
  for (const id of IDS) {
    test(id + ': hints open one tier per press, in order; the last tier solves', async ({ page }, info) => {
      const file = puzzleFile(id);
      await toBoardOf(page, info, id);
      for (let i = 0; i < file.hints.length; i += 1) {
        expect((await puzzleOf(page)).hints).toBe(i);
        await page.waitForTimeout(280);
        await press(page.locator('.pz-hint-btn'), info);
        if (i < file.hints.length - 1) {
          await expect.poll(async () => (await puzzleOf(page)).hints).toBe(i + 1);
          expect((await puzzleOf(page)).hint).toContain((file.hints[i] as { text: string }).text);
          expect((await puzzleOf(page)).phase).toBe('board');
        }
      }
      await expect.poll(async () => (await puzzleOf(page)).phase).toBe('reveal');
    });
  }

  test('the last tier is named Nhờ Cúc Cu soi tỏ', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    for (let i = 0; i < file.hints.length - 1; i += 1) {
      await page.waitForTimeout(280);
      await press(page.locator('.pz-hint-btn'), info);
    }
    await expect(page.locator('.pz-hint-btn')).toHaveText('Nhờ Cúc Cu soi tỏ');
  });

  const SOLVED_BY_CUC_CU = /Cúc Cu (đã )?(xếp|viết) hộ/u;
  const reveal = (page: Page) => page.locator('.pz-reveal').evaluate((e) => e.textContent ?? '');

  test('the board solved by the last tier says Cúc Cu solved it, not that the player matched every card', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    for (let i = 0; i < file.hints.length; i += 1) {
      await page.waitForTimeout(280);
      await press(page.locator('.pz-hint-btn'), info);
    }
    await waitPuzzlePhase(page, 'reveal');
    const text = await reveal(page);
    expect(text).toMatch(SOLVED_BY_CUC_CU);
    expect(text).not.toMatch(/Khớp rồi|Khớp mọi thẻ/u);
    expect(text).not.toMatch(/!|(^|[^\p{L}])bạn([^\p{L}]|$)/iu);
    expect(await page.locator('.pz > .sr-only').textContent()).not.toMatch(/Khớp mọi thẻ/u);
  });

  test('the board solved by the player keeps the plain match text, even after hints were opened', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-hint-btn'), info);
    await fillBoard(page, info, file.solutions[0] as never);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    const text = await reveal(page);
    expect(text).toMatch(/Khớp rồi/u);
    expect(text).not.toMatch(SOLVED_BY_CUC_CU);
  });

  test('reloading on the result screen of a board solved by the last tier keeps the Cúc Cu text', async ({ page }) => {
    const file = puzzleFile('dec25');
    await openSeeded(page, 'dec25', { phase: 'reveal', opened: file.hints.length });
    expect(await reveal(page)).toMatch(SOLVED_BY_CUC_CU);
    await openSeeded(page, 'dec25', { phase: 'reveal', opened: file.hints.length - 1 });
    expect(await reveal(page)).toMatch(/Khớp rồi/u);
  });

  test('three wrong checks offer the next tier without opening it; the hint button stays available', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    await fillBoard(page, info, wrongFill(file));
    for (let i = 0; i < 3; i += 1) {
      expect((await puzzleOf(page)).nudge).toBe(false);
      await check(page, info);
      await expect.poll(async () => (await puzzleOf(page)).wrong).toBe(i + 1);
    }
    const p = await puzzleOf(page);
    expect(p).toMatchObject({ nudge: true, hints: 0, hint: '' });
    expect(p.verdict).toMatch(/Gợi ý/u);
    await expect(page.locator('.pz-hint-btn')).toBeEnabled();
    await page.waitForTimeout(280);
    await press(page.locator('.pz-hint-btn'), info);
    await expect.poll(async () => (await puzzleOf(page)).hints).toBe(1);
  });

  test('check never refuses on status: a fill with a legend piece in the wrong place still gets the whole-board answer', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    await fillBoard(page, info, wrongFill(file));
    await check(page, info);
    const p = await puzzleOf(page);
    expect(p.phase).toBe('board');
    expect(p.verdict).not.toBe('');
  });
});

test.describe('puzzle player: keyboard and screen readers', () => {
  test('keyboard only: Tab to a piece, Enter, Tab to a slot, Enter, then check', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'no keyboard on touch devices');
    await toBoardOf(page, info, 'dec25');
    const file = puzzleFile('dec25');
    const cells = file.solutions[0] as (string | string[] | null)[];
    for (const [i, slot] of file.slots.entries()) {
      for (const id of ([] as string[]).concat(cells[i] ?? [])) {
        await page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('dec25', id) + '"]').focus();
        await page.keyboard.press('Enter');
        expect((await puzzleOf(page)).selected).toBe(id);
        await page.locator('.pz-slot[data-slot="' + slot.id + '"] .pz-slot-btn').focus();
        await page.keyboard.press('Enter');
      }
    }
    await page.locator('.pz-check').focus();
    await page.keyboard.press('Enter');
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(280);
    await page.locator('.pz-next').focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stateOf(page)).game).toBeNull();
  });

  test('Escape puts a lifted piece down; every action speaks through an aria-live region', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'no keyboard on touch devices');
    await toBoardOf(page, info, 'dec25');
    const live = page.locator('.pz [aria-live]');
    expect(await live.count()).toBeGreaterThan(0);
    const piece = page.locator('.pz-bank .pz-piece').first();
    await piece.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pz .sr-only[aria-live]')).toContainText('Đã chọn');
    await page.keyboard.press('Escape');
    expect((await puzzleOf(page)).selected).toBeNull();
  });

  test('every control is at least 44 px tall and wide', async ({ page }, info) => {
    await toBoardOf(page, info, 'dec25');
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.pz button')]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({ n: b.className, r: b.getBoundingClientRect() }))
        .filter((b) => b.r.height < 43.5 || b.r.width < 43.5)
        .map((b) => b.n),
    );
    expect(small).toEqual([]);
  });

  test('check gives whole-board feedback only: no slot or piece carries a per-slot verdict in the DOM or in aria', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    await fillBoard(page, info, wrongFill(file));
    const grab = (): Promise<string> => page.locator('.pz-board').evaluate((el) => el.outerHTML);
    const before = await grab();
    await check(page, info);
    await expect.poll(async () => (await puzzleOf(page)).checks).toBe(1);
    const after = await grab();
    expect(after).toBe(before);
    expect(after).not.toMatch(/aria-invalid|data-(?:ok|wrong|correct|right|error)/iu);
    const verdict = (await puzzleOf(page)).verdict;
    for (const slot of file.slots) expect(verdict).not.toContain(slot.id + ':');
    const marked = await page.locator('.pz-slot, .pz-piece').evaluateAll((els) => els.filter((e) => /đúng|sai|wrong|correct/iu.test(e.getAttribute('aria-label') ?? '')).length);
    expect(marked).toBe(0);
  });
});

test.describe('puzzle player: reload, motion and small screens', () => {
  test('reload in the middle of the board resumes the placements, the hint and the counts', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    await fillBoard(page, info, wrongFill(file));
    await check(page, info);
    await page.waitForTimeout(280);
    await press(page.locator('.pz-hint-btn'), info);
    await expect.poll(async () => (await puzzleOf(page)).hints).toBe(1);
    const before = await puzzleOf(page);
    await page.reload();
    await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe('dec25');
    const after = await puzzleOf(page);
    expect(after.phase).toBe('board');
    expect(after.board).toEqual(before.board);
    expect(after.hints).toBe(1);
    expect(after.hint).toBe(before.hint);
    expect(after.wrongTotal).toBe(before.wrongTotal);
  });

  test('reload on the predict step stays on it; reload on the reveal stays on the reveal; finishing clears the save', async ({ page }, info) => {
    await openPuzzle(page, 'dec25');
    await page.reload();
    await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe('dec25');
    expect((await puzzleOf(page)).phase).toBe('predict');
    await solvePuzzle(page, info);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:dec25'))).toBeNull();
  });

  test('reload on the ending conclusion keeps the filled blanks', async ({ page }, info) => {
    await openPuzzle(page, 'ending');
    const file = puzzleFile('ending');
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as never);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await waitPuzzlePhase(page, 'conclusion');
    await press(page.locator('.pz-piece').first(), info);
    await press(page.locator('.pz-blank').first(), info);
    const before = (await puzzleOf(page)).conclusion;
    await page.reload();
    await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe('ending');
    const after = await puzzleOf(page);
    expect(after.phase).toBe('conclusion');
    expect(after.conclusion?.filled).toEqual(before?.filled);
  });

  test('reduced motion: nothing in the player animates or transitions', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toBoardOf(page, info, 'dec25');
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.pz, .pz *')]
        .filter((e) => {
          const s = getComputedStyle(e);
          const long = (v: string): boolean => v.split(',').some((d) => parseFloat(d) > 0.01);
          return long(s.transitionDuration) || (s.animationName !== 'none' && long(s.animationDuration));
        })
        .map((e) => e.className),
    );
    expect(moving).toEqual([]);
  });

  for (const [w, h] of [[320, 568], [390, 844], [844, 390]] as const) {
    test('no horizontal scroll at ' + w + 'x' + h + ' on the predict step, the board, the reveal and the conclusion', async ({ page }, info) => {
      test.skip(!info.project.name.includes('chromium') || info.project.name.startsWith('desktop'), 'the viewport is set once, on the phone chromium project');
      await page.setViewportSize({ width: w, height: h });
      await openPuzzle(page, 'ending');
      const wide = (): Promise<string[]> =>
        page.evaluate(() => {
          const out: string[] = [];
          const doc = document.scrollingElement as HTMLElement;
          if (doc.scrollWidth > doc.clientWidth) out.push('document');
          for (const el of document.querySelectorAll<HTMLElement>('.pz, .pz-scroll, .pz-left, .pz-right, .pz-bar')) if (el.scrollWidth > el.clientWidth + 1) out.push(el.className);
          for (const el of document.querySelectorAll<HTMLElement>('.pz *')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)) out.push(el.className || el.tagName);
          }
          return out;
        });
      expect(await wide()).toEqual([]);
      await answerPredict(page, info);
      await skipDemo(page, info);
      expect(await wide()).toEqual([]);
      const file = puzzleFile('ending');
      await fillBoard(page, info, file.solutions[0] as never);
      expect(await wide()).toEqual([]);
      await check(page, info);
      await waitPuzzlePhase(page, 'reveal');
      expect(await wide()).toEqual([]);
      await page.waitForTimeout(280);
      await press(page.locator('.pz-next'), info);
      await waitPuzzlePhase(page, 'conclusion');
      expect(await wide()).toEqual([]);
    });
  }

  test('rotating the phone while on the board keeps the placements', async ({ page }, info) => {
    test.skip(info.project.name.startsWith('desktop'), 'phone only');
    await toBoardOf(page, info, 'dec25');
    const file = puzzleFile('dec25');
    await fillBoard(page, info, wrongFill(file));
    const before = (await puzzleOf(page)).board;
    const size = page.viewportSize() as { width: number; height: number };
    await page.setViewportSize({ width: size.height, height: size.width });
    await page.waitForTimeout(200);
    expect((await puzzleOf(page)).board).toEqual(before);
    await step(page, 100);
  });
});

test.describe('puzzle player: wiring', () => {
  test('opening the first chapter fetches the player and its own puzzle data only, and draws no canvas', async ({ page }, info) => {
    const loaded: string[] = [];
    page.on('request', (r) => loaded.push(new URL(r.url()).pathname));
    await page.goto('/');
    await waitReady(page);
    await openAtMinigame(page, info);
    expect([...new Set(loaded.filter((p) => /\/assets\/puzzle-[^/]*\.js$/u.test(p)))], 'the player chunk is fetched').toHaveLength(1);
    expect([...new Set(loaded.flatMap((p) => /\/assets\/pz-([a-z0-9]+)-/u.exec(p)?.[1] ?? []))], 'only the puzzle of this chapter').toEqual(['intro']);
    expect(await page.locator('canvas').count()).toBe(0);
  });
});

test.describe('puzzle player: sounds (place, remove, wrong check, hint, solve)', () => {
  const spy = (): void => {
    const heard: number[] = [];
    (window as unknown as { __heard: number[] }).__heard = heard;
    const set = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (this: AudioParam, value: number, at: number) {
      if (value >= 100) heard.push(value);
      return set.call(this, value, at);
    };
  };
  const heardOf = (page: Page): Promise<number[]> => page.evaluate(() => [...(window as unknown as { __heard: number[] }).__heard]);
  const played = async (page: Page): Promise<number> => (await stateOf(page)).shell.audio.played;
  const audioState = async (page: Page): Promise<string> => (await stateOf(page)).shell.audio.state;

  /** The notes scheduled by one action. */
  async function notes(page: Page, act: () => Promise<void>): Promise<number[]> {
    const before = (await heardOf(page)).length;
    await act();
    await expect.poll(async () => (await heardOf(page)).length, { timeout: 3000 }).toBeGreaterThan(before);
    await page.waitForTimeout(150);
    return (await heardOf(page)).slice(before);
  }

  async function unlocked(page: Page, info: TestInfo, id = 'saturnalia'): Promise<void> {
    await page.addInitScript(spy);
    await openPuzzle(page, id);
    await answerPredict(page, info);
    await expect.poll(() => audioState(page)).toBe('running');
    await skipDemo(page, info);
    await page.waitForTimeout(400);
  }

  test('each event has its own sound: place, remove, a wrong check, a hint, and the solve chime', async ({ page }, info) => {
    const file = puzzleFile('saturnalia');
    await unlocked(page, info);
    expect(await notes(page, () => fillBoard(page, info, [null, null, null, null, ['r'], null, null])), 'a piece goes into a slot').toEqual([523]);
    await page.waitForTimeout(150);
    expect(await notes(page, () => press(page.locator('.pz-slot .pz-piece[data-piece="' + domPiece('saturnalia', 'r') + '"]'), info)), 'a piece comes out of a slot').toEqual([392]);
    await fillBoard(page, info, wrongFill(file));
    await page.waitForTimeout(150);
    expect(await notes(page, () => check(page, info)), 'a wrong check').toEqual([330, 262]);
    await page.waitForTimeout(300);
    expect(await notes(page, () => press(page.locator('.pz-hint-btn'), info)), 'a hint').toEqual([660, 784]);
  });

  test('solving plays the three-note chime, and so does Cúc Cu laying the answer', async ({ page }, info) => {
    const file = puzzleFile('saturnalia');
    await unlocked(page, info);
    await fillBoard(page, info, file.solutions[0] as never);
    await page.waitForTimeout(150);
    expect(await notes(page, () => check(page, info))).toEqual([523, 659, 784]);
    await openPuzzle(page, 'yule');
    await answerPredict(page, info);
    await skipDemo(page, info);
    for (let i = 0; i < puzzleFile('yule').hints.length - 1; i += 1) {
      await page.waitForTimeout(280);
      await press(page.locator('.pz-hint-btn'), info);
    }
    await page.waitForTimeout(280);
    expect((await notes(page, () => press(page.locator('.pz-hint-btn'), info))).slice(-3), 'the last hint tier solves and chimes').toEqual([523, 659, 784]);
  });

  test('the sound volume at 0 mutes every puzzle sound', async ({ page }, info) => {
    await page.addInitScript(() => localStorage.setItem('teo:v1:settings', JSON.stringify({ version: 1, textSpeed: 'instant', autoAdvance: 'off', music: 70, sfx: 0, fontSize: 'normal', reducedMotion: null })));
    await openPuzzle(page, 'saturnalia');
    await answerPredict(page, info);
    await expect.poll(() => audioState(page)).toBe('running');
    await fillBoard(page, info, wrongFill(puzzleFile('saturnalia')));
    await check(page, info);
    await page.waitForTimeout(300);
    await press(page.locator('.pz-hint-btn'), info);
    expect(await played(page), 'nothing was played').toBe(0);
    expect(await puzzleOf(page)).toMatchObject({ wrongTotal: 1, hints: 1 });
  });

  for (const slow of [0, 600]) {
    test(slow ? 'a sound queued while the context is not running expires after about 300 ms when the resume is slow' : 'a sound queued while the context is not running plays when the context resumes at once', async ({ page }, info) => {
      await page.addInitScript(stubAudio, slow ? { slowResumeMs: slow } : {});
      await openPuzzle(page, 'saturnalia');
      await answerPredict(page, info);
      await expect.poll(() => audioState(page)).toBe('running');
      await expect.poll(() => played(page), 'the greeting has played').toBeGreaterThanOrEqual(1);
      await skipDemo(page, info);
      await page.waitForTimeout(300);
      await press(page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('saturnalia', 'r') + '"]'), info);
      await page.evaluate(() => (window as unknown as { __audio: { ctxs: AudioContext[] } }).__audio.ctxs[0]?.suspend());
      await expect.poll(() => audioState(page)).toBe('suspended');
      const before = await played(page);
      await press(page.locator('.pz-slot[data-slot="s5"] .pz-slot-btn'), info);
      expect((await puzzleOf(page)).board?.s5, 'the placement happened while the sound could not play').toEqual(['r']);
      await expect.poll(() => audioState(page), 'the tap that placed it resumes the context').toBe('running');
      if (slow) {
        await page.waitForTimeout(300);
        expect(await played(page), 'the queued sound was older than the expiry').toBe(before);
      } else {
        await expect.poll(() => played(page), 'the fresh sound is not lost').toBeGreaterThan(before);
      }
    });
  }
});

test.describe('puzzle player: window, drag and whole session', () => {
  test('12 rapid rotations keep the placed pieces inside the window, and the puzzle still solves', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await toBoardOf(page, info, 'saturnalia');
    const file = puzzleFile('saturnalia');
    await fillBoard(page, info, [null, null, null, null, ['r'], null, null]);
    const vp = page.viewportSize() ?? { width: 390, height: 664 };
    for (let i = 0; i < 12; i += 1) {
      await page.setViewportSize(i % 2 === 0 ? { width: vp.height, height: vp.width } : vp);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(400);
    expect((await puzzleOf(page)).board?.s5).toEqual(['r']);
    const box = (await page.locator('.pz').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
    await fillBoard(page, info, file.solutions[0] as never);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    expectClean(m, baseURL as string);
  });

  for (const size of [{ width: 100, height: 100 }, { width: 320, height: 150 }, { width: 2200, height: 300 }, { width: 300, height: 2200 }]) {
    test('extreme viewport ' + size.width + 'x' + size.height + ': no error, then the normal size recovers and the board is inside the window', async ({ page, baseURL }, info) => {
      const m = monitor(page);
      await toBoardOf(page, info, 'saturnalia');
      const vp = page.viewportSize() ?? { width: 390, height: 664 };
      await page.setViewportSize(size);
      await page.waitForTimeout(400);
      await page.setViewportSize(vp);
      await page.waitForTimeout(500);
      const box = (await page.locator('.pz').boundingBox())!;
      for (const v of [box.x, box.y, box.width, box.height]) expect(Number.isFinite(v)).toBe(true);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect((await puzzleOf(page)).phase).toBe('board');
      expectClean(m, baseURL as string);
    });
  }

  test('prefers-reduced-motion: the puzzle loads clean and plays to the end', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPuzzle(page, 'yule');
    await solvePuzzle(page, info);
    await expect.poll(async () => (await stateOf(page)).game, { timeout: 8000 }).toBeNull();
    expectClean(m, baseURL as string);
  });

  test('a played chapter, hide/show and a reload: no console error, no foreign host, the story resumes', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtMinigame(page, info);
    await solvePuzzle(page, info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    for (const hidden of [true, false]) {
      await page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
      await page.waitForTimeout(200);
    }
    await page.reload();
    await waitReady(page);
    expect((await stateOf(page)).story, 'the reload resumes in the story').not.toBeNull();
    expectClean(m, baseURL as string);
  });

  test('a piece released beside the board, over the button bar or outside the window goes back: nothing is held, nothing counts, the next tap works', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'a mouse drag is a desktop gesture');
    await toBoardOf(page, info, 'saturnalia');
    const piece = (await page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('saturnalia', 'r') + '"]').boundingBox())!;
    const bar = (await page.locator('.pz-bar').boundingBox())!;
    const vp = page.viewportSize()!;
    for (const to of [{ x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 }, { x: vp.width - 1, y: 1 }, { x: 1, y: vp.height - 1 }]) {
      await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await page.mouse.up();
      expect(Object.values((await puzzleOf(page)).board ?? {}).flat(), 'nothing placed').toEqual([]);
      expect((await puzzleOf(page)).wrong).toBe(0);
      expect(await page.locator('.pz-ghost').count(), 'no drag ghost left behind').toBe(0);
    }
    await fillBoard(page, info, [null, null, null, null, ['r'], null, null]);
    expect((await puzzleOf(page)).board?.s5, 'the next tap works').toEqual(['r']);
  });

  test('right and middle button presses on a piece start no drag and leave nothing stuck', async ({ page }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), 'a mouse button is a desktop input');
    await toBoardOf(page, info, 'saturnalia');
    const piece = (await page.locator('.pz-bank .pz-piece[data-piece="' + domPiece('saturnalia', 'r') + '"]').boundingBox())!;
    const slot = (await page.locator('.pz-slot[data-slot="s5"] .pz-slot-btn').boundingBox())!;
    for (const button of ['right', 'middle'] as const) {
      await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
      await page.mouse.down({ button });
      await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 6 });
      await page.mouse.up({ button });
      expect(await page.locator('.pz-ghost').count()).toBe(0);
      expect((await puzzleOf(page)).board?.s5, 'the piece did not move').toEqual([]);
    }
    await fillBoard(page, info, [null, null, null, null, ['r'], null, null]);
    expect((await puzzleOf(page)).board?.s5).toEqual(['r']);
  });
});

test.describe('puzzle player: fixes found in review', () => {
  test('a saved phase the puzzle no longer has is dropped: the puzzle starts from its first step and Kiểm tra answers', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'demo', predicted: 0 });
    const p = await puzzleOf(page);
    expect(p.phase).toBe('predict');
    expect(p.predicted).toBeNull();
    await expect(page.locator('#pz-option-0')).toBeVisible();
  });

  test('tapping placed pieces one after another lifts each: three in a row leave the board three pieces lighter and nothing moves', async ({ page }, info) => {
    await toBoardOf(page, info, 'ending');
    const file = puzzleFile('ending');
    await fillBoard(page, info, file.solutions[0] as never);
    const placed = await page.locator('.pz-chip').count();
    expect(placed).toBeGreaterThanOrEqual(4);
    for (let n = 1; n <= 3; n += 1) {
      await press(page.locator('.pz-chip').first(), info);
      const p = await puzzleOf(page);
      expect(await page.locator('.pz-chip').count(), 'chips after lift ' + n).toBe(placed - n);
      expect(p.bank, 'bank after lift ' + n).toHaveLength(file.tokens.length - placed + n);
    }
  });

  test('a piece taken from the box still lands in the slot of a chip it is tapped onto', async ({ page }, info) => {
    await toBoardOf(page, info, 'ending');
    const file = puzzleFile('ending');
    await fillBoard(page, info, file.solutions[0] as never);
    const before = await puzzleOf(page);
    const spare = before.bank?.[0] as string;
    const first = file.slots[0]?.id as string;
    await press(page.locator('.pz-bank [data-piece="' + domPiece('ending', spare) + '"]'), info);
    await press(page.locator('.pz-slot[data-slot="' + first + '"] .pz-chip'), info);
    const after = await puzzleOf(page);
    expect(after.board?.[first]).toContain(spare);
    expect(after.bank).not.toContain(spare);
    expect(after.selected).toBeNull();
  });

  for (const [name, size] of [['320x568', SMALL], ['844x390', LANDSCAPE]] as const) {
    test('a puzzle with pieces left out of its answer says so above the fold at ' + name + ', with the rules box closed and no count', async ({ page }, info) => {
      test.skip(!info.project.name.includes('chromium') || info.project.name.startsWith('desktop'), 'the viewport is set once, on the phone chromium project');
      await page.setViewportSize(size);
      await openSeeded(page, 'ending', null, { fontSize: 'xlarge' });
      await toBoard(page, info);
      const note = page.locator('.pz-unplaced');
      await expect(note).toBeVisible();
      expect(await page.locator('.pz-rules').evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
      expect(await note.innerText()).toMatch(/không (cần )?đặt|để lại/u);
      expect(await note.innerText()).not.toMatch(/\d/u);
      const box = await note.boundingBox();
      const view = page.viewportSize() as { width: number; height: number };
      expect(box && box.y >= 0 && box.y + box.height <= view.height && box.x >= 0 && box.x + box.width <= view.width, 'note inside the first screen').toBe(true);
    });
  }

  test('a preview never reads or writes the progress key of the real puzzle', async ({ page }, info) => {
    const real = JSON.stringify({ phase: 'board', predicted: 1, opened: 2, wrongRun: 0, wrongTotal: 0, checks: 0, found: [], cWrong: 0, board: [['hyp'], [], []], fills: null, pointed: [], nudge: false });
    await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k as string, v as string); } }, [REAL_KEY('dec25'), real] as const);
    await openPuzzle(page, 'dec25');
    expect((await puzzleOf(page)).phase, 'the preview did not resume the real save').toBe('predict');
    await toBoard(page, info);
    await fillBoard(page, info, wrongFill(puzzleFile('dec25')));
    await check(page, info);
    await page.waitForTimeout(280);
    await press(page.locator('#pz-hint'), info);
    expect(await page.evaluate((k) => localStorage.getItem(k), REAL_KEY('dec25'))).toBe(real);
    await solvePuzzle(page, info);
    expect(await page.evaluate((k) => localStorage.getItem(k), REAL_KEY('dec25')), 'finishing the preview leaves the real save alone').toBe(real);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY('dec25')), 'the preview cleans its own save').toBeNull();
  });

  test('the example keeps the Gợi ý button, which opens a hint and leaves the step; Bỏ qua ví dụ is its own control', async ({ page }, info) => {
    await openPuzzle(page, 'intro');
    await answerPredict(page, info, 0);
    await waitPuzzlePhase(page, 'demo');
    await expect(page.locator('#pz-hint')).toHaveText('Gợi ý');
    await page.waitForTimeout(280);
    await press(page.locator('#pz-hint'), info);
    await expect.poll(async () => (await puzzleOf(page)).hint).not.toBe('');
    const p = await puzzleOf(page);
    expect([p.phase, p.hints]).toEqual(['demo', 0]);
    await expect(page.locator('#pz-skip')).toHaveText('Bỏ qua ví dụ');
    await page.waitForTimeout(280);
    await press(page.locator('#pz-skip'), info);
    await waitPuzzlePhase(page, 'board');
    await expect(page.locator('#pz-skip')).toHaveCount(0);
    await expect(page.locator('#pz-hint')).toHaveText('Gợi ý');
  });

  test('the hint button names itself with the words it shows, at every step of the ladder', async ({ page }, info) => {
    const file = puzzleFile('dec25');
    await toBoardOf(page, info, 'dec25');
    for (let i = 0; i < file.hints.length; i += 1) {
      const shown = ((await page.locator('#pz-hint').textContent()) ?? '').trim();
      const name = (await page.locator('#pz-hint').getAttribute('aria-label')) ?? shown;
      expect(name.toLowerCase(), 'accessible name of "' + shown + '"').toContain(shown.toLowerCase());
      if (i < file.hints.length - 1) {
        await page.waitForTimeout(280);
        await press(page.locator('#pz-hint'), info);
        await expect.poll(async () => (await puzzleOf(page)).hints).toBe(i + 1);
      }
    }
  });

  test('a progress write that fails raises the shared storage warning', async ({ page }, info) => {
    await page.addInitScript(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string): void {
        if (String(key).includes('teo:v1:puzzle')) throw new DOMException('full', 'QuotaExceededError');
        return real.call(this, key, value);
      };
    });
    await openPuzzle(page, 'dec25');
    await expect(page.locator('#storage-warning')).toBeVisible();
    await answerPredict(page, info, 0);
    expect((await puzzleOf(page)).phase).toBe('board');
  });

  const CAP_WORDS: Record<number, string> = { 2: 'hai|2', 3: 'ba|3' };
  const capOf = (id: string): number => Math.max(...puzzleFile(id).slots.map((s) => (typeof s.cap === 'number' ? s.cap : 1)));
  const multiCap = readdirSync('story/puzzles').filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)).filter((id) => capOf(id) > 1);
  const SIZES = [['default', null], ['320x568', SMALL]] as const;

  test('every full puzzle with a slot capacity above one is among those checked', () => {
    expect(multiCap).toEqual(expect.arrayContaining(['mistletoe', 'dec25', 'nicholas']));
  });

  for (const [name, size] of SIZES) {
    test('multi-capacity puzzles show slot capacity once, above the closed rules box, at ' + name, async ({ page }, info) => {
      if (size) await page.setViewportSize(size);
      for (const id of multiCap) {
        const cap = capOf(id);
        const pattern = new RegExp('(?:nhiều nhất|tối đa)\\s*(?:' + (CAP_WORDS[cap] ?? String(cap)) + ')\\s*mảnh', 'iu');
        const rule = (puzzleFile(id) as unknown as { rules: { text: string }[] }).rules.find((r) => pattern.test(r.text));
        expect(rule, id + ' states its capacity in a rule').toBeTruthy();
        await toBoardOf(page, info, id);
        expect(await page.locator('.pz-rules[open]').count(), id).toBe(0);
        const capNote = page.locator('.pz-cap');
        await expect(capNote, id).toBeVisible();
        await expect(capNote, id).toHaveText((rule as { text: string }).text);
        const box = await capNote.boundingBox();
        expect(box, id).not.toBeNull();
        expect((box as { x: number }).x, id).toBeGreaterThanOrEqual(0);
        expect((box as { x: number; width: number }).x + (box as { width: number }).width, id).toBeLessThanOrEqual(size ? size.width : 4000);
        const closed = (await page.locator('.pz-rules').textContent()) ?? '';
        expect(closed, id + ': the closed rules box repeats no capacity sentence').not.toMatch(pattern);
        expect(closed, id).not.toContain((rule as { text: string }).text);
        expect(closed.length, id + ': the rules box is still there').toBeGreaterThan(0);
      }
    });
  }

  const fullPuzzles = readdirSync('story/puzzles').filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));
  for (const [name, size] of [['320x568', SMALL], ['360x640', { width: 360, height: 640 }], ['375x667', { width: 375, height: 667 }], ['390x844', { width: 390, height: 844 }]] as const) {
    test('slot labels and piece text never break inside a word at ' + name + ', in every full puzzle with the solution placed', async ({ page }, info) => {
      await page.setViewportSize(size);
      const brokenByPuzzle: Record<string, string[]> = {};
      for (const id of fullPuzzles) {
        const file = puzzleFile(id);
        await toBoardOf(page, info, id);
        await fillBoard(page, info, file.solutions[0] as never);
        const broken = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of document.querySelectorAll('.pz-slot-label, .pz-piece')) {
            const node = el.firstChild;
            if (!node || node.nodeType !== Node.TEXT_NODE) continue;
            for (const m of (node.textContent ?? '').matchAll(/\S+/gu)) {
              const range = document.createRange();
              range.setStart(node, m.index ?? 0);
              range.setEnd(node, (m.index ?? 0) + m[0].length);
              const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
              if (lines.size > 1) out.push(m[0]);
            }
          }
          return out;
        });
        if (broken.length) brokenByPuzzle[id] = broken;
      }
      expect(brokenByPuzzle, 'words break inside a word').toEqual({});
    });
  }

  for (const [name, size] of [['844x390', LANDSCAPE], ['667x375', { width: 667, height: 375 }]] as const) {
    test('board content never slides under the floating bar buttons at ' + name + ', in every full puzzle with the solution placed', async ({ page }, info) => {
      await page.setViewportSize(size);
      const hitByPuzzle: Record<string, string[]> = {};
      for (const id of fullPuzzles) {
        const file = puzzleFile(id);
        await toBoardOf(page, info, id);
        await fillBoard(page, info, file.solutions[0] as never);
        await page.evaluate(() => { const el = document.querySelector('.pz-right'); if (el) el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(120);
        const hits = await page.evaluate(() => {
          const column = document.querySelector('.pz-right');
          if (!column) return [];
          const box = column.getBoundingClientRect();
          const btns = [...document.querySelectorAll('.bar .bar-btn')].map((b) => b.getBoundingClientRect());
          const out: string[] = [];
          for (const el of document.querySelectorAll('.pz-right .pz-slot, .pz-right .pz-piece')) {
            const r = el.getBoundingClientRect();
            const top = Math.max(r.top, box.top);
            const bottom = Math.min(r.bottom, box.bottom);
            const left = Math.max(r.left, box.left);
            const right = Math.min(r.right, box.right);
            if (bottom - top <= 0 || right - left <= 0) continue;
            for (const b of btns) {
              if (top < b.bottom && bottom > b.top && left < b.right && right > b.left) { out.push((el.textContent ?? '').slice(0, 16)); break; }
            }
          }
          return out;
        });
        if (hits.length) hitByPuzzle[id] = hits;
      }
      expect(hitByPuzzle, 'board content under the floating bar buttons').toEqual({});
    });
  }

  for (const [name, size] of [['320x568', SMALL], ['360x640', { width: 360, height: 640 }], ['375x667', { width: 375, height: 667 }], ['390x844', { width: 390, height: 844 }], ['844x390', LANDSCAPE]] as const) {
    test('piece text sits fully inside its chip with visible padding at ' + name + ', in every full puzzle with the solution placed', async ({ page }, info) => {
      await page.setViewportSize(size);
      const badByPuzzle: Record<string, string[]> = {};
      for (const id of fullPuzzles) {
        const file = puzzleFile(id);
        await toBoardOf(page, info, id);
        await fillBoard(page, info, file.solutions[0] as never);
        const bad = await page.evaluate(() => {
          const out: string[] = [];
          const clip = new Set(['hidden', 'clip', 'auto', 'scroll']);
          for (const el of document.querySelectorAll('.pz-piece')) {
            const node = el.firstChild;
            if (!node || node.nodeType !== Node.TEXT_NODE) continue;
            const cs = getComputedStyle(el);
            if (parseFloat(cs.paddingLeft) < 4 || parseFloat(cs.paddingRight) < 4) out.push('padding-inline ' + cs.paddingLeft + '/' + cs.paddingRight + ' on: ' + (node.textContent ?? '').slice(0, 20));
            const b = el.getBoundingClientRect();
            const pad = {
              l: b.left + (parseFloat(cs.borderLeftWidth) || 0),
              r: b.right - (parseFloat(cs.borderRightWidth) || 0),
              t: b.top + (parseFloat(cs.borderTopWidth) || 0),
              u: b.bottom - (parseFloat(cs.borderBottomWidth) || 0),
            };
            for (const m of (node.textContent ?? '').matchAll(/\S+/gu)) {
              const range = document.createRange();
              range.setStart(node, m.index ?? 0);
              range.setEnd(node, (m.index ?? 0) + m[0].length);
              for (const r of range.getClientRects()) {
                if (r.left < pad.l - 0.5 || r.right > pad.r + 0.5 || r.top < pad.t - 0.5 || r.bottom > pad.u + 0.5) out.push('text rect outside the padding box: ' + m[0]);
              }
            }
            const stop = el.closest('.pz-slot') ?? el.closest('.pz-bank');
            let anc = el.parentElement;
            while (anc) {
              const acs = getComputedStyle(anc);
              if (clip.has(acs.overflowX) || clip.has(acs.overflowY)) {
                const ab = anc.getBoundingClientRect();
                if (b.left < ab.left - 0.5 || b.right > ab.right + 0.5 || b.top < ab.top - 0.5 || b.bottom > ab.bottom + 0.5) out.push('clipped by ' + (anc.className || anc.tagName) + ' [' + acs.overflowX + '/' + acs.overflowY + ']');
              }
              if (anc === stop) break;
              anc = anc.parentElement;
            }
          }
          return out;
        });
        if (bad.length) badByPuzzle[id] = bad;
      }
      expect(badByPuzzle, 'piece text not safely inside its chip').toEqual({});
    });
  }

  // The visible frame is drawn inside the padding box: an offset border plus the inset box-shadow ink line
  // (style.css draws the inner ink line as the widest inset shadow). A gap to the padding box is not a gap to that line.
  for (const [name, size] of [['320x568', SMALL], ['360x640', { width: 360, height: 640 }], ['390x844', { width: 390, height: 844 }], ['844x390', LANDSCAPE]] as const) {
    test('piece text keeps a 4 px gap to the drawn chip frame at ' + name + ', in every full puzzle with the solution placed', async ({ page }, info) => {
      await page.setViewportSize(size);
      const badByPuzzle: Record<string, string[]> = {};
      for (const id of fullPuzzles) {
        const file = puzzleFile(id);
        await toBoardOf(page, info, id);
        await fillBoard(page, info, file.solutions[0] as never);
        const bad = await page.evaluate(() => {
          const out: string[] = [];
          const clip = new Set(['hidden', 'clip', 'auto', 'scroll']);
          for (const el of document.querySelectorAll<HTMLElement>('.pz-piece')) {
            const node = el.firstChild;
            if (!node || node.nodeType !== Node.TEXT_NODE) continue;
            const cs = getComputedStyle(el);
            if (cs.whiteSpace !== 'normal' || cs.overflowWrap !== 'normal') out.push('text does not wrap at spaces only: ' + cs.whiteSpace + '/' + cs.overflowWrap);
            if (cs.textOverflow === 'ellipsis') out.push('text is set to ellipsis');
            if (el.scrollWidth > el.clientWidth + 0.5) out.push('text overflows the piece box: ' + (node.textContent ?? '').slice(0, 20));
            const ink = Math.max(0, ...cs.boxShadow.split(',').filter((s) => s.includes('inset')).map((s) => {
              const n = [...s.matchAll(/(-?[\d.]+)px/gu)].map((m) => parseFloat(m[1] ?? '0'));
              return n.length >= 4 ? (n[3] ?? 0) : 0;
            }));
            const b = el.getBoundingClientRect();
            const frame = {
              l: b.left + (parseFloat(cs.borderLeftWidth) || 0) + ink,
              r: b.right - (parseFloat(cs.borderRightWidth) || 0) - ink,
              t: b.top + (parseFloat(cs.borderTopWidth) || 0) + ink,
              u: b.bottom - (parseFloat(cs.borderBottomWidth) || 0) - ink,
            };
            for (const m of (node.textContent ?? '').matchAll(/\S+/gu)) {
              const range = document.createRange();
              range.setStart(node, m.index ?? 0);
              range.setEnd(node, (m.index ?? 0) + m[0].length);
              for (const r of range.getClientRects()) {
                const gap = Math.min(r.left - frame.l, frame.r - r.right, r.top - frame.t, frame.u - r.bottom);
                if (gap < 4) out.push('gap ' + gap.toFixed(1) + 'px to the drawn frame: ' + m[0]);
              }
            }
            const stop = el.closest('.pz-slot') ?? el.closest('.pz-bank');
            let anc = el.parentElement;
            while (anc) {
              const acs = getComputedStyle(anc);
              if (clip.has(acs.overflowX) || clip.has(acs.overflowY)) {
                const ab = anc.getBoundingClientRect();
                if (b.left < ab.left - 0.5 || b.right > ab.right + 0.5 || b.top < ab.top - 0.5 || b.bottom > ab.bottom + 0.5) out.push('clipped by ' + (anc.className || anc.tagName) + ' [' + acs.overflowX + '/' + acs.overflowY + ']');
              }
              if (anc === stop) break;
              anc = anc.parentElement;
            }
          }
          return out;
        });
        if (bad.length) badByPuzzle[id] = bad;
      }
      expect(badByPuzzle, 'piece text closer than 4 px to the drawn chip frame').toEqual({});
    });
  }

  // The slot button clears the shared button frame, so the drawn frame around a label is the
  // slot's own border (plus its inset ink line, should one ever be drawn): the label keeps 4 px to it.
  for (const [name, size] of [['320x568', SMALL], ['360x640', { width: 360, height: 640 }], ['390x844', { width: 390, height: 844 }], ['844x390', LANDSCAPE]] as const) {
    test('slot label text keeps a 4 px gap to the drawn slot frame at ' + name + ', in every full puzzle with the solution placed', async ({ page }, info) => {
      await page.setViewportSize(size);
      const badByPuzzle: Record<string, string[]> = {};
      for (const id of fullPuzzles) {
        const file = puzzleFile(id);
        await toBoardOf(page, info, id);
        await fillBoard(page, info, file.solutions[0] as never);
        const bad = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('.pz-slot-label')) {
            const node = el.firstChild;
            if (!node || node.nodeType !== Node.TEXT_NODE) continue;
            const slot = el.closest<HTMLElement>('.pz-slot');
            if (!slot) continue;
            const cs = getComputedStyle(slot);
            const ink = Math.max(0, ...cs.boxShadow.split(',').filter((s) => s.includes('inset')).map((s) => {
              const n = [...s.matchAll(/(-?[\d.]+)px/gu)].map((m) => parseFloat(m[1] ?? '0'));
              return n.length >= 4 ? (n[3] ?? 0) : 0;
            }));
            const b = slot.getBoundingClientRect();
            const frame = {
              l: b.left + (parseFloat(cs.borderLeftWidth) || 0) + ink,
              r: b.right - (parseFloat(cs.borderRightWidth) || 0) - ink,
              t: b.top + (parseFloat(cs.borderTopWidth) || 0) + ink,
              u: b.bottom - (parseFloat(cs.borderBottomWidth) || 0) - ink,
            };
            for (const m of (node.textContent ?? '').matchAll(/\S+/gu)) {
              const range = document.createRange();
              range.setStart(node, m.index ?? 0);
              range.setEnd(node, (m.index ?? 0) + m[0].length);
              for (const r of range.getClientRects()) {
                const gap = Math.min(r.left - frame.l, frame.r - r.right, r.top - frame.t, frame.u - r.bottom);
                if (gap < 4) out.push('gap ' + gap.toFixed(1) + 'px to the drawn slot frame: ' + m[0]);
              }
            }
          }
          return out;
        });
        if (bad.length) badByPuzzle[id] = bad;
      }
      expect(badByPuzzle, 'slot label text closer than 4 px to the drawn slot frame').toEqual({});
    });
  }

  test('when the file lists two solutions, the first found is told as n/of, the second ends the puzzle', async ({ page }, info) => {
    const file = puzzleFile('intro') as unknown as Record<string, unknown>;
    const two = { ...file, slots: (file.slots as { id: string; label: string }[]).slice(0, 2), tokens: [{ id: 'a', text: 'A', status: 'rule' }, { id: 'b', text: 'B', status: 'rule' }], cards: [], predict: undefined, demo: undefined, wrongFrame: { cards: [] }, solutions: [[['a'], ['b']], [['b'], ['a']]] };
    await page.route(/\/assets\/pz-intro-[^/]+\.js$/u, (route) => route.fulfill({ contentType: 'text/javascript', body: 'export default ' + JSON.stringify(two) + ';' }));
    await openPuzzle(page, 'intro');
    await fillBoard(page, info, [['a'], ['b']], two as never);
    await check(page, info);
    await expect.poll(async () => (await puzzleOf(page)).verdict).toMatch(/1\/2/u);
    expect((await puzzleOf(page)).phase).toBe('board');
    await clearBoard(page);
    await fillBoard(page, info, [['b'], ['a']], two as never);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
  });

  for (const [name, size] of [['320x568', SMALL], ['844x390', LANDSCAPE]] as const) {
    test('chapter 1: the four dials sit in one row at ' + name + ', as the words "hàng", "trái" and "phải" say', async ({ page }, info) => {
      await page.setViewportSize(size);
      await toBoardOf(page, info, 'intro');
      const boxes = await page.locator('.pz-board .pz-slot').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right) })));
      expect(boxes).toHaveLength(4);
      expect(new Set(boxes.map((b) => b.top)).size, 'one row').toBe(1);
      for (let i = 1; i < boxes.length; i += 1) expect((boxes[i] as { left: number }).left, 'left to right').toBeGreaterThanOrEqual((boxes[i - 1] as { right: number }).right);
    });
  }
});

test.describe('puzzle player: what ships', () => {
  const assets = (): { name: string; text: string }[] => readdirSync('dist/assets').filter((n) => n.endsWith('.js')).map((name) => ({ name, text: readFileSync('dist/assets/' + name, 'utf8') }));

  test('no file of the build carries the solver, the bots or the authoring checker', () => {
    const names = ['allArrangements', 'solveLevels', 'propagate', 'conclusionStats', 'checkData', 'bankFlags', 'spearman', 'registerOp', 'bankBoards', 'antiGuess'];
    const files = assets();
    expect(files.some((f) => f.name.startsWith('puzzle-'))).toBe(true);
    expect(files.flatMap((f) => names.filter((n) => f.text.includes(n)).map((n) => f.name + ': ' + n))).toEqual([]);
  });

  for (const id of IDS) {
    test(id + ': the slim file answers the checker exactly as the full file does', async () => {
      const core = (await import('../scripts/puzzles.mjs')) as unknown as { reply: (p: unknown, b: unknown, f: Set<string>) => unknown; bankOrder: (p: unknown) => unknown; helpAnswer: (p: unknown, f: Set<string>) => unknown };
      const full = puzzleFile(id) as unknown as { slots: { id: string }[]; tokens: { id: string }[]; solutions: unknown[][] };
      const slim = slimPuzzle(full as never);
      const ids = (p: unknown): string[] => (core.bankOrder(p) as { id: string }[]).map((t) => t.id);
      expect(ids(slim)).toEqual(ids(full));
      expect(core.helpAnswer(slim, new Set())).toEqual(core.helpAnswer(full, new Set()));
      const boards: unknown[][] = [full.solutions[0] as unknown[], full.slots.map(() => []), full.slots.map((_, i) => (i === 0 ? full.tokens.map((t) => t.id) : [])), full.slots.map((_, i) => (full.tokens[i] ? [full.tokens[i]?.id] : []))];
      for (const b of boards) expect(core.reply(slim, b, new Set()), id + ' ' + JSON.stringify(b)).toEqual(core.reply(full, b, new Set()));
      const json = JSON.stringify(slim);
      for (const key of ['aha', 'antiGuess', 'history', 'space', 'fills', 'evidence']) expect(json, key).not.toContain('"' + key + '"');
      const conclusion = (full as unknown as { conclusion?: { hints: { text: string; solves?: boolean }[] } }).conclusion;
      expect((slim as { conclusion?: { hints: unknown } }).conclusion?.hints, 'the conclusion hints reach the player').toEqual(conclusion?.hints);
      expect((slim as { minPlaced?: number }).minPlaced, 'the minimum of pieces reaches the player').toBe((full as unknown as { minPlaced?: number }).minPlaced);
    });
  }
});
