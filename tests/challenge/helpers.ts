import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import {
  advanceStory,
  dismissTitleQuietly,
  isTouch,
  realInput,
  reachMinigame,
  seedSave,
  solveMinigame,
  stateOf,
  step,
  tap,
  typeName,
  waitPhase,
  waitReady,
  finishMinigame,
  type AppState,
  type Point,
  type StrokeOptions,
} from '../support/play.ts';
import { GAME_SCENE } from '../support/puzzle.ts';

export { advanceStory, finishMinigame, isTouch, realInput, step, tap, typeName, waitPhase, waitReady, type AppState, type Point, type StrokeOptions };

export const state = stateOf;
export const GAME_SAVE = { schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: GAME_SCENE };
export const SAVE_KEY = 'teo:v1:save';

export interface Watch {
  errors: string[];
  foreign: string[];
  failed: string[];
  navigations: () => number;
  loads: () => number;
  requests: string[];
}

// Playwright's own screenshot injects a <style> that the page CSP refuses; that is a harness artifact, not an app error.
const HARNESS_NOISE = /Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline'/;

export function watch(page: Page, opts: { allowStatuses?: number[]; ignoreErrors?: RegExp } = {}): Watch {
  const errors: string[] = [];
  const foreign: string[] = [];
  const failed: string[] = [];
  const requests: string[] = [];
  let navs = 0;
  let loads = 0;
  page.on('domcontentloaded', () => {
    loads += 1;
  });
  let home: string | null = null;
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (HARNESS_NOISE.test(text) || opts.ignoreErrors?.test(text)) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    const url = r.url();
    requests.push(url);
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs += 1;
    if (/^(data|blob|about):/.test(url)) return;
    if (home === null && r.isNavigationRequest()) home = new URL(url).origin;
    if (home !== null && new URL(url).origin !== home) foreign.push(url);
  });
  page.on('requestfailed', (r) => {
    const reason = r.failure()?.errorText ?? '';
    if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled|Load request cancelled/i.test(reason)) failed.push(`${r.url()} ${reason}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !(opts.allowStatuses ?? []).includes(r.status())) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('websocket', (w) => foreign.push(`websocket ${w.url()}`));
  page.on('worker', (w) => foreign.push(`worker ${w.url()}`));
  return { errors, foreign, failed, requests, navigations: () => navs, loads: () => loads };
}

export function expectClean(w: Watch): void {
  expect(w.errors, 'console errors and page errors').toEqual([]);
  expect(w.foreign, 'requests to a foreign host').toEqual([]);
  expect(w.failed, 'failed requests or HTTP >= 400').toEqual([]);
}

/** Opens chapter 1 with a save at the scene of its puzzle (the vehicle for the shell tests) and walks the story with taps until the puzzle runs. */
export async function open(page: Page, query = ''): Promise<void> {
  await seedSave(page, GAME_SAVE);
  await page.goto(`/${query}`);
  await waitReady(page);
  await reachMinigame(page, test.info());
}

/**
 * Reaches the mini game with no key, click or touch that could unlock audio: the story runs on the auto-advance setting
 * and the name is submitted by a keydown that does not bubble to the document handlers.
 */
export async function openUntouched(page: Page, query = ''): Promise<void> {
  await seedSave(page, GAME_SAVE);
  await page.addInitScript(() => localStorage.setItem('teo:v1:settings', JSON.stringify({ version: 1, autoAdvance: 'fast' })));
  await page.goto(`/${query}`);
  await waitPhase(page, 'ready');
  await dismissTitleQuietly(page);
  for (let i = 0; i < 300; i += 1) {
    const s = await stateOf(page);
    if (s.game) return;
    if (s.story?.asking) {
      await page.evaluate(() => {
        const input = document.getElementById('name') as HTMLInputElement;
        input.value = 'Lan';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: false, cancelable: true }));
      });
    }
    await page.waitForTimeout(100);
  }
  throw new Error('the untouched story did not reach the mini game');
}

/** Opens the game at its very first line, with no save and no input. */
export async function openStory(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await waitPhase(page, 'ready');
  await dismissTitleQuietly(page);
}

/** Solves the puzzle that is up, with the manual clock. */
export async function solveManually(page: Page): Promise<void> {
  await solveMinigame(page, { manual: true, touch: false });
}

export async function solveInRealTime(page: Page): Promise<void> {
  await solveMinigame(page, realInput(test.info()));
}

export async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

export async function freshContext(browser: Browser, info: TestInfo, extra: Record<string, unknown> = {}): Promise<BrowserContext> {
  const { defaultBrowserType: _ignored, ...use } = info.project.use as Record<string, unknown>;
  return browser.newContext({ ...use, baseURL: info.project.use.baseURL, ...extra });
}

export function stubAudio(options: { throwOnConstruct?: boolean; none?: boolean; rejectResume?: boolean; slowResumeMs?: number } = {}): void {
  const w = window as unknown as Record<string, unknown>;
  const log = { created: [] as { active: boolean | undefined; hidden: boolean }[], resumes: 0, ctxs: [] as AudioContext[] };
  w.__audio = log;
  if (options.none) {
    w.AudioContext = undefined;
    w.webkitAudioContext = undefined;
    return;
  }
  if (options.throwOnConstruct) {
    const thrower = function () {
      throw new DOMException('The number of hardware contexts provided is greater than or equal to the maximum', 'NotSupportedError');
    };
    w.AudioContext = thrower;
    w.webkitAudioContext = thrower;
    return;
  }
  const Native = (w.AudioContext ?? w.webkitAudioContext) as typeof AudioContext;
  class Spy extends Native {
    constructor(...args: ConstructorParameters<typeof AudioContext>) {
      super(...args);
      log.created.push({ active: navigator.userActivation?.isActive, hidden: document.hidden });
      log.ctxs.push(this);
      if (options.rejectResume) void super.suspend();
    }
    override resume(): Promise<void> {
      log.resumes += 1;
      if (options.rejectResume) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      if (options.slowResumeMs) return new Promise<void>((done) => setTimeout(done, options.slowResumeMs)).then(() => super.resume());
      return super.resume();
    }
  }
  w.AudioContext = Spy;
  w.webkitAudioContext = Spy;
}

export interface AudioLog {
  created: { active: boolean | undefined; hidden: boolean }[];
  resumes: number;
}

export async function audioLog(page: Page): Promise<AudioLog> {
  return page.evaluate(() => {
    const l = (window as unknown as { __audio: { created: unknown[]; resumes: number } }).__audio;
    return { created: l.created, resumes: l.resumes } as AudioLog;
  });
}
