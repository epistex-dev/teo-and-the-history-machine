import { expect, test, type Page } from '@playwright/test';
import { monitor } from '../support/helpers.ts';
import { isTouch, stateOf } from '../support/play.ts';
import { waitPuzzlePhase } from '../support/puzzle.ts';
import { asList, domPiece, invariants, openPuzzle, openSeeded, pieceSel, puzzleFile, puzzleOf, type Cell } from './helpers.ts';

test.beforeEach(({}, info) => {
  test.skip(isTouch(info), 'no keyboard on touch devices');
});

const active = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return a && a !== document.body ? a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + '.' + a.className + '[' + (a.dataset.fk ?? a.dataset.piece ?? a.dataset.option ?? '') + ']@' + [...document.querySelectorAll('*')].indexOf(a) : 'body';
  });

const inside = (page: Page): Promise<boolean> => page.evaluate(() => Boolean(document.activeElement?.closest('.pz')));

/** Tab or Shift+Tab, whichever way is shorter in document order, until the control is focused. */
async function focusTo(page: Page, selector: string, max = 90): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    const here = await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);
    if (here) return;
    const dir = await page.evaluate((s) => {
      const t = document.querySelector(s);
      const a = document.activeElement;
      if (!t) return 'missing';
      if (!a || a === document.body) return 'Tab';
      return a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING ? 'Tab' : 'Shift+Tab';
    }, selector);
    if (dir === 'missing') throw new Error('no element for ' + selector);
    await page.keyboard.press(dir);
  }
  throw new Error('could not reach ' + selector + ' by keyboard; focus is on ' + (await active(page)));
}

test.describe('keyboard-only play', () => {
  test('dec25 from the first question to the hand-over, with Tab, Shift+Tab, Enter and Space only; focus never falls out of the puzzle', async ({ page }) => {
    const m = monitor(page);
    const file = puzzleFile('dec25');
    await openPuzzle(page, 'dec25');
    await focusTo(page, '#pz-option-1');
    await page.keyboard.press('Enter');
    await waitPuzzlePhase(page, 'board');
    expect(await inside(page), 'focus after the predict step').toBe(true);
    const sol = file.solutions[0] as Cell[];
    let n = 0;
    for (const [i, slot] of file.slots.entries()) {
      for (const id of asList(sol[i])) {
        await focusTo(page, '.pz-bank [data-piece="' + domPiece('dec25', id) + '"]');
        await page.keyboard.press(n % 2 ? 'Enter' : 'Space');
        expect((await puzzleOf(page)).selected).toBe(id);
        await focusTo(page, '.pz-slot[data-slot="' + slot.id + '"] .pz-slot-btn');
        await page.keyboard.press(n % 2 ? 'Space' : 'Enter');
        expect((await puzzleOf(page)).board?.[slot.id]).toContain(id);
        expect(await inside(page), 'focus after placing ' + id).toBe(true);
        n += 1;
      }
    }
    await focusTo(page, '#pz-check');
    await page.keyboard.press('Enter');
    await waitPuzzlePhase(page, 'reveal');
    expect(await inside(page), 'focus after the reveal opens').toBe(true);
    await page.waitForTimeout(300);
    await focusTo(page, '#pz-next');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stateOf(page)).game).toBeNull();
    expect(m.pageErrors).toEqual([]);
  });

  test('ending: the conclusion can be filled, checked and left by keyboard alone', async ({ page }) => {
    const file = puzzleFile('ending');
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    const c = file.conclusion as NonNullable<typeof file.conclusion>;
    const used = new Set<number>();
    for (const [i, blank] of c.blanks.entries()) {
      const j = c.bank.findIndex((p, k) => p.label === blank.label && !used.has(k));
      used.add(j);
      await focusTo(page, await pieceSel(page, j));
      await page.keyboard.press('Enter');
      await focusTo(page, '.pz-blank[data-blank="' + i + '"]');
      await page.keyboard.press('Enter');
      expect(await inside(page), 'focus after filling blank ' + i).toBe(true);
    }
    await page.waitForTimeout(300);
    await focusTo(page, '#pz-check');
    await page.keyboard.press('Enter');
    await waitPuzzlePhase(page, 'verdict');
    await page.waitForTimeout(300);
    await focusTo(page, '#pz-next');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stateOf(page)).game).toBeNull();
  });

  for (const phase of ['predict', 'board', 'reveal', 'conclusion'] as const) {
    test('ending ' + phase + ': Tab reaches every control, never gets stuck on one, and leaves the puzzle; Shift+Tab does the same', async ({ page }) => {
      await openSeeded(page, 'ending', { phase });
      const wanted = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.pz button, .pz summary, .pz a[href]')].filter((e) => e.offsetParent !== null && !(e as HTMLButtonElement).disabled).length);
      for (const dir of ['Tab', 'Shift+Tab']) {
        const seen = new Set<string>();
        let outside = 0;
        let repeats = 0;
        let last = '';
        for (let i = 0; i < wanted + 25; i += 1) {
          await page.keyboard.press(dir);
          const a = await active(page);
          if (a === last && a !== 'body') repeats += 1;
          last = a;
          if (await inside(page)) seen.add(a);
          else outside += 1;
        }
        expect(repeats, dir + ' stayed on one control').toBeLessThan(3);
        expect(outside, dir + ' never left the puzzle').toBeGreaterThan(0);
        expect(seen.size, dir + ' visited ' + [...seen].join(' | ')).toBeGreaterThanOrEqual(wanted);
      }
    });
  }

  test('Escape puts a held piece down, keeps focus on it and never leaves the puzzle; with nothing held it does nothing', async ({ page }) => {
    await openSeeded(page, 'dec25', { phase: 'board' });
    await focusTo(page, '.pz-bank [data-piece="' + domPiece('dec25', 'hyp') + '"]');
    await page.keyboard.press('Enter');
    expect((await puzzleOf(page)).selected).toBe('hyp');
    await focusTo(page, '.pz-slot[data-slot="s2"] .pz-slot-btn');
    await page.keyboard.press('Escape');
    let p = await puzzleOf(page);
    expect(p.selected).toBeNull();
    expect(await inside(page)).toBe(true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    p = await puzzleOf(page);
    expect([p.phase, p.selected, p.completed]).toEqual(['board', null, false]);
    expect((await stateOf(page)).shell.mode).toBe('minigame');
    expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
  });

  test('ending conclusion: Escape drops the held piece and Escape on the page does not close or skip the step', async ({ page }) => {
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    await focusTo(page, await pieceSel(page, 0));
    await page.keyboard.press('Enter');
    expect((await puzzleOf(page)).conclusion?.selected).toBe(0);
    await page.keyboard.press('Escape');
    const p = await puzzleOf(page);
    expect(p.conclusion?.selected).toBeNull();
    expect(p.phase).toBe('conclusion');
  });

  test('a held Enter on pieces and on a slot never double-places or breaks the board', async ({ page }) => {
    const m = monitor(page);
    await openSeeded(page, 'dec25', { phase: 'board' });
    await focusTo(page, '.pz-bank [data-piece="' + domPiece('dec25', 'hyp') + '"]');
    await page.keyboard.down('Enter');
    for (let i = 0; i < 25; i += 1) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
    await page.keyboard.press('Escape');
    await focusTo(page, '.pz-bank .pz-piece');
    await page.keyboard.press('Enter');
    await focusTo(page, '.pz-slot[data-slot="s1"] .pz-slot-btn');
    await page.keyboard.down('Enter');
    for (let i = 0; i < 25; i += 1) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    const p = await puzzleOf(page);
    expect(Object.values(p.board ?? {}).flat().length, 'one piece, one place').toBe(1);
    expect(await invariants(page, puzzleFile('dec25'))).toEqual([]);
    expect(m.pageErrors).toEqual([]);
  });

  test('screen readers: a placed piece is named in its slot, Enter on an empty slot says what to do first', async ({ page }) => {
    const file = puzzleFile('dec25');
    await openSeeded(page, 'dec25', { phase: 'board' });
    await focusTo(page, '.pz-slot[data-slot="s1"] .pz-slot-btn');
    await page.keyboard.press('Enter');
    await expect(page.locator('.pz .sr-only[aria-live]')).toContainText('Chọn một mảnh trước');
    await focusTo(page, '.pz-bank [data-piece="' + domPiece('dec25', 'hyp') + '"]');
    await page.keyboard.press('Enter');
    await focusTo(page, '.pz-slot[data-slot="s1"] .pz-slot-btn');
    await page.keyboard.press('Enter');
    await expect(page.locator('.pz .sr-only[aria-live]')).toContainText('Đã đặt');
    const label = await page.locator('.pz-slot[data-slot="s1"] .pz-slot-btn').getAttribute('aria-label');
    expect(label).toContain('Nấc 1');
    expect(label).toContain(file.tokens.find((t) => t.id === 'hyp')?.text ?? 'missing');
    const chip = await page.locator('.pz-chip[data-piece="' + domPiece('dec25', 'hyp') + '"]').getAttribute('aria-label');
    expect(chip).toContain('Nấc 1');
  });

  test('every control shows a visible focus indicator when reached by keyboard', async ({ page }) => {
    await openSeeded(page, 'ending', { phase: 'board' });
    const flat: string[] = [];
    await focusTo(page, '.pz summary');
    for (const sel of ['.pz summary', '.pz-slot-btn', '.pz-bank .pz-piece', '#pz-check', '#pz-hint']) {
      await focusTo(page, sel);
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        const bare = s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0;
        return { bare, shadow: s.boxShadow, outline: s.outline, tag: el.className };
      });
      if (ring.bare && (ring.shadow === 'none' || ring.shadow === '')) flat.push(sel + ' (' + ring.tag + ')');
    }
    expect(flat, 'controls with no outline and no ring on keyboard focus').toEqual([]);
  });
});
