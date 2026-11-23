import { expect, test, type Page } from '@playwright/test';
import { openAtCode } from './challenge-ch25/helpers.ts';
import { SAVE_KEY, seedSave, waitReady } from './support/play.ts';

test.describe.configure({ timeout: 90_000 });

const PHONES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const;

const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });

async function open(page: Page, size: { width: number; height: number }, seed: object = save()): Promise<void> {
  await page.setViewportSize(size);
  await seedSave(page, seed);
  await page.goto('/');
  await waitReady(page);
}

const TARGETS = 'button, select, textarea, summary, a[href], input:not([type="hidden"])';

/** Height of every control a finger has to hit: a checkbox is hit through its label. */
const targetHeights = (page: Page, scope: string) =>
  page.locator(scope).evaluate((root, selector) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return [...root.querySelectorAll(selector)].filter(visible).map((el) => {
      const hit = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') ? (el.closest('label') ?? el) : el;
      const r = hit.getBoundingClientRect();
      return { name: (el.id || el.tagName.toLowerCase()) + ' "' + (hit.textContent ?? '').trim().slice(0, 24) + '"', height: Math.round(r.height * 10) / 10 };
    });
  }, TARGETS);

const expectTall = (targets: { name: string; height: number }[]) => {
  expect(targets.length, 'targets found').toBeGreaterThan(0);
  expect(targets.filter((t) => t.height < 44), 'targets under 44 px').toEqual([]);
};

for (const size of PHONES) {
  test.describe(`${size.width}×${size.height}`, () => {
    test('every target in Cài đặt is at least 44 px tall', async ({ page }) => {
      await open(page, size);
      await page.locator('#menu-open').click();
      await page.locator('#menu-settings').click();
      await expect(page.locator('#settings')).toBeVisible();
      const targets = await targetHeights(page, '#settings');
      expect(targets.map((t) => t.name).join('|')).toContain('set-motion');
      expectTall(targets);
    });

    test('every target in an open Sổ nguồn card, source links included, is at least 44 px tall', async ({ page }) => {
      await open(page, size, save({ furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' }));
      await page.locator('#menu-open').click();
      await page.locator('#menu-notebook').click();
      const card = page.locator('#notebook-list .card').first();
      await expect(card).toBeVisible();
      await card.locator('summary').click();
      await expect(card.locator('details')).toHaveJSProperty('open', true);
      await page.locator('#notebook-list details').evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)));
      const targets = await targetHeights(page, '#notebook-dialog');
      expect(targets.filter((t) => t.name.startsWith('a ')).length, 'source links').toBeGreaterThan(0);
      expectTall(targets);
    });
  });
}

for (const width of [320, 360]) {
  test(`the title in the top bar is whole at ${width} px`, async ({ page }) => {
    await open(page, { width, height: 640 });
    const title = await page.locator('.bar h1').evaluate((h) => {
      const range = document.createRange();
      range.selectNodeContents(h);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      const cs = getComputedStyle(h);
      return { text: h.textContent, wide: h.scrollWidth - h.clientWidth, tall: h.scrollHeight - h.clientHeight, ellipsis: cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible' && cs.whiteSpace === 'nowrap', lines: lines.size };
    });
    expect(title.text).toBe('Tèo và Cỗ máy Lịch sử');
    expect(title.wide, 'text wider than the box').toBeLessThanOrEqual(0);
    expect(title.tall, 'text taller than the box').toBeLessThanOrEqual(0);
    expect(title.ellipsis, 'ellipsis').toBe(false);
    expect(title.lines, 'lines').toBeLessThanOrEqual(2);
  });
}

/** Line contents of a textarea, read from a copy that wraps with the same box and type. */
const codeLines = (page: Page, selector: string) =>
  page.locator(selector).evaluate((area) => {
    const text = (area as HTMLTextAreaElement).value;
    const cs = getComputedStyle(area);
    const probe = document.createElement('div');
    for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariantNumeric', 'letterSpacing', 'lineHeight', 'overflowWrap', 'wordBreak'] as const) probe.style[key] = cs[key];
    probe.style.cssText += ';position:fixed;top:0;left:0;visibility:hidden;white-space:pre-wrap;box-sizing:content-box;inline-size:' + (area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px';
    probe.textContent = text;
    document.body.append(probe);
    const rows = new Map<number, string>();
    const range = document.createRange();
    const node = probe.firstChild as Text;
    for (let i = 0; i < text.length; i += 1) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const top = Math.round(range.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) ?? '') + text[i]);
    }
    const heightLines = Math.round(((area as HTMLTextAreaElement).scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight));
    probe.remove();
    return { lines: [...rows.entries()].sort((a, b) => a[0] - b[0]).map((r) => r[1]), rendered: heightLines, wide: area.scrollWidth - area.clientWidth };
  });

async function expectEven(page: Page, where: string, selector: string): Promise<void> {
  const code = await page.locator(selector).inputValue();
  expect(code, where).toMatch(/^TEO1\./);
  await expect.poll(async () => (await codeLines(page, selector)).lines.filter((l) => l.length <= 2), { message: where + ' short lines once the wrap is evened', timeout: 5000 }).toEqual([]);
  const got = await codeLines(page, selector);
  expect(got.lines.join(''), where).toBe(code);
  expect(got.rendered, where + ' rendered lines').toBeGreaterThanOrEqual(got.lines.length);
  expect(got.wide, where + ' sideways overflow').toBeLessThanOrEqual(0);
  expect(
    got.lines.filter((l) => l.length <= 2),
    where + ' short lines in ' + JSON.stringify(got.lines),
  ).toEqual([]);
}

const PHONE = PHONES[0];
const ending = (name: string) => save({ name, furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' });
const NAMES = ['', 'Lan', 'Nguyễn Thị Thu Hằng', 'Trần Quang Khải Hoàng Anh Tú'];

async function openCodeDialog(page: Page): Promise<void> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-code').click();
  await expect(page.locator('#code-dialog')).toBeVisible();
}

test.describe('the continue code at 320 px never leaves a 1–2 character line', () => {
  for (const name of NAMES) {
    test(`in the code dialog, before and after a refused code (name "${name}")`, async ({ page }) => {
      await open(page, PHONE, ending(name));
      await openCodeDialog(page);
      await expectEven(page, 'code dialog', '#code-mine');
      await page.locator('#code-input').fill('TEO1.sai');
      await page.locator('#code-use').click();
      await expect(page.locator('#code-error')).not.toHaveText('');
      await expectEven(page, 'code dialog with its error', '#code-mine');
    });

    test(`on the card screen that closes an act (name "${name}")`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await seedSave(page, save({ name, furthest: 'nicholas', chapter: 'nicholas', scene: '' }));
      await page.goto('/?preview=card:nicholas');
      await waitReady(page);
      await expect(page.locator('#card-code')).toBeVisible();
      await expectEven(page, 'card screen', '#card-code-text');
    });

    test(`on the code screen at the end of the story (name "${name}")`, async ({ page }, info) => {
      await openAtCode(page, info, name, PHONE);
      await expectEven(page, 'code screen', '#code-screen-text');
    });
  }

  test('in the code dialog for every name length from 0 to 24 characters', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, PHONE, ending(''));
    for (const source of ['Trần Quang Khải Hoàng Anh Tú', 'Lan Anh Mai Hoa Binh Duong Wii']) {
      for (let length = 0; length <= 24; length += 1) {
        await page.evaluate(([key, value]) => localStorage.setItem(key as string, value as string), [SAVE_KEY, JSON.stringify(ending(source.slice(0, length)))]);
        await page.reload();
        await waitReady(page);
        await openCodeDialog(page);
        await expectEven(page, 'code dialog, name "' + source.slice(0, length) + '"', '#code-mine');
      }
    }
  });
});
