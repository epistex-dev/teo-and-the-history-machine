import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fitPlate, stepBack, type PlateLayout } from '../src/story/stage.ts';

type Rect = [number, number, number, number];
interface Room { plate: { svg: (view: Rect) => string }; frame: Rect }
interface Layout { size: [number, number]; keep?: Rect; quado: { root: [number, number]; scale: number }; teo: { root: [number, number] }; groundY: number }

const ROOMS = [
  ['ch4-corridor', 'hanh-lang-nha-anh-1784'],
  ['ch5-bethlehem', 'dem-ngoai-belem'],
  ['ch6-vault', 'kho-lich-roma'],
  ['ch7-harbour', 'ben-cang-myra-dem'],
  ['ch8-yard', 'san-lang-anh-1426'],
  ['ch9-village', 'lang-alps-dem-dong'],
  ['ch10-kitchen', 'nha-o-y-dem-hien-linh'],
  ['ch11-parlour', 'can-phong-strasbourg-1605'],
  ['ch12-street', 'pho-anh-1647'],
  ['ch13-church', 'oberndorf-toi-24-12-1818'],
] as const;
const ORIENTATIONS = ['portrait', 'landscape'] as const;
const SOURCES = ['corridor', 'bethlehem', 'vault', 'harbour', 'scenery', 'lit', 'night', 'yard', 'village', 'kitchen', 'parlour', 'street', 'church'];
const SCENERY = ['manger-lamp', 'window-shadow', 'kitchen-shadows', 'tree-light', 'draft-face', 'draft-holes', 'name-page', 'apple', 'paper-star', 'step-apple', 'lone-slip', 'door-shadows', 'choir-mark', 'door-calendar'] as const;
const SCENERY_PLATE: Record<string, string> = { 'manger-lamp': 'ch5-bethlehem', 'window-shadow': 'ch7-harbour', 'kitchen-shadows': 'ch10-kitchen', 'tree-light': 'ch11-parlour', 'draft-face': 'ch9-village', 'draft-holes': 'ch9-village', 'name-page': 'ch10-kitchen', apple: 'ch11-parlour', 'paper-star': 'ch11-parlour', 'step-apple': 'ch12-street', 'lone-slip': 'ch12-street', 'door-shadows': 'ch13-church', 'choir-mark': 'ch13-church', 'door-calendar': 'ch13-church' };
type Scenery = { scenery: true; at: [number, number]; width: number; landscape: { at: [number, number]; width: number } };
const sceneryRows = (): Record<string, Scenery> => (JSON.parse(read('src/story/stage-data.json')) as { props: Record<string, Scenery> }).props;

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const art = async (): Promise<{ rooms: Record<string, (o: string) => Room>; layouts: Record<string, Record<string, Layout>>; crow: Rect }> => {
  const [assets, layouts, birds] = await Promise.all([import('../art/style/assets.mjs' as string), import('../art/style/layouts.mjs' as string), import('../art/style/birds.mjs' as string)]);
  return { rooms: assets.ROOMS, layouts: layouts.LAYOUTS, crow: birds.CROW_FRAME };
};
const palette = (): Set<string> => {
  const md = read('VISUAL_DESIGN.md');
  const section = md.slice(md.indexOf('## Palette'), md.indexOf('## Typography'));
  return new Set((section.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()));
};

test.describe('Act 1 and 2 plates (chapters 4 to 11): the rooms of the plate pipeline', () => {
  test.beforeEach(({ baseURL }, info) => {
    test.skip(!baseURL || info.project.name !== 'desktop-chromium', 'pure checks on the sources and the bake, run once');
  });

  test('every backdrop id the eight chapter scripts name is mapped to its plate in stage-data and registered in the pipeline', async () => {
    const { rooms, layouts } = await art();
    const data = JSON.parse(read('src/story/stage-data.json')) as { backdrops: Record<string, { plate: string }> };
    for (const [plate, bg] of ROOMS) {
      expect(data.backdrops[bg]?.plate, bg).toBe(plate);
      expect(typeof rooms[plate], `${plate} room generator`).toBe('function');
      expect(Object.keys(layouts[plate] ?? {}).sort(), `${plate} layouts`).toEqual(['landscape', 'portrait']);
    }
    const scripts = ['mistletoe', 'bethlehem', 'dec25', 'nicholas', 'carol', 'krampus', 'befana', 'tree', 'ban1647', 'silent-night'].map((c) => read(`story/chapters/${c}.md`)).join('\n');
    for (const [, bg] of ROOMS) expect(scripts.includes(`@bg ${bg}`), bg).toBe(true);
  });

  test('plate SVG: drawn art only (no text, no embedded bitmap) and every colour belongs to the VISUAL_DESIGN palette', async () => {
    const { rooms } = await art();
    const allowed = palette();
    for (const [plate] of ROOMS) for (const o of ORIENTATIONS) {
      const room = rooms[plate]!(o);
      const svg = room.plate.svg(room.frame);
      expect(svg.length, `${plate} ${o}`).toBeGreaterThan(50_000);
      expect(/<text|<image|<foreignObject|<script|<use/i.test(svg), `${plate} ${o}: no text or bitmap`).toBe(false);
      const stray = new Set((svg.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()).filter((h) => !allowed.has(h)));
      expect([...stray], `${plate} ${o}: colours outside the palette`).toEqual([]);
    }
    const { prop } = (await import('../art/style/props.mjs' as string)) as { prop: (id: string) => { svg: (scale: number) => string } };
    for (const id of SCENERY) {
      const svg = prop(id).svg(1);
      expect(/<text|<image|<foreignObject|<script|<use/i.test(svg), `${id}: no text or bitmap`).toBe(false);
      expect([...new Set((svg.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()).filter((h) => !allowed.has(h)))], `${id}: colours outside the palette`).toEqual([]);
    }
  });

  test('the room sources draw no figure: no Tèo, bird, face or hand generator, and no reindeer, antler, chimney or sun-wheel', () => {
    for (const name of SOURCES) {
      const src = read(`art/style/${name}.mjs`);
      expect(/teoBody|drawFace|\bcrow\(|\bcuckoo\(|\bhand\(|from '\.\/(teo|faces|birds)\.mjs'/.test(src), `${name}: figure generator`).toBe(false);
      expect(/reindeer|antler|rudolph|chimney|sun-?wheel|sunwheel/i.test(src), `${name}: banned imagery`).toBe(false);
    }
  });

  test('layouts: Quạ Đồn and the key furniture lie inside the art in both orientations, and Quạ Đồn\'s head is not cut at the top', async () => {
    const { layouts, crow } = await art();
    for (const [plate] of ROOMS) for (const o of ORIENTATIONS) {
      const l = layouts[plate]![o]!, [w, h] = l.size, { root, scale } = l.quado;
      expect(root[0] + crow[0] * scale, `${plate} ${o} crow left`).toBeGreaterThanOrEqual(0);
      expect(root[0] + (crow[0] + crow[2]) * scale, `${plate} ${o} crow right`).toBeLessThanOrEqual(w);
      expect(root[1], `${plate} ${o} crow feet`).toBeLessThanOrEqual(h);
      expect(root[1] + crow[1] * scale, `${plate} ${o} crow head`).toBeGreaterThanOrEqual(0);
      expect(l.groundY, `${plate} ${o} ground line`).toBeLessThan(h);
      if (l.keep) {
        const [x, y, kw, kh] = l.keep;
        expect(x >= 0 && y >= 0 && x + kw <= w && y + kh <= h, `${plate} ${o} keep rectangle inside the art`).toBe(true);
      }
    }
    for (const [plate] of ROOMS) expect(layouts[plate]!.portrait!.keep, `${plate} portrait keep`).toBeTruthy();
  });

  test('the key object of each chapter lies inside the portrait keep rectangle: the mistletoe bunch (4), the lamp flame on the manger (5), the hanging lamp (6), the lantern (7), the lit window (8), the post lantern (9), the oil lamp (10), the desk candle (11)', async () => {
    const { rooms, layouts } = await art();
    const inside = (k: Rect, r: Rect, what: string): void => {
      expect(r[0], `${what} left`).toBeGreaterThanOrEqual(k[0]);
      expect(r[1], `${what} top`).toBeGreaterThanOrEqual(k[1]);
      expect(r[0] + r[2], `${what} right`).toBeLessThanOrEqual(k[0] + k[2]);
      expect(r[1] + r[3], `${what} bottom`).toBeLessThanOrEqual(k[1] + k[3]);
    };
    const keep = (plate: string): Rect => layouts[plate]!.portrait!.keep!;
    const b = (rooms['ch4-corridor']!('portrait') as unknown as { bunch: { left: number; top: number; right: number; bottom: number } }).bunch;
    inside(keep('ch4-corridor'), [b.left, b.top, b.right - b.left, b.bottom - b.top], 'ch4 mistletoe bunch');
    const c = (rooms['ch6-vault']!('portrait') as unknown as { crown: { left: number; top: number; right: number; bottom: number } }).crown;
    inside(keep('ch6-vault'), [c.left, c.top, c.right - c.left, c.bottom - c.top], 'ch6 hanging lamp');
    const { MANGER_FLAME } = (await import('../art/style/lit.mjs' as string)) as { MANGER_FLAME: [number, number] };
    const m = sceneryRows()['manger-lamp']!, k = m.width / 200;
    inside(keep('ch5-bethlehem'), [m.at[0] + MANGER_FLAME[0] * k - 4, m.at[1] + MANGER_FLAME[1] * k - 4, 8, 8], 'ch5 lamp flame');
    const lamp = (rooms['ch7-harbour']!('portrait') as unknown as { lamp: [number, number] }).lamp;
    inside(keep('ch7-harbour'), [lamp[0] - 8, lamp[1] - 8, 16, 16], 'ch7 lantern');
    const keys = (id: string): Record<string, Rect> => (rooms[id]!('portrait') as unknown as { keys: Record<string, Rect> }).keys;
    inside(keep('ch8-yard'), keys('ch8-yard').window!, 'ch8 lit window');
    inside(keep('ch9-village'), keys('ch9-village').lantern!, 'ch9 lantern on the post');
    inside(keep('ch10-kitchen'), keys('ch10-kitchen').lamp!, 'ch10 oil lamp');
    inside(keep('ch11-parlour'), keys('ch11-parlour').candle!, 'ch11 candle on the desk');
    inside(keep('ch12-street'), keys('ch12-street').lamp!, 'ch12 bracket lamp');
    inside(keep('ch12-street'), keys('ch12-street').sheet!, 'ch12 sheet on the line');
    inside(keep('ch13-church'), keys('ch13-church').portal!, 'ch13 church door');
  });

  test('scenery props: placed inside the art in both orientations, and only the four chapters\' scripts reveal them, once each', async () => {
    const { layouts } = await art();
    const { PROPS } = (await import('../art/style/props.mjs' as string)) as { PROPS: Record<string, Rect> };
    for (const id of SCENERY) {
      const row = sceneryRows()[id]!;
      expect(row.scenery, id).toBe(true);
      for (const o of ORIENTATIONS) {
        const { at, width } = o === 'portrait' ? row : row.landscape, plate = SCENERY_PLATE[id]!;
        const [w, h] = layouts[plate]![o]!.size, ratio = PROPS[id]![3] / PROPS[id]![2];
        expect(at[0], `${id} ${o} left`).toBeGreaterThanOrEqual(0);
        expect(at[1], `${id} ${o} top`).toBeGreaterThanOrEqual(0);
        expect(at[0] + width, `${id} ${o} right`).toBeLessThanOrEqual(w);
        expect(at[1] + width * ratio, `${id} ${o} bottom`).toBeLessThanOrEqual(h);
      }
    }
    const count = (chapter: string, re: RegExp): number => (read(`story/chapters/${chapter}.md`).match(re) ?? []).length;
    expect(count('bethlehem', /^@prop manger-lamp$/gm)).toBe(1);
    expect(count('nicholas', /^@prop window-shadow$/gm)).toBe(1);
    expect(count('nicholas', /^@prop -window-shadow$/gm)).toBe(1);
    expect(count('befana', /^@prop kitchen-shadows$/gm)).toBe(1);
    expect(count('befana', /^@prop -kitchen-shadows$/gm)).toBe(1);
    for (const [chapter, id] of [['krampus', 'draft-face'], ['krampus', 'draft-holes'], ['befana', 'name-page'], ['tree', 'apple']] as const) {
      expect(count(chapter, new RegExp('^@prop ' + id + '$', 'gm')), id + ' shown').toBe(1);
      expect(count(chapter, new RegExp('^@prop -' + id + '$', 'gm')), id + ' removed').toBe(1);
    }
    for (const [chapter, id] of [['ban1647', 'lone-slip'], ['silent-night', 'door-shadows'], ['silent-night', 'choir-mark']] as const) {
      expect(count(chapter, new RegExp('^@prop ' + id + '$', 'gm')), id + ' shown').toBe(1);
      expect(count(chapter, new RegExp('^@prop -' + id + '$', 'gm')), id + ' removed').toBe(1);
    }
    expect(count('ban1647', /^@prop step-apple$/gm)).toBe(1);
    expect(count('silent-night', /^@prop door-calendar$/gm)).toBe(1);
    expect(count('tree', /^@prop paper-star$/gm)).toBe(1);
    expect(count('tree', /^@prop tree-light$/gm)).toBe(1);
    expect(count('tree', /^@prop -tree-light$/gm)).toBe(1);
  });

  test('every figure anchor and key object of the rooms lies inside the stage once the crop is computed with fitPlate, at every phone and desktop size', async () => {
    const { layouts, rooms } = await art();
    // the drawn pixels of the baked bird inside CROW_FRAME (alpha bounding box of quado-body + head, design units)
    const CROW_SEEN: Rect = [-63, -154, 134, 159];
    const { PROPS } = (await import('../art/style/props.mjs' as string)) as { PROPS: Record<string, Rect> };
    // Act 2 rooms join by adding a row to ROOMS and, for key objects, `keys` in the room generator or a SCENERY_BOXES row
    const SCENERY_BOXES: Record<string, { plate: string; box: Rect }> = { 'manger-lamp': { plate: 'ch5-bethlehem', box: [104, 50, 12, 14] }, 'window-shadow': { plate: 'ch7-harbour', box: [16, 96, 76, 90] }, 'kitchen-shadows': { plate: 'ch10-kitchen', box: [0, 0, 100, 170] }, 'tree-light': { plate: 'ch11-parlour', box: [4, 31, 92, 92] }, 'draft-face': { plate: 'ch9-village', box: [4, 6, 58, 42] }, 'draft-holes': { plate: 'ch9-village', box: [4, 6, 58, 42] }, 'name-page': { plate: 'ch10-kitchen', box: [2, 3, 45, 18] }, 'step-apple': { plate: 'ch12-street', box: [2, 1, 20, 21] }, 'lone-slip': { plate: 'ch12-street', box: [2, 2, 29, 12] }, 'door-shadows': { plate: 'ch13-church', box: [0, 0, 60, 90] }, 'choir-mark': { plate: 'ch13-church', box: [3, 8, 54, 20] }, 'door-calendar': { plate: 'ch13-church', box: [1, 1, 22, 30] }, apple: { plate: 'ch11-parlour', box: [2, 1, 20, 21] }, 'paper-star': { plate: 'ch11-parlour', box: [3, 0, 30, 16] } };
    // far scenery that must not sit behind the machine's box (the boat drawn on the horizon was once hidden there)
    const SEEN_FREE = ['boat'];
    // key objects of the Act 2 rooms that Tèo or the machine must not cover at the portrait sizes (the lantern and the lamp once sat under them)
    const FIGURE_FREE = ['lantern', 'lamp', 'broom', 'window', 'candle', 'sheet', 'step', 'portal', 'draft-face', 'draft-holes', 'name-page', 'apple', 'paper-star', 'step-apple', 'lone-slip', 'door-shadows', 'choir-mark', 'door-calendar'];
    const TEO_SEEN: Rect = [-50, -334, 109, 339];
    // [width, height of the viewport, stage height below the header, dialogue box height], measured in the running game
    const sizes = [[320, 568, 489, 231], [360, 640, 561, 253], [375, 667, 603, 253], [390, 844, 780, 228], [640, 360, 360, 117], [667, 375, 375, 94], [844, 390, 390, 94], [1024, 768, 704, 106], [1280, 720, 656, 106], [1280, 800, 736, 106]] as const;
    for (const [w, h, stage, dialogue] of sizes) for (const [plate] of ROOMS) {
      const o = w > h ? 'landscape' : 'portrait', layout = layouts[plate]![o] as unknown as PlateLayout & Layout;
      const fit = fitPlate(layout, w, stage, dialogue + 8);
      const things: [string, Rect][] = [];
      { const { root, scale } = layout.quado, s = scale * fit.back * fit.k, [x, y] = stepBack(fit, root);
        things.push(['Quạ Đồn', [fit.ox + x * fit.k + CROW_SEEN[0] * s, fit.oy + y * fit.k + CROW_SEEN[1] * s, CROW_SEEN[2] * s, CROW_SEEN[3] * s]]); }
      for (const [name, r] of Object.entries((rooms[plate]!(o) as unknown as { keys?: Record<string, Rect> }).keys ?? {})) things.push([name, [fit.ox + r[0] * fit.k, fit.oy + r[1] * fit.k, r[2] * fit.k, r[3] * fit.k]]);
      for (const [id, { plate: p, box }] of Object.entries(SCENERY_BOXES)) {
        if (p !== plate) continue;
        const row = sceneryRows()[id]!, { at, width } = o === 'portrait' ? row : row.landscape, sc = width / PROPS[id]![2];
        things.push([id, [fit.ox + (at[0] + box[0] * sc) * fit.k, fit.oy + (at[1] + box[1] * sc) * fit.k, box[2] * sc * fit.k, box[3] * sc * fit.k]]);
      }
      { const { origin, scale } = (layout as unknown as { machine: { origin: [number, number]; scale: number } }).machine, [mx, my] = stepBack(fit, origin), ms = scale * fit.back * fit.k;
        const machine: Rect = [fit.ox + mx * fit.k, fit.oy + my * fit.k, 300 * ms, 340 * ms];
        for (const [name, [x, y, bw, bh]] of things) if (SEEN_FREE.includes(name))
          expect(x + bw <= machine[0] || machine[0] + machine[2] <= x || y + bh <= machine[1] || machine[1] + machine[3] <= y, `${plate} ${name} at ${w}x${h}: hidden behind the machine`).toBe(true); }
      if (o === 'portrait') {
        const { root, scale } = (layout as unknown as { teo: { root: [number, number]; scale: number } }).teo, ts = scale * fit.back * fit.k, [tx, ty] = stepBack(fit, root);
        const teo: Rect = [fit.ox + tx * fit.k + TEO_SEEN[0] * ts, fit.oy + ty * fit.k + TEO_SEEN[1] * ts, TEO_SEEN[2] * ts, TEO_SEEN[3] * ts];
        const { origin, scale: mscale } = (layout as unknown as { machine: { origin: [number, number]; scale: number } }).machine, [mx, my] = stepBack(fit, origin), ms = mscale * fit.back * fit.k;
        const machine: Rect = [fit.ox + mx * fit.k + 7.5 * ms, fit.oy + my * fit.k + 13 * ms, 286 * ms, 327 * ms];
        for (const [name, [x, y, bw, bh]] of things) if (FIGURE_FREE.includes(name))
          for (const [who, f] of [['Tèo', teo], ['the machine', machine]] as const)
            expect(x + bw <= f[0] || f[0] + f[2] <= x || y + bh <= f[1] || f[1] + f[3] <= y, `${plate} ${name} at ${w}x${h}: covered by ${who}`).toBe(true);
      }
      for (const [name, [x, y, bw, bh]] of things) {
        const label = `${plate} ${name} at ${w}x${h}`;
        expect(x, `${label}: left`).toBeGreaterThanOrEqual(0);
        expect(x + bw, `${label}: right`).toBeLessThanOrEqual(w);
        expect(y, `${label}: top`).toBeGreaterThanOrEqual(0);
        expect(y + bh, `${label}: bottom (above the dialogue box)`).toBeLessThanOrEqual(stage - dialogue);
      }
    }
  });

  test('bake: both backdrops of each room exist at the shipped resolution, the sky is not a flat block (luminance spread of the top quarter), night plates are dark, and the plates stay inside the per-plate size', async ({}, info) => {
    info.setTimeout(240_000);
    if (!existsSync(new URL('../art/baked/manifest.json', import.meta.url))) {
      try {
        execFileSync(process.execPath, ['art/style/bake.mjs'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
      } catch (e) {
        test.skip(true, `art/baked is not built (it is gitignored) and baking failed here: ${String((e as Error).message).slice(0, 120)}`);
      }
    }
    const { layouts } = await art();
    const manifest = JSON.parse(read('art/baked/manifest.json')) as { files: Record<string, { w: number; h: number; bytes: number; res: number }> };
    const dir = new URL('../art/baked/', import.meta.url).pathname;
    const spreadOf = (name: string): [number, number] => execFileSync('magick', [`${dir}${name}.webp`, '-blur', '0x8', '-gravity', 'north', '-crop', '100%x25%+0+0', '+repage', '-colorspace', 'Gray', '-format', '%[fx:standard_deviation] %[fx:mean]', 'info:'], { encoding: 'utf8' }).split(' ').map(Number) as [number, number];
    const drawn = ['ch1-office', 'ch2-feast', 'ch3-hall'].flatMap((p) => ORIENTATIONS.map((o) => spreadOf(`bg-${p}-${o}`)[0]));
    const floor = 0.8 * Math.min(...drawn);
    const flat = execFileSync('magick', ['-size', '468x252', 'xc:#406080', '-blur', '0x8', '-colorspace', 'Gray', '-format', '%[fx:standard_deviation]', 'info:'], { encoding: 'utf8' });
    expect(Number(flat), 'a flat block is under the floor, so the floor separates it from a drawn sky').toBeLessThan(floor);
    for (const [plate] of ROOMS) for (const o of ORIENTATIONS) {
      const file = manifest.files[`bg-${plate}-${o}`];
      expect(file, `bg-${plate}-${o} baked`).toBeTruthy();
      const [w, h] = layouts[plate]![o]!.size;
      expect(file!.w, `${plate} ${o} width`).toBe(Math.round(w * file!.res));
      expect(file!.h, `${plate} ${o} height`).toBe(Math.round(h * file!.res));
      expect(file!.bytes, `${plate} ${o}: over the plate size`).toBeLessThan(180_000);
      const [spread, mean] = spreadOf(`bg-${plate}-${o}`);
      expect(spread, `${plate} ${o}: blurred luminance spread of the top quarter (a flat block is 0; chapters 1 to 3 give a floor of ${floor.toFixed(3)})`).toBeGreaterThan(floor);
      if (['ch5-bethlehem', 'ch7-harbour', 'ch8-yard', 'ch9-village'].includes(plate)) expect(mean, `${plate} ${o}: reads as night`).toBeLessThan(0.35);
    }
  });
});

test.describe('Act 2 review fixes: chapter 10 kitchen art and the chapter scripts', () => {
  test.beforeEach(({ baseURL }, info) => {
    test.skip(!baseURL || info.project.name !== 'desktop-chromium', 'pure checks on the sources and the bake, run once');
  });

  const lum = (img: { width: number; data: Uint8Array | Uint8ClampedArray }, x: number, y: number): number => {
    const i = (y * img.width + x) * 4;
    return (0.2126 * (img.data[i] ?? 0) + 0.7152 * (img.data[i + 1] ?? 0) + 0.0722 * (img.data[i + 2] ?? 0)) / 255;
  };
  const inPoly = (pts: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };

  // kitchen.mjs DESIGN.portrait constants the ceiling geometry hangs on (m, Z, ceil)
  const K = { m: 243, z: 3.2, ceil: 2.4 };

  test('ch10 kitchen ceiling: the upper part carries beams — thick dark bands across the ceiling band, not two bare line families', async () => {
    const { kitchen } = await import('../art/style/kitchen.mjs' as string);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    const { LAYOUTS } = await import('../art/style/layouts.mjs' as string);
    const { view } = await import('../art/style/scenery.mjs' as string);
    const k = kitchen('portrait');
    const L = LAYOUTS['ch10-kitchen']!.portrait!, v = view(L, K.m), fy = (Y: number, z = K.z): number => v.vy + (v.hs - Y * K.m) / z;
    const band = Math.round(fy(K.ceil));
    const [png] = await rasterize([{ svg: k.plate.svg(k.frame, { scale: 1.2 }), width: k.frame[2] * 1.2, height: k.frame[3] * 1.2 }]);
    const img = PNG.sync.read(png);
    const rows: number[] = [];
    for (let y = 0; y < band * 1.2; y += 1) {
      let s = 0;
      for (let x = 0; x < img.width; x += 1) s += lum(img, x, y);
      rows.push(s / img.width);
    }
    // smooth over ~7 rows: the engraving hatch pitch is a few pixels, so strokes melt into tone and only solid structures survive
    const sm = rows.map((q, i) => {
      const a = rows.slice(Math.max(0, i - 3), i + 4);
      return a.reduce((u, w) => u + w, 0) / a.length;
    });
    const med = [...sm].sort((a, b) => a - b)[Math.floor(sm.length / 2)]!;
    const runs: number[] = [];
    let n = 0;
    for (const q of sm) {
      if (q < med - 0.05) n += 1;
      else {
        if (n >= 7) runs.push(n);
        n = 0;
      }
    }
    if (n >= 7) runs.push(n);
    expect(runs.length, `dark beam bands across the ${Math.round(band * 1.2)}-row ceiling band (median ${med.toFixed(3)}); row means: ${sm.filter((_, i) => i % 20 === 0).map((q) => q.toFixed(2)).join(' ')}`).toBeGreaterThanOrEqual(2);
  });

  test('ch10 kitchen: the broom named in plate I reads — its key rectangle is wide and the broom separates from the door in value', async () => {
    const { kitchen } = await import('../art/style/kitchen.mjs' as string);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    const k = kitchen('portrait');
    const br = k.keys.broom!;
    expect(br[2], `broom key rect width ${br[2].toFixed(1)} at ${br.map(Math.round).join(',')}`).toBeGreaterThanOrEqual(26);
    const s1 = 1.2, s = 243 / 356, bb = br[1] + br[3]; // s = DESIGN.portrait.m / 356
    const [png] = await rasterize([{ svg: k.plate.svg(k.frame, { scale: s1 }), width: k.frame[2] * s1, height: k.frame[3] * s1 }]);
    const img = PNG.sync.read(png);
    const region = (x0: number, y0: number, x1: number, y1: number): number => {
      let sum = 0, cnt = 0;
      for (let y = Math.round(y0 * s1); y < y1 * s1; y += 1) for (let x = Math.round(x0 * s1); x < x1 * s1; x += 1) { sum += lum(img, x, y); cnt += 1; }
      return sum / cnt;
    };
    const brush = region(br[0] + 3, bb - 44 * s, br[0] + br[2] - 3, bb - 4 * s), door = region(130, 400, 144, 460); // the door area beside the broom
    expect(brush - door, `the straw brush reads lighter than the door behind it (brush ${brush.toFixed(3)}, door ${door.toFixed(3)})`).toBeGreaterThan(0.15);
  });

  test('ch10 shadow play: the shadows are built from strokes over the gold light, not solid ink fills', async () => {
    const { prop } = await import('../art/style/props.mjs' as string);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    const SC = 3;
    const [png] = await rasterize([{ svg: prop('kitchen-shadows').svg(SC), width: 100 * SC, height: 170 * SC }]);
    const img = PNG.sync.read(png);
    // the road trapezoid of lit.mjs kitchenShadows, in prop design units
    const road: ReadonlyArray<readonly [number, number]> = [[48.6, 64], [51.4, 64], [86, 146], [14, 146]];
    let light = 0, total = 0;
    for (let gy = 68; gy < 144; gy += 2) for (let gx = 16; gx < 85; gx += 2) {
      if (!inPoly(road, gx, gy)) continue;
      total += 1;
      if (lum(img, Math.round(gx * SC), Math.round(gy * SC)) > 0.42) light += 1;
    }
    expect(total, 'sample points inside the road shadow').toBeGreaterThan(150);
    expect(light / total, `gold visible between the strokes inside the road shadow`).toBeGreaterThan(0.12);
  });

  test('chapter scripts do not claim a hand-held prop no scene draws: the befana mask and paper star, and the tree paper star', () => {
    const befana = read('story/chapters/befana.md'), tree = read('story/chapters/tree.md');
    expect(befana, 'befana: no mask or paper star in the hand').not.toMatch(/tay cầm (chiếc )?(mặt nạ|ngôi sao)|cầm ngôi sao giấy/);
    expect(tree, 'tree: no paper star in the hand').not.toMatch(/tay cầm (chiếc )?(mặt nạ|ngôi sao)|cầm ngôi sao giấy/);
  });

  test('baked chapter 10 assets exist and stay small: the whole chapter under 400 KB of webp', () => {
    const manifest = JSON.parse(read('art/baked/manifest.json')) as { files: Record<string, { bytes: number }> };
    const names = ['bg-ch10-kitchen-portrait', 'bg-ch10-kitchen-landscape', 'prop-kitchen-shadows', 'prop-name-page'];
    for (const nm of names) expect(manifest.files[nm], nm).toBeTruthy();
    expect(manifest.files['prop-kitchen-shadows']!.bytes, 'prop-kitchen-shadows bytes').toBeLessThan(30_000);
    const ch10 = names.reduce((s, nm) => s + manifest.files[nm]!.bytes, 0);
    expect(ch10, `chapter 10 webp total ${ch10} bytes`).toBeLessThan(400_000);
  });
});

test.describe('Act 2 round 3 fixes: engraved kitchen values and the audit-n3 objects', () => {
  test.beforeEach(({ baseURL }, info) => {
    test.skip(!baseURL || info.project.name !== 'desktop-chromium', 'pure checks on the sources and the bake, run once');
  });

  const lumAt = (img: { width: number; data: Uint8Array | Uint8ClampedArray }, x: number, y: number): number => {
    const i = (y * img.width + x) * 4;
    return (0.2126 * (img.data[i] ?? 0) + 0.7152 * (img.data[i + 1] ?? 0) + 0.0722 * (img.data[i + 2] ?? 0)) / 255;
  };
  const inPoly = (pts: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const overlapRect = (a: Rect, b: Rect): boolean => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  // region stats in design units rasterized at scale s: mean, sd, dark fraction, mean |dx| and |dy| gradients, green minus red channel
  const stats = (img: { width: number; data: Uint8Array | Uint8ClampedArray }, s: number, x0: number, y0: number, x1: number, y1: number): { mean: number; sd: number; dark: number; grad: number; gradv: number; green: number } => {
    const X0 = Math.round(x0 * s), Y0 = Math.round(y0 * s), X1 = Math.round(x1 * s), Y1 = Math.round(y1 * s);
    let sum = 0, sum2 = 0, dark = 0, n = 0, grad = 0, gradv = 0, gr = 0, rd = 0;
    const rows: number[][] = [];
    for (let y = Y0; y < Y1; y++) {
      const row: number[] = [];
      for (let x = X0; x < X1; x++) {
        const i = (y * img.width + x) * 4;
        const l = (0.2126 * img.data[i]! + 0.7152 * img.data[i + 1]! + 0.0722 * img.data[i + 2]!) / 255;
        row.push(l); sum += l; sum2 += l * l; if (l < 0.35) dark += 1; gr += img.data[i + 1]!; rd += img.data[i]!; n += 1;
      }
      rows.push(row);
    }
    for (const row of rows) for (let x = 1; x < row.length; x++) grad += Math.abs(row[x]! - row[x - 1]!);
    for (let i = 1; i < rows.length; i++) for (let x = 0; x < rows[i]!.length; x++) gradv += Math.abs(rows[i]![x]! - rows[i - 1]![x]!);
    const mean = sum / n;
    return { mean, sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), dark: dark / n, grad: grad / n, gradv: gradv / n, green: (gr - rd) / n / 255 };
  };
  // light fraction between strokes inside a polygon (prop design units, rasterized at SC)
  const lightIn = (img: { width: number; data: Uint8Array | Uint8ClampedArray }, sc: number, poly: ReadonlyArray<readonly [number, number]>, x0: number, y0: number, x1: number, y1: number): { light: number; total: number } => {
    let light = 0, total = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!inPoly(poly, x, y)) continue;
      total += 1;
      if (lumAt(img, Math.round(x * sc), Math.round(y * sc)) > 0.42) light += 1;
    }
    return { light, total };
  };
  const ROOM_FILE: Record<string, [string, string]> = { kitchen: ['kitchen', 'kitchen'], office: ['scene', 'scene'], feast: ['feast', 'feast'], parlour: ['parlour', 'parlour'] };
  const raster = async (kind: 'kitchen' | 'office' | 'feast' | 'parlour', o: 'portrait' | 'landscape', s: number) => {
    const [file, fn] = ROOM_FILE[kind]!;
    const mod = (await import(`../art/style/${file}.mjs` as string)) as unknown as Record<string, (o: string) => { plate: { svg: (v: Rect, o2: Record<string, unknown>) => string }; frame: Rect }>;
    const plate = mod[fn]!(o);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    const [png] = await rasterize([{ svg: plate.plate.svg(plate.frame, { scale: s }), width: plate.frame[2] * s, height: plate.frame[3] * s }]);
    return PNG.sync.read(png);
  };

  // K = kitchen.mjs DESIGN.portrait constants (m, the table depth Z, the ceiling height)
  const K = { m: 243, z: 3.2, ceil: 2.4 };

  test('ch10 kitchen backdrop: engraved tone falls into the upper ceiling and the floor grid breaks into uneven boards', async () => {
    const s1 = 1.2, img = await raster('kitchen', 'portrait', s1);
    // upper ceiling (design y 6-195, x 16-374): hatching and joints, not a flat brown wash with two fan families
    const ceil = stats(img, s1, 16, 6, 374, 195);
    expect(ceil.sd, `upper ceiling value spread (sd ${ceil.sd.toFixed(3)}, dark ${ceil.dark.toFixed(3)}, grad ${ceil.grad.toFixed(3)})`).toBeGreaterThanOrEqual(0.085);
    expect(ceil.dark, 'hatching shows as dark pixels in the upper ceiling').toBeGreaterThanOrEqual(0.05);
    // the narrow band between the beams (design y 372-393): vertical falloff and cross joints, not one flat strip
    const top = stats(img, s1, 156, 372, 322, 377), bot = stats(img, s1, 156, 388, 322, 393), band = stats(img, s1, 156, 372, 322, 393);
    expect(top.mean - bot.mean, `band tone falls into the lower beam shadow (${(top.mean - bot.mean).toFixed(3)})`).toBeGreaterThan(0.03);
    expect(band.sd, `band carries cross joints (sd ${band.sd.toFixed(3)})`).toBeGreaterThanOrEqual(0.046);
    // floor: uneven board lengths — fewer joint rows than a regular grid, and left and right joint rows no longer line up
    const dips = (xa: number, xb: number): number[] => {
      const rows: number[] = [];
      for (let y = Math.round(500 * s1); y < Math.round(680 * s1); y++) { let sm = 0; for (let x = Math.round(xa * s1); x < Math.round(xb * s1); x++) sm += lumAt(img, x, y); rows.push(sm / ((xb - xa) * s1)); }
      const med = [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)]!;
      const out: number[] = [];
      for (let i = 1; i < rows.length - 1; i++) if (rows[i]! < med - 0.075 && rows[i]! <= rows[i - 1]! && rows[i]! < rows[i + 1]!) out.push(i);
      const merged: number[] = [];
      for (const d of out) if (!merged.length || d - merged[merged.length - 1]! > 3) merged.push(d);
      return merged;
    };
    const all = dips(130, 270);
    expect(all.length, `floor joint rows in the lit centre strip: ${all.length}`).toBeLessThanOrEqual(12);
    expect(all.length, 'the floor still carries board joints').toBeGreaterThanOrEqual(3);
    const left = dips(132, 196), right = dips(204, 268);
    const uniq = left.filter((q) => !right.some((w) => Math.abs(w - q) <= 5)).length + right.filter((q) => !left.some((w) => Math.abs(w - q) <= 5)).length;
    const stag = uniq / Math.max(1, left.length + right.length);
    expect(stag, `left/right joint rows staggered: left [${left}] right [${right}] -> ${stag.toFixed(2)}`).toBeGreaterThanOrEqual(0.25);
  });

  test('ch10 shadow props: the broom handle and brush are engraved strokes the gold shows through', async () => {
    const { prop } = await import('../art/style/props.mjs' as string);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    const SC = 1; // the prop shows ~100 css px wide on the 390 plate: the strokes must read at that scale
    const [png] = await rasterize([{ svg: prop('kitchen-shadows')!.svg(SC), width: 100 * SC, height: 170 * SC }]);
    const img = PNG.sync.read(png);
    const handle: ReadonlyArray<readonly [number, number]> = [[9.5, 84], [10.5, 84], [33, 154], [26, 154]];
    const h = lightIn(img, SC, handle, 8, 88, 34, 150);
    expect(h.total, 'handle sample points').toBeGreaterThan(60);
    expect(h.light / h.total, `gold between the handle strokes (${(h.light / h.total).toFixed(2)})`).toBeGreaterThan(0.16);
    const head: ReadonlyArray<readonly [number, number]> = [[27, 152], [35, 152], [38.6, 126], [27.6, 126]];
    const b = lightIn(img, SC, head, 26, 128, 38, 150);
    expect(b.total, 'brush sample points').toBeGreaterThan(40);
    expect(b.light / b.total, `gold between the brush strands (${(b.light / b.total).toFixed(2)})`).toBeGreaterThan(0.14);
  });

  test('ch13 door shadows: the two figures and the guitar are engraved silhouettes, not solid ink', async () => {
    const { prop } = await import('../art/style/props.mjs' as string);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    const SC = 2;
    const [png] = await rasterize([{ svg: prop('door-shadows')!.svg(SC), width: 60 * SC, height: 90 * SC }]);
    const img = PNG.sync.read(png);
    const body1: ReadonlyArray<readonly [number, number]> = [[10, 53], [20, 42], [30, 53], [31, 88], [9, 88]];
    const head1: ReadonlyArray<readonly [number, number]> = [[14.4, 31], [20, 24.6], [25.6, 31], [20, 37.4]];
    const body2: ReadonlyArray<readonly [number, number]> = [[35, 61], [41, 46], [47, 61], [48, 84], [34, 84]];
    const head2: ReadonlyArray<readonly [number, number]> = [[36.6, 39], [41, 34.2], [45.4, 39], [41, 43.8]];
    const guitar: ReadonlyArray<readonly [number, number]> = [[42, 70.5], [46, 69.5], [50, 70.5], [51.5, 74], [50, 77], [46, 77.5], [42, 77], [40.5, 74]];
    for (const [name, poly, x0, y0, x1, y1, min] of [
      ['first body', body1, 11, 55, 29, 84, 0.14], ['first head', head1, 15, 26, 25, 36, 0.14],
      ['second body', body2, 36, 63, 46, 80, 0.14], ['second head', head2, 37.5, 35, 44.5, 43, 0.14],
      ['guitar body', guitar, 42, 70, 50, 77, 0.12],
    ] as const) {
      const r = lightIn(img, SC, poly, x0, y0, x1, y1);
      expect(r.total, `${name} sample points`).toBeGreaterThan(20);
      expect(r.light / r.total, `gold shows through the ${name} (${(r.light / r.total).toFixed(2)})`).toBeGreaterThan(min);
    }
  });

  test('ch2 saturnalia table: plates on the cloth and seated guests behind it', async () => {
    const { feast } = await import('../art/style/feast.mjs' as string);
    const { LAYOUTS } = await import('../art/style/layouts.mjs' as string);
    for (const o of ORIENTATIONS) {
      const f = feast(o) as unknown as { keys: { guests: Rect[]; plates: Rect[] } };
      const L = LAYOUTS['ch2-feast']![o]!;
      expect(f.keys.guests.length, `${o} seated guests`).toBeGreaterThanOrEqual(3);
      expect(f.keys.plates.length, `${o} plates on the cloth`).toBeGreaterThanOrEqual(4);
      for (const g of [...f.keys.guests, ...f.keys.plates]) {
        expect(g[0], `${o} guest/plate left`).toBeGreaterThanOrEqual(0);
        expect(g[1], `${o} guest/plate top`).toBeGreaterThanOrEqual(0);
        expect(g[0] + g[2], `${o} guest/plate right`).toBeLessThanOrEqual(L.size[0]);
        expect(g[1] + g[3], `${o} guest/plate bottom`).toBeLessThanOrEqual(L.size[1]);
      }
    }
    const s1 = 1.2, img = await raster('feast', 'portrait', s1);
    const f = feast('portrait') as unknown as { keys: { guests: Rect[]; plates: Rect[] } };
    for (const g of f.keys.guests) {
      const st = stats(img, s1, g[0] + 2, g[1] + 2, g[0] + g[2] - 2, g[1] + g[3] - 2);
      expect(st.dark, `guest silhouette at [${g.map((q) => Math.round(q))}] is dark (${st.dark.toFixed(2)})`).toBeGreaterThan(0.18);
    }
    for (const p of f.keys.plates) {
      const st = stats(img, s1, p[0], p[1], p[0] + p[2], p[1] + p[3]);
      expect(st.grad, `plate rim edges at [${p.map((q) => Math.round(q))}] (${st.grad.toFixed(3)})`).toBeGreaterThan(0.05);
    }
  });

  test('ch1 records office: the writing desk stands under the letter, the cup and the lantern', async () => {
    const { scene } = await import('../art/style/scene.mjs' as string);
    const { LAYOUTS } = await import('../art/style/layouts.mjs' as string);
    const { PROPS } = await import('../art/style/props.mjs' as string);
    const data = JSON.parse(read('src/story/stage-data.json')) as { props: Record<string, { at: [number, number]; width: number; landscape?: { at: [number, number]; width: number } }> };
    for (const o of ORIENTATIONS) {
      const room = scene(o) as unknown as { keys: Record<string, Rect> };
      const desk = room.keys.desk!, L = LAYOUTS['ch1-office']![o]!;
      const fw = 300 * L.machine.scale, fh = 340 * L.machine.scale;
      for (const id of ['letter', 'coffee-cup', 'lantern'] as const) {
        const row = data.props[id]!, use = o === 'landscape' && row.landscape ? row.landscape : row;
        const ratio = PROPS[id]![3]! / PROPS[id]![2]!;
        const w = (use.width / 300) * fw, x = L.machine.origin[0] + (use.at[0] / 300) * fw, y = L.machine.origin[1] + (use.at[1] / 340) * fh;
        expect(x, `${id} ${o} stands on the desk (left ${x.toFixed(1)} vs desk [${desk.map((q) => Math.round(q))}])`).toBeGreaterThanOrEqual(desk[0]);
        expect(x + w, `${id} ${o} right on the desk`).toBeLessThanOrEqual(desk[0] + desk[2]);
        expect(y + w * ratio, `${id} ${o} base within the desk top (${(y + w * ratio).toFixed(1)})`).toBeGreaterThanOrEqual(desk[1]);
        expect(y + w * ratio, `${id} ${o} base above the desk front`).toBeLessThanOrEqual(desk[1] + desk[3]);
      }
    }
    const s1 = 1.2, img = await raster('office', 'portrait', s1);
    const desk = (scene('portrait') as unknown as { keys: Record<string, Rect> }).keys.desk!;
    const top = stats(img, s1, desk[0] + 30, desk[1] + 12, desk[0] + desk[2] - 60, desk[1] + desk[3] - 20);
    const below = stats(img, s1, desk[0] + 30, desk[1] + desk[3] + 20, desk[0] + desk[2] - 60, desk[1] + desk[3] + 56);
    expect(top.mean - below.mean, `the desk top reads lighter than the floor in front (${(top.mean - below.mean).toFixed(3)})`).toBeGreaterThan(0.1);
    expect(top.sd, `the desk top carries engraving (sd ${top.sd.toFixed(3)})`).toBeGreaterThanOrEqual(0.03);
  });

  test('ch4 corridor: the name draft lies on the console table and a sprig falls by Tèo', async () => {
    const { corridor } = await import('../art/style/corridor.mjs' as string);
    const { PROPS } = await import('../art/style/props.mjs' as string);
    const { LAYOUTS } = await import('../art/style/layouts.mjs' as string);
    const data = JSON.parse(read('src/story/stage-data.json')) as { props: Record<string, { at: [number, number]; width: number; landscape?: { at: [number, number]; width: number } }> };
    for (const o of ORIENTATIONS) {
      const room = corridor(o) as unknown as { keys: Record<string, Rect> };
      const table = room.keys.table!, L = LAYOUTS['ch4-corridor']![o]!;
      for (const id of ['name-draft', 'mistletoe-sprig'] as const) {
        const row = data.props[id]!, use = o === 'landscape' && row.landscape ? row.landscape : row;
        const ratio = PROPS[id]![3]! / PROPS[id]![2]!;
        const r: Rect = [use.at[0], use.at[1], use.width, use.width * ratio];
        if (id === 'name-draft') {
          const x = r[0] + r[2] / 2, y = r[1] + r[3];
          expect(x >= table[0] - 2 && x <= table[0] + table[2] + 2, `the draft sits on the corridor table ${o} (x ${x.toFixed(0)} vs table [${table.map(Math.round)}])`).toBe(true);
          expect(y >= table[1] - 2 && y <= table[1] + table[3] + 2, `the draft base rests on the table top ${o} (y ${y.toFixed(0)} vs table [${table.map(Math.round)}])`).toBe(true);
        }
        expect(r[1] + r[3], `${id} ${o} bottom above the dialogue`).toBeLessThanOrEqual(630);
        if (id === 'mistletoe-sprig') {
          expect(r[2], 'the sprig is wide enough to read (the scene needs >= 28)').toBeGreaterThanOrEqual(28);
          const d = Math.hypot(r[0] + r[2] / 2 - L.teo.root[0], r[1] + r[3] - L.teo.root[1]);
          expect(d, `the sprig falls by Tèo's feet (distance ${d.toFixed(0)})`).toBeLessThan(45);
        }
      }
    }
    // the draft and the sprig are prop sprites of their own: rasterize each and check the line work
    const { prop } = await import('../art/style/props.mjs' as string);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    { const SC = 3, [png] = await rasterize([{ svg: prop('name-draft')!.svg(SC), width: 52 * SC, height: 26 * SC }]);
      const st = stats(PNG.sync.read(png), SC, 2, 2, 50, 24);
      expect(st.grad, `the draft carries two written lines (grad ${st.grad.toFixed(3)})`).toBeGreaterThan(0.03); }
    { const SC = 3, [png] = await rasterize([{ svg: prop('mistletoe-sprig')!.svg(SC), width: 22 * SC, height: 13 * SC }]);
      const sg = stats(PNG.sync.read(png), SC, 2, 4, 20, 12);
      expect(sg.green, `the sprig reads green against the card (g-r ${sg.green.toFixed(3)})`).toBeGreaterThan(0.02); }
  });

  test('ch7 harbour: the empty bag and the folded sheet rest at the wall foot where the shadow fell', async () => {
    const { PROPS } = await import('../art/style/props.mjs' as string);
    const { LAYOUTS } = await import('../art/style/layouts.mjs' as string);
    const data = JSON.parse(read('src/story/stage-data.json')) as { props: Record<string, { at: [number, number]; width: number; landscape?: { at: [number, number]; width: number } }> };
    for (const o of ORIENTATIONS) {
      const L = LAYOUTS['ch7-harbour']![o]!;
      const foot = L.wall;
      for (const id of ['small-bag', 'folded-sheet'] as const) {
        const row = data.props[id]!, use = o === 'landscape' && row.landscape ? row.landscape : row;
        const ratio = PROPS[id]![3]! / PROPS[id]![2]!;
        const r: Rect = [use.at[0], use.at[1], use.width, use.width * ratio];
        expect(r[1] + r[3], `${id} ${o} rests at the wall foot (base ${(r[1] + r[3]).toFixed(0)}, foot ${foot})`).toBeGreaterThan(foot - 14);
        const teoS = L.teo.scale;
        const teo: Rect = [L.teo.root[0] - 46 * teoS, L.teo.root[1] - 300 * teoS, 92 * teoS, 300 * teoS];
        expect(overlapRect(r, teo), `${id} ${o} stays clear of Tèo`).toBe(false);
        expect(r[0], `${id} ${o} inside the plate`).toBeGreaterThanOrEqual(0);
        expect(r[0] + r[2], `${id} ${o} inside the plate`).toBeLessThanOrEqual(L.size[0]);
      }
    }
    const { prop } = await import('../art/style/props.mjs' as string);
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    for (const [id, w, h] of [['small-bag', 32, 26], ['folded-sheet', 38, 22]] as const) {
      const SC = 3;
      const [png] = await rasterize([{ svg: prop(id)!.svg(SC), width: w * SC, height: h * SC }]);
      const img = PNG.sync.read(png);
      let ink = 0, n = 0;
      for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) { const i = (y * img.width + x) * 4; n += 1; const l = (0.2126 * img.data[i]! + 0.7152 * img.data[i + 1]! + 0.0722 * img.data[i + 2]!) / 255; if (img.data[i + 3]! > 100 && l < 0.5) ink += 1; }
      expect(ink / n, `${id} carries engraved strokes (ink ${(ink / n).toFixed(2)})`).toBeGreaterThan(0.06);
    }
  });

  test('chapter scripts reveal the audit-n3 objects once each', () => {
    const count = (chapter: string, re: RegExp): number => (read(`story/chapters/${chapter}.md`).match(re) ?? []).length;
    expect(count('mistletoe', /^@prop name-draft$/gm), 'the name draft shown at net-noi').toBe(1);
    expect(count('mistletoe', /^@prop -name-draft$/gm), 'the draft stays on the table to the end').toBe(0);
    expect(count('mistletoe', /^@prop mistletoe-sprig$/gm), 'the sprig shown at canh-nho').toBe(1);
    expect(count('mistletoe', /^@prop -mistletoe-sprig$/gm), 'the sprig picked up').toBe(1);
    expect(count('nicholas', /^@prop small-bag$/gm), 'the bag shown at tui-trong').toBe(1);
    expect(count('nicholas', /^@prop -small-bag$/gm), 'the bag taken along').toBe(1);
    expect(count('nicholas', /^@prop folded-sheet$/gm), 'the folded sheet shown').toBe(1);
    expect(count('nicholas', /^@prop -folded-sheet$/gm), 'the sheet stays where the bag lay').toBe(0);
  });
});
