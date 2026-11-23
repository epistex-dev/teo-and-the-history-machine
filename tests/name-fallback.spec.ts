import { expect, test } from '@playwright/test';
import { advanceStory, stateOf, waitReady } from './support/play.ts';
import { intro, lineOf } from './support/script.ts';

test('an empty name is read as "người đã hỏi" in the line after the name prompt', async ({ page }, info) => {
  const beats = intro.scenes.flatMap((s) => s.beats);
  const after = beats.slice(beats.findIndex((b) => b.t === 'ask-name') + 1).find((b) => b.t === 'say' || b.t === 'narr');
  const expected = lineOf(after!);
  expect(expected).toContain('người đã hỏi');
  await page.goto('/');
  await waitReady(page);
  for (let i = 0; i < 60 && !(await stateOf(page)).story?.asking; i += 1) await advanceStory(page, info);
  await page.locator('#name').fill('   ');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await stateOf(page)).story?.line?.text).toBe(expected);
});
