import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { encodeCode } from '../src/code.ts';
import { advanceUntil } from './support/ending.ts';
import { seedSave, stateOf, storedSave, storyOf, waitReady } from './support/play.ts';

/** Regression tests for the round 2 review findings that no challenger test covers. */
test.describe.configure({ timeout: 60_000 });

const SETTINGS_KEY = 'teo:v1:settings';
const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });
const ending = (scene: string) => ({ schemaVersion: 1, name: 'Hoàng Minh Khôi', furthest: 'ending', chapter: 'ending', scene });
const seedSettings = (page: Page, value: unknown) => page.addInitScript(([k, v]) => localStorage.setItem(k as string, v as string), [SETTINGS_KEY, JSON.stringify(value)]);
const lineIndex = async (page: Page) => (await storyOf(page)).lineIndex ?? 0;

async function open(page: Page, seed: object = save(), query = ''): Promise<void> {
  await seedSave(page, seed);
  await page.goto('/' + query);
  await waitReady(page);
}

async function toScreen(page: Page, scene: string, mode: string): Promise<void> {
  await open(page, ending(scene));
  await advanceUntil(page, mode);
}

const ratio = (a: number[], b: number[]): number => {
  const lum = ([r, g, bl]: number[]) => {
    const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(bl!);
  };
  const [hi, lo] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))];
  return (hi + 0.05) / (lo + 0.05);
};

test.describe('timeline caps (bible §7)', () => {
  test('the timeline starts with "Cỗ máy khởi động" and ends with "Hôm nay"', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    await expect(page.locator('#timeline li[data-frame]')).toHaveText(['Cỗ máy khởi động', 'Hôm nay']);
  });
});

test.describe('font (VISUAL_DESIGN Fonts)', () => {
  test('one self-hosted OFL font, subset, at most 120 KB in total, with its license shipped', () => {
    const dist = join(process.cwd(), 'dist');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
    const fonts = walk(dist).filter((f) => /\.(woff2?|ttf|otf)$/.test(f));
    expect(fonts.length, 'font files in dist').toBeGreaterThan(0);
    expect(fonts.every((f) => f.endsWith('.woff2'))).toBe(true);
    const total = fonts.reduce((sum, f) => sum + statSync(f).size, 0);
    expect(total, 'font bytes in dist').toBeLessThanOrEqual(120_000);
    const license = join(dist, 'fonts', 'OFL-EBGaramond.txt');
    expect(existsSync(license), 'license file in dist').toBe(true);
    expect(readFileSync(license, 'utf8')).toContain('SIL Open Font License');
  });

  test('the page text is set in EB Garamond, loaded from the same origin', async ({ page }) => {
    const loaded: string[] = [];
    page.on('response', (r) => {
      if (/\.woff2$/.test(new URL(r.url()).pathname)) loaded.push(new URL(r.url()).origin + ' ' + r.status());
    });
    await open(page);
    await page.waitForFunction(() => [...document.fonts].some((f) => f.family.replaceAll('"', '') === 'EB Garamond' && f.status === 'loaded'));
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"?EB Garamond"?,/);
    expect(loaded.length).toBeGreaterThan(0);
    for (const l of loaded) expect(l).toMatch(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+ 200$/);
  });

  test('the name card canvas names EB Garamond only, after the Vietnamese face has loaded', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { canvasFonts: string[] };
      w.canvasFonts = [];
      const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font') as PropertyDescriptor;
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
        configurable: true,
        get: desc.get,
        set(value: string) {
          w.canvasFonts.push(value);
          desc.set?.call(this, value);
        },
      });
    });
    await toScreen(page, 'the-ten', 'namecard');
    await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready: boolean } }).screen.ready).toBe(true);
    const used = await page.evaluate(() => (window as unknown as { canvasFonts: string[] }).canvasFonts);
    expect(used.length).toBeGreaterThan(0);
    for (const font of used) {
      expect(font, 'canvas font').toMatch(/EB Garamond/);
      expect(font, 'canvas font').not.toMatch(/Roboto|system-ui|Segoe|Arial|Helvetica/i);
    }
    const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.family.replaceAll('"', '') === 'EB Garamond' && f.status === 'loaded').map((f) => f.unicodeRange));
    expect(faces.some((range) => /1EA0-1EF9/i.test(range)), 'the Vietnamese face is loaded for a name with marks').toBe(true);
  });
});

test.describe('name card without roundRect (iOS 15 and older)', () => {
  test('the card is still drawn and can be saved', async ({ page }) => {
    await page.addInitScript(() => {
      delete (CanvasRenderingContext2D.prototype as unknown as { roundRect?: unknown }).roundRect;
    });
    await toScreen(page, 'the-ten', 'namecard');
    await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready: boolean } }).screen.ready).toBe(true);
    await expect(page.locator('#namecard-img')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('#namecard-save')).toBeVisible();
  });
});

test.describe('continue code: merge with the save', () => {
  test('a code keeps the farthest chapter of the save and moves the current chapter to the code, in the storage too', async ({ page }) => {
    await open(page, save({ furthest: 'dec25', chapter: 'dec25', scene: '' }));
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    await page.locator('#code-input').fill(encodeCode(2, 2, 'Lan'));
    await page.locator('#code-use').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.chapter).toBe('yule');
    expect((await stateOf(page)).shell.save.furthest).toBe('dec25');
    expect(JSON.parse((await storedSave(page)) ?? '{}')).toMatchObject({ chapter: 'yule', furthest: 'dec25' });
  });

  test('a code that went farther than the save raises the farthest chapter', async ({ page }) => {
    await open(page, save({ furthest: 'yule', chapter: 'yule', scene: '' }));
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    await page.locator('#code-input').fill(encodeCode(4, 6, 'Lan'));
    await page.locator('#code-use').click();
    await expect.poll(async () => (await stateOf(page)).shell.save.chapter).toBe('bethlehem');
    expect((await stateOf(page)).shell.save.furthest).toBe('nicholas');
  });
});

test.describe('copy feedback', () => {
  test('"Sao chép" in the code dialog says whether the code was copied or only selected', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    });
    await open(page);
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    await expect(page.locator('#code-note')).toHaveText('');
    await page.locator('#code-copy').click();
    await expect(page.locator('#code-note')).toContainText('Đã sao chép');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } });
      document.execCommand = () => false;
    });
    await page.locator('#code-copy').click();
    await expect(page.locator('#code-note')).toContainText('đã chọn sẵn');
  });

  test('"Sao chép" on the act-end card says so too', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    });
    await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), '?preview=card:nicholas');
    await page.locator('#card-code-copy').click();
    await expect(page.locator('#card-code-note')).toContainText('Đã sao chép');
  });
});

test.describe('auto-advance and a hidden tab', () => {
  test('a hidden tab does not advance the story, and it resumes when the tab shows again', async ({ page }) => {
    await seedSettings(page, { autoAdvance: 'fast' });
    await open(page);
    const hide = (hidden: boolean) =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await hide(true);
    const at = await lineIndex(page);
    await page.waitForTimeout(4000);
    expect(await lineIndex(page), 'the story moved on while the tab was hidden').toBe(at);
    await hide(false);
    await expect.poll(() => lineIndex(page), { timeout: 8000 }).toBeGreaterThan(at);
  });
});

test.describe('screen reader line', () => {
  test('the live region is busy while a line is typed and free when it is complete', async ({ page }) => {
    await seedSettings(page, { textSpeed: 'slow' });
    await open(page);
    const live = page.locator('#live');
    await expect(live).not.toHaveAttribute('aria-busy', 'true', { timeout: 15_000 });
    await page.locator('#advance').click();
    await expect(live).toHaveAttribute('aria-busy', 'true');
    await page.waitForTimeout(260);
    await page.locator('#advance').click();
    await expect(live).not.toHaveAttribute('aria-busy', 'true');
  });
});

test.describe('colour and motion', () => {
  test('the code error text and the SỰ THẬT stamp reach 4.5:1 on paper', async ({ page }) => {
    await open(page, save({ furthest: 'yule', chapter: 'yule', scene: '' }), '?preview=card:yule');
    const stamp = await page.evaluate(() => {
      const rgb = (v: string) => (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const el = document.querySelector('#card-screen .stamp') as HTMLElement;
      return { text: el.textContent, colour: rgb(getComputedStyle(el).color), paper: rgb(getComputedStyle(el.closest('.card') as HTMLElement).backgroundColor) };
    });
    expect(stamp.text).toBe('SỰ THẬT');
    expect(ratio(stamp.colour, stamp.paper), 'stamp text on paper').toBeGreaterThanOrEqual(4.5);
    await page.locator('#card-next').click();
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    const error = await page.evaluate(() => {
      const rgb = (v: string) => (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const el = document.querySelector('#code-error') as HTMLElement;
      return { colour: rgb(getComputedStyle(el).color), paper: rgb(getComputedStyle(el.closest('dialog') as HTMLElement).backgroundColor) };
    });
    expect(ratio(error.colour, error.paper), 'error text on paper').toBeGreaterThanOrEqual(4.5);
  });

  test('a player who turned "Giảm chuyển động" off gets motion even when the device asks for less', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedSettings(page, { reducedMotion: false });
    await open(page);
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).animationDuration))).toBe(0);
  });

  test('the device preference still applies until the player chooses', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).animationDuration))).toBeGreaterThan(0);
  });

  test('the font size setting also sizes the text of the dialogs', async ({ page }) => {
    const sizes: number[] = [];
    for (const fontSize of ['normal', 'xlarge']) {
      await page.goto('about:blank');
      await seedSettings(page, { fontSize });
      await open(page);
      await page.locator('#menu-open').click();
      await page.locator('#menu-settings').click();
      sizes.push(await page.locator('#settings label').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)));
    }
    expect(sizes[1]!).toBeGreaterThan(sizes[0]! * 1.3);
  });
});

test.describe('phone in landscape (844 x 390)', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('the menu shows all five buttons and the settings show every control without scrolling', async ({ page }) => {
    await open(page);
    await page.locator('#menu-open').click();
    const fits = (selector: string) =>
      page.evaluate((s) => {
        const dialog = document.querySelector(s) as HTMLElement;
        const d = dialog.getBoundingClientRect();
        const outside = [...dialog.querySelectorAll('button, select, input')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.top < d.top - 1 || r.bottom > d.bottom + 1 || r.bottom > innerHeight);
        });
        return { scrolls: dialog.scrollHeight > dialog.clientHeight + 1, outside: outside.map((el) => el.id), count: dialog.querySelectorAll('button, select, input').length };
      }, selector);
    const menu = await fits('#menu');
    expect(menu).toMatchObject({ scrolls: false, outside: [], count: 5 });
    await page.locator('#menu-settings').click();
    const settings = await fits('#settings');
    expect(settings).toMatchObject({ scrolls: false, outside: [], count: 7 });
  });
});
