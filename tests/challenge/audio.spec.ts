import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { audioLog, expectClean, open, openStory, openUntouched, setHidden, solveInRealTime, state, stubAudio, tap, watch } from './helpers.ts';
import { storyPoint } from '../support/play.ts';
import { puzzleOf } from '../support/puzzle.ts';

test.describe.configure({ timeout: 150_000 });

const audioState = async (page: Page) => (await state(page)).shell.audio.state;

const tapStory = async (page: Page, info: TestInfo) => {
  const p = await storyPoint(page);
  await tap(page, info, p.x, p.y);
};

test.describe('audio unlock and lifecycle', () => {
  test('no AudioContext is created before the first gesture', async ({ page }) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openStory(page);
    await page.mouse.move(100, 300);
    await page.waitForTimeout(800);
    expect((await audioLog(page)).created).toHaveLength(0);
    expect(await audioState(page)).toBe('none');
    expectClean(w);
  });

  test('first tap creates the context inside a user activation and it reaches running', async ({ page }, info) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openStory(page);
    await tapStory(page, info);
    await expect.poll(() => audioState(page)).toBe('running');
    const log = await audioLog(page);
    expect(log.created).toHaveLength(1);
    expect(log.created[0]?.active, 'AudioContext constructed while navigator.userActivation.isActive').toBe(true);
    await expect.poll(async () => (await state(page)).shell.audio.played).toBeGreaterThan(0);
    const t1 = (await state(page)).shell.audio.currentTime;
    await page.waitForTimeout(400);
    expect((await state(page)).shell.audio.currentTime, 'audio clock advances').toBeGreaterThan(t1);
    expectClean(w);
  });

  test('keyboard as the first input (Enter) unlocks audio', async ({ page }) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openStory(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => audioState(page)).toBe('running');
    expect((await audioLog(page)).created[0]?.active).toBe(true);
    expectClean(w);
  });

  test('a held key (auto-repeat) does not create more than one context', async ({ page }) => {
    await page.addInitScript(stubAudio);
    await openStory(page);
    await page.keyboard.down('Enter');
    for (let i = 0; i < 10; i += 1) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect.poll(() => audioState(page)).toBe('running');
    expect((await audioLog(page)).created).toHaveLength(1);
  });

  test('rapid repeated taps: one context, running, no errors', async ({ page }, info) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openStory(page);
    for (let i = 0; i < 40; i += 1) {
      await tapStory(page, info);
      await page.waitForTimeout(15);
    }
    await expect.poll(() => audioState(page)).toBe('running');
    expect((await audioLog(page)).created).toHaveLength(1);
    expect((await state(page)).shell.audio.played, 'greeting plays once, not per tap').toBeLessThanOrEqual(1);
    expectClean(w);
  });

  test('the very first input is a real solve of the puzzle: audio is running afterwards and the greeting sound played', async ({ page }) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openUntouched(page);
    expect((await audioLog(page)).created, 'nothing unlocked the audio before the first press').toHaveLength(0);
    expect(await audioState(page)).toBe('none');
    await solveInRealTime(page);
    await expect.poll(() => audioState(page)).toBe('running');
    expect((await audioLog(page)).created).toHaveLength(1);
    expect((await audioLog(page)).created[0]?.active).toBe(true);
    await expect.poll(async () => (await state(page)).shell.audio.played, 'a sound is audible for the first-ever press').toBeGreaterThanOrEqual(1);
    expectClean(w);
  });

  test('tab hidden before the first tap, shown later, then tap: running', async ({ page }, info) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openStory(page);
    await setHidden(page, true);
    expect((await state(page)).shell.hidden).toBe(true);
    expect(await audioState(page)).toBe('none');
    await setHidden(page, false);
    await tapStory(page, info);
    await expect.poll(() => audioState(page)).toBe('running');
    expectClean(w);
  });

  test('tab hidden before the first tap, shown later, then press: running and the puzzle stays usable', async ({ page }, info) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openUntouched(page);
    await setHidden(page, true);
    expect((await state(page)).shell.hidden).toBe(true);
    expect(await audioState(page)).toBe('none');
    await setHidden(page, false);
    const box = await page.locator('#pz-option-0').boundingBox();
    await tap(page, info, (box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    await expect.poll(() => audioState(page)).toBe('running');
    await expect.poll(async () => (await puzzleOf(page)).phase, 'the press reached the puzzle').not.toBe('predict');
    expectClean(w);
  });

  test('hidden suspends the context, visible recovers it and the puzzle keeps answering', async ({ page }) => {
    await page.addInitScript(stubAudio);
    await open(page);
    await expect.poll(() => audioState(page)).toBe('running');
    await setHidden(page, true);
    await expect.poll(() => audioState(page)).not.toBe('running');
    await setHidden(page, false);
    await expect.poll(() => audioState(page)).toBe('running');
    expect((await puzzleOf(page)).phase).toBe('predict');
  });

  test('hidden then visible in the same task (quick app switch): audio and loop do not stay suspended', async ({ page }) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await open(page);
    await expect.poll(() => audioState(page)).toBe('running');
    await page.evaluate(() => {
      for (const hidden of [true, false]) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    await page.waitForTimeout(1000);
    expect((await puzzleOf(page)).phase, 'puzzle still there').toBe('predict');
    expect(await audioState(page), 'audio recovered while the tab is visible').toBe('running');
    expectClean(w);
  });

  test('ten hide/show cycles 30 ms apart end running', async ({ page }) => {
    await page.addInitScript(stubAudio);
    await open(page);
    await expect.poll(() => audioState(page)).toBe('running');
    for (let i = 0; i < 10; i += 1) {
      await setHidden(page, true);
      await page.waitForTimeout(30);
      await setHidden(page, false);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(800);
    expect(await audioState(page)).toBe('running');
    expect((await puzzleOf(page)).phase).toBe('predict');
  });

  test('context suspended by the system while visible resumes on the next tap', async ({ page }, info) => {
    await page.addInitScript(stubAudio);
    const w = watch(page);
    await openStory(page);
    await tapStory(page, info);
    await expect.poll(() => audioState(page)).toBe('running');
    await page.evaluate(() => (window as unknown as { __audio: { ctxs: AudioContext[] } }).__audio.ctxs[0]?.suspend());
    await expect.poll(() => audioState(page)).toBe('suspended');
    await page.waitForTimeout(250);
    await tapStory(page, info);
    await expect.poll(() => audioState(page)).toBe('running');
    expect((await audioLog(page)).created).toHaveLength(1);
    expectClean(w);
  });

  test('resume() rejected by the browser: no unhandled error, next tap retries', async ({ page }, info) => {
    await page.addInitScript(stubAudio, { rejectResume: true });
    const w = watch(page);
    await openStory(page);
    await tapStory(page, info);
    await page.waitForTimeout(300);
    await tapStory(page, info);
    await page.waitForTimeout(300);
    expect((await audioLog(page)).resumes, 'each tap retries resume()').toBeGreaterThanOrEqual(2);
    expectClean(w);
  });

  test('no AudioContext in this webview: the game stays playable, no errors', async ({ page }) => {
    await page.addInitScript(stubAudio, { none: true });
    const w = watch(page);
    await open(page);
    await page.keyboard.press('Enter');
    await solveInRealTime(page);
    expect((await state(page)).shell.audio.state).toBe('none');
    expectClean(w);
  });

  test('AudioContext constructor throws on the first tap: no uncaught error, game still playable', async ({ page }) => {
    await page.addInitScript(stubAudio, { throwOnConstruct: true });
    const w = watch(page);
    await open(page);
    await page.waitForTimeout(200);
    await solveInRealTime(page);
    expectClean(w);
  });
});
