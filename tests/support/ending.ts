import type { Page } from '@playwright/test';
import { stateOf } from './play.ts';
import { chapterOf } from './script.ts';

const sig = (s: Awaited<ReturnType<typeof stateOf>>): string => `${s.shell.mode}|${s.story?.scene}|${s.story?.beat}`;

/** Taps Advance, a line at a time, until the shell is in the given mode. A tap the cooldown swallowed is repeated. */
export async function advanceUntil(page: Page, mode: string, max = 40): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    const s = await stateOf(page);
    if (s.shell.mode === mode) return;
    const before = sig(s);
    await page.locator('#advance').click();
    for (let wait = 0; wait < 8 && sig(await stateOf(page)) === before; wait += 1) await page.waitForTimeout(60);
  }
  throw new Error(`the shell did not reach ${mode} in ${max} taps`);
}

/** The same with the keyboard: Enter on the focused Advance button. */
export async function pressUntil(page: Page, mode: string, max = 40): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    const s = await stateOf(page);
    if (s.shell.mode === mode) return;
    const before = sig(s);
    await page.keyboard.press('Enter');
    for (let wait = 0; wait < 8 && sig(await stateOf(page)) === before; wait += 1) await page.waitForTimeout(60);
  }
  throw new Error(`the shell did not reach ${mode} in ${max} key presses`);
}

/** Lines (say and narration beats) the ending scene shows before its first beat of the given kind. */
export function linesBefore(scene: string, kind: 'timeline' | 'name-card'): number {
  const beats = chapterOf('ending').scenes.find((s) => s.id === scene)?.beats ?? [];
  return beats.slice(0, beats.findIndex((b) => b.t === kind)).filter((b) => b.t === 'say' || b.t === 'narr').length;
}
