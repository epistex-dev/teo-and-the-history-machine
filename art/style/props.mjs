// Props of the chapter 1 and 25 scenes, each in its own small frame (x, y, w, h).
import { clamp, mix, sstep, f1, cr, ellipse, vnoise, ink } from './lib.mjs';
import { mangerLamp, windowShadow, kitchenShadows, treeLight, draftFace, draftHoles, namePage, nameDraft, mistletoeSprig, smallBag, foldedSheet, apple, paperStar, loneSlip, calendarPage, doorShadows, choirMark } from './lit.mjs';
import { GREEN } from './scenery.mjs';
import { Plate, gauss, blobTone, limb, WASH } from './draw.mjs';

const CARD = '#f5eed8';
const hatch = (angle, gap, w, lo, step = 1.6, extra = {}) => ({ angle, gap, w, lo, step, ...extra });
export const PROPS = { 'coffee-cup': [0, 0, 110, 70], 'coffee-cup-full': [0, 0, 110, 70], letter: [0, 0, 80, 100], 'letter-blurred': [0, 0, 80, 100], lantern: [0, 0, 70, 120], 'candle-wax': [0, 0, 70, 100], 'manger-lamp': [0, 0, 200, 150], 'window-shadow': [0, 0, 90, 210], 'kitchen-shadows': [0, 0, 100, 170], 'tree-light': [0, 0, 100, 130], 'draft-face': [0, 0, 64, 52], 'draft-holes': [0, 0, 64, 52], 'name-page': [0, 0, 48, 24], 'name-draft': [0, 0, 52, 26], 'mistletoe-sprig': [0, 0, 22, 13], 'small-bag': [0, 0, 32, 26], 'folded-sheet': [0, 0, 38, 22], apple: [0, 0, 24, 24], 'paper-star': [0, 0, 36, 18], 'step-apple': [0, 0, 24, 24], 'lone-slip': [0, 0, 32, 16], 'door-calendar': [0, 0, 24, 32], 'door-shadows': [0, 0, 60, 90], 'choir-mark': [0, 0, 60, 90] };

function cup(P, full = false) {
  const saucer = ellipse(52, 60, 48, 8, 36);
  P.part(saucer, { tone: (x) => clamp(0.3 + 0.4 * sstep(30, 100, x)), layers: [hatch(0, 1.6, 1.1, 0.1)], fill: CARD, seed: 511, wash: [WASH.sky2, 0.4], halo: 1.2, outline: 1.1 });
  P.part(ellipse(52, 58, 30, 5, 30), { tone: () => 0.5, layers: [hatch(0, 1.6, 1, 0.1)], fill: '#e9e2cc', seed: 512, wash: [WASH.sky2, 0.3], halo: 0, outline: 0.8 });
  const body = cr([[22, 22, 1], [82, 22, 1], [80, 40], [72, 54], [52, 60], [32, 54], [24, 40]], true, 5);
  P.part(body, { tone: blobTone(46, 40, 34, 34, { gain: 0.8 }), layers: [hatch(80, 1.5, 1.15, 0.1), hatch(25, 2.1, 0.9, 0.5)], fill: CARD, seed: 513, wash: [WASH.sky2, 0.38], halo: 1.2, outline: 1.2 });
  P.part(limb([[82, 28], [98, 30], [98, 42], [78, 48]], [5, 4.4, 4.4, 4.6], 6, true).outline, { tone: () => 0.45, layers: [hatch(60, 1.4, 1.0, 0.1)], fill: CARD, seed: 514, wash: [WASH.sky2, 0.3], halo: 1, outline: 1.0 });
  const rim = ellipse(52, 22, 30, 6, 34);
  P.part(rim, { tone: (x, y) => clamp(0.3 + 0.5 * sstep(28, 12, y) * 0 + 0.6 * sstep(34, 74, x) * 0), layers: [hatch(0, 1.5, 0.9, 0.1)], fill: '#6b3d1a', seed: 515, wash: ['#6b3d1a', 0.8], halo: 0, outline: 1.1 });
  P.raw('<path d="M30 22 Q52 18 74 22" fill="none" stroke="' + CARD + '" stroke-width="1.4" stroke-opacity=".9"/>');
  if (full) {
    // a full cup: ripples on the coffee and a thread of steam, nothing spilled
    for (const [rx, ry] of [[10, 2], [19, 3.6]]) P.raw('<ellipse cx="52" cy="22" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + CARD + '" stroke-width=".8" stroke-opacity=".75"/>');
    P.line(cr([[46, 16], [43, 11], [48, 6], [45, 2]], false, 6), 0.8, 0.7);
    P.line(cr([[58, 16], [55, 12], [60, 8], [57, 4]], false, 6), 0.7, 0.6);
    return;
  }
  // spill running over the saucer
  P.part(cr([[34, 54], [24, 60], [20, 66], [30, 68], [44, 64]], true, 4), { tone: () => 0.15, layers: [hatch(0, 2.4, 0.7, 0.05)], fill: null, seed: 516, wash: ['#6b3d1a', 0.7], halo: 0, outline: 0 });
}
function letter(P, clean = false) {
  const sheet = cr([[6, 8, 1], [62, 4, 1], [74, 16, 1], [76, 92, 1], [10, 96, 1], [4, 84], [8, 40]], true, 3);
  P.part(sheet, { tone: (x, y) => clamp(0.06 + 0.2 * sstep(30, 80, x) + 0.1 * sstep(70, 96, y)), layers: [hatch(60, 3.2, 0.8, 0.04, 2), hatch(-30, 3.6, 0.6, 0.1)], fill: '#f1e6c6', seed: 521, wash: ['#e6c98c', 0.34], halo: 1.4, outline: 1.2 });
  P.raw('<path d="M62 4 L62 16 L74 16Z" fill="#e0d2ac" stroke="' + ink + '" stroke-width="1"/>');
  for (let i = 0; i < (clean ? 7 : 8); i++) { const y = 24 + i * 8; const pts = []; for (let k = 0; k <= 10; k++) pts.push([14 + k * 5.2, y + Math.sin(k * 1.7 + i) * 1.3]); P.line(cr(pts, false, 3), 0.9, 0.85); }
  if (clean) {
    // the signature line is still whole: a flourish under the lines of writing
    P.line(cr([[16, 86], [24, 79], [32, 88], [41, 81], [51, 87], [62, 82]], false, 5), 1.1, 0.95);
    return;
  }
  // the smeared signature: a brown blot that eats the last lines
  const blot = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = 22 + 7 * Math.sin(a * 3) + 5 * (vnoise(i * 1.3, 5, 4) - 0.5); blot.push([46 + Math.cos(a) * r, 74 + Math.sin(a) * r * 0.62]); }
  P.part(cr(blot, true, 3), { tone: (x, y) => clamp(0.12 + 0.3 * gauss(x, 46, 20) * gauss(y, 74, 10)), layers: [hatch(75, 2.2, 0.9, 0.05, 1.8), hatch(-20, 3, 0.8, 0.4)], fill: null, seed: 522, wash: ['#6b3d1a', 0.7], halo: 0, outline: 0 });
}
function lantern(P) {
  P.part(cr([[22, 6, 1], [48, 6, 1], [52, 16], [18, 16]], true, 3), { tone: () => 0.5, layers: [hatch(70, 1.4, 1.1, 0.1)], fill: '#8a6a3c', seed: 531, wash: [WASH.wood2, 0.6], halo: 0, outline: 1.1 });
  P.part(ellipse(35, 6, 9, 5, 20), { tone: () => 0.4, layers: [hatch(0, 1.4, 1, 0.1)], fill: null, seed: 532, wash: null, halo: 0, outline: 1.3 });
  const glass = cr([[20, 16, 1], [50, 16, 1], [54, 98, 1], [16, 98, 1]], true, 3);
  P.part(glass, { tone: (x, y) => clamp(0.1 + 0.5 * sstep(24, 52, x) * 0.5 + 0.3 * sstep(66, 98, y)), layers: [hatch(80, 2.4, 0.9, 0.08), hatch(20, 3, 0.8, 0.5)], fill: '#f6ecc0', seed: 533, wash: [WASH.glow, 0.78], halo: 0, outline: 1.3 });
  for (const x of [28, 35, 42]) P.line([[x - 0.3 * 0, 16], [x + (x - 35) * 0.2, 98]], 0.9, 0.9);
  // flame
  P.part(cr([[35, 84, 1], [28, 74], [32, 62], [36, 50], [40, 62], [44, 74]], true, 5), { tone: () => 0.1, layers: [hatch(80, 2.4, 0.7, 0.05)], fill: '#fff3b0', seed: 534, wash: [WASH.flame, 0.9], halo: 0, outline: 0.9 });
  P.part(cr([[12, 98, 1], [58, 98, 1], [62, 110, 1], [8, 110, 1]], true, 3), { tone: (x) => clamp(0.4 + 0.3 * sstep(30, 60, x)), layers: [hatch(0, 1.4, 1.2, 0.1)], fill: '#8a6a3c', seed: 535, wash: [WASH.wood2, 0.65], halo: 0, outline: 1.1 });
}
function wax(P) {
  P.part(cr([[6, 90, 1], [64, 90, 1], [58, 98, 1], [12, 98, 1]], true, 3), { tone: (x) => clamp(0.35 + 0.3 * sstep(30, 60, x)), layers: [hatch(0, 1.4, 1.2, 0.1)], fill: '#cfa24a', seed: 541, wash: [WASH.brass, 0.7], halo: 0, outline: 1.1 });
  const stub = cr([[20, 82, 1], [22, 36, 1], [26, 31], [44, 31], [48, 36, 1], [50, 82, 1], [44, 92], [26, 92]], true, 4);
  P.part(stub, { tone: (x, y) => clamp(0.12 + 0.5 * sstep(30, 50, x) - 0.08 * gauss(y, 40, 6)), layers: [hatch(85, 1.8, 1.2, 0.08), hatch(25, 2.6, 0.9, 0.5)], fill: '#f3ead0', seed: 542, wash: [WASH.glow2, 0.4], halo: 1.2, outline: 1.2 });
  P.raw('<path d="M24 36 Q35 31 46 36" fill="none" stroke="' + ink + '" stroke-width="1"/>');
  // wax drips down the side, one pooled on the dish
  for (const [x, h] of [[24, 34], [32, 20], [43, 42]]) P.part(limb([[x, 36], [x + 0.4, 36 + h * 0.6], [x, 36 + h]], [6.4, 5, 5.6], 5, true).outline, { tone: () => 0.28, layers: [hatch(85, 1.6, 0.9, 0.1)], fill: '#fbf4dc', seed: 543 + x, wash: [WASH.glow2, 0.35], halo: 0, outline: 0.9 });
  P.part(ellipse(52, 94, 14, 3.6, 22), { tone: () => 0.2, layers: [hatch(0, 1.6, 0.8, 0.1)], fill: '#fbf4dc', seed: 547, wash: [WASH.glow2, 0.35], halo: 0, outline: 0.9 });
  P.line([[35, 31], [35, 22]], 1.6); P.part(cr([[35, 24, 1], [31, 14], [35, 2], [39, 14]], true, 5), { tone: () => 0.1, layers: [hatch(80, 2.4, 0.7, 0.05)], fill: '#fff3b0', seed: 548, wash: [WASH.flame, 0.9], halo: 0, outline: 0.9 });
}
export function prop(id) {
  const P = new Plate(41), fr = PROPS[id];
  ({ 'coffee-cup': cup, 'coffee-cup-full': (q) => cup(q, true), letter: (q) => letter(q, true), 'letter-blurred': letter, lantern, 'candle-wax': wax, 'manger-lamp': mangerLamp, 'window-shadow': windowShadow, 'kitchen-shadows': kitchenShadows, 'tree-light': treeLight, 'draft-face': draftFace, 'draft-holes': draftHoles, 'name-page': namePage, 'name-draft': nameDraft, 'mistletoe-sprig': mistletoeSprig, 'small-bag': smallBag, 'folded-sheet': foldedSheet, apple, 'paper-star': paperStar, 'step-apple': apple, 'lone-slip': loneSlip, 'door-calendar': calendarPage, 'door-shadows': doorShadows, 'choir-mark': choirMark })[id](P);
  return { frame: fr, plate: P, svg: (scale = 1, o = {}) => P.svg(fr, { scale, ...o }) };
}
