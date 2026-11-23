import { expect, test, type Page } from '@playwright/test';
import { makeCode } from '../src/code.ts';
import { CAST, type CastName } from '../src/story/types.ts';
import { openAtCode, openAtEnd, openAtScene, screenOf } from './challenge-ch25/helpers.ts';
import { advanceStory, seedSave, stateOf, storedSave, storyOf, waitReady } from './support/play.ts';
import { chapterOf } from './support/script.ts';

/** Where the feet stand in each baked sprite frame (the teo, cuckoo and crow frames of art/style), as a fraction of the frame height. */
const FEET = { teo: 336 / 348, 'cuc-cu': 150 / 158, 'qua-don': 190 / 196 } as const;
const END_CODE = makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending' });
const modeOf = async (page: Page): Promise<string> => (await stateOf(page)).shell.mode;

async function enterCode(page: Page, code: string): Promise<void> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-code').click();
  await page.locator('#code-input').fill(code);
  await page.locator('#code-use').click();
}

test.describe('end screen and codes', () => {
  test('refresh at the end screen returns to the end screen, with no scene, name card or code screen on the way', async ({ page }, info) => {
    await openAtEnd(page, info);
    await expect.poll(async () => (await stateOf(page)).shell.save.scene).toBe('end');
    expect(JSON.parse((await storedSave(page)) ?? '{}')).toMatchObject({ chapter: 'ending', furthest: 'ending', scene: 'end', name: 'Lan' });
    await page.reload();
    await waitReady(page);
    const s = await stateOf(page);
    expect(s.shell.mode).toBe('end');
    expect(s.shell.save).toMatchObject({ chapter: 'ending', furthest: 'ending', scene: 'end', name: 'Lan' });
    await expect(page.locator('#end-screen')).toBeVisible();
    await expect(page.locator('#story')).toBeHidden();
    await expect(page.locator('#end-text')).toContainText('Lan');
    expect(await screenOf(page)).toMatchObject({ kind: 'end', name: 'Lan' });
    await expect(page.locator('#end-heading')).toBeFocused();
  });

  test('the name card from the end screen survives a refresh too: the end screen comes back', async ({ page }, info) => {
    await openAtEnd(page, info);
    await page.locator('#end-card').click();
    await expect(page.locator('#namecard-screen')).toBeVisible();
    await page.reload();
    await waitReady(page);
    expect(await modeOf(page)).toBe('end');
  });

  test('"Nhập mã" at the end screen: an older code of the ending, without the finished mark, replays the ending from its first scene', async ({ page }, info) => {
    await openAtEnd(page, info);
    await enterCode(page, END_CODE);
    await expect.poll(async () => (await storyOf(page)).scene).toBe(chapterOf('ending').scenes[0]?.id);
    await expect(page.locator('#end-screen')).toBeHidden();
    await expect(page.locator('#story')).toBeVisible();
    expect((await stateOf(page)).shell.save).toMatchObject({ chapter: 'ending', furthest: 'ending', name: 'Lan' });
    await page.reload();
    await waitReady(page);
    expect(await modeOf(page), 'a replay in progress is not an end screen').toBe('story');
  });

  test('"Nhập mã" at the end screen: the code of an earlier chapter goes back there and keeps the furthest chapter', async ({ page }, info) => {
    await openAtEnd(page, info);
    await enterCode(page, makeCode({ name: 'Lan', chapter: 'saturnalia', furthest: 'saturnalia' }));
    await expect.poll(async () => (await storyOf(page)).chapter).toBe('saturnalia');
    await expect(page.locator('#end-screen')).toBeHidden();
    expect((await stateOf(page)).shell.save.furthest).toBe('ending');
  });

  test('a double tap on "Lật trang" at the code screen moves on by one line, not two', async ({ page }, info) => {
    await openAtCode(page, info);
    const script = chapterOf('ending');
    const beats = script.scenes.flatMap((s) => s.beats);
    const after = beats.slice(beats.findIndex((b) => b.t === 'code') + 1).find((b) => b.t === 'say' || b.t === 'narr');
    await page.evaluate(() => {
      const next = document.getElementById('code-screen-next') as HTMLButtonElement;
      next.click();
      next.click();
    });
    await expect.poll(() => modeOf(page)).toBe('story');
    await page.waitForTimeout(300);
    expect((await storyOf(page)).line?.text).toBe(((after as { text: string }).text).replaceAll('{ten}', 'Lan'));
  });

  test('the texts of the end screen and the code screen', async ({ page }, info) => {
    await openAtCode(page, info);
    await expect(page.locator('#code-screen .code-box p').first()).toHaveText('Chép mã này để lần sau quay lại màn kết, trên máy này hoặc máy khác. Mã cũng nằm trong Menu, mục "Nhập mã".');
    await page.locator('#code-screen-next').click();
    for (let i = 0; i < 20 && (await modeOf(page)) !== 'end'; i += 1) await advanceStory(page, info);
    await expect(page.locator('#end-text')).toHaveText(
      'Thư trả lời gửi Lan lên đường lúc nửa đêm, do Tèo viết và ký. Sổ nguồn còn giữ từng lớp lịch sử.',
    );
  });

  test('the name stays text: a name with markup shows as typed on the end screen', async ({ page }, info) => {
    await openAtEnd(page, info, '<b>x</b>&amp;');
    await expect(page.locator('#end-text')).toContainText('Thư trả lời gửi <b>x</b>&amp; lên đường');
    await expect(page.locator('#end-text b')).toHaveCount(0);
  });
});

test.describe('continue code fields', () => {
  const NAME = 'Ẫ'.repeat(24);
  for (const [label, font] of [['normal text', 'normal'], ['largest text', 'xlarge']] as const) {
    test(`the whole code of the longest name is visible on the code screen and in the menu at 320 x 568, ${label}`, async ({ page }, info) => {
      await page.addInitScript((size) => localStorage.setItem('teo:v1:settings', JSON.stringify({ version: 1, fontSize: size })), font);
      await openAtCode(page, info, NAME, { width: 320, height: 568 });
      const code = makeCode({ name: NAME, chapter: 'ending', furthest: 'ending', finished: true });
      const whole = (id: string) =>
        page.locator(id).evaluate((el) => {
          const f = el as HTMLTextAreaElement;
          return { width: f.scrollWidth <= f.clientWidth + 1, height: f.scrollHeight <= f.clientHeight + 1, inside: f.getBoundingClientRect().right <= innerWidth + 1 };
        });
      await expect(page.locator('#code-screen-text')).toHaveValue(code);
      expect(await whole('#code-screen-text'), 'code screen').toEqual({ width: true, height: true, inside: true });
      await page.locator('#menu-open').click();
      await page.locator('#menu-code').click();
      await expect(page.locator('#code-mine')).toHaveValue(code);
      expect(await whole('#code-mine'), 'menu').toEqual({ width: true, height: true, inside: true });
    });
  }
});

test.describe('portrait and short screens', () => {
  test('the end and code screens sit in the middle of a phone screen, not in its top third', async ({ page }, info) => {
    await openAtCode(page, info, 'Lan', { width: 390, height: 844 });
    const middle = (id: string) =>
      page.evaluate((sel) => {
        const screen = document.querySelector(sel) as HTMLElement;
        const box = screen.getBoundingClientRect();
        const first = (screen.firstElementChild as HTMLElement).getBoundingClientRect();
        const last = (screen.lastElementChild as HTMLElement).getBoundingClientRect();
        return ((first.top + last.bottom) / 2 - box.top) / box.height;
      }, id);
    expect(await middle('#code-screen'), 'code screen').toBeGreaterThan(0.4);
    expect(await middle('#code-screen')).toBeLessThan(0.6);
    await page.locator('#code-screen-next').click();
    for (let i = 0; i < 20 && (await modeOf(page)) !== 'end'; i += 1) await advanceStory(page, info);
    expect(await middle('#end-screen'), 'end screen').toBeGreaterThan(0.4);
    expect(await middle('#end-screen')).toBeLessThan(0.6);
  });

  test('the name card with its buttons fits a landscape phone without scrolling', async ({ page }, info) => {
    await openAtScene(page, 'the-ten', '', 'Lan', { width: 844, height: 390 });
    for (let i = 0; i < 10 && (await modeOf(page)) !== 'namecard'; i += 1) await advanceStory(page, info);
    await expect.poll(async () => (await screenOf(page))?.ready).toBe(true);
    const fits = await page.locator('#namecard-screen').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
    expect(fits).toBe(true);
  });
});

test.describe('overlapping chapter loads', () => {
  test('the chapter entered last wins, even when an earlier chapter chunk arrives after it', async ({ page }) => {
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: '' });
    await page.route('**/assets/chapter-saturnalia-*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto('/');
    await waitReady(page);
    await enterCode(page, makeCode({ name: 'Lan', chapter: 'saturnalia', furthest: 'saturnalia' }));
    await enterCode(page, END_CODE);
    await expect.poll(async () => (await storyOf(page)).chapter).toBe('ending');
    await page.waitForTimeout(3500);
    expect((await storyOf(page)).chapter, 'the slow chapter did not replace the one entered last').toBe('ending');
    expect(await modeOf(page)).toBe('story');
  });

  test('a chapter that loaded first does not show itself while the one entered after it is still loading', async ({ page }) => {
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: '' });
    const slow = (pattern: string, ms: number) =>
      page.route(pattern, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        await route.continue();
      });
    await slow('**/assets/chapter-saturnalia-*.js', 1200);
    await slow('**/assets/chapter-ending-*.js', 3000);
    await page.goto('/');
    await waitReady(page);
    await enterCode(page, makeCode({ name: 'Lan', chapter: 'saturnalia', furthest: 'saturnalia' }));
    await enterCode(page, END_CODE);
    await page.waitForTimeout(1500);
    expect(await storyOf(page), 'still loading the last chapter, nothing of the first one is on screen').toMatchObject({ chapter: 'ending', mode: 'loading' });
    await expect(page.locator('#story')).toBeHidden();
    expect((await storyOf(page)).scene).toBeUndefined();
    await page.evaluate(() => document.getElementById('advance')?.click());
    expect((await storyOf(page)).scene, 'Lật trang does nothing while a chapter loads').toBeUndefined();
    await expect.poll(async () => (await storyOf(page)).scene, { timeout: 8000 }).toBe(chapterOf('ending').scenes[0]?.id);
    expect((await storyOf(page)).chapter).toBe('ending');
  });
});

test.describe('stage placement', () => {
  for (const [label, size] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]] as const) {
    test(`every figure's reported feet match its box in ${label}, Quạ Đồn on his own perch included`, async ({ page }, info) => {
      await page.setViewportSize(size);
      await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'saturnalia', chapter: 'saturnalia', scene: chapterOf('saturnalia').scenes[1]?.id ?? '' });
      await page.goto('/');
      await waitReady(page);
      for (let i = 0; i < 12 && !(await storyOf(page)).cast?.some((c) => c.name === 'Quạ Đồn'); i += 1) await advanceStory(page, info);
      const cast = (await storyOf(page)).cast as unknown as { name: CastName; box: { top: number; height: number; feet: number } }[];
      expect(cast.some((c) => c.name === 'Quạ Đồn')).toBe(true);
      for (const c of cast) {
        const rootY = FEET[CAST[c.name].key];
        expect(c.box.feet, `${c.name} feet`).toBeCloseTo(c.box.top + c.box.height * rootY, 0);
      }
    });
  }
});
