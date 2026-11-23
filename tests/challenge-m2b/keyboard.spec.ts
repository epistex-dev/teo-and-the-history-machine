import { expect, test, type Page } from '@playwright/test';
import { expectClean, finishMinigame, open as openMini, watch } from '../challenge/helpers.ts';
import { pressUntil } from '../support/ending.ts';
import { puzzleOf } from '../support/puzzle.ts';
import { reachMinigame, seedSave, stateOf, storedSave, storyOf, typeName, waitReady } from '../support/play.ts';

test.describe.configure({ timeout: 90_000 });

const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });

async function open(page: Page, seed: object | null = save(), query = ''): Promise<void> {
  if (seed) await seedSave(page, seed);
  await page.goto('/' + query);
  await waitReady(page);
}

const active = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { id: el?.id ?? '', tag: el?.tagName ?? '', inDialog: el?.closest('dialog[open]')?.id ?? '', inStory: Boolean(el?.closest('#story')), body: el === document.body || el === null };
  });

/** Opens the menu with the keyboard only. */
async function keyboardMenu(page: Page): Promise<void> {
  await page.locator('#menu-open').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menu')).toBeVisible();
}

async function menuItem(page: Page, id: string): Promise<void> {
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#' + id).focus();
  await page.keyboard.press('Enter');
}

const lineIndex = async (page: Page) => (await storyOf(page)).lineIndex ?? 0;

test.describe('keyboard: menu, focus and Escape', () => {
  test('the menu opens on "Tiếp tục", Tab keeps the focus inside the menu through every item and around again, Shift+Tab too', async ({ page }) => {
    await open(page);
    await keyboardMenu(page);
    expect((await active(page)).id).toBe('menu-continue');
    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const a = await active(page);
      seen.push(a.id || a.tag);
      expect(['advance', 'menu-open', 'log-open', 'name', 'mg-help'], 'Tab ' + (i + 1) + ' reached ' + a.id + ' behind the open menu; visited ' + seen.join(' > ')).not.toContain(a.id);
      expect(a.inStory, 'Tab reached the story behind the menu').toBe(false);
    }
    expect(seen.slice(0, 4)).toEqual(['menu-new', 'menu-code', 'menu-notebook', 'menu-settings']);
    for (let i = 0; i < 7; i += 1) {
      await page.keyboard.press('Shift+Tab');
      const a = await active(page);
      expect(['advance', 'menu-open', 'log-open'], 'Shift+Tab reached ' + a.id).not.toContain(a.id);
    }
  });

  test('keys that drive the story (Enter, Space, ArrowRight) do nothing to it while a dialog is open', async ({ page }) => {
    await open(page);
    const at = await lineIndex(page);
    for (const opener of ['#log-open', '#menu-open']) {
      await page.locator(opener).focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
    }
    expect(await lineIndex(page)).toBe(at);
    await page.locator('#menu-open').focus();
    await page.keyboard.press('Enter');
    await page.locator('#menu-settings').focus();
    await page.keyboard.press('Enter');
    await page.locator('#set-speed').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    expect(await lineIndex(page), 'Enter or arrows in the settings advanced the story').toBe(at);
  });

  const DIALOGS: [string, string, string][] = [
    ['settings', 'menu-settings', 'settings'],
    ['code dialog', 'menu-code', 'code-dialog'],
    ['Sổ nguồn', 'menu-notebook', 'notebook-dialog'],
  ];
  for (const [label, item, dialog] of DIALOGS) {
    test('Escape closes the ' + label + ' and the keyboard focus lands on a control of the page, not on nothing', async ({ page }) => {
      await open(page);
      await keyboardMenu(page);
      await menuItem(page, item);
      await expect(page.locator('#' + dialog)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#' + dialog)).toBeHidden();
      const a = await active(page);
      expect(a.body, 'the focus fell to the page body after closing the ' + label).toBe(false);
    });
  }

  test('Escape on the log closes it and returns the focus to the "Thoại" button', async ({ page }) => {
    await open(page);
    await page.locator('#log-open').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#log-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#log-dialog')).toBeHidden();
    expect((await active(page)).id).toBe('log-open');
  });

  test('the "Chơi mới" question does not put the keyboard focus on the button that erases progress', async ({ page }) => {
    await open(page, save({ furthest: 'dec25', chapter: 'dec25', scene: '' }));
    await keyboardMenu(page);
    await menuItem(page, 'menu-new');
    await expect(page.locator('#confirm-new')).toBeVisible();
    expect((await active(page)).id, 'one Enter erases the whole progress').not.toBe('confirm-new-yes');
    await page.keyboard.press('Enter');
    expect(JSON.parse((await storedSave(page)) ?? '{}'), 'one Enter after "Chơi mới" erased the save').toMatchObject({ furthest: 'dec25' });
  });

  test('Escape on the "Chơi mới" question keeps the progress and the story where it was', async ({ page }) => {
    await open(page, save({ furthest: 'dec25', chapter: 'dec25', scene: '' }));
    const before = await storedSave(page);
    await keyboardMenu(page);
    await menuItem(page, 'menu-new');
    await page.keyboard.press('Escape');
    await expect(page.locator('#confirm-new')).toBeHidden();
    expect(await storedSave(page)).toBe(before);
    expect((await stateOf(page)).shell.save).toMatchObject({ chapter: 'dec25', furthest: 'dec25', name: 'Lan' });
    expect((await active(page)).body).toBe(false);
  });

  test('every setting can be changed and kept with the keyboard alone, and the checkbox does not close the dialog', async ({ page }) => {
    await open(page);
    await keyboardMenu(page);
    await menuItem(page, 'menu-settings');
    await page.locator('#set-speed').focus();
    await page.keyboard.press('ArrowDown');
    await page.locator('#set-auto').focus();
    await page.keyboard.press('ArrowDown');
    await page.locator('#set-font').focus();
    await page.keyboard.press('ArrowDown');
    await page.locator('#set-motion').focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#settings')).toBeVisible();
    await page.locator('#settings-close').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#settings')).toBeHidden();
    const s = (await stateOf(page)).shell as unknown as { settings: Record<string, unknown> };
    expect(s.settings.textSpeed).not.toBe('instant');
    expect(s.settings.autoAdvance).not.toBe('off');
    expect(s.settings.fontSize).not.toBe('normal');
    expect(s.settings.reducedMotion).not.toBeNull();
    expect((await active(page)).body, 'focus lost after "Xong"').toBe(false);
  });

  test('the Tab order inside the settings is the reading order: speed, auto, music, sfx, font, motion, Xong', async ({ page }) => {
    await open(page);
    await keyboardMenu(page);
    await menuItem(page, 'menu-settings');
    await page.locator('#set-speed').focus();
    const order = ['set-speed'];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      order.push((await active(page)).id);
    }
    expect(order).toEqual(['set-speed', 'set-auto', 'set-music', 'set-sfx', 'set-font', 'set-motion', 'settings-close']);
  });

  test('the focus ring of the controls inside the dialogs has 3:1 contrast against the dialog (WCAG 2.2 non-text contrast)', async ({ page }) => {
    await open(page);
    await keyboardMenu(page);
    await menuItem(page, 'menu-settings');
    const rows: { id: string; ratio: number; style: string; width: number }[] = [];
    for (const id of ['set-speed', 'set-music', 'set-motion', 'settings-close']) {
      await page.locator('#' + id).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      rows.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const cs = getComputedStyle(el);
          const rgb = (v: string) => (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const lum = ([r, g, b]: number[]) => {
            const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
          };
          let bg = el.parentElement as HTMLElement;
          while (bg && /rgba\(.*, 0\)|transparent/.test(getComputedStyle(bg).backgroundColor)) bg = bg.parentElement as HTMLElement;
          const a = lum(rgb(cs.outlineColor));
          const b = lum(rgb(getComputedStyle(bg).backgroundColor));
          return { id: el.id, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
        }),
      );
    }
    for (const r of rows) {
      expect(r.style, r.id).not.toBe('none');
      expect(r.width, r.id).toBeGreaterThanOrEqual(2);
      expect(r.ratio, r.id + ' focus ring contrast ' + r.ratio.toFixed(2) + ':1 against the dialog').toBeGreaterThanOrEqual(3);
    }
  });
});

test.describe('keyboard: screens and the story', () => {
  test('a name is typed and sent with the keyboard alone: Enter on Lật trang until the question, the field has the focus, Enter sends it and the focus returns to Lật trang', async ({ page }) => {
    await open(page, save({ name: '', scene: 'hoi-ten' }));
    await page.locator('#advance').focus();
    for (let i = 0; i < 10 && !(await storyOf(page)).asking; i += 1) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(230);
    }
    expect((await storyOf(page)).asking).toBe(true);
    expect((await active(page)).id).toBe('name');
    await page.keyboard.type('Thảo');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    expect((await stateOf(page)).shell.save.name).toBe('Thảo');
    expect((await active(page)).id).toBe('advance');
  });

  test('typing in the name field and opening then closing the menu keeps the typed text and the question', async ({ page }) => {
    await open(page, save({ scene: 'hoi-ten' }));
    await page.locator('#advance').focus();
    for (let i = 0; i < 10 && !(await storyOf(page)).asking; i += 1) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(230);
    }
    await page.locator('#name').fill('Thảo Nguyên');
    await keyboardMenu(page);
    await page.keyboard.press('Escape');
    expect((await storyOf(page)).asking).toBe(true);
    await expect(page.locator('#name')).toHaveValue('Thảo Nguyên');
    await page.locator('#name').focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stateOf(page)).shell.save.name).toBe('Thảo Nguyên');
  });

  test('after a continue code is used the keyboard focus is on the story, so Enter moves the story on', async ({ page }) => {
    await open(page);
    await keyboardMenu(page);
    await menuItem(page, 'menu-code');
    await page.locator('#code-input').fill((await page.locator('#code-mine').inputValue()));
    await page.keyboard.press('Enter');
    await expect(page.locator('#code-dialog')).toBeHidden();
    await expect.poll(async () => (await storyOf(page)).scene).toBe('phong-ho-so');
    await expect.poll(() => lineIndex(page)).toBe(1);
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
    await expect.poll(() => lineIndex(page)).toBe(2);
  });

  test('"Lật trang" on the timeline and "Xong" on the name card are reached and used with the keyboard, and each hands the focus to the story', async ({ page }) => {
    await open(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' });
    await page.locator('#advance').focus();
    await pressUntil(page, 'timeline');
    await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { kind?: string } | null }).screen?.kind).toBe('timeline');
    expect((await active(page)).id, 'heading takes the focus when a screen opens').toBe('timeline-heading');
    for (let i = 0; i < 4 && (await active(page)).id !== 'timeline-next'; i += 1) await page.keyboard.press('Tab');
    expect((await active(page)).id).toBe('timeline-next');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    expect((await active(page)).id).toBe('advance');
    await pressUntil(page, 'namecard');
    await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean } }).screen?.ready).toBe(true);
    expect((await active(page)).id).toBe('namecard-heading');
    for (let i = 0; i < 14 && (await active(page)).id !== 'namecard-next'; i += 1) await page.keyboard.press('Tab');
    expect((await active(page)).id).toBe('namecard-next');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    expect((await active(page)).id).toBe('advance');
  });

  test('"Nhờ Cúc Cu soi tỏ" is reached with Tab and used with Enter until the puzzle is solved, then the story takes the keyboard focus back', async ({ page }) => {
    const w = watch(page);
    await seedSave(page, { schemaVersion: 1, name: '', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten' });
    await page.goto('/?manual=1');
    await waitReady(page);
    await page.locator('#advance').focus();
    for (let i = 0; i < 12 && !(await storyOf(page)).asking; i += 1) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(230);
    }
    await page.keyboard.type('Lan');
    await page.keyboard.press('Enter');
    for (let i = 0; i < 14 && (await stateOf(page)).shell.mode !== 'minigame'; i += 1) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(260);
    }
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 30_000 }).toBe('minigame');
    await expect.poll(async () => (await stateOf(page)).game?.id, { timeout: 30_000 }).toBe('intro');
    for (let n = 0; n < 40 && (await stateOf(page)).shell.mode === 'minigame'; n += 1) {
      const phase = ((await stateOf(page)).game as unknown as { phase: string }).phase;
      const want = phase === 'predict' ? 'pz-option-0' : phase === 'demo' ? 'pz-skip' : phase === 'reveal' || phase === 'verdict' ? 'pz-next' : 'pz-hint';
      const seen: string[] = [];
      for (let i = 0; i < 60 && (await active(page)).id !== want; i += 1) {
        await page.keyboard.press('Tab');
        seen.push((await active(page)).id || (await active(page)).tag);
      }
      expect((await active(page)).id, 'Tab never reached #' + want + '; visited ' + seen.join(' > ')).toBe(want);
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    await finishMinigame(page);
    const a = await active(page);
    expect(a.body, 'the focus fell to the page body when the mini game ended').toBe(false);
    expect(a.inStory).toBe(true);
    expectClean(w);
  });
});

test.describe('keyboard and pointer: leaving a mini game through the menu', () => {
  test('"Chơi mới" from inside the mini game starts chapter 1 again with no game left behind and no errors', async ({ page }) => {
    const w = watch(page);
    await openMini(page, '?manual=1');
    expect((await stateOf(page)).game).not.toBeNull();
    await page.locator('#menu-open').click();
    await page.locator('#menu-new').click();
    await page.locator('#confirm-new-yes').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    const s = await stateOf(page);
    expect(s.game).toBeNull();
    expect(s.story?.scene).toBe('phong-ho-so');
    expect(s.shell.save).toMatchObject({ name: '', chapter: 'intro', furthest: 'intro' });
    await expect(page.locator('#mg-canvas canvas')).toHaveCount(0);
    await expect(page.locator('#stage')).toBeHidden();
    await page.waitForTimeout(500);
    expectClean(w);
  });

  test('a continue code used from inside the mini game ends that game cleanly', async ({ page }) => {
    const w = watch(page);
    await openMini(page, '?manual=1');
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    await page.locator('#code-input').fill((await page.locator('#code-mine').inputValue()));
    await page.locator('#code-use').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    expect((await stateOf(page)).game).toBeNull();
    await expect(page.locator('#mg-canvas canvas')).toHaveCount(0);
    await page.waitForTimeout(500);
    expectClean(w);
  });

  test('"Chơi mới" then playing on reaches the mini game again with a working game', async ({ page }, info) => {
    await openMini(page, '?manual=1');
    await page.locator('#menu-open').click();
    await page.locator('#menu-new').click();
    await page.locator('#confirm-new-yes').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    await reachMinigame(page, info, 'Mai');
    const g = await puzzleOf(page);
    expect(g.completed).toBe(false);
    expect(g.id, 'a new game starts at chapter 1').toBe('intro');
    expect(Object.values(g.board ?? {}).flat()).toEqual([]);
    expect(typeName).toBeTruthy();
  });
});
