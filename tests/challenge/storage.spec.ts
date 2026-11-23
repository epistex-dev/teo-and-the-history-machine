import { expect, test, type Page } from '@playwright/test';
import { AFTER, GAME_SCENE, toBoard } from '../support/puzzle.ts';
import { expectClean, freshContext, open, openStory, solveInRealTime, solveManually, state, watch, waitReady } from './helpers.ts';
import { advanceStory, SAVE_KEY, storedSave, walkUntilScene } from '../support/play.ts';

test.describe.configure({ timeout: 150_000 });

const KEY = SAVE_KEY;
const valid = (extra: Record<string, unknown> = {}) => JSON.stringify({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten', ...extra });

async function seedAndReload(page: Page, raw: string): Promise<void> {
  await openStory(page);
  await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [KEY, raw]);
  await page.reload();
  await waitReady(page);
}

test.describe('storage failures', () => {
  test('getItem throws but setItem works: warns, still loads and plays', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = function () {
        throw new DOMException('denied', 'SecurityError');
      };
    });
    const w = watch(page);
    await openStory(page);
    const s = await state(page);
    expect(s.shell.storage.warning).toBe(true);
    expect(s.shell.storage.persistent).toBe(false);
    await expect(page.locator('#storage-warning')).toBeVisible();
    await open(page);
    await solveInRealTime(page);
    expect((await state(page)).shell.save, 'RAM keeps the progress').toMatchObject({ chapter: 'intro', scene: AFTER.scene, name: 'Lan' });
    expectClean(w);
  });

  test('quota exceeded on every real save (probe passes): warning at the first failing write, play continues, RAM keeps the progress', async ({ page }) => {
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.startsWith('teo:')) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        set.call(this, k, v);
      };
    });
    const w = watch(page);
    await open(page, '?manual=1');
    let s = await state(page);
    expect(s.shell.storage.warning, 'the first scene save failed').toBe(true);
    await expect(page.locator('#storage-warning')).toBeVisible();
    await expect(page.locator('#status')).not.toContainText('Đã lưu');
    expect(s.shell.save).toMatchObject({ scene: GAME_SCENE, name: 'Lan' });
    await solveManually(page);
    s = await state(page);
    expect(s.shell.mode, 'play went on after storage died').toBe('story');
    expect(s.shell.save, 'RAM fallback holds the latest save').toMatchObject({ chapter: 'intro', scene: AFTER.scene, name: 'Lan' });
    expectClean(w);
  });

  test('storage dies after a healthy first save: the warning appears at the failing write, not before', async ({ page }) => {
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.startsWith('teo:') && (window as unknown as { armed?: boolean }).armed) throw new DOMException('full', 'QuotaExceededError');
        set.call(this, k, v);
      };
    });
    const w = watch(page);
    await openStory(page);
    await expect(page.locator('#storage-warning'), 'healthy so far').toBeHidden();
    await expect(page.locator('#status')).toContainText('Đã lưu');
    await page.evaluate(() => ((window as unknown as { armed: boolean }).armed = true));
    await walkUntilScene(page, test.info(), 'hoi-ten');
    await expect(page.locator('#storage-warning')).toBeVisible();
    expect((await state(page)).shell.storage.persistent).toBe(false);
    expectClean(w);
  });

  test('window.localStorage is null (some webviews): warning, no crash, playable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => null });
    });
    const w = watch(page);
    await openStory(page);
    expect((await state(page)).shell.storage.warning).toBe(true);
    await open(page);
    await solveInRealTime(page);
    expectClean(w);
  });

  test('storage that silently drops writes is reported to the player', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        /* accepted and discarded, as some locked-down webviews do */
      };
    });
    await openStory(page);
    expect((await state(page)).shell.storage.warning, 'writes are lost, the player must be warned').toBe(true);
  });

  const fresh = { scene: 'phong-ho-so', name: '' };
  const saves: [string, string, { scene: string; name: string }][] = [
    ['valid control', valid(), { scene: 'hoi-ten', name: 'Lan' }],
    ['valid, resumes at the last scene', valid({ scene: 'kim-ket' }), { scene: 'kim-ket', name: 'Lan' }],
    ['v0 save is migrated', JSON.stringify({ schemaVersion: 0, name: 'Lan', chapter: 'intro', scene: 'cuc-cu' }), { scene: 'cuc-cu', name: 'Lan' }],
    ['not JSON', '{oops', fresh],
    ['JSON null', 'null', fresh],
    ['JSON array', '[1,2,3]', fresh],
    ['JSON string', '"scene"', fresh],
    ['empty string', '', fresh],
    ['future schemaVersion', valid({ schemaVersion: 2 }), fresh],
    ['schemaVersion as string', valid({ schemaVersion: '1' }), fresh],
    ['missing schemaVersion', JSON.stringify({ name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten' }), fresh],
    ['negative schemaVersion', valid({ schemaVersion: -1 }), fresh],
    ['fractional schemaVersion', valid({ schemaVersion: 0.5 }), fresh],
    ['scene as a number', valid({ scene: 4 }), fresh],
    ['scene that is not kebab-case', valid({ scene: 'Hoi Ten' }), fresh],
    ['scene id the chapter does not have: restart the chapter, keep the name', valid({ scene: 'nope' }), { scene: 'phong-ho-so', name: 'Lan' }],
    ['unknown chapter', valid({ chapter: 'ch99', furthest: 'ch99' }), fresh],
    ['furthest earlier than the current chapter', valid({ chapter: 'yule', furthest: 'intro', scene: '' }), fresh],
    ['name as a number', valid({ name: 123 }), fresh],
    ['name of 100 characters is cut to 24', valid({ name: 'ă'.repeat(100) }), { scene: 'hoi-ten', name: 'ă'.repeat(24) }],
    ['name with HTML stays text', valid({ name: '<img src=x onerror=alert(1)>' }), { scene: 'hoi-ten', name: '<img src=x onerror=alert(1)>'.slice(0, 24) }],
    ['__proto__ key is ignored', '{"schemaVersion":1,"name":"Lan","furthest":"intro","chapter":"intro","scene":"hoi-ten","__proto__":{"scene":"kim-ket"}}', { scene: 'hoi-ten', name: 'Lan' }],
    ['200000-deep nesting', '['.repeat(200_000), fresh],
    ['5 MB of junk', 'x'.repeat(5_000_000), fresh],
    ['lone surrogate in the name is replaced', '{"schemaVersion":1,"name":"\\ud800x","furthest":"intro","chapter":"intro","scene":"hoi-ten"}', { scene: 'hoi-ten', name: '\ufffdx' }],
  ];
  for (const [name, raw, want] of saves) {
    test(`save: ${name}`, async ({ page }) => {
      const w = watch(page);
      await seedAndReload(page, raw);
      const s = await state(page);
      expect(s.story?.scene).toBe(want.scene);
      expect(s.shell.save.name).toBe(want.name);
      expect(s.shell.storage.warning, 'a bad save is not a storage failure').toBe(false);
      expectClean(w);
    });
  }

  test('a corrupt save is overwritten by the next good write', async ({ page }) => {
    await seedAndReload(page, '{oops');
    const raw = await storedSave(page);
    expect(JSON.parse(raw ?? 'null')).toMatchObject({ schemaVersion: 1, chapter: 'intro', scene: 'phong-ho-so' });
  });

  test('two tabs: a stale tab must not roll progress back', async ({ browser }, info) => {
    const context = await freshContext(browser, info);
    try {
      const a = await context.newPage();
      const b = await context.newPage();
      await openStory(a);
      await openStory(b);
      await walkUntilScene(a, info, 'cuc-cu');
      expect((await state(a)).shell.save.scene).toBe('cuc-cu');
      for (let i = 0; i < 40 && (await state(b)).story?.scene !== 'hoi-ten'; i += 1) await advanceStory(b, info);
      expect((await state(b)).story?.scene, 'the stale tab is at an earlier scene').toBe('hoi-ten');
      expect(JSON.parse((await b.evaluate((k) => localStorage.getItem(k), KEY)) ?? 'null'), 'tab B did not overwrite tab A').toMatchObject({ scene: 'cuc-cu', furthest: 'intro', name: 'Lan' });
      await b.reload();
      await waitReady(b);
      expect((await state(b)).story?.scene, 'tab A saved cuc-cu, stale tab B must not roll it back').toBe('cuc-cu');
      expect((await state(b)).shell.save.name).toBe('Lan');
    } finally {
      await context.close();
    }
  });

  test('storage cleared behind the app mid-session: no crash, a fresh start after reload', async ({ page }) => {
    const w = watch(page);
    await openStory(page);
    await walkUntilScene(page, test.info(), 'cuc-cu');
    await page.evaluate(() => localStorage.clear());
    const s = await state(page);
    expect(s.shell.phase).toBe('ready');
    await page.reload();
    await waitReady(page);
    expect((await state(page)).shell.storage.warning).toBe(false);
    expect((await state(page)).story?.scene).toBe('phong-ho-so');
    expectClean(w);
  });

  test('storage warning does not cover the puzzle controls (portrait and landscape)', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('denied', 'SecurityError');
      };
    });
    await open(page);
    await expect(page.locator('#storage-warning')).toBeVisible();
    await toBoard(page, test.info());
    const vp = page.viewportSize() ?? { width: 390, height: 664 };
    for (const size of [vp, { width: vp.height, height: vp.width }, vp]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);
      for (const sel of ['#pz-hint', '#pz-check', '.pz-bank .pz-piece', '.pz-slot-btn']) {
        const target = page.locator(sel).first();
        await target.scrollIntoViewIfNeeded();
        const covered = await target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !(top && (top === el || el.contains(top)));
        });
        expect(covered, `${sel} is hit-testable at ${size.width}x${size.height}`).toBe(false);
      }
    }
  });
});
