import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { makeCode } from '../../src/code.ts';
import { ORDER, indexOf } from '../../src/order.ts';
import { advanceStory, SAVE_KEY, seedSave, stateOf, typeName, waitReady } from '../support/play.ts';
import { chapterOf } from '../support/script.ts';

test.describe.configure({ timeout: 150_000 });

/** Chapter 5 after its puzzle: the next chapter (dec25) is the one fetched ahead. */
const AFTER_PUZZLE = { schemaVersion: 1, name: 'Lan', furthest: 'bethlehem', chapter: 'bethlehem', scene: 'mang-co' };
const NEXT_CHUNK = '**/assets/chapter-dec25-*.js';
const NEXT_BG = /\/assets\/bg-ch6-vault-(portrait|landscape)-[^/]+\.webp$/;
const NOISE = /Failed to load resource|MIME type|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Refused to apply a stylesheet/i;

type Mode = 'hold' | 'pass' | 'abort' | 'abort-once';

interface Gate {
  hits: () => number;
  held: () => number;
  /** Lets every held request through and passes the rest. */
  release: () => Promise<void>;
  /** Aborts every held request, then passes the rest. */
  failHeld: () => Promise<void>;
  set: (mode: Mode) => void;
}

function gate(page: Page, pattern: string | RegExp, initial: Mode): Gate {
  let mode = initial;
  let hits = 0;
  let held: Route[] = [];
  void page.route(pattern, async (route) => {
    hits += 1;
    if (mode === 'hold') {
      held.push(route);
      return;
    }
    if (mode === 'abort' || (mode === 'abort-once' && hits === 1)) return route.abort('connectionreset').catch(() => undefined);
    return route.continue().catch(() => undefined);
  });
  const drain = async (how: 'continue' | 'abort'): Promise<void> => {
    mode = 'pass';
    const routes = held;
    held = [];
    for (const route of routes) await (how === 'abort' ? route.abort('connectionreset') : route.continue()).catch(() => undefined);
  };
  return { hits: () => hits, held: () => held.length, release: () => drain('continue'), failHeld: () => drain('abort'), set: (m) => (mode = m) };
}

interface Watch {
  errors: string[];
  loads: () => number;
  requests: string[];
}

function watch(page: Page): Watch {
  const errors: string[] = [];
  const requests: string[] = [];
  let loads = 0;
  page.on('domcontentloaded', () => (loads += 1));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text());
  });
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  return { errors, requests, loads: () => loads };
}

const netError = (page: Page): Promise<boolean> => page.locator('#net-error').isVisible().catch(() => false);

async function open(page: Page, save: object, size?: { width: number; height: number }): Promise<void> {
  if (size) await page.setViewportSize(size);
  await seedSave(page, save);
  await page.goto('/');
  await waitReady(page);
}

/** Plays forward with taps until the card screen has its content, the page shows the network message, or the budget is gone. */
async function reachCard(page: Page, info: TestInfo, budget = 140): Promise<void> {
  for (let i = 0; i < budget; i += 1) {
    const s = await stateOf(page).catch(() => null);
    if (!s) {
      await page.waitForTimeout(100);
      continue;
    }
    if (s.shell.phase === 'network-error') return;
    const filled = await page.locator('#card-slot').evaluate((el) => el.childElementCount > 0).catch(() => false);
    if (s.shell.mode === 'card' && filled) return;
    if (s.shell.mode === 'card' || s.shell.mode === 'loading' || s.shell.phase === 'loading') {
      await page.waitForTimeout(100);
      continue;
    }
    try {
      if (s.story?.asking) await typeName(page, 'Lan');
      else await advanceStory(page, info);
    } catch {
      await page.waitForTimeout(100);
    }
  }
}

/** describe() names the target chapter as soon as it is entered, while the screen still says loading, so "on screen" needs the mode too. */
const inStory = async (page: Page, chapter: string): Promise<boolean> => {
  const s = await stateOf(page).catch(() => null);
  return s?.shell.mode === 'story' && s.story?.chapter === chapter;
};

const cardFilled = (page: Page): Promise<boolean> => page.locator('#card-slot').evaluate((el) => el.childElementCount > 0).catch(() => false);

async function hold(page: Page, g: Gate): Promise<void> {
  await expect.poll(() => g.held(), { message: 'the next chapter chunk is requested by the preload', timeout: 15_000 }).toBeGreaterThan(0);
}

async function menu(page: Page, id: 'menu-new' | 'menu-code'): Promise<void> {
  await page.locator('#menu-open').click();
  await expect(page.locator('#menu')).toHaveJSProperty('open', true);
  await page.locator('#' + id).click();
}

test.describe('preload next: reload, reset, edges', () => {
  test('reload while the next chapter request is still in flight: one clean reload, no _r flag, no message, scene restarts, preload runs again', async ({ page }) => {
    const w = watch(page);
    const g = gate(page, NEXT_CHUNK, 'hold');
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    await page.reload();
    await waitReady(page);
    expect(await netError(page), 'network message after a reload during the preload').toBe(false);
    expect(new URL(page.url()).searchParams.has('_r'), '_r flag left in the URL').toBe(false);
    expect(w.loads()).toBe(2);
    expect((await stateOf(page)).story?.scene).toBe('mang-co');
    await expect.poll(() => g.held(), { timeout: 15_000 }).toBeGreaterThan(1);
    await g.release();
    expect(w.errors).toEqual([]);
  });

  test('reload at the same moment the in-flight preload request fails: the failure is not taken for a broken page (no second reload, no message)', async ({ page }) => {
    const w = watch(page);
    const g = gate(page, NEXT_CHUNK, 'hold');
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    g.set('pass');
    await Promise.all([page.reload(), g.failHeld()]);
    await waitReady(page);
    await page.waitForTimeout(2500);
    expect(await netError(page)).toBe(false);
    expect(w.loads(), 'document loads: the original and one reload').toBe(2);
    expect(new URL(page.url()).searchParams.has('_r')).toBe(false);
    expect(w.errors).toEqual([]);
  });

  test('new game while the preload is in flight: the new session starts at the intro, and the old preload does not fetch backdrops after the reset', async ({ page }) => {
    const w = watch(page);
    const g = gate(page, NEXT_CHUNK, 'hold');
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    await menu(page, 'menu-new');
    await page.locator('#confirm-new-yes').click();
    await expect.poll(() => inStory(page, 'intro')).toBe(true);
    await g.release();
    await page.waitForTimeout(3000);
    const s = await stateOf(page);
    expect(s.story?.chapter).toBe('intro');
    expect(s.story?.bg?.id, 'the backdrop of the new session is untouched').not.toBe('kho-lich-roma');
    expect(await netError(page)).toBe(false);
    expect(w.requests.filter((u) => NEXT_BG.test(u)), 'backdrops of a chapter the abandoned session was heading to are fetched after the reset').toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('continue code entered while the preload is in flight: lands on the code chapter, and the late preload fetches no backdrops for the abandoned chapter', async ({ page }) => {
    const w = watch(page);
    const g = gate(page, NEXT_CHUNK, 'hold');
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    await menu(page, 'menu-code');
    await page.locator('#code-input').fill(makeCode({ name: 'Lan', chapter: 'nicholas', furthest: 'nicholas' }));
    await page.locator('#code-use').click();
    await expect.poll(() => inStory(page, 'nicholas')).toBe(true);
    await g.release();
    await page.waitForTimeout(3000);
    expect((await stateOf(page)).story?.chapter).toBe('nicholas');
    expect(w.requests.filter((u) => NEXT_BG.test(u)), 'backdrops of a chapter the code skipped past are fetched after the jump').toEqual([]);
    expect(await netError(page)).toBe(false);
    expect(w.errors).toEqual([]);
  });

  test('last chapter: nothing is fetched ahead, the end flow stays clean', async ({ page }) => {
    const w = watch(page);
    await open(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' });
    await page.waitForTimeout(3500);
    const chunks = w.requests.filter((u) => /\/assets\/chapter-[^/]+\.js$/.test(u));
    expect(chunks, 'chapter chunks requested on the last chapter').toEqual([expect.stringContaining('chapter-ending-')]);
    expect(w.requests.filter((u) => /\/assets\/bg-/.test(u) && !/bg-ch\d+-/.test(u))).toEqual([]);
    expect((await stateOf(page)).story?.chapter).toBe('ending');
    expect(await netError(page)).toBe(false);
    expect(w.errors).toEqual([]);
  });

});

test.describe('preload next: network failures', () => {
  test('the preloaded chunk fails once: nothing is shown, no reload, and Lật trang still loads the chapter', async ({ page }, info) => {
    const w = watch(page);
    const g = gate(page, NEXT_CHUNK, 'abort-once');
    await open(page, AFTER_PUZZLE);
    await expect.poll(() => g.hits(), { timeout: 15_000 }).toBeGreaterThan(0);
    await reachCard(page, info);
    expect(await netError(page), 'network message while only a speculative fetch failed').toBe(false);
    expect(w.loads(), 'reload caused by a speculative fetch').toBe(1);
    await page.locator('#card-next').click();
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    expect(await netError(page)).toBe(false);
    expect(w.loads()).toBe(1);
    expect(w.errors).toEqual([]);
  });

  test('the preloaded chunk keeps failing: Lật trang ends in a reload or the network message, never a silent loading screen', async ({ page }, info) => {
    const g = gate(page, NEXT_CHUNK, 'abort');
    const w = watch(page);
    await open(page, AFTER_PUZZLE);
    await expect.poll(() => g.hits(), { timeout: 15_000 }).toBeGreaterThan(0);
    await reachCard(page, info);
    expect(w.loads()).toBe(1);
    await page.locator('#card-next').click();
    await expect
      .poll(async () => (await netError(page)) || w.loads() > 1, { timeout: 12_000, message: 'neither the network message nor a reload after the chapter chunk failed' })
      .toBe(true);
  });

  test('Lật trang pressed while the preload is still in flight, then the chunk fails: the player is not left on a silent loading screen', async ({ page }, info) => {
    const g = gate(page, NEXT_CHUNK, 'hold');
    const w = watch(page);
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    await reachCard(page, info);
    expect(await cardFilled(page)).toBe(true);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('loading');
    await g.failHeld();
    await expect
      .poll(async () => (await netError(page)) || w.loads() > 1 || (await inStory(page, 'dec25')), {
        timeout: 12_000,
        message: 'mode stays "loading" with no message and no reload',
      })
      .toBe(true);
  });

  test('Lật trang pressed while the preload is still in flight, then the chunk arrives: the next chapter opens once', async ({ page }, info) => {
    const g = gate(page, NEXT_CHUNK, 'hold');
    const w = watch(page);
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    await reachCard(page, info);
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('loading');
    await g.release();
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    expect((await stateOf(page)).shell.mode).toBe('story');
    expect(w.loads()).toBe(1);
    expect(w.errors).toEqual([]);
  });

  test('a different chunk (screens, for the card) fails while the preload is in flight: the card still comes up or the player is told', async ({ page }, info) => {
    const g = gate(page, NEXT_CHUNK, 'hold');
    const screens = gate(page, '**/assets/screens-*.js', 'abort-once');
    const w = watch(page);
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    await reachCard(page, info);
    const state = await stateOf(page).catch(() => null);
    const told = await netError(page);
    const filled = await cardFilled(page);
    expect(filled || told, 'mode=' + state?.shell.mode + ' screens requests=' + screens.hits() + ' loads=' + w.loads() + ' errors=' + JSON.stringify(w.errors) + ': the card screen is empty and nothing tells the player').toBe(true);
  });

  test('a different chunk (notebook, the card text) fails while the preload is in flight: the card still comes up or the player is told', async ({ page }, info) => {
    const g = gate(page, NEXT_CHUNK, 'hold');
    const notebook = gate(page, '**/assets/notebook-*.js', 'abort-once');
    const w = watch(page);
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    await reachCard(page, info);
    expect(notebook.hits(), 'the notebook chunk is requested for the card').toBeGreaterThan(0);
    const state = await stateOf(page).catch(() => null);
    const told = await netError(page);
    const filled = await cardFilled(page);
    expect(filled || told, 'mode=' + state?.shell.mode + ' notebook requests=' + notebook.hits() + ' loads=' + w.loads() + ' errors=' + JSON.stringify(w.errors) + ': the card screen is empty and nothing tells the player').toBe(true);
  });

  test('a different chunk (shell, the Menu button) fails while the preload is in flight: the Menu opens later or the player is told', async ({ page }) => {
    const g = gate(page, NEXT_CHUNK, 'hold');
    const shell = gate(page, '**/assets/shell-*.js', 'abort-once');
    const w = watch(page);
    await open(page, AFTER_PUZZLE);
    await hold(page, g);
    let opened = false;
    for (let i = 0; i < 12 && !opened; i += 1) {
      await page.locator('#menu-open').click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      opened = await page.locator('#menu').evaluate((el) => (el as HTMLDialogElement).open).catch(() => false);
      if (!opened && (await netError(page))) break;
    }
    const told = await netError(page);
    expect(opened || told, 'shell chunk requests=' + shell.hits() + ' loads=' + w.loads() + ' errors=' + JSON.stringify(w.errors) + ': Menu is dead and nothing tells the player').toBe(true);
  });
});

test.describe('preload next: orientation, backdrops, rapid taps', () => {
  test('rotating to landscape after the portrait backdrops were preloaded: the next chapter shows its landscape backdrop, decoded', async ({ page }, info) => {
    const w = watch(page);
    await open(page, AFTER_PUZZLE, { width: 390, height: 844 });
    await expect.poll(() => w.requests.some((u) => /bg-ch6-vault-portrait/.test(u)), { timeout: 15_000 }).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await reachCard(page, info);
    await page.locator('#card-next').click();
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    await expect
      .poll(() => page.locator('#backdrop-portrait').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.currentSrc.includes('-landscape-')), { timeout: 8000, message: 'landscape backdrop of the new chapter drawn' })
      .toBe(true);
    expect(await netError(page)).toBe(false);
    expect(w.errors).toEqual([]);
  });

  test('rotating to landscape and back before the chapter ends: the portrait backdrop is still the one on screen and decoded', async ({ page }, info) => {
    await open(page, AFTER_PUZZLE, { width: 390, height: 844 });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 390, height: 844 });
    await reachCard(page, info);
    await page.locator('#card-next').click();
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    await expect
      .poll(() => page.locator('#backdrop-portrait').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.currentSrc.includes('-portrait-')), { timeout: 8000 })
      .toBe(true);
  });

  test('the preloaded backdrop request fails once: the chapter still draws its backdrop after Lật trang', async ({ page }, info) => {
    const bg = gate(page, NEXT_BG, 'abort-once');
    await open(page, AFTER_PUZZLE);
    await expect.poll(() => bg.hits(), { timeout: 15_000 }).toBeGreaterThan(0);
    await reachCard(page, info);
    await page.locator('#card-next').click();
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    await expect.poll(() => page.locator('#backdrop-portrait').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 8000, message: 'backdrop never drawn after the preload request failed' }).toBe(true);
    expect(await netError(page)).toBe(false);
  });

  test('rapid Lật trang on the card (six clicks in one burst): the chapter is entered once, its first lines are not skipped', async ({ page }, info) => {
    const g = gate(page, NEXT_CHUNK, 'pass');
    const w = watch(page);
    await open(page, AFTER_PUZZLE);
    await expect.poll(() => g.hits(), { timeout: 15_000 }).toBeGreaterThan(0);
    await reachCard(page, info);
    await page.locator('#card-next').click({ clickCount: 6, delay: 0 });
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    await page.waitForTimeout(600);
    const s = (await stateOf(page)).story!;
    expect(s.scene, 'first scene of the chapter').toBe('kho-lich');
    expect(s.lineIndex, 'lines advanced by the burst').toBeLessThanOrEqual(1);
    expect(w.requests.filter((u) => /chapter-dec25-/.test(u)).length, 'chapter chunk requests').toBeLessThanOrEqual(2);
    expect(w.errors).toEqual([]);
  });

  test('keyboard burst on Lật trang across the chapter boundary: no line is skipped faster than the cooldown allows, no stuck state', async ({ page }, info) => {
    await open(page, AFTER_PUZZLE);
    await reachCard(page, info);
    await page.locator('#card-next').focus();
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Enter', { delay: 0 });
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    const s = (await stateOf(page)).story!;
    expect(s.mode).toBe('story');
    expect(s.scene).toBe('kho-lich');
    expect(s.lineIndex ?? 0, 'lines consumed by a 12-press burst').toBeLessThanOrEqual(4);
  });

  test('save written once the chapter changed names the new chapter and survives a reload', async ({ page }, info) => {
    await open(page, AFTER_PUZZLE);
    await reachCard(page, info);
    await page.locator('#card-next').click();
    await expect.poll(() => inStory(page, 'dec25'), { timeout: 15_000, message: 'dec25 on screen in story mode' }).toBe(true);
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)) as string)).toMatchObject({ chapter: 'dec25', scene: 'kho-lich', furthest: 'dec25' });
    await page.reload();
    await waitReady(page);
    expect((await stateOf(page)).story?.chapter).toBe('dec25');
  });
});
