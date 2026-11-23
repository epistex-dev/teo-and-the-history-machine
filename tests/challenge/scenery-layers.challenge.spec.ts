import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { advanceStory, isTouch, seedSave, stateOf, storyOf, tap, typeName, waitReady } from '../support/play.ts';

test.describe.configure({ timeout: 150_000 });

interface Row {
  at: [number, number];
  width: number;
  landscape: { at: [number, number]; width: number };
}

const ROWS = (JSON.parse(readFileSync('src/story/stage-data.json', 'utf8')) as { props: Record<string, Row> }).props;
const Q = String.fromCharCode(96);
const NOISE = /Failed to load resource|Refused to apply a stylesheet/i;

const LAYERS = {
  'manger-lamp': { chapter: 'bethlehem', scene: 'mang-co', reveal: 'quầng đèn nhỏ', plate: 'ch5-bethlehem' },
  'window-shadow': { chapter: 'nicholas', scene: 'nam-viet', reveal: 'một ô sáng', plate: 'ch7-harbour' },
} as const;
type LayerId = keyof typeof LAYERS;
const IDS = Object.keys(LAYERS) as LayerId[];

const SIZES = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
  small: { width: 320, height: 568 },
  smallLandscape: { width: 667, height: 375 },
};
type Size = { width: number; height: number };

const saveOf = (id: LayerId): object => ({ schemaVersion: 1, name: 'Lan', furthest: LAYERS[id].chapter, chapter: LAYERS[id].chapter, scene: LAYERS[id].scene });

function collect(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text());
  });
  return errors;
}

async function open(page: Page, id: LayerId, size: Size = SIZES.portrait, watchFrames = false): Promise<void> {
  await page.setViewportSize(size);
  if (watchFrames)
    await page.addInitScript(() => {
      const w = window as unknown as { __frames: number[] };
      w.__frames = [];
      const tick = (): void => {
        const n = [...document.querySelectorAll('.scenery .prop')].filter((el) => el.getClientRects().length > 0 && ['manger-lamp', 'window-shadow'].includes((el as HTMLElement).dataset.prop ?? '')).length;
        if (n) w.__frames.push(n);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  await seedSave(page, saveOf(id));
  await page.goto('/');
  await waitReady(page);
  await settle(page);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('#story img')].filter((img) => !img.hidden && img.src).map((img) => img.decode().catch(() => undefined)));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/** The stage also lists the machine's props (the coffee cup); only the scenery layers are of interest here. */
const props = async (page: Page): Promise<string[]> => ((await storyOf(page)) as unknown as { stage: { props: string[] } }).stage.props.filter((id) => id in LAYERS);
const domProps = (page: Page): Promise<string[]> => page.locator('.scenery .prop').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.prop as string));
const frames = (page: Page): Promise<number[]> => page.evaluate(() => (window as unknown as { __frames: number[] }).__frames);

async function reveal(page: Page, info: TestInfo, id: LayerId): Promise<void> {
  for (let i = 0; i < 45; i += 1) {
    const s = await storyOf(page);
    if ((s.line?.text ?? '').includes(LAYERS[id].reveal)) return settle(page);
    if (s.asking) await typeName(page, 'Lan');
    else await advanceStory(page, info);
  }
  throw new Error('the line that shows ' + id + ' was not reached');
}

interface Measure {
  orientation: 'portrait' | 'landscape';
  currentSrc: string;
  worst: number;
  detail: string;
  inView: boolean;
  covered: number;
  viewport: Size;
}

let layouts: Record<string, Record<'portrait' | 'landscape', { size: [number, number] }>> | undefined;

async function measure(page: Page, id: LayerId): Promise<Measure> {
  layouts ??= ((await import('../../art/style/layouts.mjs' as string)) as { LAYOUTS: typeof layouts }).LAYOUTS;
  const m = await page.evaluate((pid) => {
    const box = (el: Element): { x: number; y: number; w: number; h: number } => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    const story = document.getElementById('story') as HTMLElement;
    const img = document.getElementById('backdrop-portrait') as HTMLImageElement;
    const prop = document.querySelector('.scenery .prop[data-prop="' + pid + '"]');
    const art = prop?.querySelector('img') as HTMLImageElement | null;
    const dialogue = document.querySelector('.dialogue') as HTMLElement;
    return {
      orientation: story.clientWidth > story.clientHeight ? 'landscape' : 'portrait',
      currentSrc: img.currentSrc,
      bd: box(img),
      prop: prop ? box(prop) : null,
      ratio: art && art.naturalWidth ? art.naturalHeight / art.naturalWidth : 1,
      dialogue: box(dialogue),
      viewport: { width: innerWidth, height: innerHeight },
    };
  }, id);
  if (!m.prop) throw new Error(id + ' is not in the DOM');
  const o = m.orientation as 'portrait' | 'landscape';
  const row = ROWS[id] as Row;
  const [at, width] = o === 'portrait' ? [row.at, row.width] : [row.landscape.at, row.landscape.width];
  const [sw, sh] = layouts![LAYERS[id].plate]![o]!.size;
  const want = { x: m.bd.x + (at[0] / sw) * m.bd.w, y: m.bd.y + (at[1] / sh) * m.bd.h, w: (width / sw) * m.bd.w };
  const wantH = want.w * m.ratio;
  const diffs = [m.prop.x - want.x, m.prop.y - want.y, m.prop.w - want.w, m.prop.h - wantH].map(Math.abs);
  const p = m.prop;
  const overlapW = Math.max(0, Math.min(p.x + p.w, m.dialogue.x + m.dialogue.w) - Math.max(p.x, m.dialogue.x));
  const overlapH = Math.max(0, Math.min(p.y + p.h, m.dialogue.y + m.dialogue.h) - Math.max(p.y, m.dialogue.y));
  return {
    orientation: o,
    currentSrc: m.currentSrc,
    worst: Math.max(...diffs),
    detail: 'prop ' + [p.x, p.y, p.w, p.h].map(Math.round) + ' want ' + [want.x, want.y, want.w, wantH].map(Math.round) + ' backdrop ' + [m.bd.x, m.bd.y, m.bd.w, m.bd.h].map(Math.round),
    inView: p.x >= -1 && p.y >= -1 && p.x + p.w <= m.viewport.width + 1 && p.y + p.h <= m.viewport.height + 1,
    covered: (overlapW * overlapH) / (p.w * p.h),
    viewport: m.viewport,
  };
}

async function expectAligned(page: Page, id: LayerId, label: string): Promise<void> {
  let last: Measure | undefined;
  await expect
    .poll(
      async () => {
        last = await measure(page, id);
        return last.worst < 2 && last.currentSrc.includes('-' + last.orientation + '-');
      },
      { timeout: 4000, message: label + ': layer ' + id + ' is off the backdrop crop (' + (last ? last.detail : '') + ')' },
    )
    .toBe(true);
}

async function expectShown(page: Page, id: LayerId, label: string): Promise<void> {
  await expectAligned(page, id, label);
  const m = await measure(page, id);
  expect(m.inView, label + ': ' + id + ' is cut by the viewport ' + m.detail + ' viewport ' + m.viewport.width + 'x' + m.viewport.height).toBe(true);
  expect(m.covered, label + ': ' + id + ' lies under the dialogue box').toBeLessThan(0.1);
}

test.describe('scenery layers: reload, restore, reset', () => {
  for (const id of IDS) {
    test(id + ': reload after the layer appeared restarts the scene and shows the layer exactly once when the scene reaches the line that names it (at the plate beat for manger-lamp, at the naming line for window-shadow since round 3)', async ({ page }, info) => {
      const errors = collect(page);
      await open(page, id);
      await reveal(page, info, id);
      expect(await domProps(page)).toEqual([id]);
      const saved = await page.evaluate(() => localStorage.getItem('teo:v1:save'));
      await page.reload();
      await waitReady(page);
      await settle(page);
      expect(await page.evaluate(() => localStorage.getItem('teo:v1:save')), 'save after the reload').toBe(saved);
      expect((await storyOf(page)).scene).toBe(LAYERS[id].scene);
      if (id === 'manger-lamp') {
        expect(await domProps(page), 'layer shown twice or not at all at the start of the restarted scene').toEqual([id]);
        expect(await props(page)).toEqual([id]);
      } else {
        // window-shadow is tagged at its naming line mid-scene (round 3), so the restarted scene starts without it
        expect(await domProps(page), 'layer must not show before its naming line').toEqual([]);
        expect(await props(page)).toEqual([]);
      }
      await reveal(page, info, id);
      expect(await domProps(page), 'layer shown twice or not at all after the reload').toEqual([id]);
      await expectShown(page, id, 'after reload');
      expect(errors).toEqual([]);
    });
  }

  test('window-shadow: reload after it disappeared (scene tui-trong): never in the DOM, never painted', async ({ page }, info) => {
    const errors = collect(page);
    await open(page, 'window-shadow', SIZES.portrait, true);
    await reveal(page, info, 'window-shadow');
    for (let i = 0; i < 20 && (await storyOf(page)).scene !== 'tui-trong'; i += 1) await advanceStory(page, info);
    expect((await storyOf(page)).scene).toBe('tui-trong');
    expect(await domProps(page), 'window-shadow gone at the removal beat (the scene may carry other props)').not.toContain('window-shadow');
    expect(await props(page)).toEqual([]);
    await page.reload();
    await waitReady(page);
    await page.waitForTimeout(400);
    expect((await storyOf(page)).scene).toBe('tui-trong');
    expect(await domProps(page)).not.toContain('window-shadow');
    expect(await frames(page), 'a frame was painted with the window-shadow in it').toEqual([]);
    expect(errors).toEqual([]);
  });

  test('window-shadow: a continue-code or seeded save at tui-trong (the scene that removes it) never paints it', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __frames: number[] };
      w.__frames = [];
      const tick = (): void => {
        const n = [...document.querySelectorAll('.scenery .prop')].filter((el) => el.getClientRects().length > 0 && ['manger-lamp', 'window-shadow'].includes((el as HTMLElement).dataset.prop ?? '')).length;
        if (n) w.__frames.push(n);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'nicholas', chapter: 'nicholas', scene: 'tui-trong' });
    await page.goto('/');
    await waitReady(page);
    await page.waitForTimeout(500);
    expect((await storyOf(page)).scene).toBe('tui-trong');
    expect(await domProps(page)).not.toContain('window-shadow');
    expect(await props(page)).toEqual([]);
    expect(await frames(page), 'a frame painted the shadow before its removal beat').toEqual([]);
  });

  for (const id of IDS) {
    test(id + ': a continue code for the same chapter, and then for another one, leaves no layer behind', async ({ page }, info) => {
      const { makeCode } = await import('../../src/code.ts');
      const errors = collect(page);
      await open(page, id);
      await reveal(page, info, id);
      const enter = async (chapter: string): Promise<void> => {
        await page.locator('#menu-open').click();
        await expect(page.locator('#menu')).toHaveJSProperty('open', true);
        await page.locator('#menu-code').click();
        await page.locator('#code-input').fill(makeCode({ name: 'Lan', chapter, furthest: LAYERS[id].chapter }));
        await page.locator('#code-use').click();
        await expect.poll(async () => (await stateOf(page)).story?.chapter === chapter && (await stateOf(page)).shell.mode === 'story').toBe(true);
        await settle(page);
      };
      await enter(LAYERS[id].chapter);
      expect((await storyOf(page)).scene, 'the code restarts the chapter').not.toBe(LAYERS[id].scene);
      expect(await domProps(page), 'layer survived a code for the same chapter').toEqual([]);
      expect(await props(page)).toEqual([]);
      await enter('intro');
      expect(await domProps(page), 'layer survived a code for another chapter').toEqual([]);
      expect(errors).toEqual([]);
    });

    test(id + ': new game while the layer is up removes it, and the layer is not on the intro backdrop', async ({ page }, info) => {
      await open(page, id);
      await reveal(page, info, id);
      await page.locator('#menu-open').click();
      await expect(page.locator('#menu')).toHaveJSProperty('open', true);
      await page.locator('#menu-new').click();
      await page.locator('#confirm-new-yes').click();
      await expect.poll(async () => (await stateOf(page)).story?.chapter === 'intro' && (await stateOf(page)).shell.mode === 'story').toBe(true);
      expect(await domProps(page)).toEqual([]);
      expect(await props(page)).toEqual([]);
    });
  }

  test('manger-lamp: it does not carry into the next chapter after Lật trang', async ({ page }, info) => {
    await open(page, 'manger-lamp', SIZES.portrait, true);
    await reveal(page, info, 'manger-lamp');
    for (let i = 0; i < 40 && (await stateOf(page)).shell.mode !== 'card'; i += 1) await advanceStory(page, info);
    await expect(page.locator('#card-slot > *').first()).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __frames: number[] }).__frames = []));
    await page.locator('#card-next').click();
    await expect.poll(async () => (await stateOf(page)).story?.chapter === 'dec25' && (await stateOf(page)).shell.mode === 'story').toBe(true);
    await page.waitForTimeout(500);
    expect(await domProps(page)).toEqual([]);
    expect(await frames(page), 'the lamp was painted over the next chapter').toEqual([]);
  });
});

test.describe('scenery layers: alignment with the backdrop crop', () => {
  for (const id of IDS) {
    test(id + ': stays on the backdrop through portrait, landscape, 320x568, landscape, 667x375, portrait', async ({ page }, info) => {
      const errors = collect(page);
      await open(page, id);
      await reveal(page, info, id);
      for (const [name, size] of [['portrait', SIZES.portrait], ['landscape', SIZES.landscape], ['320x568', SIZES.small], ['landscape again', SIZES.landscape], ['667x375', SIZES.smallLandscape], ['portrait again', SIZES.portrait]] as const) {
        await page.setViewportSize(size);
        await expectAligned(page, id, name);
      }
      expect(errors).toEqual([]);
    });

    test(id + ': appears aligned when the orientation changed after the scene was entered but before the line', async ({ page }, info) => {
      await open(page, id, SIZES.landscape);
      await page.setViewportSize(SIZES.portrait);
      await reveal(page, info, id);
      await expectShown(page, id, 'portrait after landscape start');
      await page.setViewportSize(SIZES.landscape);
      await expectShown(page, id, 'back to landscape');
    });

    test(id + ': a reload in landscape and then a rotation keeps it on the crop', async ({ page }, info) => {
      await open(page, id, SIZES.landscape);
      await reveal(page, info, id);
      await page.reload();
      await waitReady(page);
      await reveal(page, info, id);
      await expectShown(page, id, 'landscape after reload');
      await page.setViewportSize(SIZES.portrait);
      await expectShown(page, id, 'rotated after reload');
    });

    for (const [name, size] of [['320x568', SIZES.small], ['844x390', SIZES.landscape]] as const) {
      test(id + ': at ' + name + ' it is drawn, on the crop, inside the viewport and clear of the dialogue box', async ({ page }, info) => {
        await open(page, id, size);
        await reveal(page, info, id);
        await expectShown(page, id, name);
        const art = await page.locator('.scenery .prop[data-prop="' + id + '"] img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
        expect(art, 'sprite decoded').toBe(true);
      });
    }

    test(id + ': a tap on the layer itself advances the story (it must not catch the tap)', async ({ page }, info) => {
      await open(page, id);
      await reveal(page, info, id);
      const before = (await storyOf(page)).beat;
      const box = (await page.locator('.scenery .prop[data-prop="' + id + '"]').boundingBox())!;
      for (let i = 0; i < 6 && (await storyOf(page)).beat === before; i += 1) {
        await tap(page, info, box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(260);
      }
      expect((await storyOf(page)).beat, 'beat after tapping the layer').toBeGreaterThan(before!);
    });

    test(id + ': the layer sits between the backdrop and the cast in paint order', async ({ page }, info) => {
      await open(page, id);
      await reveal(page, info, id);
      const order = await page.evaluate(() => {
        const rel = (a: Element, b: Element): boolean => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        const back = document.getElementById('backdrop') as Element;
        const scenery = document.querySelector('.scenery') as Element;
        const cast = document.getElementById('cast-area') as Element;
        return { backBeforeScenery: rel(back, scenery), sceneryBeforeCast: rel(scenery, cast), z: getComputedStyle(scenery).zIndex };
      });
      expect(order.backBeforeScenery).toBe(true);
      expect(order.sceneryBeforeCast).toBe(true);
    });
  }
});

test.describe('scenery layers: reduced motion', () => {
  for (const id of IDS) {
    test(id + ': with prefers-reduced-motion it is fully drawn the moment its line shows, with no running animation', async ({ page }, info) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, id);
      await reveal(page, info, id);
      const s = await page.evaluate((pid) => {
        const el = document.querySelector('.scenery .prop[data-prop="' + pid + '"]') as HTMLElement;
        const running = el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length;
        return { opacity: getComputedStyle(el).opacity, visibility: getComputedStyle(el).visibility, running, flag: document.documentElement.dataset.reducedMotion };
      }, id);
      expect(s.flag).toBe('true');
      expect(s.running).toBe(0);
      expect(s.opacity).toBe('1');
      expect(s.visibility).toBe('visible');
      await expectShown(page, id, 'reduced motion');
    });

    test(id + ': with reduced motion forced off in settings while the system asks for it, it is still fully drawn', async ({ page }, info) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => localStorage.setItem('teo:v1:settings', JSON.stringify({ reducedMotion: false })));
      await open(page, id);
      await reveal(page, info, id);
      const opacity = await page.locator('.scenery .prop[data-prop="' + id + '"]').evaluate((el) => getComputedStyle(el).opacity);
      expect(opacity).toBe('1');
      await expectShown(page, id, 'settings override');
    });
  }
});

/** The beats are rewritten in the served chapter chunk, since the story files hold each @prop once. */
async function rewrite(page: Page, chunk: string, needle: string, replacement: string): Promise<() => boolean> {
  let hit = false;
  await page.route('**/assets/chapter-' + chunk + '-*.js', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (body.includes(needle)) hit = true;
    await route.fulfill({ response: res, body: body.replace(needle, replacement) });
  });
  return () => hit;
}

const beat = (id: string, on: boolean): string => '{t:' + Q + 'prop' + Q + ',id:' + Q + id + Q + ',on:' + (on ? '!0' : '!1') + '}';
const LAMP_ON = beat('manger-lamp', true);

test.describe('scenery layers: repeated and stray @prop', () => {
  test('manger-lamp: @prop three times, plus @prop -id for layers never shown and an unknown id, leaves exactly one lamp', async ({ page }, info) => {
    const errors = collect(page);
    const hit = await rewrite(page, 'bethlehem', LAMP_ON, [beat('window-shadow', false), beat('manger-lamp', false), beat('ghost', true), beat('ghost', false), LAMP_ON, LAMP_ON, LAMP_ON].join(','));
    await open(page, 'manger-lamp');
    await reveal(page, info, 'manger-lamp');
    expect(hit(), 'the chunk was rewritten').toBe(true);
    expect(await domProps(page), 'lamp nodes in the DOM').toEqual(['manger-lamp']);
    expect(await props(page)).toEqual(['manger-lamp']);
    await expectShown(page, 'manger-lamp', 'repeated');
    expect(errors).toEqual([]);
  });

  test('manger-lamp: on, off, on, off, off, on ends with one lamp, and off, off ends with none and no leftover node', async ({ page }, info) => {
    const errors = collect(page);
    const hit = await rewrite(page, 'bethlehem', LAMP_ON, [LAMP_ON, beat('manger-lamp', false), LAMP_ON, beat('manger-lamp', false), beat('manger-lamp', false), LAMP_ON].join(','));
    await open(page, 'manger-lamp');
    await reveal(page, info, 'manger-lamp');
    expect(hit()).toBe(true);
    expect(await domProps(page)).toEqual(['manger-lamp']);
    await expectShown(page, 'manger-lamp', 'on-off-on');
    expect(errors).toEqual([]);
  });

  test('manger-lamp: off straight after on leaves no layer and no node, even after a rotation', async ({ page }, info) => {
    const errors = collect(page);
    const hit = await rewrite(page, 'bethlehem', LAMP_ON, [LAMP_ON, beat('manger-lamp', false), beat('manger-lamp', false)].join(','));
    await open(page, 'manger-lamp');
    for (let i = 0; i < 6; i += 1) await advanceStory(page, info);
    for (let i = 0; i < 14 && !((await storyOf(page)).line?.text ?? '').includes(LAYERS['manger-lamp'].reveal); i += 1) await advanceStory(page, info);
    expect(hit()).toBe(true);
    expect(await domProps(page)).toEqual([]);
    await page.setViewportSize(SIZES.landscape);
    await page.waitForTimeout(300);
    await page.setViewportSize(SIZES.portrait);
    await page.waitForTimeout(300);
    expect(await domProps(page)).toEqual([]);
    expect(await props(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('manger-lamp: a backdrop without art hides the layer, and the art backdrop coming back shows it again on the crop', async ({ page }, info) => {
    const bg = (id: string): string => '{t:' + Q + 'bg' + Q + ',id:' + Q + id + Q + '}';
    const errors = collect(page);
    const hit = await rewrite(page, 'bethlehem', LAMP_ON, [LAMP_ON, bg('no-such-room'), bg('dem-ngoai-belem')].join(','));
    await open(page, 'manger-lamp');
    await reveal(page, info, 'manger-lamp');
    expect(hit()).toBe(true);
    expect((await storyOf(page)).bg?.id).toBe('dem-ngoai-belem');
    expect(await domProps(page)).toEqual(['manger-lamp']);
    await expectShown(page, 'manger-lamp', 'after the backdrop round trip');
    expect(errors).toEqual([]);
  });

  test('window-shadow: @prop -window-shadow when the shadow was never shown (first beat of tui-trong seeded alone) is harmless, and the shadow can still be shown after', async ({ page }, info) => {
    const errors = collect(page);
    const needle = beat('window-shadow', true);
    const hit = await rewrite(page, 'nicholas', needle, [beat('window-shadow', false), needle, beat('window-shadow', false), needle].join(','));
    await open(page, 'window-shadow');
    await reveal(page, info, 'window-shadow');
    expect(hit()).toBe(true);
    expect(await domProps(page)).toEqual(['window-shadow']);
    await expectShown(page, 'window-shadow', 'toggled');
    expect(errors).toEqual([]);
  });
});
