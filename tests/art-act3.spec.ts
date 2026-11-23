import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fitPlate, stepBack, type PlateLayout } from '../src/story/stage.ts';

type Rect = [number, number, number, number];
interface Room { plate: { svg: (view: Rect, opts?: { scale?: number }) => string }; frame: Rect }
interface Layout { size: [number, number]; keep?: Rect; quado: { root: [number, number]; scale: number }; teo: { root: [number, number] }; groundY: number }

const ROOMS = [
  ['ch14-iceland-kitchen', 'bep-nha-iceland-dem-dong', 'yule-lads'],
  ['ch15-wool-workshop', 'xuong-len-iceland-the-ky-19', 'yule-cat'],
  ['ch16-print-shop', 'toa-soan-troy-23-12-1823', 'santa-ny'],
  ['ch17-tio-corner', 'nha-nong-catalonia-dem-dong', 'caga-tio'],
  ['ch18-london-snow', 'pho-london-1843', 'dickens'],
  ['ch19-norway-yard', 'nong-trai-na-uy-dem-giang-sinh', 'brooms'],
] as const;
const ORIENTATIONS = ['portrait', 'landscape'] as const;
const SOURCES = ['yule-lads', 'yule-cat', 'santa-ny', 'caga-tio', 'dickens', 'brooms'];
// key objects of the Act 3 rooms that Tèo or the machine must not cover at the portrait sizes
const FIGURE_FREE: Record<string, string[]> = { 'ch14-iceland-kitchen': ['lamp', 'window', 'sheet', 'bar'], 'ch15-wool-workshop': ['lamp', 'wool', 'sheet', 'dark'], 'ch16-print-shop': ['lamp', 'sheet', 'stack'], 'ch17-tio-corner': ['fire', 'tio', 'sheet'], 'ch18-london-snow': ['window', 'mist', 'case', 'pier', 'track'], 'ch19-norway-yard': ['window', 'square', 'cross', 'sickle'] };
// per-room luminance pairs: the bright key must outshine the dark one by the margin
const LUM: Record<string, [string, string, number]> = { 'ch14-iceland-kitchen': ['window', 'mouth', 0.12], 'ch15-wool-workshop': ['lamp', 'dark', 0.08], 'ch16-print-shop': ['lamp', 'dark', 0.08], 'ch17-tio-corner': ['fire', 'dark', 0.1], 'ch18-london-snow': ['window', 'pier', 0.12], 'ch19-norway-yard': ['window', 'cross', 0.12] };

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

test.describe('Act 3 plates (chapters 14 to 19): the rooms of the plate pipeline', () => {
  test.beforeEach(({ baseURL }, info) => {
    test.skip(!baseURL || info.project.name !== 'desktop-chromium', 'pure checks on the sources and the bake, run once');
  });

  test('every backdrop id the chapter scripts name is mapped to its plate in stage-data and registered in the pipeline', async () => {
    const { rooms, layouts } = await art();
    const data = JSON.parse(read('src/story/stage-data.json')) as { backdrops: Record<string, { plate: string }> };
    for (const [plate, bg] of ROOMS) {
      expect(data.backdrops[bg]?.plate, bg).toBe(plate);
      expect(typeof rooms[plate], `${plate} room generator`).toBe('function');
      expect(Object.keys(layouts[plate] ?? {}).sort(), `${plate} layouts`).toEqual(['landscape', 'portrait']);
    }
    const scripts = ROOMS.map(([, bg, chapter]) => read(`story/chapters/${chapter}.md`));
    for (const [i, [, bg]] of ROOMS.entries()) expect(scripts[i]!.includes(`@bg ${bg}`), bg).toBe(true);
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
  });

  test('the room sources draw no figure: no Tèo, bird, face or hand generator', () => {
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
      if (l.keep) { const [x, y, kw, kh] = l.keep;
        expect(x >= 0 && y >= 0 && x + kw <= w && y + kh <= h, `${plate} ${o} keep rectangle inside the art`).toBe(true); }
    }
    for (const [plate] of ROOMS) expect(layouts[plate]!.portrait!.keep, `${plate} portrait keep`).toBeTruthy();
  });

  test('the key objects of each chapter lie inside the portrait keep rectangle', async () => {
    const { rooms, layouts } = await art();
    const inside = (k: Rect, r: Rect, what: string): void => {
      expect(r[0], `${what} left`).toBeGreaterThanOrEqual(k[0]);
      expect(r[1], `${what} top`).toBeGreaterThanOrEqual(k[1]);
      expect(r[0] + r[2], `${what} right`).toBeLessThanOrEqual(k[0] + k[2]);
      expect(r[1] + r[3], `${what} bottom`).toBeLessThanOrEqual(k[1] + k[3]);
    };
    const keys = (id: string): Record<string, Rect> => (rooms[id]!('portrait') as unknown as { keys: Record<string, Rect> }).keys;
    for (const [plate] of ROOMS) for (const name of Object.keys(keys(plate))) {
      if (name === 'mouth') continue; // a luminance probe below the keep, not a figure anchor
      inside(layouts[plate]!.portrait!.keep!, keys(plate)[name]!, `${plate} ${name}`);
    }
    for (const [plate] of ROOMS) for (const o of ORIENTATIONS) for (const name of ['mouth']) {
      const r = (rooms[plate]!(o) as unknown as { keys: Record<string, Rect> }).keys[name];
      if (!r) continue; // rooms without a hearth mouth have no below-keep probe
      const [w, h] = layouts[plate]![o]!.size;
      expect(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= w && r[1] + r[3] <= h, `${plate} ${o} ${name} inside the art`).toBe(true);
    }
  });

  test('every figure anchor and key object of the rooms lies inside the stage once the crop is computed with fitPlate, at every phone and desktop size', async () => {
    const { layouts, rooms } = await art();
    const CROW_SEEN: Rect = [-63, -154, 134, 159];
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
      if (o === 'portrait') {
        const { root, scale } = (layout as unknown as { teo: { root: [number, number]; scale: number } }).teo, ts = scale * fit.back * fit.k, [tx, ty] = stepBack(fit, root);
        const teo: Rect = [fit.ox + tx * fit.k + TEO_SEEN[0] * ts, fit.oy + ty * fit.k + TEO_SEEN[1] * ts, TEO_SEEN[2] * ts, TEO_SEEN[3] * ts];
        const { origin, scale: mscale } = (layout as unknown as { machine: { origin: [number, number]; scale: number } }).machine, [mx, my] = stepBack(fit, origin), ms = mscale * fit.back * fit.k;
        const machine: Rect = [fit.ox + mx * fit.k + 7.5 * ms, fit.oy + my * fit.k + 13 * ms, 286 * ms, 327 * ms];
        for (const [name, [x, y, bw, bh]] of things) if ((FIGURE_FREE[plate] ?? []).includes(name))
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

  test('bake: both backdrops of each room exist at the shipped resolution, the art is not a flat block, night plates read as night, and each chapter stays inside its webp budget', async ({}, info) => {
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
    for (const [plate] of ROOMS) for (const o of ORIENTATIONS) {
      const file = manifest.files[`bg-${plate}-${o}`];
      expect(file, `bg-${plate}-${o} baked`).toBeTruthy();
      const [w, h] = layouts[plate]![o]!.size;
      expect(file!.w, `${plate} ${o} width`).toBe(Math.round(w * file!.res));
      expect(file!.h, `${plate} ${o} height`).toBe(Math.round(h * file!.res));
      expect(file!.bytes, `${plate} ${o}: over the plate size`).toBeLessThan(180_000);
      const [spread, mean] = spreadOf(`bg-${plate}-${o}`);
      expect(spread, `${plate} ${o}: blurred luminance spread of the top quarter (a flat block is 0)`).toBeGreaterThan(0.01);
      const outdoor = ['ch18-london-snow', 'ch19-norway-yard'].includes(plate as string);
      expect(mean, `${plate} ${o}: reads as night`).toBeLessThan(outdoor ? 0.35 : 0.62);
    }
    for (const [, , chapter] of ROOMS) {
      const plate = ROOMS.find(([, , c]) => c === chapter)![0]!;
      const total = ORIENTATIONS.reduce((s, o) => s + manifest.files[`bg-${plate}-${o}`]!.bytes, 0);
      expect(total, `${chapter}: the two backdrops of the chapter total ${total} bytes`).toBeLessThan(250_000);
    }
  });

  test('each room has a working light: measured luminance of the bright key over the dark one, portrait and landscape', async () => {
    const { rooms, layouts } = await art();
    const { rasterize } = await import('../art/style/raster.mjs' as string);
    const lum = (img: { width: number; data: Uint8Array | Uint8ClampedArray }, x: number, y: number): number => {
      const i = (y * img.width + x) * 4;
      return (0.2126 * (img.data[i] ?? 0) + 0.7152 * (img.data[i + 1] ?? 0) + 0.0722 * (img.data[i + 2] ?? 0)) / 255;
    };
    const meanOf = (img: { width: number; data: Uint8Array | Uint8ClampedArray }, r: Rect): number => {
      let s = 0, n = 0;
      for (let y = Math.max(0, Math.round(r[1])); y < Math.round(r[1] + r[3]); y += 2) for (let x = Math.max(0, Math.round(r[0])); x < Math.round(r[0] + r[2]); x += 2) { s += lum(img, x, y); n += 1; }
      return s / n;
    };
    for (const [plate] of ROOMS) for (const o of ORIENTATIONS) {
      const [bright, dark, margin] = LUM[plate]!;
      const room = rooms[plate]!(o), [w, h] = layouts[plate]![o]!.size;
      const [png] = await rasterize([{ svg: room.plate.svg(room.frame, { scale: 1.2 }), width: w * 1.2, height: h * 1.2 }]);
      const img = PNG.sync.read(png);
      const keys = (room as unknown as { keys: Record<string, Rect> }).keys;
      const brightMean = meanOf(img, [keys[bright]![0] * 1.2, keys[bright]![1] * 1.2, keys[bright]![2] * 1.2, keys[bright]![3] * 1.2]);
      const darkMean = meanOf(img, [keys[dark]![0] * 1.2, keys[dark]![1] * 1.2, keys[dark]![2] * 1.2, keys[dark]![3] * 1.2]);
      expect(darkMean, `${plate} ${o}: the ${dark} region (${darkMean.toFixed(3)}) against the ${bright} region (${brightMean.toFixed(3)})`).toBeLessThan(brightMean - margin);
    }
  });

  test('the ch15 plate draws what the script stages: hanging skeins, lantern, spinning wheel, loom cloth, wool pile, tally sheet with 13 marks', () => {
    const src = read('art/style/yule-cat.mjs');
    for (const what of ['skein', 'flame(', 'wheelC', 'loom', 'cloth', 'pile', 'hangB', 'k < 13']) {
      expect(src.includes(what), `yule-cat.mjs: ${what}`).toBe(true);
    }
    const chapter = read('story/chapters/yule-cat.md');
    expect(chapter.includes('@bg xuong-len-iceland-the-ky-19'), 'bg id').toBe(true);
    expect(src.includes('window'), 'ch15 draws no window the script never mentions').toBe(false);
  });

  test('the ch14 plate draws what the script stages: sill lamp, snowy window, dresser, logs, hearth bar, crow prints, blank sheet', () => {
    const src = read('art/style/yule-lads.mjs');
    for (const what of ['oilLamp', 'crystals', 'dresser', 'wood', 'barT', 'drawPrint', 'sheet', 'SNOW', 'mountain']) {
      expect(src.includes(what), `yule-lads.mjs: ${what}`).toBe(true);
    }
    const chapter = read('story/chapters/yule-lads.md');
    expect(chapter.includes('@bg bep-nha-iceland-dem-dong'), 'bg id').toBe(true);
    expect(/^@prop kitchen-shadows$/gm.test(chapter), 'ch14 reuses no ch10 shadow prop').toBe(false);
  });
  test('the ch16 plate draws what the script stages: composing stand with lead-type rows, oil lamp, unread newspaper stack, idle press, pencil sketches, ink blot, coffee ring', () => {
    const src = read('art/style/santa-ny.mjs');
    for (const what of ['lampY', 'rows', 'stackX', 'pressX', 'pencil sketches', 'blotX', '#a7692f', '#cfa24a']) {
      expect(src.includes(what), `santa-ny.mjs: ${what}`).toBe(true);
    }
    const chapter = read('story/chapters/santa-ny.md');
    expect(chapter.includes('@bg toa-soan-troy-23-12-1823'), 'bg id').toBe(true);
    expect(src.includes('window'), 'ch16 draws no window the script never mentions').toBe(false);
  })
  test('the ch17 plate draws what the script stages: stone hearth with olive-wood fire, Tió log under blanket with barretina, stick, adult hand, children shadows, sketch sheet and pencil', () => {
    const src = read('art/style/caga-tio.mjs');
    for (const what of ['flame', 'LOG', 'CAP', 'barre', 'blanket', 'stick', 'shadows', 'pencil', 'sheet']) {
      expect(src.includes(what), `caga-tio.mjs: ${what}`).toBe(true);
    }
    const chapter = read('story/chapters/caga-tio.md');
    expect(chapter.includes('@bg nha-nong-catalonia-dem-dong'), 'bg id').toBe(true);
  })
  test('the ch18 plate draws what the script stages: two lit windows with a dark pier between, bookshop stack with an open title page, breath mist on the glass, card rows in the display case, door crack, snow on sills and cobbles, slide-track', () => {
    const src = read('art/style/dickens.mjs');
    for (const what of ['nightSky', 'SNOW', 'mist', 'title page', 'display case', 'crack of lamplight', 'slide-track', 'cobbles', 'sill']) {
      expect(src.includes(what), `dickens.mjs: ${what}`).toBe(true);
    }
    const chapter = read('story/chapters/dickens.md');
    expect(chapter.includes('@bg pho-london-1843'), 'bg id').toBe(true);
  });
  test('the ch19 plate draws what the script stages: tar crosses on shut doors, one lit window printing a yellow square, sickle across the byre lintel', () => {
    const src = read('art/style/brooms.mjs');
    for (const what of ['nightSky', 'crust', 'crossRect', 'sickleRect', 'squareRect', 'LIGHT', 'hay']) {
      expect(src.includes(what), `brooms.mjs: ${what}`).toBe(true);
    }
    const chapter = read('story/chapters/brooms.md');
    expect(chapter.includes('@bg nong-trai-na-uy-dem-giang-sinh'), 'bg id').toBe(true);
  });
});