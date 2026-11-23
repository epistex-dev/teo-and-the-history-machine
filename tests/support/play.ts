import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { solvePuzzle } from './puzzle.ts';

export const SAVE_KEY = 'teo:v1:save';
export const START_OF_MINIGAME = { schemaVersion: 1, name: '', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten' };

export interface Line {
  kind: 'say' | 'narr' | 'stamp';
  speaker: string;
  expr: string | null;
  text: string;
}

export interface Story {
  chapter: string;
  mode: string;
  title?: string;
  scene?: string;
  sceneIndex?: number;
  scenes?: number;
  beat?: number;
  lineIndex?: number;
  sceneLines?: number;
  line?: Line | null;
  plate?: string | null;
  asking?: boolean;
  name?: string;
  bg?: { id: string | null; color: string };
  cast?: { name: string; expr: string }[];
}

export interface SaveState {
  schemaVersion: number;
  name: string;
  furthest: string;
  chapter: string;
  scene: string;
}

export interface Shell {
  phase: 'loading' | 'ready' | 'network-error';
  mode: string;
  status: string;
  viewport: { width: number; height: number; dpr: number };
  storage: { persistent: boolean; warning: boolean; newerSave: boolean };
  save: SaveState;
  audio: { state: string; currentTime: number; played: number };
  longFrames: { boot: number[]; play: number[] };
  hidden: boolean;
}

export interface AppState {
  shell: Shell;
  story: Story | null;
  game: { id: string; kind: string } | null;
}

export type Point = { x: number; y: number };

export const stateOf = async (page: Page): Promise<AppState> => JSON.parse(await page.evaluate(() => window.render_game_to_text())) as AppState;

export async function storyOf(page: Page): Promise<Story> {
  const { story } = await stateOf(page);
  if (!story) throw new Error('no story state');
  return story;
}

export const step = (page: Page, ms = 1000 / 60): Promise<void> => page.evaluate((v) => window.advanceTime(v), ms);

export async function waitPhase(page: Page, phase: string, timeout = 15_000): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await stateOf(page)).shell.phase;
        } catch {
          return 'navigating';
        }
      },
      { timeout },
    )
    .toBe(phase);
}

/** Leaves the title screen the way a player does: Tiếp tục when the save has progress, else Bắt đầu. A page without the title (a ?preview= link) is left alone. */
export async function passTitle(page: Page): Promise<void> {
  const title = page.locator('#title');
  if (!(await title.count())) return;
  const keep = page.locator('#title .title-continue');
  await ((await keep.isVisible()) ? keep : page.locator('#title .title-start')).click();
  await expect(title).toHaveCount(0);
}

/** Takes the title screen away with no input event: for the specs that assert nothing has touched the page yet (no audio unlocked before a first gesture). */
export async function dismissTitleQuietly(page: Page): Promise<void> {
  await page.evaluate(() => {
    const title = document.getElementById('title') as HTMLDialogElement | null;
    title?.close();
    title?.remove();
  });
}

export async function waitReady(page: Page): Promise<void> {
  await waitPhase(page, 'ready', 30_000);
  await passTitle(page);
}

export async function seedSave(page: Page, save: object | string = START_OF_MINIGAME): Promise<void> {
  const raw = typeof save === 'string' ? save : JSON.stringify(save);
  await page.addInitScript(([key, value]) => {
    try {
      if (localStorage.getItem(key as string) === null) localStorage.setItem(key as string, value as string);
    } catch {
      /* storage tests break localStorage on purpose */
    }
  }, [SAVE_KEY, raw]);
}

export async function storedSave(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
}

export const isTouch = (info: TestInfo): boolean => Boolean(info.project.use.hasTouch);

/** Chromium mobile gets raw touch events through CDP; WebKit and desktop get real mouse events. */
export const realInput = (info: TestInfo, manual = false): StrokeOptions => ({ manual, touch: isTouch(info) && info.project.name.includes('chromium') });

export async function tap(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  if (isTouch(info)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

export async function storyPoint(page: Page): Promise<Point> {
  await expect(page.locator('#story'), 'story is visible').toBeVisible();
  const box = (await page.locator('#story').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + Math.min(60, box.height / 4) };
}

const signature = (s: AppState): string => `${s.shell.mode}|${s.story?.scene}|${s.story?.beat}|${s.story?.asking}|${s.game ? 1 : 0}`;

/** One player advance with a real tap or click. The 200 ms cooldown may swallow a tap, so a tap that changed nothing is repeated. */
export async function advanceStory(page: Page, info: TestInfo): Promise<void> {
  const before = signature(await stateOf(page));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const p = await storyPoint(page);
    await tap(page, info, p.x, p.y);
    for (let wait = 0; wait < 6; wait += 1) {
      if (signature(await stateOf(page)) !== before) return;
      await page.waitForTimeout(40);
    }
  }
  throw new Error(`story did not advance from ${before}`);
}

export async function typeName(page: Page, name: string): Promise<void> {
  await page.locator('#name').fill(name);
  await page.keyboard.press('Enter');
}

export async function readLine(page: Page): Promise<string> {
  return (await storyOf(page)).line?.text ?? '';
}

/** Plays the story with taps (name prompt answered with the keyboard) until the mini game runs. */
export async function reachMinigame(page: Page, info: TestInfo, name = 'Lan'): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const s = await stateOf(page);
    if (s.game) return;
    if (s.shell.mode === 'minigame') {
      await page.waitForTimeout(50);
      continue;
    }
    if (s.shell.phase === 'network-error') throw new Error(`network error while walking to the mini game: ${s.shell.status}`);
    if (s.story?.asking) await typeName(page, name);
    else await advanceStory(page, info);
  }
  throw new Error('did not reach the mini game');
}

export async function openAtMinigame(page: Page, info: TestInfo, query = '', name = 'Lan'): Promise<void> {
  await seedSave(page);
  await page.goto(`/${query}`);
  await waitReady(page);
  await reachMinigame(page, info, name);
}

const sessions = new WeakMap<Page, import('@playwright/test').CDPSession>();
export async function cdpOf(page: Page): Promise<import('@playwright/test').CDPSession> {
  let s = sessions.get(page);
  if (!s) {
    s = await page.context().newCDPSession(page);
    sessions.set(page, s);
  }
  return s;
}

export interface StrokeOptions {
  manual?: boolean;
  touch?: boolean;
}

/** After the last move the game keeps a short beat and then hands back to the story. */
export async function finishMinigame(page: Page, o: { manual?: boolean } = {}): Promise<void> {
  if (o.manual) for (let i = 0; i < 80 && (await stateOf(page)).shell.mode === 'minigame'; i += 1) await step(page, 100);
  await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
}

/** Plays the puzzle that is up with real taps and waits for the story to take over. */
export async function solveMinigame(page: Page, _o: StrokeOptions, info?: TestInfo): Promise<void> {
  await solvePuzzle(page, info ?? test.info());
  return finishMinigame(page);
}

/** Advances through the rest of chapter 1 (the name prompt is answered if it shows up) until the first scene of chapter 2 is on screen. */
export async function walkToChapterEnd(page: Page, info: TestInfo, o: StrokeOptions = realInput(info)): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const s = await stateOf(page);
    if (s.story?.chapter === 'saturnalia' && s.story.line) return;
    if (s.story?.chapter === 'saturnalia') await page.waitForTimeout(50);
    else if (s.game) await solveMinigame(page, o);
    else if (s.shell.mode === 'minigame') await page.waitForTimeout(50);
    else if (s.story?.asking) await typeName(page, 'Lan');
    else await advanceStory(page, info);
  }
  throw new Error('did not reach the end of chapter 1');
}

/** Plays the story forward (taps, name prompt, mini game) until the given scene starts. */
export async function walkUntilScene(page: Page, info: TestInfo, scene: string, name = 'Lan', o: StrokeOptions = realInput(info)): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const s = await stateOf(page);
    if (s.shell.mode === 'story' && s.story?.scene === scene) return;
    if (s.game) await solveMinigame(page, o);
    else if (s.shell.mode === 'minigame') await page.waitForTimeout(50);
    else if (s.story?.asking) await typeName(page, name);
    else await advanceStory(page, info);
  }
  throw new Error(`did not reach scene ${scene}`);
}
