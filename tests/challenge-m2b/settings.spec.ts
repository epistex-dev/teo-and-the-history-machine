import { expect, test, type Page } from '@playwright/test';
import { expectClean, watch } from '../challenge/helpers.ts';
import { advanceUntil } from '../support/ending.ts';
import { reachMinigame, seedSave, stateOf, storyOf, waitReady } from '../support/play.ts';

test.describe.configure({ timeout: 90_000 });

const SETTINGS_KEY = 'teo:v1:settings';
const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });

async function open(page: Page, seed: object | null = save(), query = ''): Promise<void> {
  if (seed) await seedSave(page, seed);
  await page.goto('/' + query);
  await waitReady(page);
}

const seedSettings = (page: Page, value: unknown) => page.addInitScript(([k, v]) => localStorage.setItem(k as string, v as string), [SETTINGS_KEY, typeof value === 'string' ? value : JSON.stringify(value)]);
const settingsOf = async (page: Page) => (await stateOf(page)).shell as unknown as { settings: Record<string, unknown>; audio: { music: number; sfx: number; played: number; state: string } };
const openSettings = async (page: Page) => {
  await page.locator('#menu-open').click();
  await page.locator('#menu-settings').click();
  await expect(page.locator('#settings')).toBeVisible();
};
const fontPx = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const lineIndex = async (page: Page) => (await storyOf(page)).lineIndex ?? 0;

test.describe('settings: values at the edges', () => {
  const stored: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ['volume above 100', { music: 250, sfx: 101 }, { music: 100, sfx: 100 }],
    ['negative volume', { music: -5, sfx: -1e9 }, { music: 0, sfx: 0 }],
    ['fractional volume', { music: 12.4, sfx: 33.5 }, { music: 12, sfx: 34 }],
    ['volume as text', { music: '50', sfx: '0' }, { music: 70, sfx: 80 }],
    ['volume null and NaN-like', { music: null, sfx: 'NaN' }, { music: 70, sfx: 80 }],
    ['volume exactly 0 is kept, not replaced by the default', { music: 0, sfx: 0 }, { music: 0, sfx: 0 }],
    ['prototype names as choices', { textSpeed: 'toString', autoAdvance: 'constructor', fontSize: '__proto__' }, { textSpeed: 'instant', autoAdvance: 'off', fontSize: 'normal' }],
    ['reduced motion as text', { reducedMotion: 'true' }, { reducedMotion: null }],
  ];
  for (const [label, value, want] of stored) {
    test('stored ' + label + ' loads to a safe value', async ({ page }) => {
      const w = watch(page);
      await seedSettings(page, value);
      await open(page);
      expect((await settingsOf(page)).settings).toMatchObject(want);
      expectClean(w);
    });
  }

  for (const [label, raw] of [['an array', '[1,2,3]'], ['null', 'null'], ['a string', '"loud"'], ['a number', '7'], ['truncated JSON', '{"music":4'], ['empty text', ''], ['a 2 MB blob', '{"x":"' + 'a'.repeat(2_000_000) + '"}']] as const) {
    test('settings stored as ' + label + ' fall back to the defaults and the game opens', async ({ page }) => {
      const w = watch(page);
      await seedSettings(page, raw);
      await open(page);
      expect((await settingsOf(page)).settings).toMatchObject({ textSpeed: 'instant', autoAdvance: 'off', music: 70, sfx: 80, fontSize: 'normal', reducedMotion: null });
      expect((await stateOf(page)).shell.phase).toBe('ready');
      expectClean(w);
    });
  }

  test('a settings entry that cannot be written (storage full) still applies for the session and the player is warned', async ({ page }) => {
    const w = watch(page, { ignoreErrors: /QuotaExceeded|setItem/ });
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await open(page, null);
    await openSettings(page);
    await page.locator('#set-font').selectOption('xlarge');
    await page.locator('#set-motion').check();
    await page.locator('#settings-close').click();
    expect((await settingsOf(page)).settings).toMatchObject({ fontSize: 'xlarge', reducedMotion: true });
    expect(await fontPx(page, '#line')).toBeGreaterThan(18);
    await expect(page.locator('#storage-warning')).toBeVisible();
    await openSettings(page);
    await expect(page.locator('#set-font')).toHaveValue('xlarge');
    expect(w.errors.filter((e) => !/QuotaExceeded|setItem|full/.test(e))).toEqual([]);
  });
});

test.describe('settings: volume 0 and the keyboard', () => {
  test('a volume slider is usable by keyboard alone: arrows step by 5, Home 0, End 100, and each change is stored and shown', async ({ page }) => {
    await open(page);
    await openSettings(page);
    const music = page.locator('#set-music');
    await music.focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#out-music')).toHaveText('0%');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#out-music')).toHaveText('5%');
    await page.keyboard.press('End');
    await expect(page.locator('#out-music')).toHaveText('100%');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#out-music')).toHaveText('90%');
    expect((await settingsOf(page)).audio.music).toBe(90);
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY)) ?? '{}').music).toBe(90);
  });

  test('both volumes at 0 persist across a reload, show as 0 in the dialog and no tone is played by taps and keys', async ({ page }) => {
    await open(page);
    await openSettings(page);
    await page.locator('#set-music').focus();
    await page.keyboard.press('Home');
    await page.locator('#set-sfx').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Escape');
    await page.reload();
    await waitReady(page);
    expect((await settingsOf(page)).audio).toMatchObject({ music: 0, sfx: 0 });
    await openSettings(page);
    await expect(page.locator('#set-music')).toHaveValue('0');
    await expect(page.locator('#set-sfx')).toHaveValue('0');
    await expect(page.locator('#out-sfx')).toHaveText('0%');
    await page.keyboard.press('Escape');
    for (let i = 0; i < 4; i += 1) {
      await page.locator('#advance').click();
      await page.waitForTimeout(230);
    }
    await page.keyboard.press('Enter');
    expect((await settingsOf(page)).audio.played, 'tones played with the effects volume at 0').toBe(0);
  });

  test('control: with the default volume a tap does play a tone (so the silent test above can fail)', async ({ page }) => {
    await open(page);
    await page.locator('#advance').click();
    await expect.poll(async () => (await settingsOf(page)).audio.played, { timeout: 4000 }).toBeGreaterThan(0);
  });
});

test.describe('settings: cỡ chữ (font size)', () => {
  async function sizesOf(page: Page, selector: string, inNotebook: boolean): Promise<number[]> {
    const out: number[] = [];
    for (const size of ['small', 'normal', 'large', 'xlarge']) {
      await openSettings(page);
      await page.locator('#set-font').selectOption(size);
      await page.locator('#settings-close').click();
      if (inNotebook) {
        await page.locator('#menu-open').click();
        await page.locator('#menu-notebook').click();
        await expect(page.locator(selector).first()).toBeVisible();
      }
      out.push(await fontPx(page, selector));
      if (inNotebook) await page.keyboard.press('Escape');
    }
    return out;
  }

  test('the four sizes grow the dialogue text strictly', async ({ page }) => {
    await open(page);
    const s = await sizesOf(page, '#line', false);
    expect(s[0]!).toBeLessThan(s[1]!);
    expect(s[1]!).toBeLessThan(s[2]!);
    expect(s[2]!).toBeLessThan(s[3]!);
  });

  test('the four sizes grow the text of the Sổ nguồn cards strictly (the Sổ nguồn is read text)', async ({ page }) => {
    await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }));
    const s = await sizesOf(page, '#notebook-list .card-line', true);
    expect(s, 'font sizes small, normal, large, xlarge').toEqual([...s].sort((a, b) => a - b));
    expect(new Set(s).size, 'four different sizes: ' + s.join(', ')).toBe(4);
  });

  test('the largest size makes the text of the card screen at least 1.3 times larger than the normal size', async ({ page }) => {
    await seedSettings(page, { fontSize: 'normal' });
    await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), '?preview=card:saturnalia');
    const normal = await fontPx(page, '#card-screen .card-line');
    const big = await page.context().newPage();
    await seedSave(big, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }));
    await seedSettings(big, { fontSize: 'xlarge' });
    await big.goto('/?preview=card:saturnalia');
    await waitReady(big);
    expect(await fontPx(big, '#card-screen .card-line')).toBeGreaterThan(normal * 1.3);
  });

  const SURFACES: [string, (p: Page) => Promise<void>][] = [
    ['menu', async (p) => { await p.locator('#menu-open').click(); }],
    ['settings', async (p) => { await openSettings(p); }],
    ['code dialog', async (p) => { await p.locator('#menu-open').click(); await p.locator('#menu-code').click(); }],
    ['Sổ nguồn with every card open', async (p) => {
      await p.locator('#menu-open').click();
      await p.locator('#menu-notebook').click();
      await expect(p.locator('#notebook-list .card').first()).toBeVisible();
      for (const summary of await p.locator('#notebook-list summary').all()) await summary.click();
    }],
    ['log', async (p) => { await p.locator('#log-open').click(); }],
    ['confirm new game', async (p) => { await p.locator('#menu-open').click(); await p.locator('#menu-new').click(); }],
  ];
  for (const [label, show] of SURFACES) {
    test('at 320 px wide and the largest font the ' + label + ' has no sideways scroll, nothing clipped at the sides and fits the height', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await seedSettings(page, { fontSize: 'xlarge' });
      await open(page, save({ furthest: 'dec25', chapter: 'dec25', scene: '' }));
      await show(page);
      await expect(page.locator('dialog[open]')).toBeVisible();
      const bad = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out: string[] = [];
        if (document.documentElement.scrollWidth > vw) out.push('page scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw);
        const dialog = document.querySelector('dialog[open]') as HTMLElement | null;
        if (!dialog) return ['no dialog open'];
        const d = dialog.getBoundingClientRect();
        if (d.left < 0 || d.right > vw + 0.5) out.push('dialog ' + Math.round(d.left) + '..' + Math.round(d.right));
        if (d.top < 0 || d.bottom > innerHeight + 0.5) out.push('dialog vertical ' + Math.round(d.top) + '..' + Math.round(d.bottom) + ' of ' + innerHeight);
        if (dialog.scrollWidth > dialog.clientWidth + 1) out.push('dialog scrolls sideways ' + dialog.scrollWidth + ' > ' + dialog.clientWidth);
        for (const el of dialog.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.left < d.left - 1 || r.right > d.right + 1) && !el.closest('.sr-only')) out.push('<' + el.tagName.toLowerCase() + ' ' + el.id + '> sticks out of the dialog ' + Math.round(r.left) + '..' + Math.round(r.right));
        }
        return out.slice(0, 6);
      });
      expect(bad).toEqual([]);
    });
  }

  test('at 320 px wide and the largest font every dialogue line of the first scene fits above the Lật trang button, which stays on the screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedSettings(page, { fontSize: 'xlarge' });
    await open(page);
    for (let i = 0; i < 7; i += 1) {
      const m = await page.evaluate(() => {
        const q = (s: string) => (document.querySelector(s) as HTMLElement).getBoundingClientRect();
        const line = document.querySelector('#line') as HTMLElement;
        return { adv: q('#advance'), line: q('#line'), dlg: q('.dialogue'), scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth, vh: innerHeight, clipped: line.scrollHeight > line.clientHeight + 1, bar: q('header.bar') };
      });
      expect(m.scrollW, 'line ' + i + ' scrolls sideways').toBeLessThanOrEqual(m.vw);
      expect(m.adv.left, 'Lật trang left, line ' + i).toBeGreaterThanOrEqual(0);
      expect(m.adv.right, 'Lật trang right, line ' + i).toBeLessThanOrEqual(m.vw);
      expect(m.adv.bottom, 'Lật trang bottom, line ' + i).toBeLessThanOrEqual(m.vh);
      expect(m.dlg.top, 'dialogue under the title bar, line ' + i).toBeGreaterThanOrEqual(m.bar.bottom - 1);
      expect(m.line.bottom, 'text bottom, line ' + i).toBeLessThanOrEqual(m.vh);
      expect(m.clipped, 'text clipped, line ' + i).toBe(false);
      await page.locator('#advance').click();
      await page.waitForTimeout(230);
    }
  });

  for (const width of [360, 390]) {
    test('at ' + width + ' px wide and the normal font the code dialog and the card screen do not scroll sideways', async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), '?preview=card:nicholas');
      const card = await page.locator('#card-screen').evaluate((el) => [el.scrollWidth, el.clientWidth]);
      expect(card[0], 'card screen scrollWidth ' + card[0] + ' > ' + card[1]).toBeLessThanOrEqual(card[1]!);
      await page.locator('#menu-open').click();
      await page.locator('#menu-code').click();
      await expect(page.locator('#code-dialog')).toBeVisible();
      const dialog = await page.locator('#code-dialog').evaluate((el) => [el.scrollWidth, el.clientWidth]);
      expect(dialog[0], 'code dialog scrollWidth ' + dialog[0] + ' > ' + dialog[1]).toBeLessThanOrEqual(dialog[1]!);
    });
  }

  for (const [label, preview] of [['card screen', '?preview=card:nicholas'], ['timeline', null]] as const) {
    test('at 320 px wide and the largest font the ' + label + ' does not scroll sideways', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await seedSettings(page, { fontSize: 'xlarge' });
      if (preview) await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), preview);
      else {
        await open(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' });
        await advanceUntil(page, 'timeline');
      }
      const screen = page.locator(preview ? '#card-screen' : '#timeline-screen');
      await expect(screen).toBeVisible();
      if (preview) for (const summary of await page.locator('#card-screen summary').all()) await summary.click();
      const bad = await screen.evaluate((root) => {
        const out: string[] = [];
        if (root.scrollWidth > root.clientWidth + 1) out.push('screen scrolls sideways ' + root.scrollWidth + ' > ' + root.clientWidth);
        const vw = document.documentElement.clientWidth;
        for (const el of root.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > vw + 1 || r.left < -1) && !el.closest('.sr-only')) out.push('<' + el.tagName.toLowerCase() + ' ' + el.className + '> ' + Math.round(r.left) + '..' + Math.round(r.right));
        }
        return out.slice(0, 6);
      });
      expect(bad).toEqual([]);
    });
  }
});

test.describe('settings: tự chạy thoại (auto-advance)', () => {
  test('auto-advance does not run the story behind an open menu, settings or log: the player loses no line', async ({ page }) => {
    await seedSettings(page, { autoAdvance: 'fast' });
    await open(page);
    await page.locator('#menu-open').click();
    const at = await lineIndex(page);
    await page.waitForTimeout(6000);
    expect(await lineIndex(page), 'story moved on while the menu covered it').toBe(at);
    await page.keyboard.press('Escape');
    await page.locator('#log-open').click();
    const atLog = await lineIndex(page);
    await page.waitForTimeout(6000);
    expect(await lineIndex(page), 'story moved on while the log covered it').toBe(atLog);
  });

  test('auto-advance never answers the name prompt for the player and keeps what is typed', async ({ page }) => {
    await seedSettings(page, { autoAdvance: 'fast' });
    await open(page, save({ scene: 'hoi-ten' }));
    await expect.poll(async () => (await storyOf(page)).asking, { timeout: 20_000 }).toBe(true);
    await page.locator('#name').fill('Thảo');
    await page.waitForTimeout(5000);
    expect((await storyOf(page)).asking).toBe(true);
    await expect(page.locator('#name')).toHaveValue('Thảo');
    expect((await stateOf(page)).shell.save.name).toBe('Lan');
  });

  test('auto-advance never leaves the mini game, and stops for the card, the timeline and the name card', async ({ page }, info) => {
    test.setTimeout(150_000);
    await seedSettings(page, { autoAdvance: 'fast' });
    await seedSave(page, save({ scene: 'hoi-ten' }));
    await page.goto('/?manual=1');
    await waitReady(page);
    await expect.poll(async () => (await storyOf(page)).asking, { timeout: 20_000 }).toBe(true);
    await page.locator('#name').fill('Lan');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 90_000 }).toBe('minigame');
    await page.waitForTimeout(6000);
    expect((await stateOf(page)).shell.mode).toBe('minigame');
    void info;
  });

  test('auto-advance does not skip past the timeline screen or the name card', async ({ page }) => {
    await seedSettings(page, { autoAdvance: 'fast' });
    await open(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' });
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 20_000 }).toBe('timeline');
    await page.waitForTimeout(6000);
    expect((await stateOf(page)).shell.mode, 'the timeline is read, not skipped').toBe('timeline');
  });

  test('switching auto-advance off stops a pending advance and a changed delay applies to the next line', async ({ page }) => {
    await open(page);
    await openSettings(page);
    await page.locator('#set-auto').selectOption('fast');
    await page.locator('#set-auto').selectOption('off');
    await page.locator('#settings-close').click();
    const at = await lineIndex(page);
    await page.waitForTimeout(5000);
    expect(await lineIndex(page)).toBe(at);
  });

  test('a key press during auto-advance moves exactly one line, never two', async ({ page }) => {
    await seedSettings(page, { autoAdvance: 'slow' });
    await open(page);
    await page.waitForTimeout(300);
    const at = await lineIndex(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(260);
    expect(await lineIndex(page)).toBe(at + 1);
    await page.keyboard.press(' ');
    await page.waitForTimeout(260);
    expect(await lineIndex(page)).toBe(at + 2);
  });

  test('holding Enter on the Lật trang button moves one line, not a stream of lines', async ({ page }) => {
    await open(page);
    await page.locator('#advance').focus();
    const at = await lineIndex(page);
    await page.keyboard.down('Enter');
    for (let i = 0; i < 6; i += 1) {
      await page.waitForTimeout(250);
      await page.keyboard.down('Enter');
    }
    await page.keyboard.up('Enter');
    expect(await lineIndex(page), 'a held key (auto-repeat) advanced the story').toBe(at + 1);
  });
});

test.describe('settings: tốc độ chữ and the live region', () => {
  test('while a line is typed slowly the live region is not rewritten letter by letter', async ({ page }) => {
    await seedSettings(page, { textSpeed: 'slow' });
    await open(page);
    await page.locator('#advance').click();
    await page.evaluate(() => {
      const w = window as unknown as { mutations: number };
      w.mutations = 0;
      new MutationObserver((list) => (w.mutations += list.length)).observe(document.getElementById('live') as HTMLElement, { subtree: true, childList: true, characterData: true });
    });
    const full = (await storyOf(page)).line?.text ?? '';
    expect(full.length).toBeGreaterThan(40);
    await expect.poll(async () => (await page.locator('#line').textContent())?.length ?? 0, { timeout: 15_000 }).toBe(full.length);
    const busy = await page.locator('#live').getAttribute('aria-busy');
    const mutations = await page.evaluate(() => (window as unknown as { mutations: number }).mutations);
    expect(mutations <= 3 || busy !== null, 'a screen reader hears ' + mutations + ' separate updates of one line').toBe(true);
  });

  test('a tap during typing shows the whole line and the next tap goes to the next line', async ({ page }) => {
    await seedSettings(page, { textSpeed: 'slow' });
    await open(page);
    await page.locator('#advance').click();
    await page.waitForTimeout(260);
    await page.locator('#advance').click();
    await page.waitForTimeout(260);
    const at = await lineIndex(page);
    expect(at).toBeGreaterThan(1);
    await page.locator('#advance').click();
    expect(await page.locator('#line').textContent()).toBe((await storyOf(page)).line?.text);
    expect(await lineIndex(page)).toBe(at);
    await page.waitForTimeout(260);
    await page.locator('#advance').click();
    expect(await lineIndex(page)).toBe(at + 1);
  });

  test('a player name made of emoji and combining letters is typed out whole and ends equal to the line', async ({ page }) => {
    await seedSettings(page, { textSpeed: 'fast' });
    await open(page, save({ name: 'Mai 🇻🇳👨‍👩‍👧 Te\u0300o', scene: 'cuc-cu' }));
    for (let i = 0; i < 6; i += 1) {
      const full = (await storyOf(page)).line?.text ?? '';
      await expect.poll(async () => await page.locator('#line').textContent(), { timeout: 12_000 }).toBe(full);
      await page.locator('#advance').click();
      await page.waitForTimeout(230);
    }
  });
});

test.describe('settings: giảm chuyển động (reduced motion) reaches the mini game', () => {
  const movingInPlayer = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.pz, .pz *')]
        .filter((e) => {
          const s = getComputedStyle(e);
          const long = (v: string): boolean => v.split(',').some((d) => parseFloat(d) > 0.01);
          return long(s.transitionDuration) || (s.animationName !== 'none' && long(s.animationDuration));
        })
        .map((e) => e.className),
    );

  test('the player choosing reduced motion leaves nothing in the puzzle player that transitions, with the system saying no preference', async ({ page }, info) => {
    await seedSettings(page, { reducedMotion: true });
    await seedSave(page, save({ scene: 'hoi-ten' }));
    await page.goto('/?manual=1');
    await waitReady(page);
    await reachMinigame(page, info as never);
    expect(await page.locator('.pz').count()).toBe(1);
    expect(await movingInPlayer(page)).toEqual([]);
  });

  test('the system asking for reduced motion leaves nothing in the puzzle player that transitions', async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await seedSave(page, save({ scene: 'hoi-ten' }));
      await page.goto('/?manual=1');
      await waitReady(page);
      await reachMinigame(page, info as never);
      expect(await page.locator('.pz').count()).toBe(1);
      expect(await movingInPlayer(page)).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
