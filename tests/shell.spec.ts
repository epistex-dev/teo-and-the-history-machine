import { expect, test, type Page } from '@playwright/test';
import { encodeCode, makeCode } from '../src/code.ts';
import { ORDER } from '../src/order.ts';
import { SAVE_KEY, seedSave, stateOf, storyOf, waitReady } from './support/play.ts';
import { intro, lineOf } from './support/script.ts';

const SETTINGS_KEY = 'teo:v1:settings';
const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });

async function open(page: Page, seed: object | null = save(), query = ''): Promise<void> {
  if (seed) await seedSave(page, seed);
  await page.goto(`/${query}`);
  await waitReady(page);
}

const menu = async (page: Page, item: string) => {
  await page.locator('#menu-open').click();
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator(`#menu-${item}`).click();
};

const settingsOf = async (page: Page) => (await stateOf(page)).shell as unknown as { settings: Record<string, unknown>; audio: { music: number; sfx: number } };

test.describe('menu', () => {
  test('the menu lists Tiếp tục, Chơi mới, Nhập mã, Sổ nguồn and Cài đặt in that order and Tiếp tục returns to the same line', async ({ page }) => {
    await open(page);
    const before = (await storyOf(page)).line?.text;
    await page.locator('#menu-open').click();
    await expect(page.locator('#menu button')).toHaveText(['Tiếp tục', 'Chơi mới', 'Nhập mã', 'Sổ nguồn', 'Cài đặt']);
    await page.locator('#menu-continue').click();
    await expect(page.locator('#menu')).toBeHidden();
    expect((await storyOf(page)).line?.text).toBe(before);
  });

  test('keyboard: Enter opens the menu button, Esc closes the menu, and Enter on the story does not advance behind an open menu', async ({ page }, info) => {
    test.skip(info.project.use.hasTouch === true, 'keyboard flow, desktop only');
    await open(page);
    await page.locator('#menu-open').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#menu')).toBeVisible();
    const before = (await storyOf(page)).lineIndex;
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu')).toBeHidden();
    expect((await storyOf(page)).lineIndex).toBe(before);
  });

  test('Chơi mới asks first; "Giữ tiến độ" keeps the save, "Chơi mới" starts chapter 1 again with no name', async ({ page }) => {
    await open(page, save({ furthest: 'dec25', chapter: 'dec25', scene: '' }));
    await menu(page, 'new');
    await expect(page.locator('#confirm-new')).toBeVisible();
    await page.locator('#confirm-new-no').click();
    expect((await stateOf(page)).shell.save).toMatchObject({ furthest: 'dec25', name: 'Lan' });
    await menu(page, 'new');
    await page.locator('#confirm-new-yes').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    const s = await stateOf(page);
    expect(s.story?.scene).toBe('phong-ho-so');
    expect(s.shell.save).toMatchObject({ name: '', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so' });
  });

  test('Xem lại thoại lists the lines shown so far', async ({ page }) => {
    await open(page);
    await page.locator('#advance').click();
    await page.waitForTimeout(260);
    await page.locator('#advance').click();
    await page.locator('#log-open').click();
    await expect(page.locator('#log-list li')).toHaveCount(3);
    const first = intro.scenes[0]!.beats.flatMap((b) => lineOf(b) ?? []).slice(0, 3);
    for (const [i, text] of first.entries()) await expect(page.locator('#log-list li').nth(i)).toContainText(text);
  });

  test('the dialogue is an aria-live region and the status line is a status region', async ({ page }) => {
    await open(page);
    await expect(page.locator('#live')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#status')).toHaveAttribute('role', 'status');
  });
});

test.describe('settings (R13)', () => {
  test('every control persists across a reload and is applied', async ({ page }) => {
    await open(page);
    await menu(page, 'settings');
    await page.locator('#set-speed').selectOption('slow');
    await page.locator('#set-auto').selectOption('fast');
    await page.locator('#set-font').selectOption('xlarge');
    await page.locator('#set-music').fill('25');
    await page.locator('#set-sfx').fill('55');
    await page.locator('#set-motion').check();
    const shell = await settingsOf(page);
    expect(shell.settings).toMatchObject({ textSpeed: 'slow', autoAdvance: 'fast', fontSize: 'xlarge', music: 25, sfx: 55, reducedMotion: true, reducedMotionEffective: true });
    expect(shell.audio).toMatchObject({ music: 25, sfx: 55 });
    const stored = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY)) ?? 'null');
    expect(stored).toMatchObject({ textSpeed: 'slow', autoAdvance: 'fast', fontSize: 'xlarge', music: 25, sfx: 55, reducedMotion: true });
    await page.reload();
    await waitReady(page);
    const again = await settingsOf(page);
    expect(again.settings).toMatchObject({ textSpeed: 'slow', autoAdvance: 'fast', fontSize: 'xlarge', music: 25, sfx: 55, reducedMotion: true });
    expect(again.audio).toMatchObject({ music: 25, sfx: 55 });
    expect(await page.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe('true');
    await menu(page, 'settings');
    await expect(page.locator('#set-speed')).toHaveValue('slow');
    await expect(page.locator('#set-font')).toHaveValue('xlarge');
    await expect(page.locator('#set-music')).toHaveValue('25');
    await expect(page.locator('#set-motion')).toBeChecked();
  });

  test('font size scales the dialogue text', async ({ page }) => {
    await open(page);
    const size = () => page.locator('#line').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const normal = await size();
    await menu(page, 'settings');
    await page.locator('#set-font').selectOption('xlarge');
    await page.locator('#settings-close').click();
    expect(await size()).toBeGreaterThan(normal * 1.3);
  });

  test('text speed types the line out and a tap shows the rest at once', async ({ page }) => {
    await open(page);
    await menu(page, 'settings');
    await page.locator('#set-speed').selectOption('slow');
    await page.locator('#settings-close').click();
    await page.locator('#advance').click();
    const full = (await storyOf(page)).line?.text ?? '';
    expect(full.length).toBeGreaterThan(40);
    const shown = async () => (await page.locator('#line').textContent())?.length ?? 0;
    await expect.poll(shown).toBeLessThan(full.length);
    await page.waitForTimeout(260);
    await page.locator('#advance').click();
    expect(await page.locator('#line').textContent()).toBe(full);
    expect((await storyOf(page)).line?.text).toBe(full);
  });

  test('auto-advance moves the story on by itself, off does not', async ({ page }) => {
    await open(page);
    const index = async () => (await storyOf(page)).lineIndex ?? 0;
    const start = await index();
    await page.waitForTimeout(2500);
    expect(await index()).toBe(start);
    await menu(page, 'settings');
    await page.locator('#set-auto').selectOption('fast');
    await page.locator('#settings-close').click();
    await expect.poll(index, { timeout: 8000 }).toBeGreaterThan(start);
  });

  test('reduced motion follows prefers-reduced-motion until the player chooses', async ({ browser }) => {
    for (const [scheme, expected] of [['reduce', true], ['no-preference', false]] as const) {
      const context = await browser.newContext({ reducedMotion: scheme });
      const page = await context.newPage();
      await page.goto('/');
      await waitReady(page);
      expect((await settingsOf(page)).settings).toMatchObject({ reducedMotion: null, reducedMotionEffective: expected });
      await menu(page, 'settings');
      if (expected) await expect(page.locator('#set-motion')).toBeChecked();
      else await expect(page.locator('#set-motion')).not.toBeChecked();
      await page.locator('#set-motion').setChecked(!expected);
      expect((await settingsOf(page)).settings).toMatchObject({ reducedMotion: !expected, reducedMotionEffective: !expected });
      await context.close();
    }
  });

  test('corrupt settings fall back to the defaults', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '{"textSpeed":"warp","music":"loud","fontSize":7}'), SETTINGS_KEY);
    await open(page);
    expect((await settingsOf(page)).settings).toMatchObject({ textSpeed: 'instant', autoAdvance: 'off', music: 70, sfx: 80, fontSize: 'normal' });
  });

  test('the settings keep the save untouched', async ({ page }) => {
    await open(page);
    const before = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
    await menu(page, 'settings');
    await page.locator('#set-font').selectOption('large');
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(before);
  });
});

test.describe('continue code (R2)', () => {
  const useCode = async (page: Page, code: string) => {
    await menu(page, 'code');
    await page.locator('#code-input').fill(code);
    await page.locator('#code-use').click();
  };

  test('the dialog shows the code of the current save and it reads back as the same progress', async ({ page }) => {
    await open(page, save({ furthest: 'carol', chapter: 'dec25', scene: '' }));
    await menu(page, 'code');
    const mine = await page.locator('#code-mine').inputValue();
    expect(mine).toBe(makeCode({ name: 'Lan', chapter: 'dec25', furthest: 'carol' }));
  });

  test('a valid code restores name, chapter and farthest chapter', async ({ page }) => {
    await open(page);
    const next = { id: 'dec25' };
    await useCode(page, makeCode({ name: 'Mai Anh', chapter: next.id, furthest: next.id }));
    expect((await stateOf(page)).shell.save).toMatchObject({ schemaVersion: 1, name: 'Mai Anh', furthest: next.id, chapter: next.id });
    await page.reload();
    await waitReady(page);
    expect((await stateOf(page)).shell.save).toMatchObject({ name: 'Mai Anh', chapter: next.id, furthest: next.id });
  });

  test('a code with spaces and line breaks around it is accepted', async ({ page }) => {
    await open(page);
    const next = { id: 'dec25' };
    await useCode(page, `  ${makeCode({ name: 'Lan', chapter: next.id, furthest: next.id })}\n `);
  });

  const bad: [string, string, RegExp][] = [
    ['empty', '', /dán mã/],
    ['random text', 'xin chao the gioi 123456', /không phải mã|không hợp lệ|độ dài/],
    ['too long', 'TEO1.' + 'A'.repeat(300), /độ dài/],
    ['too short', 'TEO1.00', /độ dài/],
    ['wrong schema', 'TEO2.00.00.nTGFu.AAAAAA', /phiên bản/],
    ['wrong checksum', makeCode({ name: 'Lan', chapter: 'yule', furthest: 'yule' }).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), /sai ký tự/],
    ['beyond the farthest chapter', encodeCode(9, 4, 'Lan'), /vượt quá/],
    ['chapter that does not exist', encodeCode(40, 40, 'Lan'), /không có trong truyện/],
  ];
  for (const [name, code, message] of bad) {
    test(`an invalid code is refused with a message and the save does not change: ${name}`, async ({ page }) => {
      await open(page);
      const before = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
      await useCode(page, code);
      await expect(page.locator('#code-error')).toHaveText(message);
      await expect(page.locator('#code-dialog')).toBeVisible();
      expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(before);
      expect((await stateOf(page)).shell.save).toMatchObject({ chapter: 'intro', name: 'Lan' });
    });
  }

  test('Enter in the code box uses the code', async ({ page }) => {
    await open(page);
    await menu(page, 'code');
    const next = { id: 'dec25' };
    await page.locator('#code-input').fill(makeCode({ name: 'Lan', chapter: next.id, furthest: next.id }));
    await page.locator('#code-input').press('Enter');
  });
});

test.describe('Sổ nguồn', () => {
  test('lists only the cards of finished chapters, with the stamp of bible §7 and no card for the frame chapter', async ({ page }) => {
    await open(page, save({ furthest: 'dec25', chapter: 'dec25', scene: '' }));
    await menu(page, 'notebook');
    const cards = page.locator('#notebook-list .card');
    await expect(cards).toHaveCount(4);
    expect(await cards.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.chapter))).toEqual(['saturnalia', 'yule', 'mistletoe', 'bethlehem']);
    expect(await page.locator('#notebook-list .stamp').allTextContents()).toEqual(['TRANH CÃI', 'SỰ THẬT', 'TRUYỀN THUYẾT', 'THEO KINH THÁNH']);
    await expect(page.locator('#notebook-list .card[data-chapter="intro"]')).toHaveCount(0);
  });

  test('a card has 2 to 3 lines and "Xem đủ" opens the sections whose links open in a new tab with rel=noopener', async ({ page }) => {
    await open(page, save({ furthest: 'yule', chapter: 'yule', scene: '' }));
    await menu(page, 'notebook');
    const card = page.locator('#notebook-list .card[data-chapter="saturnalia"]');
    await expect(card).toBeVisible();
    const lines = await card.locator('.card-line').count();
    expect(lines).toBeGreaterThanOrEqual(2);
    expect(lines).toBeLessThanOrEqual(3);
    await expect(card.locator('.card-full')).not.toHaveAttribute('open', '');
    await card.locator('summary').click();
    await expect(card.locator('summary')).toHaveText('Xem đủ');
    await expect(card.locator('[data-section="fact"] h4')).toHaveText('Sự thật');
    await expect(card.locator('[data-section="tradition"] h4')).toHaveText('Theo Kinh Thánh hoặc theo truyền thống');
    await expect(card.locator('[data-section="dispute"] h4')).toContainText('Còn tranh cãi');
    const links = await card.locator('a').evaluateAll((as) => as.map((a) => ({ href: (a as HTMLAnchorElement).href, target: (a as HTMLAnchorElement).target, rel: (a as HTMLAnchorElement).rel })));
    expect(links.length).toBeGreaterThan(3);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.href).toMatch(/^https:\/\//);
    }
    expect(links.map((l) => l.href)).toContain('https://penelope.uchicago.edu/encyclopaedia_romana/calendar/saturnalia.html');
  });

  test('no card yet on a fresh game', async ({ page }) => {
    await open(page, null);
    await menu(page, 'notebook');
    await expect(page.locator('#notebook-list')).toContainText('Chưa có thẻ nào');
  });

  test('the card that ends an act carries a continue code that resumes at the next chapter', async ({ page }) => {
    await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), '?preview=card:nicholas');
    await expect(page.locator('#card-code')).toBeVisible();
    const code = await page.locator('#card-code-text').inputValue();
    expect(code).toBe(makeCode({ name: 'Lan', chapter: 'carol', furthest: 'carol' }));
  });

  test('the frame chapters have no card and no stamp', async ({ page }) => {
    for (const id of ['intro', 'ending']) {
      await page.goto('about:blank');
      await open(page, save(), `?preview=card:${id}`);
      expect((await stateOf(page)).shell.mode).toBe('story');
      await expect(page.locator('#card-screen')).toBeHidden();
    }
  });
});
