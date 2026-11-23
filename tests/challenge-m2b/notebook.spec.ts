import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { seedSave, stateOf, waitReady } from '../support/play.ts';

test.describe.configure({ timeout: 90_000 });

const IDS = ['intro', 'saturnalia', 'yule', 'mistletoe', 'bethlehem', 'dec25', 'nicholas', 'carol', 'krampus', 'befana', 'tree', 'ban1647', 'silent-night', 'yule-lads', 'yule-cat', 'santa-ny', 'caga-tio', 'dickens', 'brooms', 'ending'];
const VERIFIED = ['saturnalia', 'yule', 'mistletoe', 'bethlehem', 'dec25', 'nicholas'];

/** Bible §7: stamp ("Dấu") of every chapter. */
const BIBLE_STAMP: Record<string, string> = {};
for (const line of readFileSync('story/bible.md', 'utf8').split('\n')) {
  const m = /^\| \d+ \| `([a-z0-9-]+)` \| [^|]*\| [^|]*\| ([^|]*)\|/.exec(line);
  if (m && /^[A-ZÀ-Ỹ ]+$/.test(m[2]!.trim())) BIBLE_STAMP[m[1]!] = m[2]!.trim();
}
const SECTION_FOR_STAMP: Record<string, string> = { 'SỰ THẬT': 'fact', 'TRUYỀN THUYẾT': 'legend', 'THEO KINH THÁNH': 'tradition', 'TRANH CÃI': 'dispute' };

const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });

async function open(page: Page, seed: object | null = save(), query = ''): Promise<void> {
  if (seed) await seedSave(page, seed);
  await page.goto('/' + query);
  await waitReady(page);
}

/** Sổ nguồn with every card, as the player sees it after the whole story (furthest = ending). */
async function fullNotebook(page: Page): Promise<void> {
  await open(page, save({ furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' }));
  await page.locator('#menu-open').click();
  await page.locator('#menu-notebook').click();
  await expect(page.locator('#notebook-list .card').first()).toBeVisible();
}

const linksOf = (page: Page, scope: string) =>
  page.locator(scope + ' a').evaluateAll((as) => as.map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent ?? '').trim(), target: (a as HTMLAnchorElement).target, rel: (a as HTMLAnchorElement).rel, chapter: a.closest('.card')?.getAttribute('data-chapter') ?? '' })));

test.describe('Sổ nguồn: what the bible and R6 promise', () => {
  test('bible §7 has a stamp for every chapter we check', async () => {
    for (const id of VERIFIED) expect(BIBLE_STAMP[id], id).toBeTruthy();
  });

  test('the Sổ nguồn at the end of the story lists a card for each of the 23 chapters before the last one, in chapter order, headed "Chương N · title"', async ({ page }) => {
    await fullNotebook(page);
    const heads = await page.locator('#notebook-list .card').evaluateAll((els) => els.map((e) => ({ id: (e as HTMLElement).dataset.chapter ?? '', title: e.querySelector('.card-title')?.textContent ?? '' })));
    expect(heads.map((h) => h.id)).toEqual(IDS.filter((id) => id !== 'intro' && id !== 'ending'));
    for (const h of heads) expect(h.title, h.id).toMatch(new RegExp('^Chương ' + (IDS.indexOf(h.id) + 1) + ' · \\S'));
  });

  for (const id of VERIFIED) {
    test('the card of ' + id + ' has the stamp of bible §7, 2 to 3 lines, and a section that matches its stamp', async ({ page }) => {
      await open(page, save({ furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' }));
      await page.locator('#menu-open').click();
      await page.locator('#menu-notebook').click();
      const card = page.locator('#notebook-list .card[data-chapter="' + id + '"]');
      await expect(card).toBeVisible();
      await expect(card.locator('.stamp')).toHaveText(BIBLE_STAMP[id]!);
      const lines = await card.locator('.card-line').count();
      expect(lines, 'card lines').toBeGreaterThanOrEqual(2);
      expect(lines, 'card lines').toBeLessThanOrEqual(3);
      await card.locator('summary').click();
      const section = SECTION_FOR_STAMP[BIBLE_STAMP[id]!]!;
      await expect(card.locator('[data-section="' + section + '"] li').first(), 'a ' + BIBLE_STAMP[id] + ' chapter needs its ' + section + ' section').toBeVisible();
      const order = await card.locator('[data-section]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.section));
      const want = ['fact', 'legend', 'tradition', 'dispute'];
      expect(order, 'sections keep the order Sự thật, Truyền thuyết, Theo Kinh Thánh, Tranh cãi').toEqual(want.filter((s) => order.includes(s)));
    });
  }

  test('every point of every card has at least one source link (R6: mọi ý có link nguồn)', async ({ page }) => {
    await fullNotebook(page);
    for (const summary of await page.locator('#notebook-list summary').all()) await summary.click();
    const bare = await page.locator('#notebook-list .card-section li').evaluateAll((els) =>
      els.filter((li) => li.querySelectorAll('a').length === 0).map((li) => (li.closest('.card') as HTMLElement).dataset.chapter + ': ' + (li.textContent ?? '').slice(0, 80)),
    );
    expect(bare, 'points with no source link').toEqual([]);
  });

  test('every link in the Sổ nguồn opens a new tab with rel=noopener, is https, has a readable name and is not a Wikipedia page', async ({ page }) => {
    await fullNotebook(page);
    for (const summary of await page.locator('#notebook-list summary').all()) await summary.click();
    const links = await linksOf(page, '#notebook-list');
    expect(links.length).toBeGreaterThan(20);
    for (const l of links) {
      const where = l.chapter + ' ' + l.href;
      expect(l.target, where).toBe('_blank');
      expect(l.rel.split(/\s+/), where).toContain('noopener');
      expect(l.href, where).toMatch(/^https:\/\/[^/]+\//);
      expect(l.text.replace(/\(mở trong tab mới\)/, '').trim().length, 'no visible name: ' + where).toBeGreaterThan(2);
      expect(new URL(l.href).hostname, 'Wikipedia only to trace sources, never as a source: ' + where).not.toMatch(/wikipedia\.org$/);
    }
  });

  test('a card for a chapter that has no verified text is flagged and shows no stamp, no section, no link', async ({ page }) => {
    await fullNotebook(page);
    const unwritten = IDS.filter((id) => id !== 'intro' && id !== 'ending' && !existsSync(`story/notebook/${id}.json`));
    test.skip(unwritten.length === 0, 'every chapter has a verified card');
    for (const id of unwritten) {
      const card = page.locator('#notebook-list .card[data-chapter="' + id + '"]');
      await expect(card.locator('.flag')).toHaveText('Chưa viết');
      await expect(card.locator('.stamp, details, a')).toHaveCount(0);
    }
  });

  test('the card that was just shown on the card screen is in the Sổ nguồn at that moment', async ({ page }) => {
    await open(page, save({ furthest: 'saturnalia', chapter: 'saturnalia', scene: '' }), '?preview=card:saturnalia');
    await expect(page.locator('#card-screen .card[data-chapter="saturnalia"]')).toBeVisible();
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await expect(page.locator('#notebook-list .card[data-chapter="saturnalia"]'), 'the Sổ nguồn is missing the card the player is looking at').toHaveCount(1);
  });

  test('chapters before the farthest one show their card, the farthest chapter and later ones do not', async ({ page }) => {
    await open(page, save({ furthest: 'yule', chapter: 'yule', scene: '' }));
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await expect(page.locator('#notebook-list .card').first()).toBeVisible();
    expect(await page.locator('#notebook-list .card').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.chapter))).toEqual(['saturnalia']);
  });
});

test.describe('Sổ nguồn: links, real clicks and the keyboard', () => {
  async function stubExternal(page: Page): Promise<string[]> {
    const referers: string[] = [];
    await page.context().route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async (route) => {
      referers.push(route.request().headers().referer ?? '');
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>nguon</title><p>nguon</p>' });
    });
    return referers;
  }

  test('a click on a source link opens a new tab that cannot reach back (no opener, no referrer) and leaves the game where it was', async ({ page }) => {
    const referers = await stubExternal(page);
    await open(page, save({ furthest: 'yule', chapter: 'yule', scene: '' }));
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    const card = page.locator('#notebook-list .card[data-chapter="saturnalia"]');
    await card.locator('summary').click();
    const before = page.url();
    const [popup] = await Promise.all([page.context().waitForEvent('page'), card.locator('a').first().click()]);
    await popup.waitForLoadState();
    expect(await popup.evaluate(() => window.opener), 'the new tab keeps a handle on the game').toBeNull();
    expect(referers.at(-1), 'the game URL leaked as a referrer').toBe('');
    expect(page.url()).toBe(before);
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await popup.close();
  });

  test('"Xem đủ" opens and closes with Enter and with Space, a link inside takes Tab focus and Enter opens it in a new tab', async ({ page }) => {
    await stubExternal(page);
    await open(page, save({ furthest: 'yule', chapter: 'yule', scene: '' }));
    await page.locator('#menu-open').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#menu')).toBeVisible();
    await page.locator('#menu-notebook').focus();
    await page.keyboard.press('Enter');
    const card = page.locator('#notebook-list .card[data-chapter="saturnalia"]');
    await expect(card).toBeVisible();
    await card.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(card.locator('details')).toHaveJSProperty('open', true);
    await page.keyboard.press('Enter');
    await expect(card.locator('details')).toHaveJSProperty('open', false);
    await page.keyboard.press(' ');
    await expect(card.locator('details')).toHaveJSProperty('open', true);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName), 'the first thing after "Xem đủ" is a link or a control').toBeTruthy();
    const link = card.locator('a').first();
    await link.focus();
    const [popup] = await Promise.all([page.context().waitForEvent('page'), page.keyboard.press('Enter')]);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();
  });

  test('the card screen has "Xem đủ" with the same sections and links, and "Lật trang" is reachable with Tab after them', async ({ page }) => {
    await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), '?preview=card:dec25');
    const card = page.locator('#card-screen .card');
    await expect(card.locator('summary')).toHaveText('Xem đủ');
    await expect(card.locator('.card-line')).not.toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('card-heading');
    await card.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(card.locator('[data-section="dispute"] li').first()).toBeVisible();
    const links = await linksOf(page, '#card-screen');
    expect(links.length).toBeGreaterThan(3);
    for (const l of links) {
      expect(l.target).toBe('_blank');
      expect(l.rel.split(/\s+/)).toContain('noopener');
    }
    let reached = false;
    for (let i = 0; i < links.length + 6 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = (await page.evaluate(() => document.activeElement?.id)) === 'card-next';
    }
    expect(reached, 'Tab did not reach "Lật trang"').toBe(true);
  });

  test('the card screen of an act-ending chapter reaches the code, its copy button and "Lật trang" in that Tab order', async ({ page }) => {
    await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), '?preview=card:nicholas');
    const order: string[] = [];
    for (let i = 0; i < 24 && order.at(-1) !== 'card-next'; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || ''));
    }
    const named = order.filter((x) => x.startsWith('card-'));
    expect(named).toEqual(['card-code-text', 'card-code-copy', 'card-next']);
  });

});
