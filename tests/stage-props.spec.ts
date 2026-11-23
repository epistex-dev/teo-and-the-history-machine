import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseChapter } from '../src/story/parse.ts';
import type { Beat, ChapterScript, Scene } from '../src/story/types.ts';
import { advanceStory, seedSave, storyOf, waitReady } from './support/play.ts';
// @ts-expect-error the art modules ship no declarations
import { ROOMS } from '../art/style/assets.mjs';
// @ts-expect-error the art modules ship no declarations
import { LAYOUTS } from '../art/style/layouts.mjs';
// @ts-expect-error the art modules ship no declarations
import { PROPS } from '../art/style/props.mjs';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
type Rect = [number, number, number, number];
type Box = { x: number; y: number; width: number; height: number };
type Orient = 'portrait' | 'landscape';

const CHAPTERS = ['intro', 'saturnalia', 'yule', 'mistletoe', 'bethlehem', 'nicholas', 'krampus', 'befana', 'tree', 'ban1647', 'silent-night', 'carol', 'dec25', 'brooms', 'dickens', 'caga-tio', 'santa-ny', 'yule-lads', 'ending'] as const;
const scripts = new Map<string, ChapterScript>(CHAPTERS.map((id) => [id, parseChapter(readFileSync(new URL(`../story/chapters/${id}.md`, import.meta.url), 'utf8'), id)]));

const isText = (b: Beat): b is Extract<Beat, { text: string }> => b.t === 'narr' || b.t === 'say';

function sceneOf(chapter: string, scene: string): Scene {
  const sc = scripts.get(chapter)!.scenes.find((s) => s.id === scene);
  if (!sc) throw new Error(`missing scene ${chapter}/${scene}`);
  return sc;
}

function introStop(chapter: string, scene: string, needle: string): number {
  const at = sceneOf(chapter, scene).beats.filter(isText).findIndex((b) => b.text.includes(needle));
  if (at < 0) throw new Error(`no narration line names "${needle}" in ${chapter}/${scene}`);
  return at;
}

function visibleStop(chapter: string, scene: string, id: string): number {
  const scenes = scripts.get(chapter)!.scenes;
  const si = scenes.findIndex((s) => s.id === scene);
  if (si < 0) throw new Error(`missing scene ${chapter}/${scene}`);
  let on = false;
  for (let k = 0; k < si; k += 1) for (const b of scenes[k]!.beats) if (b.t === 'prop' && b.id === id) on = b.on;
  let stop = 0, first = -1;
  for (const b of scenes[si]!.beats) {
    if (b.t === 'prop' && b.id === id) on = b.on;
    if (isText(b)) { if (on && first < 0) first = stop; stop += 1; }
  }
  return first;
}

// [chapter, scene, prop id -> the narration line that introduces it]
const ROWS: ReadonlyArray<readonly [string, string, Record<string, string>]> = [
  ['intro', 'phong-ho-so', { letter: 'phả một lá thư', 'coffee-cup': 'không nhớ mình đã chạm vào cốc', 'letter-blurred': 'Vệt nâu loang trên giấy' }],
  ['yule', 'sanh-dai', { 'candle-wax': 'cây nến sáp cháy trên ghế' }],
  ['yule', 'den-sang', { 'coffee-cup-full': 'Bên cỗ máy' }],
  ['mistletoe', 'net-noi', { 'coffee-cup-full': 'cốc cà phê tự xoay quai', 'name-draft': 'Trên giấy nháp' }],
  ['mistletoe', 'canh-nho', { 'mistletoe-sprig': 'một cành nhỏ rơi xuống chân Tèo' }],
  ['bethlehem', 'mang-co', { 'manger-lamp': 'Bàn đã xếp xong' }],
  ['nicholas', 'ba-mat-so', { 'coffee-cup-full': 'cốc cà phê tự nhích' }],
  ['nicholas', 'nam-viet', { 'window-shadow': 'Máy hắt lên vách kho' }],
  ['nicholas', 'tui-trong', { 'small-bag': 'Dưới chân vách', 'folded-sheet': 'gấp bản chép mục lịch' }],
  ['krampus', 'hinh-ve', { 'coffee-cup-full': 'cốc cà phê tự xoay nửa vòng', 'draft-face': 'vẽ cái mặt' }],
  ['krampus', 'mat-na-giay', { 'draft-holes': 'chọc hai lỗ' }],
  ['befana', 'xa-bep', { 'coffee-cup-full': 'Cạnh chân máy có một cốc cà phê' }],
  ['befana', 'ban-bep', { 'name-page': 'Giấy tờ có ghi năm' }],
  ['befana', 'ngoi-sao', { 'kitchen-shadows': 'Máy hắt lên vách bếp' }],
  ['tree', 'o-sang', { 'tree-light': 'Máy hắt một ô sáng' }],
  ['tree', 'qua-tao', { apple: 'Một quả táo rời cành', 'paper-star': 'Anh đặt nó xuống bàn viết' }],
  ['ban1647', 'mat-so-nguoi', { 'coffee-cup-full': 'cốc cà phê tự xê khỏi quầng đèn' }],
  ['ban1647', 'cot-thu-bay', { 'lone-slip': 'Mảnh còn lại ghi' }],
  ['ban1647', 'bac-da', { 'step-apple': 'Quả táo trang trí, anh đặt lên bậc đá' }],
  ['silent-night', 'bac-da', { 'coffee-cup-full': 'mặt cà phê dồn về một phía' }],
  ['silent-night', 'hai-cai-bong', { 'door-shadows': 'Máy hắt lên cánh cửa', 'choir-mark': 'nét mờ cho ca đoàn' }],
  ['silent-night', 'to-giay-trang', { 'door-calendar': 'gài trang lịch' }],
  ['saturnalia', 'qua-don', { 'coffee-cup-full': 'Sát chân cỗ máy' }],
  ['carol', 'truoc-cua-quan', { 'coffee-cup-full': 'mặt cà phê trong cốc gợn' }],
  ['dec25', 'hai-muc', { 'coffee-cup-full': 'Trên nền đá cạnh chân máy' }],
  ['brooms', 'cua-chuong', { 'coffee-cup-full': 'Cốc cà phê đứng trên tuyết' }],
  ['dickens', 'cuon-sach', { 'coffee-cup-full': 'Cốc cà phê đứng ở cuối vệt' }],
  ['caga-tio', 'loi-doan', { 'coffee-cup-full': 'làn hơi trên cốc cà phê' }],
  ['santa-ny', 'tho-vo-danh', { 'coffee-cup-full': 'cốc cà phê tự xoay nửa vòng' }],
  ['yule-lads', 'dau-chan-tro', { 'coffee-cup-full': 'cốc cà phê đứng thế chỗ' }],
  ['ending', 'thao-may', { 'coffee-cup': 'Cực Bắc 23:59', lantern: 'Cực Bắc 23:59' }],
  ['ending', 'the-ten', { 'letter-blurred': 'rút lá thư nhòe' }],
];

const SCENERY = new Set(['manger-lamp', 'window-shadow', 'kitchen-shadows', 'tree-light', 'draft-face', 'draft-holes', 'name-page', 'name-draft', 'mistletoe-sprig', 'small-bag', 'folded-sheet', 'apple', 'paper-star', 'step-apple', 'lone-slip', 'door-calendar', 'door-shadows', 'choir-mark']);

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

const keyOf = (room: string, o: Orient, key: string): Rect => (ROOMS[room] as unknown as (o: Orient) => { keys: Record<string, Rect> })(o).keys[key]!;
const fmt = (b: Box): string => `[${[b.x, b.y, b.width, b.height].map((q) => q.toFixed(1))}]`;

// the plate box measured on the page maps a prop's screen box back into the room's design space, where the room keys live
function designBox(screen: Box, plate: Box, room: string, o: Orient): Box {
  const [dw, dh] = LAYOUTS[room]![o]!.size;
  const sx = plate.width / dw, sy = plate.height / dh;
  return { x: (screen.x - plate.x) / sx, y: (screen.y - plate.y) / sy, width: screen.width / sx, height: screen.height / sy };
}

function boxMatch(k: Rect, b: Box): string | null {
  const dx = Math.abs(b.x - k[0]), db = Math.abs(b.y + b.height - (k[1] + k[3])), dw = Math.abs(b.width - k[2]);
  return dx <= 4 && db <= 4 && dw <= 4 ? null : `box ${fmt(b)} does not match the room's own drawing [${k.map(Math.round)}]`;
}

function pointOn(k: Rect, pad: number, b: Box): string | null {
  const x = b.x + b.width / 2, y = b.y + b.height;
  return x >= k[0] - pad && x <= k[0] + k[2] + pad && y >= k[1] - pad && y <= k[1] + k[3] + pad ? null : `base (${x.toFixed(0)}, ${y.toFixed(0)}) is off [${k.map(Math.round)}] + ${pad} px`;
}

function boxIn(k: Rect, pad: number, b: Box): string | null {
  const ok = b.x >= k[0] - pad && b.x + b.width <= k[0] + k[2] + pad && b.y >= k[1] - pad && b.y + b.height <= k[1] + k[3] + pad;
  return ok ? null : `box ${fmt(b)} is outside [${k.map(Math.round)}] + ${pad} px`;
}

// harbour: the prop rests on the quay at the foot of the warehouse wall — its base sits on the floor side of the wall's base line (yFoot at its own x), no more than 50 px in front of it, wide enough to read
function atHarbourFoot(o: Orient, b: Box): string | null {
  if (b.width < 34) return `it is ${b.width.toFixed(0)} px wide (the scene needs >= 34)`;
  const [m, wallX, vx, vy, hs] = o === 'portrait' ? [300, 1.8, 195, 340, 500] : [270, 2.1, 450, 128, 262];
  const cx = b.x + b.width / 2, base = b.y + b.height;
  const yFoot = vy + (hs * (vx - cx)) / (m * wallX);
  const dy = base - yFoot;
  return dy >= -8 && dy <= 50 ? null : `base (${cx.toFixed(0)}, ${base.toFixed(0)}) sits ${Math.abs(dy).toFixed(1)} px ${dy < 0 ? 'above' : 'in front of'} the wall's base line (y ${yFoot.toFixed(1)} at x ${cx.toFixed(0)})`;
}

// harbour window shadow: the machine's light patch must lie on the drawn wall side, overlapping the drawn window
function onHarbourWall(o: Orient, b: Box): string | null {
  const vx = o === 'portrait' ? 195 : 450;
  if (b.x + b.width > vx + 5) return `box ${fmt(b)} reaches past the wall side (x ${vx})`;
  const w = (ROOMS['ch7-harbour'] as unknown as (o: Orient) => { win: Rect })(o).win;
  const overlap = b.x < w[0] + w[2] && w[0] < b.x + b.width && b.y < w[1] + w[3] && w[1] < b.y + b.height;
  return overlap ? null : `box ${fmt(b)} does not overlap the drawn window [${w.map(Math.round)}]`;
}

const ROOM_OF: Record<string, string> = { 'manger-lamp': 'ch5-bethlehem', 'window-shadow': 'ch7-harbour', 'kitchen-shadows': 'ch10-kitchen', 'tree-light': 'ch11-parlour', apple: 'ch11-parlour', 'paper-star': 'ch11-parlour', 'draft-face': 'ch9-village', 'draft-holes': 'ch9-village', 'name-page': 'ch10-kitchen', 'name-draft': 'ch4-corridor', 'mistletoe-sprig': 'ch4-corridor', 'small-bag': 'ch7-harbour', 'folded-sheet': 'ch7-harbour', 'lone-slip': 'ch12-street', 'step-apple': 'ch12-street', 'door-shadows': 'ch13-church', 'choir-mark': 'ch13-church', 'door-calendar': 'ch13-church' };

const SURFACES: Record<string, (o: Orient, screen: Box, plate: Box) => string | null> = {
  'name-draft': (o, s, p) => pointOn(keyOf('ch4-corridor', o, 'table'), 2, designBox(s, p, 'ch4-corridor', o)),
  'mistletoe-sprig': (o, s, p) => {
    const b = designBox(s, p, 'ch4-corridor', o);
    if (b.width < 28) return `the sprig is ${b.width.toFixed(0)} px wide (the scene needs >= 28)`;
    const [floorTop, floorBottom] = o === 'portrait' ? [406, 624] : [140, 276];
    const base = b.y + b.height;
    return base >= floorTop && base <= floorBottom ? null : `base y ${base.toFixed(0)} is off the corridor floor band [${floorTop}, ${floorBottom}]`;
  },
  'small-bag': (o, s, p) => atHarbourFoot(o, designBox(s, p, 'ch7-harbour', o)),
  'folded-sheet': (o, s, p) => atHarbourFoot(o, designBox(s, p, 'ch7-harbour', o)),
  'window-shadow': (o, s, p) => onHarbourWall(o, designBox(s, p, 'ch7-harbour', o)),
  'kitchen-shadows': (o, s, p) => boxMatch(keyOf('ch10-kitchen', o, 'patch'), designBox(s, p, 'ch10-kitchen', o)),
  'tree-light': (o, s, p) => boxIn(keyOf('ch11-parlour', o, 'tree'), 8, designBox(s, p, 'ch11-parlour', o)),
  apple: (o, s, p) => boxMatch(keyOf('ch11-parlour', o, 'apple'), designBox(s, p, 'ch11-parlour', o)),
  'paper-star': (o, s, p) => boxMatch(keyOf('ch11-parlour', o, 'star'), designBox(s, p, 'ch11-parlour', o)),
  'draft-face': (o, s, p) => pointOn(keyOf('ch9-village', o, 'sheet'), 6, designBox(s, p, 'ch9-village', o)),
  'draft-holes': (o, s, p) => pointOn(keyOf('ch9-village', o, 'sheet'), 6, designBox(s, p, 'ch9-village', o)),
  'name-page': (o, s, p) => pointOn(keyOf('ch10-kitchen', o, 'page'), 6, designBox(s, p, 'ch10-kitchen', o)),
  'lone-slip': (o, s, p) => pointOn(keyOf('ch12-street', o, 'step'), 6, designBox(s, p, 'ch12-street', o)),
  'step-apple': (o, s, p) => pointOn(keyOf('ch12-street', o, 'step'), 6, designBox(s, p, 'ch12-street', o)),
  'door-shadows': (o, s, p) => boxIn(keyOf('ch13-church', o, 'portal'), 4, designBox(s, p, 'ch13-church', o)),
  'choir-mark': (o, s, p) => boxIn(keyOf('ch13-church', o, 'portal'), 4, designBox(s, p, 'ch13-church', o)),
  'door-calendar': (o, s, p) => boxIn(keyOf('ch13-church', o, 'portal'), 4, designBox(s, p, 'ch13-church', o)),
  'manger-lamp': (o, s, p) => {
    const b = designBox(s, p, 'ch5-bethlehem', o);
    const pt: [number, number] = o === 'portrait' ? [232, 338] : [440, 170];
    return b.x <= pt[0] && pt[0] <= b.x + b.width && b.y <= pt[1] && pt[1] <= b.y + b.height ? null : `the lamp box ${fmt(b)} misses the manger at [${pt}]`;
  },
};

test('machine props stand on the machine foot, candle-wax on the hall bench', () => {
  const data = JSON.parse(readFileSync(new URL('../src/story/stage-data.json', import.meta.url), 'utf8')) as { props: Record<string, { at: [number, number]; width: number; landscape?: { at: [number, number]; width: number } }> };
  for (const o of ['portrait', 'landscape'] as const) {
    for (const id of ['coffee-cup', 'coffee-cup-full', 'letter', 'letter-blurred', 'lantern'] as const) {
      const row = data.props[id]!, use = o === 'landscape' && row.landscape ? row.landscape : row;
      const base = use.at[1] + use.width * (PROPS[id]![3]! / PROPS[id]![2]!);
      expect(base, `${id} ${o} base on the machine foot (got ${base.toFixed(1)})`).toBeGreaterThanOrEqual(335);
      expect(base, `${id} ${o} base on the machine foot (got ${base.toFixed(1)})`).toBeLessThanOrEqual(347);
    }
    const row = data.props['candle-wax']!, use = o === 'landscape' && row.landscape ? row.landscape : row;
    const L = LAYOUTS['ch3-hall']![o]!, m = o === 'portrait' ? 320 : 285;
    const [vx, vy] = L.vp, hs = L.size[1] - vy;
    const benchTop = (vy + (hs - 0.45 * m) / 2.6 - L.machine.origin[1]) / L.machine.scale;
    const base = use.at[1] + use.width * (PROPS['candle-wax']![3]! / PROPS['candle-wax']![2]!);
    expect(Math.abs(base - benchTop), `candle-wax ${o} base on the bench top (got ${base.toFixed(1)} vs bench top ${benchTop.toFixed(1)})`).toBeLessThanOrEqual(8);
  }
});

test('every prop first shows at the narration line that names it', () => {
  for (const [chapter, scene, needles] of ROWS) {
    for (const [id, needle] of Object.entries(needles)) {
      expect(visibleStop(chapter, scene, id), `${chapter}/${scene}: ${id} first shows at the line naming it ("${needle}")`).toBe(introStop(chapter, scene, needle));
    }
  }
});

for (const [chapter, scene, needles] of ROWS) {
  for (const [o, size] of [['portrait', PORTRAIT], ['landscape', LANDSCAPE]] as const) {
    test(`${chapter}/${scene} ${o}: props sit where the prose says and clear of the dialogue panel`, async ({ page }, info: TestInfo) => {
      await openAt(page, chapter, scene, size);
      const stops: Array<{ props: string[]; boxes: Record<string, Box>; dialogueY: number; plate: Box; machine: { left: number; top: number; right: number; bottom: number } | null }> = [];
      let last = '';
      for (let i = 0; i < 60; i += 1) {
        const s = (await storyOf(page)) as unknown as { mode: string; scene: string; line?: { text: string } | null; stage: { props: string[]; machineBox: { left: number; top: number; right: number; bottom: number } | null } };
        if (s.mode !== 'story' || s.scene !== scene) break;
        const text = s.line?.text ?? '';
        if (text !== last) {
          last = text;
          const boxes: Record<string, Box> = {};
          for (const id of Object.keys(needles)) {
            if (!s.stage.props.includes(id)) continue;
            const sel = SCENERY.has(id) ? `.scenery .prop[data-prop="${id}"]` : `.machine [data-prop="${id}"]`;
            const bb = await page.locator(sel).first().boundingBox();
            if (bb) boxes[id] = bb;
          }
          const dlg = await page.locator('.dialogue').boundingBox();
          const plate = (await page.locator('.scenery').boundingBox()) as Box;
          expect(plate.width, `${chapter}/${scene} ${o}: the plate box is measured`).toBeGreaterThan(50);
          stops.push({ props: [...s.stage.props], boxes, dialogueY: dlg ? dlg.y : 1e5, plate, machine: s.stage.machineBox });
        }
        await advanceStory(page, info);
      }
      expect(stops.length, `${chapter}/${scene} ${o}: the walk covers the scene`).toBeGreaterThan(0);
      for (const [id, needle] of Object.entries(needles)) {
        const want = introStop(chapter, scene, needle);
        expect(visibleStop(chapter, scene, id), `${id}: parsed first-show at the naming line`).toBe(want);
        const at = stops.findIndex((st) => st.props.includes(id));
        expect(at, `${id} ${o}: shown at the naming line (beat ${want})`).toBe(want);
        if (!SCENERY.has(id)) continue;
        for (const [i, st] of stops.entries()) {
          const b = st.boxes[id];
          if (!b) continue;
          expect(b.y + b.height, `${id} ${o}: above the dialogue panel at beat ${i} (bottom ${(b.y + b.height).toFixed(1)}, panel top ${st.dialogueY.toFixed(1)})`).toBeLessThanOrEqual(st.dialogueY + 2);
        }
        const shown = stops[at]?.boxes[id];
        expect(shown, `${id} ${o}: rendered so its box can be measured`).toBeTruthy();
        const msg = SURFACES[id]!(o, shown!, stops[at]!.plate);
        expect(msg, `${id} ${o}: ${msg ?? 'rests on its prose-named surface'}`).toBeNull();
        if (id === 'small-bag' || id === 'folded-sheet') {
          const mb = stops[at]!.machine;
          expect(mb, `${id} ${o}: the machine box is measured`).toBeTruthy();
          const hit = shown!.x < mb!.right && mb!.left < shown!.x + shown!.width && shown!.y < mb!.bottom && mb!.top < shown!.y + shown!.height;
          expect(hit, `${id} ${o}: clear of the machine's box (prop ${fmt(shown!)} vs machine [${mb!.left.toFixed(0)}, ${mb!.top.toFixed(0)}, ${mb!.right.toFixed(0)}, ${mb!.bottom.toFixed(0)}])`).toBe(false);
        }
      }
    });
  }
}
