import { expect, test, type Page } from '@playwright/test';
import { reply } from '../../scripts/puzzles.mjs';
import { cool, domClick, LANDSCAPE, openSeeded, placeAll, puzzleFile, puzzleOf, SMALL, type Cell } from './helpers.ts';

interface Audit {
  overflow: string[];
  small: string[];
  covered: string[];
  bar: string[];
  feedbackClipped: string[];
}

/** One look at the puzzle on screen: sideways overflow, targets under 44 px, controls another element sits on, the bar's own fit. */
const audit = (page: Page, label: string): Promise<Audit> =>
  page.evaluate((where) => {
    const out: Audit = { overflow: [], small: [], covered: [], bar: [], feedbackClipped: [] };
    const name = (el: Element): string => where + ' ' + el.tagName.toLowerCase() + '.' + (el.className || '') + (el.textContent ? ' "' + el.textContent.trim().slice(0, 24) + '"' : '');
    const doc = document.scrollingElement as HTMLElement;
    if (doc.scrollWidth > doc.clientWidth) out.overflow.push(where + ' document ' + doc.scrollWidth + ' > ' + doc.clientWidth);
    for (const el of document.querySelectorAll<HTMLElement>('.pz, .pz-scroll, .pz-left, .pz-right, .pz-bar, .pz-board, .pz-conclusion')) if (el.scrollWidth > el.clientWidth + 1) out.overflow.push(name(el) + ' scrollWidth ' + el.scrollWidth + ' > ' + el.clientWidth);
    for (const el of document.querySelectorAll<HTMLElement>('.pz *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)) out.overflow.push(name(el) + ' spans ' + Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + innerWidth);
    }
    const controls = [...document.querySelectorAll<HTMLElement>('.pz button, .pz summary, .pz a[href]')].filter((e) => e.offsetParent !== null && !(e as HTMLButtonElement).disabled);
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) out.small.push(name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    for (const el of controls) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const top = document.elementFromPoint(x, y);
      if (!top || !(el === top || el.contains(top) || top.contains(el))) out.covered.push(name(el) + ' is under ' + (top ? top.tagName.toLowerCase() + '.' + top.className + '#' + top.id : 'nothing'));
    }
    const bar = document.querySelector<HTMLElement>('.pz-bar');
    if (bar && !bar.hidden) {
      const b = bar.getBoundingClientRect();
      if (b.bottom > innerHeight + 1) out.bar.push(where + ' bar bottom ' + Math.round(b.bottom) + ' > ' + innerHeight);
      for (const btn of bar.querySelectorAll<HTMLElement>('button')) {
        const r = btn.getBoundingClientRect();
        if (r.bottom > b.bottom + 1 || r.top < b.top - 1 || r.right > innerWidth + 1) out.bar.push(name(btn) + ' leaves the bar');
      }
      if (bar.scrollHeight > bar.clientHeight + 1) out.bar.push(where + ' bar content ' + bar.scrollHeight + ' > ' + bar.clientHeight);
      const msgs = bar.querySelector<HTMLElement>('.pz-msgs');
      if (msgs && msgs.scrollHeight > msgs.clientHeight + 1) out.feedbackClipped.push(where + ' feedback ' + msgs.scrollHeight + ' > ' + msgs.clientHeight + ': ' + (msgs.textContent ?? '').slice(0, 60));
    }
    return out;
  }, label);

const merge = (into: Audit, a: Audit): void => {
  for (const k of Object.keys(into) as (keyof Audit)[]) into[k].push(...a[k]);
};

const wrongBoard = (id: string): Cell[] => {
  const file = puzzleFile(id);
  const rows: Cell[][] = [];
  const T = file.tokens.length;
  const n = file.slots.length;
  const cap = file.slots.map((s) => (s.cap === 'any' ? T : typeof s.cap === 'number' ? s.cap : 1));
  for (let seed = 0; seed < 4000 && rows.length === 0; seed += 1) {
    let x = seed * 2654435761 + 7;
    const cells: string[][] = file.slots.map(() => []);
    for (const t of file.tokens) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      const s = x % (n + 1);
      if (s < n && (cells[s] as string[]).length < (cap[s] as number)) (cells[s] as string[]).push(t.id);
    }
    const r = reply(file, cells, new Set());
    if (r.type === 'wrong' && cells.flat().length >= Math.min(T, n + 2)) rows.push(cells);
  }
  return rows[0] ?? file.slots.map(() => null);
};

type Stage = 'predict' | 'demo' | 'board' | 'busy' | 'reveal' | 'conclusion' | 'busy-conclusion' | 'verdict';

async function reach(page: Page, id: string, stage: Stage, settings: object): Promise<boolean> {
  const file = puzzleFile(id);
  if (stage === 'demo' && !file.demo) return false;
  if ((stage === 'conclusion' || stage === 'busy-conclusion' || stage === 'verdict') && !file.conclusion) return false;
  const hint = 'Gợi ý 3/5: ' + (file.hints[2] as { text: string }).text;
  if (stage === 'predict') await openSeeded(page, id, null, settings);
  else if (stage === 'board' || stage === 'demo') await openSeeded(page, id, { phase: stage }, settings);
  else if (stage === 'reveal') await openSeeded(page, id, { phase: 'reveal', predicted: 0 }, settings);
  else if (stage === 'busy') {
    await openSeeded(page, id, { phase: 'board', opened: 3, hint, wrongRun: 2, wrongTotal: 2, checks: 2 }, settings);
    await placeAll(page, file, wrongBoard(id));
    await cool(page);
    await domClick(page, '#pz-check');
  } else if (stage === 'conclusion') await openSeeded(page, id, { phase: 'conclusion' }, settings);
  else if (stage === 'busy-conclusion') {
    await openSeeded(page, id, { phase: 'conclusion', fills: [0, 1, 2, 3, 4, 5], wrongRun: 2, opened: 1, hint: 'Gợi ý 1/3: ' + 'Câu hỏi: mỗi chỗ trống nhận một mảnh.' }, settings);
    await cool(page);
    await domClick(page, '#pz-check');
  } else {
    await openSeeded(page, id, { phase: 'conclusion' }, settings);
    for (let i = 0; i < 3; i += 1) {
      await cool(page);
      await domClick(page, '#pz-hint');
    }
  }
  await page.waitForTimeout(80);
  return true;
}

const STAGES: Stage[] = ['predict', 'demo', 'board', 'busy', 'reveal', 'conclusion', 'busy-conclusion', 'verdict'];
const IDS = ['intro', 'dec25', 'ending'];
const UPCOMING = ['saturnalia', 'yule'];

for (const [sizeName, size] of [['320x568', SMALL], ['844x390', LANDSCAPE]] as const) {
  for (const scale of ['normal', 'xlarge'] as const) {
    test(sizeName + ' at text size ' + scale + ': no sideways scroll, every control ≥ 44 px and reachable, the bar holds its buttons', async ({ page }) => {
      await page.setViewportSize(size);
      const all: Audit = { overflow: [], small: [], covered: [], bar: [], feedbackClipped: [] };
      for (const id of IDS) {
        for (const stage of STAGES) {
          if (!(await reach(page, id, stage, { fontSize: scale }))) continue;
          merge(all, await audit(page, id + '/' + stage));
        }
      }
      const uniq = (xs: string[]): string[] => [...new Set(xs)].slice(0, 12);
      expect.soft(uniq(all.overflow), 'sideways overflow').toEqual([]);
      expect.soft(uniq(all.small), 'targets under 44 px').toEqual([]);
      expect.soft(uniq(all.covered), 'controls covered by something else').toEqual([]);
      expect.soft(uniq(all.bar), 'the bar does not hold its buttons').toEqual([]);
    });

    test(sizeName + ' at text size ' + scale + ': the verdict and the nudge are readable without scrolling inside the bar', async ({ page }) => {
      await page.setViewportSize(size);
      const clipped: string[] = [];
      for (const id of IDS) {
        for (const stage of ['busy', 'busy-conclusion'] as const) {
          if (!(await reach(page, id, stage, { fontSize: scale }))) continue;
          const p = await puzzleOf(page);
          expect(p.nudge || p.verdict !== '', id + '/' + stage + ' has feedback').toBe(true);
          clipped.push(...(await audit(page, id + '/' + stage)).feedbackClipped);
        }
      }
      expect([...new Set(clipped)]).toEqual([]);
    });
  }
}

for (const [sizeName, size] of [['320x568', SMALL], ['844x390', LANDSCAPE]] as const) {
  test('upcoming puzzles (saturnalia, yule; preview only) at ' + sizeName + ': no sideways scroll, every control ≥ 44 px and reachable', async ({ page }) => {
    await page.setViewportSize(size);
    const all: Audit = { overflow: [], small: [], covered: [], bar: [], feedbackClipped: [] };
    for (const id of UPCOMING) {
      for (const stage of ['predict', 'board', 'busy', 'reveal'] as const) {
        if (!(await reach(page, id, stage, {}))) continue;
        merge(all, await audit(page, id + '/' + stage));
      }
    }
    const uniq = (xs: string[]): string[] => [...new Set(xs)].slice(0, 12);
    expect.soft(uniq(all.overflow), 'sideways overflow').toEqual([]);
    expect.soft(uniq(all.small), 'targets under 44 px').toEqual([]);
    expect.soft(uniq(all.covered), 'controls covered by something else').toEqual([]);
    expect.soft(uniq(all.bar), 'the bar does not hold its buttons').toEqual([]);
  });
}

test.describe('reduced motion', () => {
  const moving = (page: Page): Promise<string[]> =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.pz, .pz *')]
        .filter((e) => {
          const s = getComputedStyle(e);
          const long = (v: string): boolean => v.split(',').some((d) => parseFloat(d) > 0.01);
          return long(s.transitionDuration) || (s.animationName !== 'none' && long(s.animationDuration)) || s.scrollBehavior === 'smooth';
        })
        .map((e) => e.className),
    );

  for (const stage of ['predict', 'board', 'busy', 'reveal', 'conclusion', 'verdict'] as const) {
    test('the device asks for less motion: nothing moves in the ' + stage + ' step of the ending, stamps included', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await reach(page, 'ending', stage, {});
      expect(await moving(page)).toEqual([]);
    });

    test('the player turns reduced motion on in Settings while the device does not: nothing moves in the ' + stage + ' step', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await reach(page, 'ending', stage, { reducedMotion: true });
      expect(await page.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe('true');
      expect(await moving(page)).toEqual([]);
    });
  }

  test('pointing at a card by a hint scrolls without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(SMALL);
    await openSeeded(page, 'dec25', { phase: 'board' });
    await cool(page);
    await domClick(page, '#pz-hint');
    await cool(page);
    await domClick(page, '#pz-hint');
    const smooth = await page.evaluate(() => [document.documentElement, ...document.querySelectorAll<HTMLElement>('.pz-scroll, .pz-left, .pz-right')].map((e) => getComputedStyle(e).scrollBehavior).filter((b) => b === 'smooth'));
    expect(smooth).toEqual([]);
  });
});
