import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LANDSCAPE } from './challenge-puzzle/helpers.ts';
import { isTouch } from './support/play.ts';
import { openPuzzle, press, puzzleOf, toBoard } from './support/puzzle.ts';

const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const;
const BOARDS = ['yule', 'bethlehem', 'saturnalia', 'dec25', 'caga-tio'] as const;
const SMALL = SIZES.filter((s) => s.height < 700);

async function boardOf(page: Page, info: TestInfo, id: string, size?: { width: number; height: number }): Promise<void> {
  if (size) await page.setViewportSize(size);
  await openPuzzle(page, id);
  await toBoard(page, info);
}

interface Probe {
  vw: number;
  vh: number;
  docOver: boolean;
  slots: { n: number; seen: number };
  pieces: { n: number; seen: number };
  check: { top: number; bottom: number } | null;
  hint: { top: number; bottom: number } | null;
  dock: { top: number; bottom: number; left: number; right: number } | null;
  bar: { top: number; bottom: number } | null;
  play: { top: number; bottom: number; height: number };
}

/** What the player sees without touching a scroll bar: an element counts as seen when all of it lies inside the window and every scrolling ancestor, and nothing covers its middle. */
const probe = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const clips = (el: Element): DOMRect[] => {
      const out: DOMRect[] = [];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.display !== 'contents' && /auto|scroll|hidden|clip/u.test(cs.overflowX + cs.overflowY)) out.push(p.getBoundingClientRect());
      }
      return out;
    };
    const seen = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (r.top < -0.5 || r.left < -0.5 || r.bottom > vh + 0.5 || r.right > vw + 0.5) return false;
      for (const c of clips(el)) if (r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5 || r.left < c.left - 0.5 || r.right > c.right + 0.5) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && el.contains(hit);
    };
    const box = (sel: string): DOMRect | null => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const slots = [...document.querySelectorAll('.pz-slot')];
    const pieces = [...document.querySelectorAll('.pz-bank .pz-piece')];
    let scroller: Element | null = slots[0]?.parentElement ?? null;
    while (scroller && !/auto|scroll/u.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const pr = scroller?.getBoundingClientRect() ?? new DOMRect();
    const doc = document.scrollingElement as HTMLElement;
    return {
      vw, vh,
      docOver: doc.scrollHeight > doc.clientHeight + 1 || doc.scrollWidth > doc.clientWidth + 1,
      slots: { n: slots.length, seen: slots.filter(seen).length },
      pieces: { n: pieces.length, seen: pieces.filter(seen).length },
      check: box('#pz-check'),
      hint: box('#pz-hint'),
      dock: box('.pz-dock'),
      bar: box('.pz-bar'),
      play: { top: pr.top, bottom: pr.bottom, height: scroller?.clientHeight ?? 0 },
    };
  });

/** The player has read the head and scrolls the board box once so the first slot sits at its top; nothing is scrolled after this. */
const reveal = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const first = document.querySelector('.pz-slot');
    let box: Element | null = first?.parentElement ?? null;
    while (box && !/auto|scroll/u.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    if (box && first) box.scrollTop += first.getBoundingClientRect().top - box.getBoundingClientRect().top - 6;
  });

/** The bar buttons, the dock and the playing area stack without a gap off screen and without covering each other. */
function expectStack(p: Probe, what: string): void {
  for (const [name, b] of [['Kiểm tra', p.check], ['Gợi ý', p.hint]] as const) {
    expect(b, what + ': ' + name + ' exists').not.toBeNull();
    expect(b!.top, what + ': ' + name + ' top').toBeGreaterThanOrEqual(0);
    expect(b!.bottom, what + ': ' + name + ' bottom ' + b!.bottom + ' in a window ' + p.vh + ' high').toBeLessThanOrEqual(p.vh + 0.5);
  }
  expect(p.dock, what + ': dock exists').not.toBeNull();
  expect(p.dock!.top, what + ': dock covers the playing area').toBeGreaterThanOrEqual(p.play.bottom - 1);
  expect(p.dock!.bottom, what + ': dock sits on the bar').toBeLessThanOrEqual(p.bar!.top + 1);
  expect(p.docOver, what + ': the page scrolls').toBe(false);
}

const tap = async (page: Page, info: TestInfo, x: number, y: number): Promise<void> => {
  if (isTouch(info)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
};

/** The centre of an element that must already be on screen: no scrolling is done to reach it. */
const centre = (page: Page, sel: string): Promise<{ x: number; y: number } | null> =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight && hit !== null && el.contains(hit) ? { x, y } : null;
  }, sel);

const scrollTops = (page: Page): Promise<number[]> =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.pz-scroll, .pz-board, .pz-bank, .pz-top')].map((e) => e.scrollTop));

const sheetState = (page: Page): Promise<{ open: boolean; shown: boolean }> =>
  page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.pz-dock');
    const ev = document.querySelector<HTMLElement>('.pz-evidence');
    return { open: dock?.getAttribute('aria-expanded') === 'true', shown: ev !== null && ev.getBoundingClientRect().height > 0 };
  });

/** Scrolled to each card in turn, the card fits inside the sheet and its text is not clipped. */
const sheetReads = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>('.pz-evidence');
    if (!sheet) return ['no sheet'];
    let holder: Element | null = sheet;
    while (holder && !/auto|scroll/u.test(getComputedStyle(holder).overflowY)) holder = holder.parentElement;
    const box = (holder ?? sheet).getBoundingClientRect();
    const out: string[] = [];
    for (const card of sheet.querySelectorAll<HTMLElement>('.pz-card')) {
      card.scrollIntoView({ block: 'start' });
      const r = card.getBoundingClientRect();
      if (r.top < box.top - 1 || r.bottom > box.bottom + 1) out.push((card.querySelector('.pz-no')?.textContent ?? '') + ' taller than the sheet');
      if (card.scrollWidth > card.clientWidth + 1) out.push(card.className + ' clipped');
    }
    return out;
  });

const smallTargets = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.pz button, .pz a, .pz summary')]
      .filter((b) => b.offsetParent !== null && !b.closest('[inert]'))
      .map((b) => ({ n: b.className || b.tagName, r: b.getBoundingClientRect() }))
      .filter((b) => b.r.height < 43.5 || b.r.width < 43.5)
      .map((b) => b.n + ' ' + Math.round(b.r.width) + 'x' + Math.round(b.r.height)),
  );

const hintAndWait = async (page: Page, info: TestInfo): Promise<void> => {
  await page.waitForTimeout(290);
  await press(page.locator('#pz-hint'), info);
  await page.waitForTimeout(60);
};

test.describe('puzzle player: portrait board layout', () => {
  for (const size of SIZES) {
    for (const id of BOARDS) {
      test('at ' + size.width + 'x' + size.height + ' the ' + id + ' board shows its slots and pieces together, with the buttons in the window', async ({ page }, info) => {
        await boardOf(page, info, id, size);
        await reveal(page);
        const p = await probe(page);
        const what = id + ' ' + size.width + 'x' + size.height + ' (slots ' + p.slots.seen + '/' + p.slots.n + ', pieces ' + p.pieces.seen + '/' + p.pieces.n + ')';
        if (size.height >= 800) {
          expect(p.pieces.seen, what + ': every piece is on screen').toBe(p.pieces.n);
          expect(p.slots.seen, what + ': every slot (up to 6) is on screen').toBeGreaterThanOrEqual(Math.min(p.slots.n, 6));
        } else {
          expect(p.slots.seen, what + ': slots on screen').toBeGreaterThanOrEqual(2);
          expect(p.pieces.seen, what + ': a row of pieces on screen').toBeGreaterThanOrEqual(2);
        }
        expectStack(p, what);
        expect(await smallTargets(page)).toEqual([]);
      });
    }
  }

  for (const size of SMALL) {
    for (const id of ['befana', 'nicholas', 'dec25', 'yule']) {
      test('at ' + size.width + 'x' + size.height + ' opening Luật chơi on ' + id + ' keeps the buttons in the window and the board in reach', async ({ page }, info) => {
        await boardOf(page, info, id, size);
        await press(page.locator('.pz-rules summary'), info);
        await expect(page.locator('.pz-rules')).toHaveAttribute('open', '');
        await page.waitForTimeout(150);
        const p = await probe(page);
        const what = id + ' rules open ' + size.width + 'x' + size.height;
        expectStack(p, what);
        expect(p.play.height, what + ': height left for the board').toBeGreaterThanOrEqual(150);
      });
    }
  }

  for (const size of SMALL) {
    for (const id of ['nicholas', 'dec25']) {
      test('at ' + size.width + 'x' + size.height + ' every hint rung on ' + id + ' leaves the bar in the window and the board at least 150 px high', async ({ page }, info) => {
        await boardOf(page, info, id, size);
        for (let rung = 1; rung <= 3; rung += 1) {
          await hintAndWait(page, info);
          const p = await probe(page);
          const what = id + ' hint ' + rung + ' ' + size.width + 'x' + size.height;
          expectStack(p, what);
          expect(p.play.height, what + ': height left for the board').toBeGreaterThanOrEqual(150);
        }
      });
    }
  }

  for (const size of SIZES) {
    test('at ' + size.width + 'x' + size.height + ' a piece places and every card reads with zero page scroll', async ({ page }, info) => {
      await boardOf(page, info, 'dec25', size);
      await reveal(page);
      const slotId = await page.locator('.pz-slot').first().getAttribute('data-slot');
      const piece = await page.evaluate(() => {
        for (const el of document.querySelectorAll('.pz-bank .pz-piece')) {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (r.top >= 0 && r.bottom <= innerHeight && hit !== null && el.contains(hit)) return el.getAttribute('data-piece');
        }
        return null;
      });
      expect(piece, 'a piece is on screen').not.toBeNull();
      const from = await centre(page, '.pz-bank .pz-piece[data-piece="' + piece + '"]');
      const to = await centre(page, '.pz-slot[data-slot="' + slotId + '"] .pz-slot-btn');
      expect(from, 'the piece is on screen').not.toBeNull();
      expect(to, 'the first slot is on screen').not.toBeNull();
      await tap(page, info, from!.x, from!.y);
      await tap(page, info, to!.x, to!.y);
      expect((await puzzleOf(page)).board?.[slotId as string]).toHaveLength(1);
      expect((await probe(page)).docOver).toBe(false);

      await page.waitForTimeout(290);
      await press(page.locator('.pz-dock'), info);
      await expect(page.locator('.pz-evidence')).toBeVisible();
      expect(await sheetState(page)).toEqual({ open: true, shown: true });
      expect(await sheetReads(page), 'a card does not fit the sheet').toEqual([]);
      expect((await probe(page)).docOver, 'the page scrolls while the sheet is open').toBe(false);
      expect(await smallTargets(page)).toEqual([]);

      await page.waitForTimeout(290);
      await press(page.locator('.pz-dock'), info);
      await expect(page.locator('.pz-evidence')).toBeHidden();
      expect((await puzzleOf(page)).board?.[slotId as string]).toHaveLength(1);
      expect((await probe(page)).docOver).toBe(false);
    });
  }
});

test.describe('puzzle player: the evidence sheet', () => {
  test.beforeEach(async ({ page }, info) => {
    await boardOf(page, info, 'dec25', { width: 390, height: 844 });
  });

  test('a hint rung that points at a card opens the sheet on it', async ({ page }, info) => {
    await hintAndWait(page, info);
    expect((await sheetState(page)).open, 'rung 1 points at no card').toBe(false);
    await hintAndWait(page, info);
    expect((await puzzleOf(page)).pointed.length).toBeGreaterThan(0);
    expect(await sheetState(page)).toEqual({ open: true, shown: true });
    const onPoint = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('.pz-card[data-pointed="true"]');
      const sheet = document.querySelector<HTMLElement>('.pz-evidence');
      if (!card || !sheet) return false;
      const c = card.getBoundingClientRect();
      const s = sheet.getBoundingClientRect();
      return c.top >= s.top - 1 && c.bottom <= s.bottom + 1;
    });
    expect(onPoint, 'the pointed card is out of the sheet view').toBe(true);
  });
});

test.describe('puzzle player: landscape stays as it was', () => {
  test('landscape keeps the two columns and hides the dock', async ({ page }, info) => {
    await boardOf(page, info, 'dec25', { width: LANDSCAPE.width, height: LANDSCAPE.height });
    await expect(page.locator('.pz-dock')).toBeHidden();
    await expect(page.locator('.pz-evidence')).toBeVisible();
    const side = await page.evaluate(() => {
      const l = document.querySelector<HTMLElement>('.pz-left')?.getBoundingClientRect();
      const r = document.querySelector<HTMLElement>('.pz-right')?.getBoundingClientRect();
      return l !== undefined && r !== undefined && r.left >= l.right - 1;
    });
    expect(side, 'board column is not beside the evidence column').toBe(true);
    expect((await probe(page)).docOver).toBe(false);
  });
});
