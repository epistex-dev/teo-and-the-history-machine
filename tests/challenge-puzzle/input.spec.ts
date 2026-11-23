import { expect, test } from '@playwright/test';
import { monitor } from '../support/helpers.ts';
import { isTouch, stateOf } from '../support/play.ts';
import { answerPredict, check, press, skipDemo, toBoard, waitPuzzlePhase, fillBoard } from '../support/puzzle.ts';
import { reply } from '../../scripts/puzzles.mjs';
import {
  asList,
  centerOf,
  cool,
  domClick,
  domPiece,
  emptyOf,
  expectStoryAt,
  invariants,
  KEY,
  seedStorage,
  lineAfter,
  openInStory,
  openPuzzle,
  openSeeded,
  placeAll,
  placeDom,
  puzzleFile,
  puzzleOf,
  rng,
  tapAt,
  waitGame,
  type Cell,
} from './helpers.ts';

const wrongOf = (id: string): Cell[] => {
  const f = puzzleFile(id);
  const base = f.solutions[0] as Cell[];
  const ids = f.tokens.map((t) => t.id);
  const first = ids.find((i) => !asList(base[0]).includes(i)) as string;
  return base.map((_, i) => (i === 0 ? [first] : null));
};

test.describe('double taps and races', () => {
  for (const id of ['intro', 'dec25', 'ending'] as const) {
    test(id + ': a double tap on a predict option answers once; the second tap lands on nothing of the next step', async ({ page }, info) => {
      const file = puzzleFile(id);
      for (const [i] of (file.predict as { options: string[] }).options.entries()) {
        await openPuzzle(page, id);
        const c = await centerOf(page, '#pz-option-' + i);
        await tapAt(page, info, c.x, c.y);
        await tapAt(page, info, c.x, c.y);
        const p = await puzzleOf(page);
        expect(p.phase, 'phase after double tap on option ' + i).toBe(id === 'intro' ? 'demo' : 'board');
        expect(p.predicted, 'predicted').toBe(i);
        expect(p.selected, 'a piece was selected by the second tap').toBeNull();
        expect(Object.values(p.board ?? {}).flat(), 'a piece was placed by the second tap').toEqual([]);
        expect([p.checks, p.hints, p.wrong], 'checks, hints, wrong').toEqual([0, 0, 0]);
        await page.evaluate(() => localStorage.clear());
      }
    });
  }

  test('intro: a double tap on Bỏ qua opens the board once and presses nothing there', async ({ page }, info) => {
    await openPuzzle(page, 'intro');
    await answerPredict(page, info, 0);
    await cool(page);
    const c = await centerOf(page, '#pz-skip');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    const p = await puzzleOf(page);
    expect(p.phase).toBe('board');
    expect([p.hints, p.checks, p.wrong]).toEqual([0, 0, 0]);
    expect(p.hint).toBe('');
  });

  test('intro: a double tap on Vào câu đố enters the board once and checks nothing there', async ({ page }, info) => {
    const file = puzzleFile('intro');
    const demo = file.demo as { slots: { id: string }[]; solutions: Cell[][] };
    await openPuzzle(page, 'intro');
    await answerPredict(page, info, 0);
    for (const [i, slot] of demo.slots.entries()) for (const id of asList(demo.solutions[0]?.[i])) await placeDom(page, id, slot.id);
    await check(page, info);
    await expect(page.locator('#pz-check')).toHaveText('Vào câu đố');
    await cool(page);
    const c = await centerOf(page, '#pz-check');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    const p = await puzzleOf(page);
    expect(p.phase).toBe('board');
    expect([p.checks, p.wrong, p.wrongTotal]).toEqual([0, 0, 0]);
    expect(p.verdict).toBe('');
  });

  test('a double tap on Kiểm tra counts one wrong check, a double tap on Gợi ý opens one tier', async ({ page }, info) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, puzzleFile('dec25'), wrongOf('dec25'));
    await cool(page);
    let c = await centerOf(page, '#pz-check');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    let p = await puzzleOf(page);
    expect([p.checks, p.wrong, p.wrongTotal]).toEqual([0, 0, 0]);
    await placeAll(page, puzzleFile('dec25'), [null, ['xm', 'sun'], ['c380']]);
    await cool(page);
    c = await centerOf(page, '#pz-check');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    p = await puzzleOf(page);
    expect(p.checks, 'checks after one double tap').toBe(1);
    expect(p.wrong, 'wrong after one double tap').toBe(1);
    await cool(page);
    c = await centerOf(page, '#pz-hint');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    expect((await puzzleOf(page)).hints).toBe(1);
  });

  test('intro in the story: a double tap on Lật trang continues with the one line after the puzzle, not the next', async ({ page }, info) => {
    await openInStory(page, info, 'intro');
    await toBoard(page, info);
    const file = puzzleFile('intro');
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await cool(page);
    const c = await centerOf(page, '#pz-next');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    await expectStoryAt(page, lineAfter('intro'));
  });

  test('ending: a double tap on Viết câu kết opens the conclusion once and fills or selects nothing', async ({ page }, info) => {
    await openSeeded(page, 'ending', { phase: 'reveal' });
    await cool(page);
    const c = await centerOf(page, '#pz-next');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    const p = await puzzleOf(page);
    expect(p.phase).toBe('conclusion');
    expect(p.conclusion).toMatchObject({ selected: null });
    expect(p.conclusion?.filled.every((f) => f === null), 'a blank was filled').toBe(true);
  });

  test('ending in the story: a double tap on the last Lật trang continues with the one line after the puzzle', async ({ page }, info) => {
    await openInStory(page, info, 'ending');
    await toBoard(page, info);
    await fillBoard(page, info, puzzleFile('ending').solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await waitPuzzlePhase(page, 'conclusion');
    await cool(page);
    await press(page.locator('#pz-hint'), info);
    await cool(page);
    await press(page.locator('#pz-hint'), info);
    await cool(page);
    await press(page.locator('#pz-hint'), info);
    await waitPuzzlePhase(page, 'verdict');
    await cool(page);
    const c = await centerOf(page, '#pz-next');
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    await tapAt(page, info, c.x, c.y);
    await expectStoryAt(page, lineAfter('ending'));
  });

  test('a burst of 40 clicks on Gợi ý in one tick opens one tier; a burst on Kiểm tra counts one check', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, puzzleFile('dec25'), [['hyp'], ['xm', 'sun'], ['birth']]);
    await page.evaluate(() => {
      for (let i = 0; i < 40; i += 1) document.querySelector<HTMLElement>('#pz-hint')?.click();
    });
    expect((await puzzleOf(page)).hints).toBe(1);
    await cool(page);
    await page.evaluate(() => {
      for (let i = 0; i < 40; i += 1) document.querySelector<HTMLElement>('#pz-check')?.click();
    });
    const p = await puzzleOf(page);
    expect([p.checks, p.wrong]).toEqual([1, 1]);
  });
});

test.describe('drag and tap races', () => {
  test.beforeEach(({}, info) => {
    test.skip(isTouch(info), 'a mouse drag; touch players tap');
  });

  const drag = async (page: import('@playwright/test').Page, from: string, to: string, steps = 8): Promise<void> => {
    const a = await centerOf(page, from);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    const b = await centerOf(page, to).catch(() => a);
    await page.mouse.move(b.x, b.y, { steps });
    await page.mouse.up();
  };

  test('dragging a bank piece onto a slot places it, selects nothing and leaves no ghost', async ({ page }) => {
    const m = monitor(page);
    await openSeeded(page, 'dec25', { phase: 'board' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await drag(page, '.pz-bank [data-piece="' + domPiece('dec25', 'hyp') + '"]', '.pz-slot[data-slot="s2"]');
    const p = await puzzleOf(page);
    expect(p.board?.s2).toEqual(['hyp']);
    expect(p.selected).toBeNull();
    expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
    expect(m.pageErrors).toEqual([]);
  });

  test('a piece held by a tap stays out of the way when another piece is dragged onto a slot', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.pz-bank [data-piece="' + domPiece('dec25', 'xm') + '"]').click();
    await drag(page, '.pz-bank [data-piece="' + domPiece('dec25', 'sun') + '"]', '.pz-slot[data-slot="s1"]');
    const p = await puzzleOf(page);
    expect(p.board?.s1, 'the dragged piece lands').toEqual(['sun']);
    expect(Object.values(p.board ?? {}).flat(), 'the held piece was placed by the click after the drop').toEqual(['sun']);
    expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
  });

  test('a drag released over nothing changes nothing and the next tap works', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await page.setViewportSize({ width: 1280, height: 900 });
    const a = await centerOf(page, '.pz-bank [data-piece="' + domPiece('dec25', 'hyp') + '"]');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 3, 4, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    expect(Object.values((await puzzleOf(page)).board ?? {}).flat()).toEqual([]);
    expect(await page.locator('.pz-ghost').count()).toBe(0);
    await page.locator('.pz-bank [data-piece="' + domPiece('dec25', 'xm') + '"]').click();
    expect((await puzzleOf(page)).selected).toBe('xm');
  });

  test('dragging a placed piece back onto the bank lifts it; a 5 px wobble is a tap', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await placeDom(page, 'hyp', 's1');
    await drag(page, '.pz-chip[data-piece="' + domPiece('dec25', 'hyp') + '"]', '.pz-bank');
    let p = await puzzleOf(page);
    expect(p.board?.s1).toEqual([]);
    expect(p.bank).toContain('hyp');
    const a = await centerOf(page, '.pz-bank [data-piece="' + domPiece('dec25', 'xm') + '"]');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 3, a.y + 4, { steps: 3 });
    await page.mouse.up();
    p = await puzzleOf(page);
    expect(p.selected, 'a 5 px wobble should still be a tap').toBe('xm');
  });

  test('a right-button press and a cancelled pointer never start or finish a drag', async ({ page }) => {
    const m = monitor(page);
    await openSeeded(page, 'dec25', { phase: 'board' });
    await page.setViewportSize({ width: 1280, height: 900 });
    const a = await centerOf(page, '.pz-bank [data-piece="' + domPiece('dec25', 'hyp') + '"]');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(a.x + 40, a.y + 40, { steps: 4 });
    expect(await page.locator('.pz-ghost').count()).toBe(0);
    await page.mouse.up({ button: 'right' });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y - 30, { steps: 4 });
    expect(await page.locator('.pz-ghost').count()).toBe(1);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })));
    expect(await page.locator('.pz-ghost').count()).toBe(0);
    await page.mouse.up();
    expect(Object.values((await puzzleOf(page)).board ?? {}).flat()).toEqual([]);
    expect(m.pageErrors).toEqual([]);
  });

  test('two fingers: a second pointer going down mid-drag never leaves a ghost or a stuck drag', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(([ida, idb]) => {
      const fire = (el: Element, type: string, id: number, x: number, y: number): void => {
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, button: 0 }));
      };
      const a = document.querySelector('.pz-bank [data-piece="' + ida + '"]') as HTMLElement;
      const b = document.querySelector('.pz-bank [data-piece="' + idb + '"]') as HTMLElement;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      fire(a, 'pointerdown', 1, ra.x + 5, ra.y + 5);
      fire(b, 'pointerdown', 2, rb.x + 5, rb.y + 5);
      fire(document.body, 'pointermove', 1, ra.x + 60, ra.y + 60);
      fire(document.body, 'pointerup', 2, rb.x + 5, rb.y + 5);
      fire(document.body, 'pointerup', 1, ra.x + 60, ra.y + 60);
    }, [domPiece('dec25', 'hyp'), domPiece('dec25', 'xm')] as const);
    expect(await page.locator('.pz-ghost').count(), 'ghost left behind').toBe(0);
    expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
  });
});

test.describe('random taps never break the board', () => {
  for (const id of ['intro', 'dec25', 'ending', 'saturnalia', 'yule'] as const) {
    test(id + ': 300 seeded random taps, Escape keys and lifts keep every piece in exactly one place within its cap', async ({ page }) => {
      const m = monitor(page);
      const file = puzzleFile(id);
      await openSeeded(page, id, { phase: 'board' });
      const bad = await page.evaluate(
        ([slots, ids, seed]) => {
          let s = seed as number;
          const rand = (): number => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
          };
          const problems: string[] = [];
          const caps = slots as { id: string; cap?: number | string }[];
          for (let n = 0; n < 300; n += 1) {
            const roll = rand();
            if (roll < 0.06) {
              document.querySelector('.pz-board')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            } else {
              const sel = roll < 0.45 ? '.pz-bank .pz-piece, .pz-chip' : roll < 0.9 ? '.pz-slot-btn' : '.pz-slot';
              const all = [...document.querySelectorAll<HTMLElement>(sel)];
              if (all.length) all[Math.floor(rand() * all.length)]?.click();
            }
            const g = JSON.parse(window.render_game_to_text()).game;
            const placed = Object.values(g.board as Record<string, string[]>).flat();
            const every = [...placed, ...g.bank].sort();
            if (JSON.stringify(every) !== JSON.stringify([...(ids as string[])].sort())) problems.push('op ' + n + ' partition ' + JSON.stringify(every));
            for (const c of caps) {
              const cap = c.cap === 'any' ? Infinity : typeof c.cap === 'number' ? c.cap : 1;
              if ((g.board[c.id] ?? []).length > cap) problems.push('op ' + n + ' slot ' + c.id + ' over cap');
            }
            if (g.selected && !g.bank.includes(g.selected)) problems.push('op ' + n + ' selected ' + g.selected + ' not in bank');
            if (document.querySelectorAll('.pz-chip').length !== placed.length) problems.push('op ' + n + ' chips differ from placements');
            if (problems.length > 4) break;
          }
          return problems;
        },
        [file.slots, file.tokens.map((t) => t.id), 12345] as const,
      );
      expect(bad).toEqual([]);
      expect(m.pageErrors).toEqual([]);
    });
  }
});

test.describe('multi-capacity and ordered slots', () => {
  test('dec25: pieces of one rung in the opposite order, and placed in any order of slots, still solve', async ({ page }, info) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    const file = puzzleFile('dec25');
    await placeAll(page, file, [null, null, ['c380']]);
    await placeAll(page, file, [null, ['sun', 'xm'], null]);
    await placeAll(page, file, [['list'], null, null]);
    await cool(page);
    await press(page.locator('#pz-check'), info);
    await waitPuzzlePhase(page, 'reveal');
  });

  test('dec25: a full rung with the others empty is an incomplete board that counts the empty rungs, not a wrong one', async ({ page }) => {
    const file = puzzleFile('dec25');
    const full = file.tokens.slice(0, 2).map((t) => t.id);
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, file, [full, null, null]);
    await cool(page);
    await domClick(page, '#pz-check');
    const p = await puzzleOf(page);
    const oracle = reply(file, [full, null, null], new Set());
    expect(oracle.type).toBe('incomplete');
    expect(p.verdict).toContain('còn ' + emptyOf(oracle) + ' chỗ');
    expect([p.checks, p.wrong]).toEqual([0, 0]);
  });

  test('dec25: with a piece held, tapping a placed piece adds the held one to that rung', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeDom(page, 'xm', 's2');
    await domClick(page, '.pz-bank [data-piece="' + domPiece('dec25', 'hyp') + '"]');
    await domClick(page, '.pz-chip[data-piece="' + domPiece('dec25', 'xm') + '"]');
    const p = await puzzleOf(page);
    expect(p.board?.s2?.slice().sort()).toEqual(['hyp', 'xm']);
    expect(p.selected).toBeNull();
    expect(p.bank).not.toContain('hyp');
    expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
  });

  test('a slot capped at 2: the third piece is refused with a spoken reason and stays held', async ({ page }) => {
    await page.route('**/assets/pz-dec25-*.js', async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replaceAll('cap:`any`', 'cap:2');
      await route.fulfill({ response: res, body });
    });
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeDom(page, 'hyp', 's1');
    await placeDom(page, 'xm', 's1');
    await domClick(page, '.pz-bank [data-piece="' + domPiece('dec25', 'sun') + '"]');
    await domClick(page, '.pz-slot[data-slot="s1"] .pz-slot-btn');
    const p = await puzzleOf(page);
    expect(p.board?.s1).toEqual(['hyp', 'xm']);
    expect(p.selected, 'the refused piece stays held').toBe('sun');
    await expect(page.locator('.pz .sr-only[aria-live]')).toContainText('tối đa 2');
    expect(await invariants(page, { ...puzzleFile('dec25'), slots: puzzleFile('dec25').slots.map((s) => ({ ...s, cap: 2 })) })).toEqual([]);
  });

  test('saturnalia (one piece per slot): a second piece replaces the first, which returns to the bank', async ({ page }) => {
    const file = puzzleFile('saturnalia');
    await openSeeded(page, 'saturnalia', { phase: 'board' });
    const [a, b] = file.tokens.map((t) => t.id);
    await placeDom(page, a as string, 's1');
    await placeDom(page, b as string, 's1');
    const p = await puzzleOf(page);
    expect(p.board?.s1).toEqual([b]);
    expect(p.bank).toContain(a);
    expect(await invariants(page, file)).toEqual([]);
  });

  test('moving a placed piece to another slot leaves one copy', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeDom(page, 'hyp', 's1');
    await domClick(page, '.pz-chip[data-piece="' + domPiece('dec25', 'hyp') + '"]');
    await domClick(page, '.pz-slot[data-slot="s3"] .pz-slot-btn');
    const p = await puzzleOf(page);
    expect(p.board).toEqual({ s1: [], s2: [], s3: ['hyp'] });
  });
});

test.describe('empty slots', () => {
  test('dec25: checking an empty board, then each growing partial board, matches the checker and counts no wrong answer', async ({ page }) => {
    const file = puzzleFile('dec25');
    await openSeeded(page, 'dec25', { phase: 'board' });
    const sol = file.solutions[0] as Cell[];
    const placed: string[][] = file.slots.map(() => []);
    const steps: [string, number][] = [['', 0], ...file.slots.flatMap((s, i) => asList(sol[i]).map((id) => [id, i] as [string, number]))];
    for (const [id, i] of steps) {
      if (id) {
        await placeDom(page, id, (file.slots[i] as { id: string }).id);
        (placed[i] as string[]).push(id);
      }
      const expected = reply(file, placed.map((c) => [...c]), new Set());
      if (expected.type !== 'incomplete') break;
      await cool(page);
      await domClick(page, '#pz-check');
      const p = await puzzleOf(page);
      expect(p.verdict, 'after placing ' + (id || 'nothing')).toContain('còn ' + emptyOf(expected) + ' chỗ');
      expect([p.checks, p.wrong, p.wrongTotal, p.hints], 'counters after an incomplete check').toEqual([0, 0, 0, 0]);
      expect(p.phase).toBe('board');
    }
  });

  test('ten empty submissions never open the hint ladder or the nudge', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    for (let i = 0; i < 10; i += 1) {
      await cool(page);
      await domClick(page, '#pz-check');
    }
    const p = await puzzleOf(page);
    expect([p.nudge, p.hints, p.hint, p.phase]).toEqual([false, 0, '', 'board']);
  });
});

test.describe('hints', () => {
  test('hint presses spaced past the cooldown open one tier each, name the tier and mark the card; the last solves', async ({ page }) => {
    const file = puzzleFile('dec25');
    await openSeeded(page, 'dec25', { phase: 'board' });
    for (let i = 1; i < file.hints.length; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
      const p = await puzzleOf(page);
      expect(p.hints, 'tier ' + i).toBe(i);
      expect(p.hint).toContain('Gợi ý ' + i + '/' + file.hints.length);
      expect(p.hint).toContain((file.hints[i - 1] as { text: string }).text);
      const card = (file.hints[i - 1] as { card?: string }).card;
      expect(p.pointed, 'pointed cards at tier ' + i).toEqual(card ? [card] : []);
    }
    await cool(page);
    await domClick(page, '#pz-hint');
    await waitPuzzlePhase(page, 'reveal');
  });

  test('the answer tier never fills the board before it is asked for', async ({ page }) => {
    const file = puzzleFile('ending');
    await openSeeded(page, 'ending', { phase: 'board' });
    for (let i = 1; i < file.hints.length; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
      expect(Object.values((await puzzleOf(page)).board ?? {}).flat(), 'tier ' + i + ' placed pieces').toEqual([]);
    }
  });

  test('intro in the story: five hints solve it, the reveal shows, Lật trang continues once and clears the save', async ({ page }, info) => {
    await openInStory(page, info, 'intro');
    await answerPredict(page, info, 1);
    await skipDemo(page, info);
    for (let i = 0; i < 5; i += 1) {
      await cool(page);
      await press(page.locator('#pz-hint'), info);
    }
    await waitPuzzlePhase(page, 'reveal');
    await expect(page.locator('.pz-echo')).toContainText((puzzleFile('intro').predict as { options: string[] }).options[1] as string);
    await cool(page);
    await press(page.locator('#pz-next'), info);
    await expectStoryAt(page, lineAfter('intro'));
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:puzzle:intro'))).toBeNull();
    expect((await stateOf(page)).game).toBeNull();
  });
});

test.describe('the nudge after three wrong checks', () => {
  const wrongChecks = async (page: import('@playwright/test').Page, n: number): Promise<void> => {
    for (let i = 0; i < n; i += 1) {
      await cool(page);
      await domClick(page, '#pz-check');
    }
  };

  test('dec25: not after 1 or 2 wrong checks, exactly after the 3rd, still after the 4th; the tier stays closed', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, puzzleFile('dec25'), [['hyp'], ['xm', 'sun'], ['birth']]);
    const seen: boolean[] = [];
    for (let i = 1; i <= 4; i += 1) {
      await wrongChecks(page, 1);
      const p = await puzzleOf(page);
      expect(p.wrong).toBe(i);
      seen.push(p.nudge);
      expect(p.hints, 'the nudge opened a tier by itself').toBe(0);
    }
    expect(seen).toEqual([false, false, true, true]);
    await expect(page.locator('#pz-hint')).toHaveAttribute('data-nudge', 'true');
    expect((await puzzleOf(page)).verdict).toContain('Gợi ý');
  });

  test('empty submissions in between neither count nor reset the run', async ({ page }) => {
    const file = puzzleFile('dec25');
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, file, [['hyp'], ['xm', 'sun'], ['birth']]);
    await wrongChecks(page, 2);
    await domClick(page, '.pz-chip[data-piece="' + domPiece('dec25', 'birth') + '"]');
    await domClick(page, '.pz-bank [data-piece="' + domPiece('dec25', 'c380') + '"]');
    await wrongChecks(page, 3);
    expect((await puzzleOf(page)).wrong).toBe(2);
    expect((await puzzleOf(page)).nudge).toBe(false);
    await domClick(page, '.pz-slot[data-slot="s3"] .pz-slot-btn');
    await wrongChecks(page, 1);
    const p = await puzzleOf(page);
    expect(p.wrong).toBe(3);
    expect(p.nudge).toBe(true);
  });

  test('a hint press ends the run: three more wrong checks are needed', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, puzzleFile('dec25'), [['hyp'], ['xm', 'sun'], ['birth']]);
    await wrongChecks(page, 3);
    expect((await puzzleOf(page)).nudge).toBe(true);
    await cool(page);
    await domClick(page, '#pz-hint');
    let p = await puzzleOf(page);
    expect([p.nudge, p.wrong, p.hints]).toEqual([false, 0, 1]);
    await wrongChecks(page, 2);
    expect((await puzzleOf(page)).nudge).toBe(false);
    await wrongChecks(page, 1);
    p = await puzzleOf(page);
    expect([p.nudge, p.wrong]).toEqual([true, 3]);
  });

  test('wrong checks in the throwaway example never nudge and never carry into the board', async ({ page }, info) => {
    const file = puzzleFile('intro');
    const demo = file.demo as { slots: { id: string }[]; tokens: { id: string }[]; solutions: Cell[][] };
    await openPuzzle(page, 'intro');
    await answerPredict(page, info, 0);
    const sol = asList(demo.solutions[0]?.[0]);
    const other = demo.tokens.map((t) => t.id).find((t) => !sol.includes(t)) as string;
    await placeDom(page, other, (demo.slots[0] as { id: string }).id);
    await wrongChecks(page, 5);
    let p = await puzzleOf(page);
    expect([p.nudge, p.wrong, p.checks]).toEqual([false, 0, 0]);
    await cool(page);
    await domClick(page, '#pz-skip');
    await waitPuzzlePhase(page, 'board');
    p = await puzzleOf(page);
    expect([p.nudge, p.wrong, p.checks]).toEqual([false, 0, 0]);
  });

  test('saturnalia: the wrong-frame answer is a plain wrong answer: it names no card and counts toward the nudge', async ({ page }) => {
    const file = puzzleFile('saturnalia');
    const trap = (file as unknown as { wrongFrame: { trap: Record<string, string | string[]> } }).wrongFrame.trap;
    const cells: Cell[] = file.slots.map((s) => (trap[s.id] ? ([] as string[]).concat(trap[s.id] as string | string[]) : null));
    const used = new Set(cells.flatMap(asList));
    const free = cells.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
    file.tokens.filter((t) => (t as { required?: boolean }).required && !used.has(t.id)).forEach((t, k) => (cells[free[k] as number] = [t.id]));
    expect(reply(file, cells, new Set()).type, 'the wrong-frame board gets the same reply as any wrong board').toBe('wrong');
    await openSeeded(page, 'saturnalia', { phase: 'board' });
    await placeAll(page, file, cells);
    await wrongChecks(page, 1);
    const first = await puzzleOf(page);
    expect(first.verdict).toBe('Chưa khớp với các thẻ.');
    expect(first.pointed, 'the frame message points at no card').toEqual([]);
    await wrongChecks(page, 2);
    const p = await puzzleOf(page);
    expect(p.pointed).toEqual([]);
    expect(p.wrong, 'three wrong-frame checks').toBe(3);
    expect(p.nudge).toBe(true);
  });

  test('idle time never nudges and never opens a tier: 5 minutes of stepped time and 3 s of real time', async ({ page }) => {
    await seedStorage(page, { [KEY('dec25')]: JSON.stringify({ phase: 'board' }) });
    await page.goto('/?preview=puzzle:dec25&manual=1');
    await waitGame(page, 'dec25');
    await placeAll(page, puzzleFile('dec25'), [['hyp'], ['xm', 'sun'], ['birth']]);
    await wrongChecks(page, 2);
    for (let i = 0; i < 10; i += 1) await page.evaluate(() => window.advanceTime(30_000));
    await page.waitForTimeout(3000);
    const p = await puzzleOf(page);
    expect([p.nudge, p.hints, p.hint, p.wrong]).toEqual([false, 0, '', 2]);
  });
});

test.describe('random submissions agree with the checker and never solve', () => {
  for (const id of ['intro', 'dec25', 'ending', 'saturnalia', 'yule'] as const) {
    test(id + ': 40 seeded random boards get the checker\'s answer; only a real solution reaches the reveal', async ({ page }) => {
      const file = puzzleFile(id);
      const rand = rng(97 + id.length);
      await openSeeded(page, id, { phase: 'board' });
      const ids = file.tokens.map((t) => t.id);
      let solved = false;
      for (let trial = 0; trial < 40 && !solved; trial += 1) {
        const roll = rand();
        for (let n = 0; n < 1 + Math.floor(rand() * ids.length * 1.5); n += 1) {
          const bank = (await puzzleOf(page)).bank as string[];
          if (roll < 0.15 || !bank.length) {
            const chips = await page.locator('.pz-chip').count();
            if (chips) {
              await domClick(page, '.pz-chip', Math.floor(rand() * chips));
              await page.evaluate(() => document.querySelector('.pz-board')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
            }
          } else {
            await domClick(page, '.pz-bank [data-piece="' + domPiece(id, bank[Math.floor(rand() * bank.length)] as string) + '"]');
            await domClick(page, '.pz-slot-btn', Math.floor(rand() * file.slots.length));
          }
        }
        const state = await puzzleOf(page);
        const cells: Cell[] = file.slots.map((s) => [...((state.board as Record<string, string[]>)[s.id] ?? [])]);
        const expected = reply(file, cells, new Set());
        await cool(page);
        await domClick(page, '#pz-check');
        const p = await puzzleOf(page);
        if (expected.type === 'solved') {
          solved = true;
          expect(p.phase).toBe('reveal');
          continue;
        }
        expect(p.phase, 'a board the checker rejects (' + expected.type + ') reached ' + p.phase + ' ' + JSON.stringify(cells)).toBe('board');
        if (expected.type === 'incomplete') expect(p.verdict).toContain('còn ' + emptyOf(expected) + ' chỗ');
        else if (expected.type === 'wrong' || expected.type === 'format') expect(p.verdict).toContain('Chưa khớp');
      }
    });
  }
});
