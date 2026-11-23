import { expect, test, type Page } from '@playwright/test';
import { makeCode } from '../src/code.ts';
import { SAVE_KEY, seedSave, stateOf, storedSave, storyOf, tap, waitPhase } from './support/play.ts';

const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: '', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });
const title = (page: Page) => page.locator('#title');
const rows = (page: Page) => title(page).locator('nav button');

async function open(page: Page, seed: object | null = null, query = ''): Promise<void> {
  if (seed) await seedSave(page, seed);
  await page.goto(`/${query}`);
  await waitPhase(page, 'ready', 30_000);
}

test.describe('title screen', () => {
  test('the game opens on the title: two-line name and Bắt đầu, Nhập mã, Sổ nguồn, Cài đặt as rows, Bắt đầu focused', async ({ page }) => {
    await open(page);
    await expect(title(page)).toBeVisible();
    await expect(title(page).getByRole('heading', { level: 2 }).locator('em, .caps')).toHaveText(['Tèo và', 'Cỗ máy Lịch sử']);
    await expect(rows(page).filter({ visible: true })).toHaveText(['Bắt đầu', 'Nhập mã', 'Sổ nguồn', 'Cài đặt']);
    await expect(page.locator('#title .title-start')).toBeFocused();
    await expect.poll(() => page.locator('#title img').evaluate((img: HTMLImageElement) => img.dataset.ready ?? '')).toBe('true');
  });

  test('the first press on Bắt đầu is the first gesture: audio starts running', async ({ page }, info) => {
    await open(page);
    expect((await stateOf(page)).shell.audio.state).toBe('none');
    const box = (await page.locator('#title .title-start').boundingBox())!;
    await tap(page, info, box.x + box.width / 2, box.y + box.height / 2);
    await expect(title(page)).toHaveCount(0);
    await expect.poll(async () => (await stateOf(page)).shell.audio.state).toBe('running');
  });

  test('a page reloaded after a chunk failure goes on with the game, without the title', async ({ page }) => {
    await open(page, null, '?_r=1');
    await expect(title(page)).toHaveCount(0);
    expect((await storyOf(page)).scene).toBe('phong-ho-so');
  });

  test('Escape does not close the title', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Escape');
    await expect(title(page)).toBeVisible();
  });

  test('Bắt đầu without a save starts chapter 1 at its first scene and the in-game Menu still works', async ({ page }) => {
    await open(page);
    expect(await storedSave(page)).not.toBeNull();
    await page.locator('#title .title-start').click();
    await expect(title(page)).toHaveCount(0);
    const s = await storyOf(page);
    expect(s.chapter).toBe('intro');
    expect(s.scene).toBe('phong-ho-so');
    await page.locator('#menu-open').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#menu button')).toHaveText(['Tiếp tục', 'Chơi mới', 'Nhập mã', 'Sổ nguồn', 'Cài đặt']);
  });

  test('a preview link opens without the title', async ({ page }) => {
    await open(page, null, '?preview=card:saturnalia');
    await expect(title(page)).toHaveCount(0);
    await expect(page.locator('#card-screen')).toBeVisible();
  });

  test.describe('Tiếp tục', () => {
    test('is hidden with no save and with the save boot writes itself', async ({ page }) => {
      await open(page);
      await expect(page.locator('#title .title-continue')).toBeHidden();
      await page.reload();
      await waitPhase(page, 'ready', 30_000);
      expect(JSON.parse((await storedSave(page)) ?? 'null')).toMatchObject({ name: '', chapter: 'intro', scene: 'phong-ho-so' });
      await expect(page.locator('#title .title-continue')).toBeHidden();
    });

    test('is hidden for a nameless save at the first scene of chapter 1', async ({ page }) => {
      await open(page, save());
      await expect(page.locator('#title .title-continue')).toBeHidden();
    });

    for (const [label, seed, expected] of [
      ['a name', save({ name: 'Lan' }), { chapter: 'intro', scene: 'phong-ho-so' }],
      ['the name prompt at chapter 1 scene 2, before a name is entered', save({ scene: 'hoi-ten' }), { chapter: 'intro', scene: 'hoi-ten' }],
      ['a later chapter', save({ name: 'Lan', furthest: 'yule', chapter: 'yule', scene: '' }), { chapter: 'yule' }],
      ['a solved puzzle', save({ puzzles: ['intro'] }), { chapter: 'intro', scene: 'phong-ho-so' }],
    ] as const) {
      test(`is shown with ${label} and resumes there`, async ({ page }) => {
        await open(page, seed);
        await expect(page.locator('#title .title-continue')).toBeVisible();
        await expect(page.locator('#title .title-continue')).toBeFocused();
        await page.locator('#title .title-continue').click();
        await expect(title(page)).toHaveCount(0);
        expect(await storyOf(page)).toMatchObject(expected);
        expect((await stateOf(page)).shell.save).toMatchObject({ name: seed.name, chapter: seed.chapter });
      });
    }
  });

  test.describe('buttons', () => {
    for (const [name, selector] of [
      ['Nhập mã', '#code-dialog'],
      ['Sổ nguồn', '#notebook-dialog'],
      ['Cài đặt', '#settings'],
    ] as const) {
      test(`${name} opens its screen over the title and closing it returns to the title`, async ({ page }) => {
        await open(page);
        await rows(page).filter({ hasText: name }).click();
        await expect(page.locator(selector)).toBeVisible();
        await page.locator(selector).getByRole('button', { name: /^(Đóng|Xong)$/ }).click();
        await expect(page.locator(selector)).toBeHidden();
        await expect(title(page)).toBeVisible();
      });
    }

    test('Nhập mã with a valid code closes the title and loads that chapter', async ({ page }) => {
      await open(page);
      await rows(page).filter({ hasText: 'Nhập mã' }).click();
      await page.locator('#code-input').fill(makeCode({ name: 'Lan', chapter: 'yule', furthest: 'yule' }));
      await page.locator('#code-use').click();
      await expect(title(page)).toHaveCount(0);
      await expect.poll(async () => (await storyOf(page)).chapter).toBe('yule');
    });

    test('Bắt đầu with a save asks first: Giữ tiến độ keeps it, Chơi mới starts over', async ({ page }) => {
      await open(page, save({ name: 'Lan', furthest: 'yule', chapter: 'yule', scene: '' }));
      await page.locator('#title .title-start').click();
      await expect(page.locator('#confirm-new')).toBeVisible();
      await page.locator('#confirm-new-no').click();
      await expect(title(page)).toBeVisible();
      expect(JSON.parse((await storedSave(page)) ?? 'null')).toMatchObject({ name: 'Lan', chapter: 'yule' });
      await page.locator('#title .title-start').click();
      await page.locator('#confirm-new-yes').click();
      await expect(title(page)).toHaveCount(0);
      await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
      expect((await stateOf(page)).shell.save).toMatchObject({ name: '', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so' });
      expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toContain('"name":""');
    });
  });

  test.describe('layout', () => {
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 800]] as const) {
      for (const withSave of [false, true]) {
        test(`fits ${width}x${height} ${withSave ? 'with' : 'without'} a save: rows at least 44 px, nothing overflows`, async ({ page }) => {
          await page.setViewportSize({ width, height });
          await open(page, withSave ? save({ name: 'Lan' }) : null);
          const m = await title(page).evaluate((el) => ({
            overflowX: el.scrollWidth - el.clientWidth,
            overflowY: el.scrollHeight - el.clientHeight,
            pageX: document.documentElement.scrollWidth - innerWidth,
            heights: [...el.querySelectorAll('nav button')].filter((b) => (b as HTMLElement).offsetParent).map((b) => b.getBoundingClientRect().height),
            right: Math.max(...[...el.querySelectorAll('nav button')].map((b) => b.getBoundingClientRect().right)),
          }));
          expect(m.heights).toHaveLength(withSave ? 5 : 4);
          expect(Math.min(...m.heights)).toBeGreaterThanOrEqual(44);
          expect(m.overflowX).toBeLessThanOrEqual(0);
          expect(m.pageX).toBeLessThanOrEqual(0);
          expect(m.overflowY).toBeLessThanOrEqual(0);
          expect(m.right).toBeLessThanOrEqual(width);
        });
      }
    }

    test('keyboard reaches every row in order and the focused row has a visible outline', async ({ page }, info) => {
      test.skip(info.project.use.hasTouch === true, 'keyboard flow, desktop only');
      await open(page, save({ name: 'Lan' }));
      const focused = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const style = getComputedStyle(el);
          return { text: el.textContent, outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
      expect((await focused()).text).toBe('Tiếp tục');
      const seen: string[] = [];
      for (const key of ['Shift+Tab', 'Tab', 'Tab', 'Tab', 'Tab']) {
        await page.keyboard.press(key);
        const f = await focused();
        seen.push(f.text ?? '');
        expect(f.outline).not.toBe('none');
        expect(f.width).toBeGreaterThan(0);
      }
      expect(seen).toEqual(['Bắt đầu', 'Tiếp tục', 'Nhập mã', 'Sổ nguồn', 'Cài đặt']);
    });
  });
});
