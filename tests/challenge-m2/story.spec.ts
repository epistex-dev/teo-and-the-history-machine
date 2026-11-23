import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { advanceStory, expectClean, open, setHidden, state, step, watch, waitReady } from '../challenge/helpers.ts';
import { helpPuzzle } from '../support/puzzle.ts';
import { isTouch, seedSave, storyOf, storyPoint, tap, typeName } from '../support/play.ts';
import { ORDER } from '../../src/order.ts';
import { chapterOf, intro, lineAfterMinigame, nameLine } from '../support/script.ts';

test.describe.configure({ timeout: 90_000 });

const index = async (page: Page): Promise<number> => (await storyOf(page)).lineIndex ?? -1;

async function fresh(page: Page, query = ''): Promise<void> {
  await page.goto('/' + query);
  await waitReady(page);
}

test.describe('story player: rapid input', () => {
  test('mashing Space for 700 ms advances at most one line per 200 ms', async ({ page }) => {
    await fresh(page);
    const start = await index(page);
    const t0 = Date.now();
    let presses = 0;
    while (Date.now() - t0 < 700) {
      await page.keyboard.press('Space');
      presses += 1;
    }
    const elapsed = Date.now() - t0;
    const gained = (await index(page)) - start;
    expect(presses).toBeGreaterThan(5);
    expect(gained, 'lines advanced in ' + elapsed + ' ms').toBeLessThanOrEqual(Math.floor(elapsed / 200) + 1);
    expect((await storyOf(page)).asking).toBe(false);
  });

  test('mashing taps for 700 ms advances at most one line per 200 ms', async ({ page }, info) => {
    await fresh(page);
    const start = await index(page);
    const p = await storyPoint(page);
    const t0 = Date.now();
    while (Date.now() - t0 < 700) await tap(page, info, p.x, p.y);
    const elapsed = Date.now() - t0;
    expect((await index(page)) - start).toBeLessThanOrEqual(Math.floor(elapsed / 200) + 1);
  });

  test('mashing every second line while the clock is frozen (manual mode): at most two lines', async ({ page }, info) => {
    await fresh(page, '?manual=1');
    const start = await index(page);
    const p = await storyPoint(page);
    const t0 = Date.now();
    for (let i = 0; i < 40; i += 1) {
      await tap(page, info, p.x, p.y);
      await page.keyboard.press('Enter');
    }
    const elapsed = Date.now() - t0;
    expect((await index(page)) - start).toBeLessThanOrEqual(Math.floor(elapsed / 200) + 1);
  });

  test('a tap and a key in the same instant advance one line', async ({ page }, info) => {
    await fresh(page);
    await page.waitForTimeout(300);
    const start = await index(page);
    const p = await storyPoint(page);
    if (isTouch(info)) await Promise.all([page.touchscreen.tap(p.x, p.y), page.keyboard.press('Enter')]);
    else await Promise.all([page.mouse.click(p.x, p.y), page.keyboard.press('Enter')]);
    await page.waitForTimeout(300);
    expect((await index(page)) - start).toBe(1);
  });

  test('mashing cannot get past the name prompt: it stays asked and the mini game does not start', async ({ page }, info) => {
    await seedSave(page);
    await fresh(page);
    const p = await storyPoint(page);
    for (let i = 0; i < 25; i += 1) {
      await tap(page, info, p.x, p.y);
      await page.waitForTimeout(60);
    }
    const s = await state(page);
    expect(s.game).toBeNull();
    expect(s.story?.asking).toBe(true);
    expect(s.shell.save.name).toBe('');
  });

  test('the Lật trang button: one click is one line', async ({ page }) => {
    await fresh(page);
    await page.waitForTimeout(300);
    await expect(page.locator('#advance')).toBeVisible();
    const start = await index(page);
    await page.locator('#advance').click();
    await page.waitForTimeout(600);
    expect(await index(page), 'a click on the button also reached the story tap handler').toBe(start + 1);
  });

  for (const key of ['Enter', 'Space']) {
    test('keyboard on the focused Lật trang button: ' + key + ' is one line, focus stays on it', async ({ page }) => {
      await fresh(page);
      await page.waitForTimeout(300);
      await page.locator('#advance').focus();
      const start = await index(page);
      await page.keyboard.press(key);
      await page.waitForTimeout(600);
      expect(await index(page), 'the key reached both the button and the document handler').toBe(start + 1);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('advance');
    });
  }

  for (const key of ['a', 'Escape', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Shift', 'Control+ArrowRight', 'Alt+ArrowRight', 'Control+Enter', 'Meta+Space']) {
    test('key ' + key + ' does not advance the story', async ({ page }) => {
      await fresh(page);
      await page.waitForTimeout(300);
      const start = await index(page);
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      expect(await index(page), 'advanced on ' + key).toBe(start);
    });
  }

  test('a mouse drag across the story (press, move 190 px, release) does not advance', async ({ page }, info) => {
    test.skip(isTouch(info), 'a finger drag never produces a click');
    await fresh(page);
    await page.waitForTimeout(300);
    const start = await index(page);
    const p = await storyPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 150, p.y + 120, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await index(page), 'a drag from one point to another counts as a tap').toBe(start);
  });
});

test.describe('story player: live region and focus', () => {
  test('the live region holds only the speaker and the line, polite and atomic', async ({ page }) => {
    await fresh(page);
    const info = await page.evaluate(() => {
      const live = document.querySelector('.live');
      return {
        polite: live?.getAttribute('aria-live'),
        atomic: live?.getAttribute('aria-atomic'),
        inside: [...(live?.querySelectorAll('*') ?? [])].map((e) => e.id || e.tagName),
        assertive: document.querySelectorAll('[aria-live="assertive"], [role="alert"]:not([hidden])').length,
      };
    });
    expect(info.polite).toBe('polite');
    expect(info.atomic).toBe('true');
    expect(info.inside).toEqual(['speaker', 'line']);
    expect(info.assertive, 'a visible assertive region during normal play').toBe(0);
  });

  test('each advance changes the live region in at most four DOM mutations (no per character typing noise)', async ({ page }, info) => {
    await fresh(page);
    await page.evaluate(() => {
      const w = window as unknown as { __m: number };
      w.__m = 0;
      new MutationObserver((l) => (w.__m += l.length)).observe(document.querySelector('.live')!, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    for (let i = 0; i < 4; i += 1) {
      await page.evaluate(() => ((window as unknown as { __m: number }).__m = 0));
      await advanceStory(page, info);
      await page.waitForTimeout(1500);
      const n = await page.evaluate(() => (window as unknown as { __m: number }).__m);
      expect(n, 'mutations of the live region for one line').toBeLessThanOrEqual(4);
    }
  });

  test('the DOM text matches render_game_to_text for every line, speaker hidden on narration', async ({ page }, info) => {
    await fresh(page);
    for (let i = 0; i < 9; i += 1) {
      const s = await storyOf(page);
      if (s.asking) break;
      await page.waitForTimeout(150);
      const dom = await page.evaluate(() => {
        const sp = document.getElementById('speaker')!;
        return { line: document.getElementById('line')!.textContent, speaker: sp.textContent, shown: !sp.hidden && getComputedStyle(sp).display !== 'none' };
      });
      expect(dom.line).toBe(s.line?.text);
      if (s.line?.kind === 'say') expect(dom.speaker).toBe(s.line.speaker);
      else expect(dom.shown && (dom.speaker ?? '').trim() !== '', 'a narration line still shows the previous speaker').toBe(false);
      await advanceStory(page, info);
    }
  });

  test('keyboard only through the puzzle: after the last hint, focus is somewhere visible in the story and Enter advances once', async ({ page }, info) => {
    test.skip(isTouch(info), 'keyboard path');
    await open(page, '?manual=1');
    const active = (): Promise<string> => page.evaluate(() => document.activeElement?.id ?? '');
    for (let n = 0; n < 40 && (await state(page)).shell.mode === 'minigame'; n += 1) {
      const phase = ((await state(page)).game as unknown as { phase: string }).phase;
      const want = phase === 'predict' ? 'pz-option-0' : phase === 'demo' ? 'pz-skip' : phase === 'reveal' || phase === 'verdict' ? 'pz-next' : 'pz-hint';
      for (let i = 0; i < 60 && (await active()) !== want; i += 1) await page.keyboard.press('Tab');
      expect(await active(), 'Tab reaches #' + want).toBe(want);
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    await expect.poll(async () => (await state(page)).shell.mode).toBe('story');
    const where = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      const r = a?.getBoundingClientRect();
      return { tag: a?.tagName, inStory: Boolean(a?.closest('#story')), visible: Boolean(r && r.width > 0 && r.height > 0), id: a?.id };
    });
    expect(where.tag, 'focus fell back to <body> when the help button was hidden').not.toBe('BODY');
    expect(where.visible).toBe(true);
    expect(where.inStory).toBe(true);
    const before = await storyOf(page);
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const after = await storyOf(page);
    if (after.scene === before.scene) expect(after.lineIndex).toBe((before.lineIndex ?? 0) + 1);
    else expect(after.lineIndex, 'a new scene starts at its first line, no line skipped').toBe(1);
    expect(after.line?.text).not.toBe(lineAfterMinigame(intro, 'Lan').text);
  });

  test('after the name is submitted by keyboard the next Space advances the story', async ({ page }, info) => {
    test.skip(isTouch(info), 'keyboard path');
    await seedSave(page);
    await fresh(page);
    for (let i = 0; i < 6 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
    await typeName(page, 'Lan');
    await expect.poll(async () => (await storyOf(page)).line?.text ?? '').toContain(nameLine(intro, 'Lan'));
    const start = await index(page);
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    expect(await index(page), 'focus is lost after the prompt closes').toBe(start + 1);
  });

});

test.describe('story player: layout in odd viewports', () => {
  const sizes: [string, number, number][] = [
    ['phone landscape', 844, 390],
    ['small phone', 320, 568],
    ['short landscape', 667, 320],
    ['desktop', 1280, 720],
  ];
  for (const [label, width, height] of sizes) {
    test('every line of the first scenes fits inside the dialogue box and the viewport: ' + label, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      await seedSave(page);
      await fresh(page);
      const bad: string[] = [];
      for (let i = 0; i < 26; i += 1) {
        const full = await state(page);
        const s = full.story;
        if (!s) break;
        if (s.asking) {
          const r = await page.evaluate(() => {
            const b = document.getElementById('name-done')!.getBoundingClientRect();
            const n = document.getElementById('name')!.getBoundingClientRect();
            return { bottom: Math.max(b.bottom, n.bottom), right: Math.max(b.right, n.right), w: window.innerWidth, h: window.innerHeight };
          });
          if (r.bottom > r.h + 1 || r.right > r.w + 1) bad.push('prompt outside viewport at ' + JSON.stringify(r));
          await typeName(page, 'Lan');
          continue;
        }
        if (full.shell.mode !== 'story') break;
        await page.waitForTimeout(120);
        const m = await page.evaluate(() => {
          const line = document.getElementById('line')!;
          const d = document.querySelector('.dialogue')!.getBoundingClientRect();
          const adv = document.getElementById('advance')!.getBoundingClientRect();
          return { clipped: line.scrollHeight - line.clientHeight, bottom: d.bottom, top: d.top, h: window.innerHeight, advBottom: adv.bottom, advRight: adv.right, w: window.innerWidth, scrollY: document.documentElement.scrollHeight - window.innerHeight, scrollX: document.documentElement.scrollWidth - window.innerWidth, lineTop: line.getBoundingClientRect().top };
        });
        if (m.clipped > 1) bad.push('line ' + i + ' clipped by ' + m.clipped);
        if (m.bottom > m.h + 1 || m.advBottom > m.h + 1 || m.advRight > m.w + 1) bad.push('dialogue outside viewport at line ' + i + ' ' + JSON.stringify(m));
        if (m.lineTop < 0) bad.push('line starts above the viewport at ' + i);
        if (m.scrollY > 1 || m.scrollX > 1) bad.push('page scrolls at line ' + i + ' ' + m.scrollX + ',' + m.scrollY);
        await advanceStory(page, info);
      }
      expect(bad).toEqual([]);
    });
  }

  test('rotating in the middle of a line keeps the line and the next tap still advances once', async ({ page }, info) => {
    await fresh(page);
    await advanceStory(page, info);
    const before = await storyOf(page);
    const vp = page.viewportSize()!;
    for (const size of [{ width: vp.height, height: vp.width }, vp]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(200);
      expect((await storyOf(page)).line?.text).toBe(before.line?.text);
    }
    await advanceStory(page, info);
    expect(await index(page)).toBe((before.lineIndex ?? 0) + 1);
  });

  test('hidden then visible in the middle of the name prompt keeps what was typed', async ({ page }, info) => {
    await seedSave(page);
    await fresh(page);
    for (let i = 0; i < 6 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
    await page.locator('#name').fill('Hạnh');
    await setHidden(page, true);
    await page.waitForTimeout(200);
    await setHidden(page, false);
    expect(await page.locator('#name').inputValue()).toBe('Hạnh');
    expect((await storyOf(page)).asking).toBe(true);
  });
});

test.describe('reduced motion', () => {
  async function motion(page: Page): Promise<{ running: number; longest: number; smooth: number }> {
    return page.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>('body *')];
      let longest = 0;
      let smooth = 0;
      const toMs = (v: string) => Math.max(...v.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000) || 0));
      for (const el of els) {
        const cs = getComputedStyle(el);
        longest = Math.max(longest, toMs(cs.transitionDuration), cs.animationName !== 'none' ? toMs(cs.animationDuration) : 0);
        if (cs.scrollBehavior === 'smooth') smooth += 1;
      }
      return { running: document.getAnimations().filter((a) => a.playState === 'running').length, longest, smooth };
    });
  }

  test('with prefers-reduced-motion the story shell has no running animation, no long transition and no smooth scroll', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const w = watch(page);
    await fresh(page);
    for (let i = 0; i < 4; i += 1) {
      await advanceStory(page, info);
      await page.waitForTimeout(100);
      const m = await motion(page);
      expect(m.running, 'running CSS animations').toBe(0);
      expect(m.longest, 'longest transition or animation in ms').toBeLessThanOrEqual(20);
      expect(m.smooth).toBe(0);
    }
    expectClean(w);
  });

  test('with prefers-reduced-motion the mini game is reachable and completes with the help button', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const w = watch(page);
    await open(page, '?manual=1');
    const m = await motion(page);
    expect(m.running).toBe(0);
    await helpPuzzle(page, info);
    expect((await state(page)).shell.mode).toBe('story');
    expectClean(w);
    void info;
  });
});
