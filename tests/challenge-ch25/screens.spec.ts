import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { makeCode } from '../../src/code.ts';
import { letterText } from '../support/letter.ts';
import { cleanName } from '../../src/save.ts';
import { advanceStory, isTouch, stateOf, step, storedSave, storyOf, waitReady } from '../support/play.ts';
import { AFTER, LANDSCAPE, helpThrough, maybeEnd, modeOf, openAtCode, openAtEnd, openAtGame, openAtScene, screenOf, toEndScreen } from './helpers.ts';

const END_CODE = makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending' });
const FINISHED_CODE = makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending', finished: true });
const saveOf = async (page: Page) => (await stateOf(page)).shell.save;
const consoleOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};
const activeId = (page: Page): Promise<string> => page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName ?? '');
const visibleFocus = (page: Page): Promise<boolean> => page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return !!e && e !== document.body && e.getClientRects().length > 0; });

test.describe('ch25 reload and history', () => {
  test('reload at the end screen: progress and name kept, no minigame to replay, the end screen comes back, the code is still the old one', async ({ page }, info) => {
    const errors = consoleOf(page);
    await openAtEnd(page, info);
    const before = await saveOf(page);
    await page.reload();
    await waitReady(page);
    expect(await saveOf(page), 'the save survives the reload').toEqual(before);
    expect(before).toMatchObject({ name: 'Lan', chapter: 'ending', furthest: 'ending' });
    const modes = await toEndScreen(page, info);
    expect(modes, 'the finished minigame is not asked again').not.toContain('minigame');
    await expect(page.locator('#end-text')).toContainText('Lan');
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    await expect(page.locator('#code-mine')).toHaveValue(FINISHED_CODE);
    expect(errors).toEqual([]);
  });

  test('reload at the code screen: the same code shows again and the end screen still follows', async ({ page }, info) => {
    const errors = consoleOf(page);
    await openAtCode(page, info);
    await expect(page.locator('#code-screen-text')).toHaveValue(FINISHED_CODE);
    await page.reload();
    await waitReady(page);
    expect((await saveOf(page)).furthest).toBe('ending');
    let shown = '';
    for (let i = 0; i < 80 && (await modeOf(page)) !== 'end'; i += 1) {
      const mode = await modeOf(page);
      if (mode === 'code') {
        shown = await page.locator('#code-screen-text').inputValue();
        await page.locator('#code-screen-next').click();
      } else if (mode === 'namecard') {
        await expect.poll(async () => (await screenOf(page))?.ready).toBe(true);
        await page.locator('#namecard-next').click();
      } else if (mode === 'minigame') throw new Error('minigame came back');
      else await advanceStory(page, info);
    }
    expect(shown).toBe(FINISHED_CODE);
    expect(await modeOf(page)).toBe('end');
    expect(errors).toEqual([]);
  });

  test('reload in the middle of the mini game puts the player back at the scene before it, not at the end of the chapter or on a blank screen', async ({ page }, info) => {
    await openAtGame(page, info, '?manual=1');
    await step(page, 3000);
    await page.reload();
    await waitReady(page);
    const s = await storyOf(page);
    expect(s.chapter).toBe('ending');
    expect(await modeOf(page)).toBe('story');
    expect((await saveOf(page)).furthest).toBe('ending');
    for (let i = 0; i < 60 && (await modeOf(page)) !== 'minigame'; i += 1) await advanceStory(page, info);
    expect((await stateOf(page)).game?.id, 'the puzzle comes back').toBe('ending');
  });

  test('the browser back button at the end screen leaves cleanly; going forward again keeps the save and the end screen or its last scene works', async ({ page }, info) => {
    const errors = consoleOf(page);
    await page.goto('about:blank');
    await openAtEnd(page, info);
    const before = await saveOf(page);
    await page.goBack();
    await expect.poll(() => page.url()).toBe('about:blank');
    await page.goForward();
    await waitReady(page);
    expect(await storedSave(page)).toContain('"furthest":"ending"');
    expect(await saveOf(page)).toEqual(before);
    await toEndScreen(page, info);
    await expect(page.locator('#end-text')).toContainText('Lan');
    expect(errors).toEqual([]);
  });

  test('Chơi mới from the end screen, then the continue code of the old run: the ending plays again from its first scene with the name, the right mini game and the end screen', async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors = consoleOf(page);
    await openAtScene(page, 'the-ten', '?manual=1');
    await toEndScreen(page, info);
    await page.locator('#end-new').click();
    await page.locator('#confirm-new-yes').click();
    await expect.poll(async () => (await storyOf(page)).chapter).toBe('intro');
    expect(await saveOf(page)).toMatchObject({ name: '', chapter: 'intro', furthest: 'intro' });
    await expect(page.locator('#end-screen')).toBeHidden();
    await expect(page.locator('#story')).toBeVisible();
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-list .card'), 'a new game has no cards').toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    await page.locator('#code-input').fill(END_CODE);
    await page.locator('#code-use').click();
    await expect.poll(async () => (await storyOf(page)).scene).toBe('thao-may');
    expect((await storyOf(page)).chapter).toBe('ending');
    expect(await saveOf(page)).toMatchObject({ name: 'Lan', chapter: 'ending', furthest: 'ending' });
    for (let i = 0; i < 60 && (await modeOf(page)) !== 'minigame'; i += 1) await advanceStory(page, info);
    for (let i = 0; i < 60 && !(await maybeEnd(page)); i += 1) await page.waitForTimeout(100);
    expect((await stateOf(page)).game?.id, 'the ending game, not a cached one of the first chapter').toBe('ending');
    await helpThrough(page, info);
    expect((await storyOf(page)).line?.text).toBe(AFTER());
    const modes = await toEndScreen(page, info);
    expect(modes.at(-1)).toBe('end');
    await expect(page.locator('#end-text')).toContainText('Lan');
    await page.locator('#end-notebook').click();
    await expect(page.locator('#notebook-list .card')).toHaveCount(18);
    expect(errors).toEqual([]);
  });
});

test.describe('ch25 end screen buttons', () => {
  test('Sổ nguồn from the end screen opens once, lists 18 cards every time, closes with Esc and with Đóng, and the focus goes back to the button', async ({ page }, info) => {
    const errors = consoleOf(page);
    await openAtEnd(page, info);
    for (const how of ['Escape', 'close', 'Escape'] as const) {
      await page.locator('#end-notebook').click();
      await expect(page.locator('#notebook-dialog')).toBeVisible();
      await expect(page.locator('#notebook-list .card')).toHaveCount(18);
      expect(await page.locator('dialog[open]').count()).toBe(1);
      await page.keyboard.press('Enter');
      await page.keyboard.press(' ');
      await page.keyboard.press('ArrowRight');
      expect(await modeOf(page), 'keys inside the notebook do not touch the end screen').toBe('end');
      if (how === 'Escape') await page.keyboard.press('Escape');
      else await page.locator('#notebook-dialog button[type=submit]').click();
      await expect(page.locator('#notebook-dialog')).toBeHidden();
      expect(await modeOf(page)).toBe('end');
      expect(await activeId(page), 'the focus returns to the button that opened the notebook').toBe('end-notebook');
    }
    expect(errors).toEqual([]);
  });

  for (const warm of [false, true]) {
    test('double tap on "Chơi mới" ' + (warm ? 'after the shell loaded' : 'on first use') + ' does not wipe the save', async ({ page }, info) => {
      await openAtEnd(page, info);
      if (warm) {
        await page.locator('#end-notebook').click();
        await expect(page.locator('#notebook-dialog')).toBeVisible();
        await page.keyboard.press('Escape');
      }
      const before = await saveOf(page);
      await doubleTap(page, info, '#end-new');
      await page.waitForTimeout(800);
      expect(await saveOf(page), 'the save is untouched').toEqual(before);
      expect(await modeOf(page), 'still on the end screen').toBe('end');
      expect(await page.locator('#confirm-new[open]').count(), 'the question is open or was dismissed, never answered yes').toBeLessThanOrEqual(1);
      expect(await storedSave(page)).toContain('"furthest":"ending"');
    });

    test('double tap on "Sổ nguồn" ' + (warm ? 'after the shell loaded' : 'on first use') + ' opens one dialog with 18 cards', async ({ page }, info) => {
      await openAtEnd(page, info);
      if (warm) {
        await page.locator('#end-card').click();
        await expect.poll(async () => (await screenOf(page))?.ready).toBe(true);
        await page.locator('#namecard-next').click();
        await expect.poll(() => modeOf(page)).toBe('end');
      }
      await doubleTap(page, info, '#end-notebook');
      await expect(page.locator('#notebook-dialog')).toBeVisible();
      await page.waitForTimeout(500);
      await expect(page.locator('#notebook-list .card')).toHaveCount(18);
      await page.keyboard.press('Escape');
      expect(await page.locator('dialog[open]').count(), 'one Esc closes it').toBe(0);
      expect(await modeOf(page)).toBe('end');
    });

    test('double tap on "Xem lại thư trả lời" ' + (warm ? 'after the shell loaded' : 'on first use') + ' ends in a consistent screen with a card that draws', async ({ page }, info) => {
      const errors = consoleOf(page);
      await openAtEnd(page, info);
      if (warm) {
        await page.locator('#end-notebook').click();
        await expect(page.locator('#notebook-dialog')).toBeVisible();
        await page.keyboard.press('Escape');
      }
      await doubleTap(page, info, '#end-card');
      await page.waitForTimeout(2000);
      const mode = await modeOf(page);
      expect(['namecard', 'end']).toContain(mode);
      expect((await screenOf(page))?.kind, 'the state names the screen on view').toBe(mode);
      if (mode === 'namecard') {
        await expect.poll(async () => (await screenOf(page))?.ready).toBe(true);
        await page.locator('#namecard-next').click();
      }
      await expect.poll(() => modeOf(page)).toBe('end');
      expect((await screenOf(page))?.kind).toBe('end');
      expect(errors).toEqual([]);
    });
  }

  test('"Xong" pressed in the same moment as "Xem lại thư trả lời", before the card has drawn, goes back to the end screen and the late card does not replace the end screen state or take the focus', async ({ page }, info) => {
    await openAtEnd(page, info);
    await page.locator('#end-notebook').click();
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    for (let round = 0; round < 3; round += 1) {
      await page.evaluate(() => {
        (document.getElementById('end-card') as HTMLElement).click();
        setTimeout(() => (document.getElementById('namecard-next') as HTMLElement).click(), 0);
      });
      await expect.poll(() => modeOf(page)).toBe('end');
      await page.waitForTimeout(1500);
      expect(await modeOf(page)).toBe('end');
      expect((await screenOf(page))?.kind, 'state names the end screen, not the card that finished late (round ' + round + ')').toBe('end');
      expect(await activeId(page), 'the focus is not parked on the hidden card heading (round ' + round + ')').not.toBe('namecard-heading');
      expect(await visibleFocus(page), 'the focus is on something on screen').toBe(true);
    }
  });

  test('the end buttons and the name card work with the keyboard alone, and the focus lands on the new screen each time', async ({ page }, info) => {
    test.setTimeout(120_000);
    await openAtScene(page, 'thao-may', '?manual=1');
    const lost: string[] = [];
    const tabTo = async (id: string): Promise<void> => {
      for (let i = 0; i < 90; i += 1) {
        if ((await activeId(page)) === id) return;
        await page.keyboard.press('Tab');
      }
      throw new Error('Tab never reaches #' + id + ' (focus is on ' + (await activeId(page)) + ')');
    };
    let helped = false;
    const heading: Record<string, string> = { timeline: 'timeline-heading', code: 'code-screen-heading', namecard: 'namecard-heading', end: 'end-heading' };
    for (let i = 0; i < 300; i += 1) {
      const mode = await modeOf(page);
      if (mode === 'end') break;
      if (mode === 'minigame') {
        if (!(await maybeEnd(page))) {
          await page.waitForTimeout(50);
          continue;
        }
        if (!helped) {
          helped = true;
          await page.keyboard.down('Enter');
          await page.keyboard.down(' ');
          await step(page, 3000);
          await page.keyboard.up(' ');
          await page.keyboard.up('Enter');
          const held = await maybeEnd(page);
          expect(held?.hints, 'held keys do nothing in the puzzle').toBe(0);
          expect(held?.completed).toBe(false);
        }
        const g = await maybeEnd(page);
        await page.waitForTimeout(280);
        if (g?.phase === 'predict') await tabTo('pz-option-' + ((await page.locator('.pz-option').count()) - 1));
        else if (g?.phase === 'demo') await tabTo('pz-skip');
        else if (g?.phase === 'reveal' || g?.phase === 'verdict') await tabTo('pz-next');
        else await tabTo('pz-hint');
        await page.keyboard.press('Enter');
        continue;
      }
      if (mode === 'story') {
        const key = JSON.stringify([(await stateOf(page)).story]);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(230);
        if (JSON.stringify([(await stateOf(page)).story]) === key) await page.waitForTimeout(250);
        continue;
      }
      if (mode === 'namecard') await expect.poll(async () => (await screenOf(page))?.ready, { timeout: 10_000 }).toBe(true);
      if ((await activeId(page)) !== heading[mode]) lost.push(mode + ' focus ' + (await activeId(page)));
      await tabTo(mode === 'timeline' ? 'timeline-next' : mode === 'namecard' ? 'namecard-next' : 'code-screen-next');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    expect(await modeOf(page)).toBe('end');
    if ((await activeId(page)) !== 'end-heading') lost.push('end focus ' + (await activeId(page)));
    expect(lost, 'every screen takes the focus').toEqual([]);
    await tabTo('end-notebook');
    await page.keyboard.press('Enter');
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await activeId(page)).toBe('end-notebook');
    await tabTo('end-card');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await screenOf(page))?.ready).toBe(true);
    expect(await activeId(page)).toBe('namecard-heading');
    await tabTo('namecard-next');
    await page.keyboard.press('Enter');
    await expect.poll(() => modeOf(page)).toBe('end');
    expect(await activeId(page), 'back on the end screen the focus is on its heading').toBe('end-heading');
    await tabTo('end-new');
    await page.keyboard.press('Enter');
    await expect(page.locator('#confirm-new')).toBeVisible();
    expect(await activeId(page), 'the safe answer has the focus').toBe('confirm-new-no');
    await page.keyboard.press('Enter');
    await expect(page.locator('#confirm-new')).toBeHidden();
    expect(await modeOf(page)).toBe('end');
    expect(await activeId(page)).toBe('end-new');
  });
});

async function doubleTap(page: Page, info: TestInfo, selector: string): Promise<void> {
  const b = (await page.locator(selector).boundingBox()) as { x: number; y: number; width: number; height: number };
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  if (isTouch(info)) {
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
  } else await page.mouse.dblclick(x, y);
}

test.describe('ch25 small screens for the name card, code screen and end screen', () => {
  for (const [label, size, font] of [['320x568', { width: 320, height: 568 }, 'normal'], ['320x568 with the largest text', { width: 320, height: 568 }, 'xlarge'], ['844x390 landscape', LANDSCAPE, 'normal'], ['844x390 landscape with the largest text', LANDSCAPE, 'xlarge']] as const) {
    test(label + ': nothing spills sideways, every control can be scrolled to and is at least 44 css px, the whole code shows in its field', async ({ page }, info) => {
      await page.addInitScript((f) => localStorage.setItem('teo:v1:settings', JSON.stringify({ version: 1, fontSize: f })), font);
      const check = async (what: string, ids: string[], screen: string): Promise<void> => {
        const out = await page.evaluate(
          ([sel, list]) => {
            const root = document.querySelector(sel as string) as HTMLElement;
            const r = [] as string[];
            if (root.scrollWidth > root.clientWidth + 1) r.push('screen scrolls sideways ' + root.scrollWidth + '>' + root.clientWidth);
            if (document.documentElement.scrollWidth > innerWidth) r.push('page scrolls sideways');
            for (const id of list as string[]) {
              const e = document.getElementById(id) as HTMLElement;
              e.scrollIntoView({ block: 'center' });
              const b = e.getBoundingClientRect();
              if (b.left < -0.5 || b.right > innerWidth + 0.5) r.push(id + ' outside horizontally ' + Math.round(b.left) + '..' + Math.round(b.right));
              if (b.top < -0.5 || b.bottom > innerHeight + 0.5) r.push(id + ' not reachable vertically ' + Math.round(b.top) + '..' + Math.round(b.bottom));
              if (b.height < 43.5 || b.width < 43.5) r.push(id + ' too small ' + Math.round(b.width) + 'x' + Math.round(b.height));
            }
            return r;
          },
          [screen, ids],
        );
        expect(out, what).toEqual([]);
      };
      await openAtScene(page, 'the-ten', '', 'Lan', size);
      let sawCode = false;
      let sawCard = false;
      for (let i = 0; i < 80 && (await modeOf(page)) !== 'end'; i += 1) {
        const mode = await modeOf(page);
        if (mode === 'namecard') {
          await expect.poll(async () => (await screenOf(page))?.ready, { timeout: 10_000 }).toBe(true);
          const img = await page.locator('#namecard-img').boundingBox();
          expect((img as { width: number }).width).toBeLessThanOrEqual(size.width);
          await check('name card', ['namecard-save', 'namecard-next'], '#namecard-screen');
          sawCard = true;
          await page.locator('#namecard-next').click();
        } else if (mode === 'code') {
          await check('code screen', ['code-screen-copy', 'code-screen-next'], '#code-screen');
          const clipped = await page.locator('#code-screen-text').evaluate((e: HTMLInputElement) => e.scrollWidth > e.clientWidth + 1);
          expect.soft(clipped, 'the whole code shows in its field').toBe(false);
          sawCode = true;
          await page.locator('#code-screen-next').click();
        } else await advanceStory(page, info);
      }
      expect(sawCard && sawCode).toBe(true);
      await check('end screen', ['end-notebook', 'end-card', 'end-new'], '#end-screen');
    });
  }
});

test.describe('ch25 name card with hard names', () => {
  const NAMES: [string, string][] = [
    ['24 wide letters', 'W'.repeat(24)],
    ['21 clusters with two combining marks each', 'W\u0323\u0302'.repeat(21)],
    ['tall Vietnamese capitals', 'ẪẬỆỘỬỮẶ'.repeat(3)],
    ['marks piled on one letter', 'A\u0323\u0302\u0309\u0303\u0301\u0300 Lan'],
  ];

  async function cardOf(page: Page, name: string): Promise<{ png: PNG; info: Record<string, unknown> }> {
    await page.goto('/');
    await waitReady(page);
    await page.evaluate((save) => localStorage.setItem('teo:v1:save', save), JSON.stringify({ schemaVersion: 1, name, furthest: 'ending', chapter: 'ending', scene: 'the-ten' }));
    await page.reload();
    await waitReady(page);
    for (let i = 0; i < 20 && (await modeOf(page)) !== 'namecard'; i += 1) await advanceStory(page, test.info());
    await expect.poll(async () => (await screenOf(page))?.ready, { timeout: 15_000 }).toBe(true);
    const info = (await screenOf(page)) as Record<string, unknown>;
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#namecard-save').click()]);
    return { png: PNG.sync.read(readFileSync((await download.path()) as string)), info };
  }

  const bandDiff = (a: PNG, b: PNG): number => {
    let diff = 0;
    for (let y = 0; y < a.height; y += 1) {
      for (let x = 0; x < a.width; x += 1) {
        if (x >= 100 && x < a.width - 100) continue;
        const i = (y * a.width + x) * 4;
        if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) diff += 1;
      }
    }
    return diff;
  };

  test('a long or mark-heavy name is cleaned, drawn inside the card margins at 1080 x 1350, shrunk but not below 12 px, and shown on the end screen as text', async ({ page }, info) => {
    test.setTimeout(150_000);
    const errors = consoleOf(page);
    const base = await cardOf(page, 'Lan');
    expect(base.png.width).toBe(1080);
    expect(base.png.height).toBe(1350);
    for (const [label, raw] of NAMES) {
      const name = cleanName(raw);
      const { png, info: state } = await cardOf(page, raw);
      expect(state.name, label + ': the state holds the cleaned name').toBe(name);
      expect([png.width, png.height], label).toEqual([1080, 1350]);
      expect(state.fontPx as number, label + ': font size').toBeGreaterThanOrEqual(12);
      expect(state.fontPx as number, label + ': font size').toBeLessThanOrEqual(150);
      expect(bandDiff(base.png, png), label + ': nothing drawn in the 100 px side margins').toBe(0);
      await expect(page.locator('#namecard-img')).toHaveAttribute('alt', letterText(name));
      await page.locator('#namecard-next').click();
      await toEndScreen(page, info);
      expect(await page.locator('#end-text').textContent(), label).toContain('Thư trả lời gửi ' + name + ' lên đường');
    }
    expect(errors).toEqual([]);
  });
});

test.describe('ch25 whole chapter after the game', () => {
  test('the helper path from the game reaches the timeline, name card, code screen and end screen in that order with the name on the end screen', async ({ page }, info) => {
    test.setTimeout(150_000);
    const errors = consoleOf(page);
    await openAtGame(page, info, '?manual=1');
    await helpThrough(page, info);
    expect((await storyOf(page)).line?.text).toBe(AFTER());
    const modes = await toEndScreen(page, info);
    expect(modes.filter((m) => m !== 'story')).toEqual(['timeline', 'namecard', 'code', 'end']);
    expect(await page.locator('#end-text').textContent()).toContain('Lan');
    expect(errors).toEqual([]);
  });
});
