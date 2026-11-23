import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { advanceStory, expectClean, state, watch, waitReady } from '../challenge/helpers.ts';
import { cdpOf, isTouch, seedSave, storyOf, storyPoint, tap } from '../support/play.ts';

test.describe.configure({ timeout: 90_000 });

const wellFormed = (s: string): boolean => !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);

async function askPage(page: Page, info: TestInfo): Promise<void> {
  await seedSave(page);
  await page.goto('/');
  await waitReady(page);
  for (let i = 0; i < 6 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
  expect((await storyOf(page)).asking, 'the name prompt is up').toBe(true);
}

async function answer(page: Page, value: string): Promise<{ name: string; line: string }> {
  await page.locator('#name').fill(value);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
  await expect.poll(async () => (await storyOf(page)).line?.text ?? '').toContain('Dòng ký tên giờ ghi: ');
  return { name: (await state(page)).shell.save.name, line: (await storyOf(page)).line?.text ?? '' };
}

test.describe('name prompt: empty and invisible', () => {
  const blanks: [string, string][] = [
    ['empty', ''],
    ['spaces', '   '],
    ['tabs, NBSP, ideographic space', '\t\u00a0\u3000 '],
    ['zero-width spaces', '\u200b\u200b\u200b'],
    ['BOM', '\ufeff'],
    ['LRM and RLM only', '\u200e\u200f'],
    ['word joiner and soft hyphen', '\u2060\u00ad'],
  ];
  for (const [label, value] of blanks) {
    test('a name of only ' + label + ' falls back to "người đã hỏi"', async ({ page }, info) => {
      await askPage(page, info);
      const r = await answer(page, value);
      expect(r.line).toContain('Dòng ký tên giờ ghi: người đã hỏi. Lần này, tôi xin giữ cho trọn.');
    });
  }

  test('surrounding spaces are trimmed: the line has no double spaces around the name', async ({ page }, info) => {
    await askPage(page, info);
    const r = await answer(page, '   Lan   ');
    expect(r.name).toBe('Lan');
    expect(r.line).toContain('Dòng ký tên giờ ghi: Lan. Lần này, tôi xin giữ cho trọn.');
  });
});

test.describe('name prompt: length, marks, emoji, bidi', () => {
  test('24 decomposed ế (48 code points) is NFC first, so all 24 characters are kept', async ({ page }, info) => {
    await askPage(page, info);
    const r = await answer(page, 'e\u0302\u0301'.repeat(24));
    expect(r.name).toBe('ế'.repeat(24));
  });

  test('typing 30 decomposed characters through the keyboard keeps 24 NFC characters', async ({ page }, info) => {
    await askPage(page, info);
    await page.locator('#name').focus();
    await page.keyboard.insertText('o\u0309'.repeat(30));
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    expect((await state(page)).shell.save.name).toBe('ỏ'.repeat(24));
  });

  test('zalgo: a base letter with 40 marks is cut to at most 24 code points, stays well formed and the page does not overflow', async ({ page }, info) => {
    await askPage(page, info);
    const marks = Array.from({ length: 40 }, (_, i) => String.fromCodePoint(0x300 + i)).join('');
    const r = await answer(page, 'a' + marks);
    expect([...r.name].length).toBeLessThanOrEqual(24);
    expect(wellFormed(r.name)).toBe(true);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, 'horizontal overflow').toBeLessThanOrEqual(0);
  });

  test('a long unbreakable name of wide letters stays inside a 320 px screen', async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await askPage(page, info);
    await answer(page, 'W'.repeat(24));
    const box = await page.evaluate(() => {
      const r = document.getElementById('line')!.getBoundingClientRect();
      return { left: r.left, right: r.right, scroll: document.documentElement.scrollWidth, line: document.getElementById('line')!.scrollWidth, client: document.getElementById('line')!.clientWidth };
    });
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(321);
    expect(box.scroll).toBeLessThanOrEqual(320);
    expect(box.line, 'text wider than its box').toBeLessThanOrEqual(box.client + 1);
  });

  test('30 Santa emoji: at most 24 code points, no lone surrogate, no U+FFFD', async ({ page }, info) => {
    await askPage(page, info);
    const r = await answer(page, '🎅'.repeat(30));
    expect([...r.name].length).toBeLessThanOrEqual(24);
    expect(wellFormed(r.name)).toBe(true);
    expect(r.name).not.toContain('\ufffd');
    expect(r.line).toContain('Dòng ký tên giờ ghi: ' + r.name + '. Lần này, tôi xin giữ cho trọn.');
  });

  test('a cut never leaves a dangling ZWJ (family emoji after one letter)', async ({ page }, info) => {
    await askPage(page, info);
    const r = await answer(page, 'a' + '👨‍👩‍👧‍👦'.repeat(7));
    expect(r.name.endsWith('\u200d'), 'name ends with a zero width joiner').toBe(false);
    expect(wellFormed(r.name)).toBe(true);
  });

  test('a cut never leaves half a flag (one letter, then flags)', async ({ page }, info) => {
    await askPage(page, info);
    const r = await answer(page, 'a' + '🇻🇳'.repeat(20));
    const regional = [...r.name].filter((c) => c >= '\u{1F1E6}' && c <= '\u{1F1FF}').length;
    expect(regional % 2, 'odd number of regional indicators = a half flag').toBe(0);
  });

  test('Arabic name is shown as text', async ({ page }, info) => {
    await askPage(page, info);
    const r = await answer(page, 'مرحبا بالعالم');
    expect(r.name).toBe('مرحبا بالعالم');
    await expect(page.locator('#line')).toContainText('مرحبا بالعالم');
  });

  for (const [label, value] of [['right-to-left override', '\u202Eabc'], ['right-to-left isolate without its end', '\u2067xyz']] as const) {
    test('bidi control: ' + label + ' cannot reorder the rest of the line', async ({ page }, info) => {
      await askPage(page, info);
      const r = await answer(page, value);
      const ok = await page.evaluate((name) => {
        if (!/[\u202a-\u202e\u2066-\u2069]/.test(name)) return true;
        const line = document.getElementById('line')!;
        for (const el of line.querySelectorAll('*')) if (el.textContent?.includes(name) && /isolate|plaintext/.test(getComputedStyle(el).unicodeBidi)) return true;
        return false;
      }, r.name);
      expect(ok, 'the name is neither stripped of bidi controls nor isolated in the line').toBe(true);
    });
  }
});

test.describe('name prompt: markup and replacement patterns', () => {
  const evil: [string, string][] = [
    ['img onerror', '<img src=x onerror=_p=1>'],
    ['svg onload', '<svg onload=_p=1>'],
    ['script', '<script>_p=1</script>'],
    ['closing tags', '</p></div><b>x</b>'],
    ['entities', '&lt;b&gt;&amp;'],
    ['attribute break', '"><i onclick=_p=1>'],
  ];
  for (const [label, value] of evil) {
    test('markup stays text: ' + label, async ({ page }, info) => {
      const w = watch(page);
      await askPage(page, info);
      const imgs = await page.locator('img').count();
      const r = await answer(page, value);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => (window as unknown as { _p?: number })._p), 'script ran').toBeUndefined();
      expect(await page.locator('img').count(), 'an img was created').toBe(imgs);
      expect(await page.locator('#story [onerror], #story [onload], #story [onclick], #story b, #story i, #story svg:not([aria-hidden]) script').count()).toBe(0);
      expect(await page.locator('#line').textContent()).toContain(r.name);
      expect(r.line).toContain(r.name);
      await page.reload();
      await waitReady(page);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => (window as unknown as { _p?: number })._p), 'script ran after reload').toBeUndefined();
      expectClean(w);
    });
  }

  for (const value of ['$&', "$'", '$' + String.fromCharCode(96), '$$', '$1', '{ten}', '{ten}{ten}']) {
    test('replacement pattern ' + JSON.stringify(value) + ' is shown literally in the {ten} lines', async ({ page }, info) => {
      await askPage(page, info);
      const r = await answer(page, value);
      expect(r.name).toBe(value);
      expect(r.line).toBe('Dòng ký tên giờ ghi: ' + value + '. Lần này, tôi xin giữ cho trọn.');
    });
  }
});

test.describe('name prompt: submitting', () => {
  test('Safari-style IME: Enter after compositionend with isComposing false and keyCode 229 does not submit', async ({ page }, info) => {
    await askPage(page, info);
    await page.locator('#name').focus();
    await page.evaluate(() => {
      const el = document.getElementById('name') as HTMLInputElement;
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      el.value = 'tiê';
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'tiê' }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: false, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(300);
    expect((await storyOf(page)).asking, 'the Enter that only commits the composition submitted the name').toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
  });

  test('real Chromium IME composition: Enter inside the composition does not submit', async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'CDP IME is Chromium only');
    await askPage(page, info);
    const cdp = await cdpOf(page);
    await page.locator('#name').focus();
    await cdp.send('Input.imeSetComposition', { text: 'tie', selectionStart: 3, selectionEnd: 3 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    expect((await storyOf(page)).asking, 'Enter during composition submitted the prompt').toBe(true);
    await cdp.send('Input.insertText', { text: 'tiê' });
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    expect((await state(page)).shell.save.name).toBe('tiê');
  });

  test('a held Enter submits once and does not also advance the next line', async ({ page }, info) => {
    await askPage(page, info);
    await page.locator('#name').fill('Lan');
    for (let i = 0; i < 8; i += 1) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await page.waitForTimeout(700);
    expect((await storyOf(page)).line?.text, 'the Enter that submitted also advanced a line').toMatch(/^Dòng ký tên giờ ghi: Lan\./);
  });

  test('a double tap on Ký tên submits once and does not skip the next line', async ({ page }, info) => {
    await askPage(page, info);
    await page.locator('#name').fill('Lan');
    const b = (await page.locator('#name-done').boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    if (isTouch(info)) {
      await page.touchscreen.tap(x, y);
      await page.touchscreen.tap(x, y);
    } else {
      await page.mouse.dblclick(x, y);
    }
    await page.waitForTimeout(700);
    expect((await storyOf(page)).line?.text, 'the second tap fell through to the story').toMatch(/^Dòng ký tên giờ ghi: Lan\./);
  });

  test('while the prompt is up, taps on the story and on Lật trang do not dismiss it, keys on the page do not either', async ({ page }, info) => {
    await askPage(page, info);
    const p = await storyPoint(page);
    for (let i = 0; i < 4; i += 1) {
      await tap(page, info, p.x, p.y);
      await page.waitForTimeout(260);
    }
    if (await page.locator('#advance').isVisible()) await page.locator('#advance').click({ force: true, trial: false }).catch(() => undefined);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (const key of ['Enter', ' ', 'ArrowRight']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(260);
    }
    expect((await storyOf(page)).asking, 'the prompt was skipped without a name').toBe(true);
  });

  test('desktop: the input has focus as soon as the prompt shows', async ({ page }, info) => {
    test.skip(isTouch(info), 'no forced keyboard on touch');
    await askPage(page, info);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('name');
  });

  test('keyboard only: Tab reaches the input and Ký tên, Space types a space instead of advancing', async ({ page }, info) => {
    test.skip(isTouch(info), 'keyboard path');
    await askPage(page, info);
    await page.keyboard.type('An Nhi');
    expect((await storyOf(page)).asking).toBe(true);
    expect(await page.locator('#name').inputValue()).toBe('An Nhi');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('name-done');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    expect((await state(page)).shell.save.name).toBe('An Nhi');
  });

  test('paste of 200 characters with newline and tabs: 24 kept, trimmed', async ({ page, browserName }, info) => {
    await askPage(page, info);
    await page.locator('#name').focus();
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.evaluate(() => navigator.clipboard.writeText('\t  ' + 'Nguyễn '.repeat(30) + '\n'));
      await page.keyboard.press('Control+V');
    } else {
      await page.keyboard.insertText('\t  ' + 'Nguyễn '.repeat(30) + '\n');
    }
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    const name = (await state(page)).shell.save.name;
    expect([...name].length).toBeLessThanOrEqual(24);
    expect(name).toMatch(/^Nguyễn/);
    expect(name).toBe(name.trim());
    expect(name).not.toMatch(/[\n\t]/);
  });

  test('pasting markup stays text', async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'clipboard permission is Chromium only');
    await askPage(page, info);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => navigator.clipboard.writeText('<img src=x onerror=_p=1>'));
    await page.locator('#name').focus();
    await page.keyboard.press('Control+V');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as unknown as { _p?: number })._p)).toBeUndefined();
  });

  test('after a reload in the middle of the mini game the saved name is not wiped by an empty answer', async ({ page }, info) => {
    await seedSave(page);
    await page.goto('/');
    await waitReady(page);
    for (let i = 0; i < 6 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
    await answer(page, 'Lan');
    for (let i = 0; i < 30 && !(await state(page)).game; i += 1) {
      if ((await state(page)).shell.mode === 'minigame') await page.waitForTimeout(50);
      else await advanceStory(page, info);
    }
    expect((await state(page)).game).not.toBeNull();
    await page.reload();
    await waitReady(page);
    const s = await storyOf(page);
    if (s.asking) {
      const prefilled = await page.locator('#name').inputValue();
      if (prefilled === '') {
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
      }
    }
    expect((await state(page)).shell.save.name, 'the name the player gave is lost after a reload').toBe('Lan');
  });
});
