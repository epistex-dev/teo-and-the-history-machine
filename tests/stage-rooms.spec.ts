import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CAST } from '../src/story/types.ts';
import { advanceStory, seedSave, stateOf, storyOf, typeName, waitReady } from './support/play.ts';
import { chapterOf } from './support/script.ts';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const SPRITE = { teo: (view: string, e: string) => `teo-${view}-face-${e}`, 'cuc-cu': (_: string, e: string) => `cuccu-head-${e}`, 'qua-don': (_: string, e: string) => `quado-head-${e}` } as const;

type Rect = [number, number, number, number];
interface Plates {
  feast: (o: string) => { obstacles: { columns: Rect[]; windows: Rect[] } };
  layouts: Record<string, Record<string, { quado: { root: [number, number]; scale: number }; size: [number, number] }>>;
  crowFrame: Rect;
}

async function plates(): Promise<Plates> {
  const [feast, layouts, birds] = await Promise.all([import('../art/style/feast.mjs' as string), import('../art/style/layouts.mjs' as string), import('../art/style/birds.mjs' as string)]);
  return { feast: feast.feast, layouts: layouts.LAYOUTS, crowFrame: birds.CROW_FRAME };
}

const overlap = (a: Rect, b: Rect): boolean => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('#story img')].filter((img) => !img.hidden && img.src).map((img) => img.decode().catch(() => undefined)));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function openAt(page: Page, chapter: string, scene: string, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: chapter, chapter, scene });
  await page.goto('/');
  await waitReady(page);
  await settled(page);
}

test.describe('chapter 2 to 7 rooms on the plate engine', () => {
  test('Quạ Đồn\'s perch in the banquet hall touches no column and no window, in either orientation', async () => {
    const { feast, layouts, crowFrame } = await plates();
    for (const o of ['portrait', 'landscape']) {
      const { root, scale } = layouts['ch2-feast']![o]!.quado;
      const crow: Rect = [root[0] + crowFrame[0] * scale, root[1] + crowFrame[1] * scale, crowFrame[2] * scale, crowFrame[3] * scale];
      const { obstacles } = feast(o);
      for (const rect of [...obstacles.columns, ...obstacles.windows]) expect(overlap(crow, rect), `${o}: crow ${crow.map(Math.round)} against ${rect.map(Math.round)}`).toBe(false);
    }
  });

  test('Quạ Đồn in the hall stands inside the art, not cut by its edge', async () => {
    const { layouts, crowFrame } = await plates();
    for (const o of ['portrait', 'landscape']) {
      const { root, scale, } = layouts['ch3-hall']![o]!.quado;
      const [w, h] = layouts['ch3-hall']![o]!.size;
      expect(root[0] + crowFrame[0] * scale, o).toBeGreaterThanOrEqual(0);
      expect(root[0] + (crowFrame[0] + crowFrame[2]) * scale, o).toBeLessThanOrEqual(w);
      expect(root[1], o).toBeLessThanOrEqual(h);
    }
  });

  for (const [chapter, scene, bg, art, flags, props] of [
    ['saturnalia', 'ban-tiec', 'ban-tiec-saturnalia-roma', 'ch2-feast', ['stained', 'open', 'stuck'], []],
    ['yule', 'sanh-dai', 'sanh-dai-bac-au-giua-dong', 'ch3-hall', ['stained', 'open'], []],
    ['mistletoe', 'hanh-lang', 'hanh-lang-nha-anh-1784', 'ch4-corridor', ['stained', 'open'], []],
    ['bethlehem', 'ngoai-thanh', 'dem-ngoai-belem', 'ch5-bethlehem', ['stained', 'open'], []],
    ['dec25', 'kho-lich', 'kho-lich-roma', 'ch6-vault', ['stained', 'open'], []],
    ['nicholas', 'ben-cang', 'ben-cang-myra-dem', 'ch7-harbour', ['stained', 'open'], []],
    ['carol', 'san-lang', 'san-lang-anh-1426', 'ch8-yard', ['stained', 'open'], []],
    ['krampus', 'dau-doc', 'lang-alps-dem-dong', 'ch9-village', ['stained', 'open'], []],
    ['befana', 'nha-o-y', 'nha-o-y-dem-hien-linh', 'ch10-kitchen', ['stained', 'open'], []],
    ['tree', 'can-phong', 'can-phong-strasbourg-1605', 'ch11-parlour', ['stained', 'open'], []],
    ['ban1647', 'hieu-in', 'pho-anh-1647', 'ch12-street', ['stained', 'open'], []],
    ['silent-night', 'truoc-nha-tho', 'oberndorf-toi-24-12-1818', 'ch13-church', ['stained', 'open', 'stuck'], []],
  ] as const) {
    test(`${chapter}: the backdrop is the plate ${art}, the machine keeps the stain and the props are in place`, async ({ page }) => {
      await openAt(page, chapter, scene, PORTRAIT);
      const s = (await storyOf(page)) as unknown as { bg?: { id: string }; stage: { machine: string[]; props: string[] } };
      expect(s.bg?.id).toBe(bg);
      expect(await page.locator('#backdrop-portrait').getAttribute('src')).toContain(`bg-${art}-portrait`);
      expect(await page.locator('#backdrop-landscape').getAttribute('srcset')).toContain(`bg-${art}-landscape`);
      expect(await page.locator('#story').getAttribute('data-art')).toBe('plate');
      expect(s.stage.machine).toEqual(flags);
      expect(s.stage.props).toEqual(props);
      await expect(page.locator('.machine img[data-part="machine-stain"]')).toBeVisible();
    });

    for (const [label, size] of [['portrait', PORTRAIT], ['landscape', LANDSCAPE]] as const) {
      test(`${chapter} ${label}: every expression the script uses renders its own sprite and every figure stands above the dialogue box inside the stage`, async ({ page }, info: TestInfo) => {
        test.setTimeout(240_000);
        const script = chapterOf(chapter);
        const seen = new Set<string>();
        for (const sc of script.scenes) {
          const p = await page.context().browser()!.newContext({ ...(info.project.use as object), viewport: size });
          const q = await p.newPage();
          await openAt(q, chapter, sc.id, size);
          for (let i = 0; i < 40; i += 1) {
            const s = await storyOf(q);
            if (s.scene !== sc.id || s.mode !== 'story' || s.asking) break;
            await settled(q);
            const story = (await q.locator('#story').boundingBox())!;
            const dialogue = (await q.locator('.dialogue').boundingBox())!;
            for (const c of (s.cast ?? []) as unknown as { name: keyof typeof CAST; expr: string; view: string }[]) {
              const key = CAST[c.name].key;
              await expect.poll(() => q.locator(`.figure[data-who="${key}"] .face`).getAttribute('src'), { message: `${c.name} face src is set once the sprite decodes` }).not.toBeNull();
              const face = await q.locator(`.figure[data-who="${key}"] .face`).getAttribute('src');
              expect(face, `${c.name} ${c.expr}`).toContain(SPRITE[key](c.view === 'front' ? 'front' : 'three-quarter', c.expr));
              seen.add(`${c.name}:${c.expr}`);
              const box = (await q.locator(`.figure[data-who="${key}"]`).boundingBox())!;
              expect(box.x, `${c.name} inside the stage (left)`).toBeGreaterThanOrEqual(story.x - 1);
              expect(box.x + box.width, `${c.name} inside the stage (right)`).toBeLessThanOrEqual(story.x + story.width + 1);
              expect(box.y + box.height, `${c.name} above the dialogue box`).toBeLessThanOrEqual(dialogue.y + 4);
            }
            await advanceStory(q, info);
          }
          await p.close();
        }
        expect(seen.size).toBeGreaterThan(2);
      });
    }
  }

  for (const [chapter, scene, id, gone, goneLine, rest, needle] of [
    ['bethlehem', 'mang-co', 'manger-lamp', null, null, [], ''],
    ['nicholas', 'nam-viet', 'window-shadow', 'tui-trong', null, ['small-bag'], 'Máy hắt lên vách kho'],
    ['befana', 'ngoi-sao', 'kitchen-shadows', null, 'Ô sáng tắt', [], ''],
    ['tree', 'o-sang', 'tree-light', 'qua-tao', null, ['apple'], ''],
  ] as const) {
    test(`${chapter}: the scenery prop ${id} is on the art from the plate of its scene (the caption names it) to ${gone ? 'the first beat of ' + gone : goneLine ? 'the line "' + goneLine + '"' : 'the end of the chapter'}`, async ({ page }, info) => {
      test.setTimeout(120_000);
      await openAt(page, chapter, scene, PORTRAIT);
      const onArt = (): Promise<string[]> => page.locator('.scenery .prop').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.prop as string));
      let beats = 0;
      let named = !needle;
      for (let i = 0; i < 40; i += 1) {
        const s = (await storyOf(page)) as unknown as { scene: string; mode: string; line?: { text: string }; stage: { props: string[] } };
        if ((gone && s.scene === gone) || (goneLine && s.line?.text.startsWith(goneLine))) {
          expect(s.stage.props.filter((p) => !['coffee-cup-full', 'letter'].includes(p)), `${gone ?? goneLine}: the layers left are exactly these`).toEqual(rest);
          expect(await onArt(), 'and so on the art').toEqual(rest);
          return expect(beats, 'the prop was shown before it went').toBeGreaterThan(3);
        }
        if (s.scene !== scene || s.mode !== 'story') break;
        if (!named && (s.line?.text ?? '').includes(needle)) named = true;
        expect(s.stage.props.filter((p) => p === id), `beat ${i}`).toEqual(named ? [id] : []);
        expect(await onArt(), `beat ${i} in the DOM`).toEqual(named ? [id] : []);
        beats += 1;
        await advanceStory(page, info);
      }
      expect(beats, 'the scene was played').toBeGreaterThan(3);
    });
  }

  for (const [chapter, scene, id, gone, needle] of [
    ['krampus', 'hinh-ve', 'draft-face', true, 'vẽ cái mặt'],
    ['krampus', 'mat-na-giay', 'draft-holes', true, ''],
    ['befana', 'ban-bep', 'name-page', false, ''],
    ['tree', 'qua-tao', 'apple', true, ''],
    ['tree', 'qua-tao', 'paper-star', false, 'Có ai từng treo sao'],
    ['ban1647', 'cot-thu-bay', 'lone-slip', true, ''],
    ['ban1647', 'bac-da', 'step-apple', false, ''],
    ['silent-night', 'hai-cai-bong', 'door-shadows', true, ''],
    ['silent-night', 'hai-cai-bong', 'choir-mark', true, 'Sau hai cái bóng'],
    ['silent-night', 'to-giay-trang', 'door-calendar', false, 'Anh gài trang lịch'],
  ] as const) {
    test(`${chapter}: the scenery layer ${id} the caption names is on the art from its plate, drawn${gone ? ', and gone when its line is past' : ''}`, async ({ page }, info) => {
      test.setTimeout(120_000);
      await openAt(page, chapter, scene, PORTRAIT);
      const onArt = (): Promise<string[]> => page.locator('.scenery .prop').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.prop as string));
      if ((await stateOf(page)).shell.mode === 'namecard') {
        await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean } }).screen.ready, { timeout: 15_000 }).toBe(true);
        await page.locator('#namecard-next').click();
        await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
      }
      await settled(page);
      if (needle) {
        expect(await onArt(), 'not before its line').not.toContain(id);
        for (let i = 0; i < 20 && !((await storyOf(page)).line?.text ?? '').includes(needle); i += 1) await advanceStory(page, info);
        expect((await storyOf(page)).line?.text).toContain(needle);
        await settled(page);
      }
      expect(await onArt(), 'from its line').toContain(id);
      const img = page.locator(`.scenery .prop[data-prop="${id}"] img`);
      await expect(img).toBeVisible();
      expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      if (!gone) return;
      for (let i = 0; i < 60; i += 1) {
        const mode = (await stateOf(page)).shell.mode;
        if (mode === 'namecard') {
          await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean } }).screen.ready, { timeout: 15_000 }).toBe(true);
          await page.locator('#namecard-next').click();
          await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
        } else if (mode !== 'story' || (await storyOf(page)).scene !== scene) break;
        else await advanceStory(page, info);
      }
      await settled(page);
      expect(await onArt(), 'gone after its scene').not.toContain(id);
    });
  }

  /** Where the flame (chapter 5), the hand (chapter 7), the lit patch (10) and the lit square (11) are inside their layer's frame, as fractions of it. */
  const KEY_PART = {
    'manger-lamp': { chapter: 'bethlehem', scene: 'mang-co', frame: [200, 150], box: [104, 50, 12, 14] },
    'window-shadow': { chapter: 'nicholas', scene: 'nam-viet', frame: [90, 210], box: [16, 96, 76, 90] },
    'kitchen-shadows': { chapter: 'befana', scene: 'ngoi-sao', frame: [100, 170], box: [0, 0, 100, 170] },
    'tree-light': { chapter: 'tree', scene: 'o-sang', frame: [100, 130], box: [4, 31, 92, 92] },
  } as const;
  const SIZES: [string, number, number][] = [['320x568', 320, 568], ['360x640', 360, 640], ['375x667', 375, 667], ['390x844', 390, 844], ['640x360', 640, 360], ['667x375', 667, 375], ['844x390', 844, 390], ['1024x768', 1024, 768], ['1280x720', 1280, 720], ['1280x800', 1280, 800]];
  for (const [id, part] of Object.entries(KEY_PART)) {
    test(`${id}: the key part of the layer (${id === 'manger-lamp' ? 'lamp flame' : id === 'window-shadow' ? 'hand with the pouch' : 'lit square'}) is inside the story box and above the dialogue at every phone and desktop size`, async ({ page }, info) => {
      test.setTimeout(240_000);
      for (const [label, w, h] of SIZES) {
        await openAt(page, part.chapter, part.scene, { width: w, height: h });
        await settled(page);
        for (let i = 0; i < 30 && !(await page.locator(`.scenery .prop[data-prop="${id}"]`).count()); i += 1) await advanceStory(page, info);
        const layer = (await page.locator(`.scenery .prop[data-prop="${id}"]`).boundingBox())!;
        const story = (await page.locator('#story').boundingBox())!;
        const dialogue = (await page.locator('.dialogue').boundingBox())!;
        const [fw, fh] = part.frame, [bx, by, bw, bh] = part.box;
        const x0 = layer.x + (bx / fw) * layer.width, x1 = x0 + (bw / fw) * layer.width, y0 = layer.y + (by / fh) * layer.height, y1 = y0 + (bh / fh) * layer.height;
        expect(x0, `${label} left`).toBeGreaterThanOrEqual(story.x - 0.5);
        expect(x1, `${label} right`).toBeLessThanOrEqual(story.x + story.width + 0.5);
        expect(y0, `${label} top`).toBeGreaterThanOrEqual(story.y - 0.5);
        expect(y1, `${label} bottom, over the dialogue at ${Math.round(dialogue.y)}`).toBeLessThanOrEqual(dialogue.y + 0.5);
      }
    });
  }

  test('props follow the script across three scenes played in a row: the DOM holds exactly the props the stage reports, each once', async ({ page }, info) => {
    test.setTimeout(120_000);
    await openAt(page, 'intro', 'phong-ho-so', PORTRAIT);
    const dom = (): Promise<string[]> => page.locator('.machine .prop').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.prop as string));
    const scenes: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 80 && scenes.length < 3; i += 1) {
      const s = await storyOf(page);
      const stage = (s as unknown as { stage: { props: string[] } }).stage.props;
      if (s.scene && scenes.at(-1) !== s.scene) scenes.push(s.scene);
      for (const id of stage) seen.add(id);
      expect(await dom(), `${s.scene} beat ${s.beat}`).toEqual(stage);
      if (scenes.length === 3 && s.scene === 'cuc-cu') break;
      if (s.asking) await typeName(page, 'Lan');
      else await advanceStory(page, info);
    }
    expect(scenes).toEqual(['phong-ho-so', 'hoi-ten', 'cuc-cu']);
    expect([...seen].sort()).toContain('coffee-cup');
    expect((await stateOf(page)).story?.scene).toBe('cuc-cu');
  });

  for (const [chapter, scene, before, line, after] of [
    ['intro', 'phong-ho-so', [], 'Tèo. Có một lá thư', ['letter']],
    ['mistletoe', 'net-noi', [], 'Bên chân máy', ['coffee-cup-full']],
    ['dec25', 'hai-muc', [], 'Trên nền đá', ['coffee-cup-full']],
    ['nicholas', 'ba-mat-so', [], 'Trên mặt kè', ['coffee-cup-full']],
    ['saturnalia', 'qua-don', [], 'Sát chân cỗ máy', ['coffee-cup-full']],
    ['yule', 'den-sang', ['candle-wax'], 'Bên cỗ máy', ['coffee-cup-full']],
  ] as const) {
    test(`${chapter}: the prop the narration names is on the stage at that line, drawn, and not before`, async ({ page }, info) => {
      await openAt(page, chapter, scene, PORTRAIT);
      const props = async (): Promise<string[]> => ((await storyOf(page)) as unknown as { stage: { props: string[] } }).stage.props;
      for (let i = 0; i < 30 && !((await storyOf(page)).line?.text ?? '').startsWith(line); i += 1) {
        if (i === 0) expect(await props()).toEqual([...before]);
        await advanceStory(page, info);
      }
      expect((await storyOf(page)).line?.text).toContain(line);
      expect(await props()).toEqual([...after]);
      await settled(page);
      const img = page.locator(`.machine [data-prop="${after[0]}"] img`);
      await expect(img).toBeVisible();
      expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    });
  }

  for (const [chapter, scene, said] of [['mistletoe', 'hanh-lang', 'Quạ Đồn đậu sẵn'], ['dec25', 'hai-muc', 'Quạ Đồn khép cánh'], ['nicholas', 'ba-mat-so', 'Quạ Đồn đã đậu'], ['ending', 'the-ten', 'Quạ Đồn đã đậu sẵn'], ['carol', 'truoc-cua-quan', 'Quạ Đồn đậu trên nóc máy'], ['krampus', 'hinh-ve', 'Quạ Đồn đậu trên nóc máy'], ['befana', 'xa-bep', 'Quạ Đồn đã đậu trên xà'], ['tree', 'chu-nen', 'Quạ Đồn đã đậu trên một cành thấp'], ['ban1647', 'mat-so-nguoi', 'Quạ Đồn đậu ở đầu dây phơi'], ['silent-night', 'bac-da', 'Quạ Đồn đã đậu sẵn']] as const)
  test(`${chapter}: Quạ Đồn is on the stage from the line that says he is already perched, not before, and inside the story box above the dialogue at the small portrait sizes`, async ({ page }, info) => {
    test.setTimeout(240_000);
    for (const [w, h] of [[320, 568], [360, 640], [375, 667]] as const) {
      await openAt(page, chapter, scene, { width: w, height: h });
      const crow = page.locator('#story .figure[data-who="qua-don"]');
      const label = `${w}x${h}`;
      for (let i = 0; i < 12 && !((await storyOf(page)).line?.text ?? '').includes(said); i += 1) {
        expect(await crow.count(), `${label}: no Quạ Đồn before the line that names him`).toBe(0);
        if ((await stateOf(page)).shell.mode === 'namecard') {
          await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean } }).screen.ready, { timeout: 15_000 }).toBe(true);
          await page.locator('#namecard-next').click();
          await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
          continue;
        }
        await advanceStory(page, info);
      }
      expect((await storyOf(page)).line?.text, label).toContain(said);
      await settled(page);
      await expect(crow, `${label}: Quạ Đồn on the stage at the line that names him`).toBeVisible();
      const b = (await crow.boundingBox())!, story = (await page.locator('#story').boundingBox())!, dialogue = (await page.locator('.dialogue').boundingBox())!;
      expect(b.y, `${label}: top`).toBeGreaterThanOrEqual(story.y);
      expect(b.y + b.height, `${label}: bottom`).toBeLessThanOrEqual(dialogue.y + 0.5);
      expect(b.x, `${label}: left`).toBeGreaterThanOrEqual(story.x);
      expect(b.x + b.width, `${label}: right`).toBeLessThanOrEqual(story.x + story.width + 0.5);
    }
  });

  test('chapter 1: the clean letter is swapped for the blurred one when the cup tips over', async ({ page }, info) => {
    await openAt(page, 'intro', 'phong-ho-so', PORTRAIT);
    const props = async (): Promise<string[]> => ((await storyOf(page)) as unknown as { stage: { props: string[] } }).stage.props;
    for (let i = 0; i < 30 && !((await storyOf(page)).line?.text ?? '').startsWith('Vệt nâu loang'); i += 1) await advanceStory(page, info);
    expect(await props()).toEqual(['coffee-cup', 'letter-blurred']);
    await expect(page.locator('.machine [data-prop="letter"]')).toHaveCount(0);
  });

  test('Tèo\'s normal pose and face are requested before the chapter background, so a slow cold load does not show the room without him', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', (r) => {
      const name = /\/([\w-]+?)(?:-[\w-]{8})?\.webp$/.exec(new URL(r.url()).pathname)?.[1];
      if (name) seen.push(name);
    });
    await page.setViewportSize(PORTRAIT);
    await page.goto('/');
    await waitReady(page);
    await settled(page);
    const at = (prefix: string): number => seen.findIndex((n) => n.startsWith(prefix));
    expect(at('teo-front-face-normal'), seen.join(' ')).toBeGreaterThanOrEqual(0);
    expect(at('teo-front'), seen.join(' ')).toBeGreaterThanOrEqual(0);
    expect(at('bg-ch1-office-portrait'), seen.join(' ')).toBeGreaterThanOrEqual(0);
    expect(Math.max(at('teo-front'), at('teo-front-face-normal')), 'both Tèo sprites come before the background').toBeLessThan(at('bg-ch1-office-portrait'));
  });

  test('Tèo is large enough in landscape for his expressions to read: his face is at least 28 px wide on a 844 x 390 phone', async ({ page }) => {
    await openAt(page, 'yule', 'sanh-dai', LANDSCAPE);
    const face = await page.locator('.figure[data-who="teo"] .face').boundingBox();
    expect(face!.width).toBeGreaterThanOrEqual(28);
  });
});
