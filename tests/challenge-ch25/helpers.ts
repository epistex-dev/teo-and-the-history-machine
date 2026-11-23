import { expect, type Page, type TestInfo } from '@playwright/test';
import { advanceStory, reachMinigame, seedSave, stateOf, step, storyOf, waitReady } from '../support/play.ts';
import { helpPuzzle, type PuzzleState } from '../support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from '../support/script.ts';

export const script = chapterOf('ending');
export const gameScene = script.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
export const AFTER = (name = 'Lan'): string => lineAfterMinigame(script, name).text;
export const LANDSCAPE = { width: 844, height: 390 };

export const maybeEnd = async (page: Page): Promise<PuzzleState | null> => {
  const g = (await stateOf(page)).game as unknown as PuzzleState | null;
  return g && g.id === 'ending' ? g : null;
};
export const modeOf = async (page: Page): Promise<string> => (await stateOf(page)).shell.mode;
export const screenOf = async (page: Page): Promise<Record<string, unknown> | null> => ((await stateOf(page)).story as unknown as { screen: Record<string, unknown> | null } | null)?.screen ?? null;

export async function openAtGame(page: Page, info: TestInfo, query = '?manual=1', size?: { width: number; height: number }, name = 'Lan'): Promise<void> {
  if (size) await page.setViewportSize(size);
  await seedSave(page, { schemaVersion: 1, name, furthest: 'ending', chapter: 'ending', scene: gameScene });
  await page.goto('/' + query);
  await waitReady(page);
  await reachMinigame(page, info, name);
  if (query.includes('manual')) await step(page, 100);
}

export async function openAtScene(page: Page, scene: string, query = '', name = 'Lan', size?: { width: number; height: number }): Promise<void> {
  if (size) await page.setViewportSize(size);
  await seedSave(page, { schemaVersion: 1, name, furthest: 'ending', chapter: 'ending', scene });
  await page.goto('/' + query);
  await waitReady(page);
}

/** Real-time play: advance, name card, timeline and code screen until the end screen shows. Starts after the mini game. */
export async function toEndScreen(page: Page, info: TestInfo, max = 200): Promise<string[]> {
  const modes: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const s = await stateOf(page);
    if (modes.at(-1) !== s.shell.mode) modes.push(s.shell.mode);
    if (s.shell.mode === 'end') return modes;
    if (s.game) throw new Error('the mini game came up on the way to the end screen');
    if (s.shell.mode === 'minigame') await page.waitForTimeout(50);
    else if (s.shell.mode === 'timeline') await page.locator('#timeline-next').click();
    else if (s.shell.mode === 'namecard') {
      await expect.poll(async () => (await screenOf(page))?.ready, { timeout: 10_000 }).toBe(true);
      await page.locator('#namecard-next').click();
    } else if (s.shell.mode === 'code') await page.locator('#code-screen-next').click();
    else if (s.story?.asking) throw new Error('the name prompt came up in the ending');
    else await advanceStory(page, info);
  }
  throw new Error('the end screen did not show in ' + max + ' steps; modes ' + modes.join(','));
}

export async function openAtEnd(page: Page, info: TestInfo, name = 'Lan', size?: { width: number; height: number }): Promise<string[]> {
  await openAtScene(page, 'the-ten', '', name, size);
  const modes = await toEndScreen(page, info);
  await expect(page.locator('#end-screen')).toBeVisible();
  return modes;
}

export async function openAtCode(page: Page, info: TestInfo, name = 'Lan', size?: { width: number; height: number }): Promise<void> {
  await openAtScene(page, 'the-ten', '', name, size);
  for (let i = 0; i < 80; i += 1) {
    const mode = await modeOf(page);
    if (mode === 'code') return;
    if (mode === 'namecard') {
      await expect.poll(async () => (await screenOf(page))?.ready, { timeout: 10_000 }).toBe(true);
      await page.locator('#namecard-next').click();
    } else await advanceStory(page, info);
  }
  throw new Error('the code screen did not show');
}

export const helpThrough = helpPuzzle;

export const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox()) as { x: number; y: number; width: number; height: number };
