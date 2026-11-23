import { expect, test } from '@playwright/test';
import { SAVE_KEY, stateOf, waitReady } from './support/play.ts';
import { intro } from './support/script.ts';

test('the story view shows each scene plate caption under the art and nothing where a scene has none', async ({ page }) => {
  await page.goto('/');
  await waitReady(page);
  for (const scene of intro.scenes) {
    const expected = scene.beats.find((b) => b.t === 'plate')?.text ?? null;
    const save = JSON.stringify({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: scene.id });
    await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [SAVE_KEY, save]);
    await page.reload();
    await waitReady(page);
    const story = (await stateOf(page)).story;
    expect(story?.scene).toBe(scene.id);
    expect(story?.plate, 'plate of scene ' + scene.id).toBe(expected);
    const caption = page.locator('#plate-caption');
    if (expected) {
      expect(expected).toMatch(/^Hình [IVX]+\. — /);
      await expect(caption).toBeVisible();
      await expect(caption).toHaveText(expected);
    } else await expect(caption).toBeHidden();
  }
});
