// Cỗ máy Lịch sử: a brass and oak cabinet in front elevation. The moving parts (needle, crank, door leaves, stain, steam) are separate layers
// drawn in the same frame, so the engine can rotate or hide them over the static body.
import { clamp, mix, sstep, f1, cr, ellipse, vnoise, ink } from './lib.mjs';
import { Plate, gauss, blobTone, limb, WASH } from './draw.mjs';

const CARD = '#f5eed8';
const hatch = (angle, gap, w, lo, step = 1.8, extra = {}) => ({ angle, gap, w, lo, step, ...extra });
const box = (x, y, w, h) => [[x, y, 1], [x + w, y, 1], [x + w, y + h, 1], [x, y + h, 1]];
export const MFRAME = [0, 0, 300, 340];
export const DIAL = [150, 200];
export const HINGE = { doorL: [116, 76], doorR: [184, 76], crank: [238, 214] };
// crop rectangle of every layer inside MFRAME (x, y, w, h); body is the whole frame
export const LAYERS = {
  body: [0, 0, 300, 340],
  needle: [DIAL[0] - 8, DIAL[1] - 66, 16, 92],
  crank: [226, 160, 70, 108],
  doorL: [112, 44, 38, 56],
  doorR: [150, 44, 38, 56],
  stain: [120, 230, 120, 78],
  stuck: [0, 0, 300, 110],
};
const GEAR = (cx, cy, r, n, rot = 0) => {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2, da = (Math.PI * 2) / n;
    for (const [k, rr] of [[0.0, r * 0.84], [0.2, r * 0.84], [0.3, r], [0.7, r], [0.8, r * 0.84]]) { const a = a0 + da * k; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1]); }
  }
  return pts;
};
const oak = (seed) => (x, y) => clamp(0.34 + 0.22 * (vnoise(x * 0.06, y * 0.5, seed) - 0.5) * 2 + 0.3 * sstep(60, 280, x) * 0.5 - 0.2 * sstep(150, 40, x) * 0);

function drawBody(P) {
  // plinth with brass feet
  const plinth = cr([[12, 304, 1], [288, 304, 1], [292, 322, 1], [292, 334, 1], [8, 334, 1], [8, 322, 1]], true, 3);
  P.part(plinth, { tone: (x, y) => clamp(0.4 + 0.3 * sstep(310, 334, y) + 0.2 * sstep(40, 290, x) * 0.5), layers: [hatch(0, 1.8, 1.3, 0.1, 2), hatch(70, 2.6, 1.0, 0.55)], seed: 411, wash: [WASH.wood2, 0.58], halo: 0 });
  P.line([[12, 314], [288, 314]], 0.7, 0.8);
  for (const x of [26, 262]) P.part(box(x, 334, 16, 6), { tone: () => 0.5, layers: [hatch(0, 1.6, 1.0, 0.1)], seed: 412 + x, wash: [WASH.brass, 0.8], halo: 0 });
  // cabinet
  const cab = box(26, 96, 248, 208);
  P.part(cab, { tone: (x, y) => clamp(0.34 + 0.34 * sstep(120, 280, x) - 0.1 * sstep(120, 30, x) + 0.1 * (vnoise(x * 0.05, y * 0.5, 4) - 0.5) + 0.16 * sstep(280, 300, y)), layers: [hatch(88, 2.0, 1.45, 0.08, 2.1, { wob: 0.4 }), hatch(34, 2.6, 1.1, 0.55, 2.2)], seed: 413, wash: [WASH.wood, 0.55], halo: 0, outline: 1.3 });
  // pediment (the cuckoo house)
  const roof = cr([[14, 98, 1], [150, 14, 1], [286, 98, 1], [274, 106, 1], [26, 106, 1]], true, 3);
  P.part(roof, { tone: (x, y) => clamp(0.35 + 0.4 * sstep(150, 290, x) * 0.8 + 0.2 * sstep(30, 104, y) - 0.12 * sstep(150, 10, x)), layers: [hatch(60, 1.9, 1.5, 0.08, 2), hatch(-30, 2.6, 1.1, 0.6)], seed: 414, wash: [WASH.cap, 0.55], halo: 0, outline: 1.3 });
  for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7; P.line([[mix(14, 150, t) + 3, mix(98, 14, t) + 4], [mix(26, 150, t) + 5, mix(106, 26, t) - 4]], 0.6, 0.55); }
  P.part(box(20, 100, 260, 10), { tone: (x, y) => clamp(0.3 + 0.35 * sstep(20, 280, x)), layers: [hatch(0, 1.5, 1.2, 0.1)], seed: 415, wash: [WASH.wood2, 0.6], halo: 0, outline: 1.1 });
  P.raw('<circle cx="150" cy="20" r="4" fill="' + CARD + '" stroke="' + ink + '" stroke-width="1"/>');
  // cuckoo niche: arched, dark inside
  const niche = cr([[116, 100, 1], [116, 66], [124, 54], [150, 46], [176, 54], [184, 66], [184, 100, 1]], true, 5);
  P.part(niche, { tone: (x, y) => clamp(0.92 - 0.35 * gauss(x, 150, 24) * gauss(y, 92, 12)), layers: [hatch(80, 1.5, 1.3, 0.1, 1.6), hatch(10, 2, 1.1, 0.6)], fill: '#a89878', seed: 416, wash: [WASH.wood2, 0.5], halo: 0, outline: 1.4 });
  P.part(box(120, 94, 60, 8), { tone: () => 0.4, layers: [hatch(0, 1.4, 1.1, 0.1)], seed: 417, wash: [WASH.brass, 0.7], halo: 0, outline: 1 });
  // dial: brass bezel, cream face, ticks
  const [cx, cy] = DIAL;
  const bez = ellipse(cx, cy, 76, 76, 48);
  P.part(bez, { tone: blobTone(cx, cy, 76, 76, { gain: 0.7, amb: 0.2 }), layers: [hatch(-45, 1.6, 1.3, 0.1, 1.8), hatch(30, 2.4, 1.0, 0.5)], fill: '#e9d9a4', seed: 418, wash: [WASH.brass, 0.8], halo: 0, outline: 1.5 });
  const face = ellipse(cx, cy, 64, 64, 48);
  P.part(face, { tone: (x, y) => clamp(0.1 + 0.38 * sstep(48, 64, Math.hypot(x - cx, y - cy)) + 0.22 * sstep(-30, 40, (x - cx) * 0.6 + (y - cy) * 0.8) * sstep(14, 40, Math.hypot(x - cx, y - cy))), layers: [hatch(-40, 1.5, 1.0, 0.1, 1.6), hatch(40, 2.1, 0.8, 0.5)], fill: CARD, seed: 419, wash: [WASH.glow, 0.5], halo: 0, outline: 1.2 });
  for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, big = i % 5 === 0, r0 = big ? 57 : 58.6, r1 = 62; P.line([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], big ? 1.6 : 0.5, 1); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, x = cx + Math.cos(a) * 41, y = cy + Math.sin(a) * 41; if (false) P.raw('<path d="M' + f1(x) + ' ' + f1(y - 3.4) + 'L' + f1(x + 2.4) + ' ' + f1(y) + 'L' + f1(x) + ' ' + f1(y + 3.4) + 'L' + f1(x - 2.4) + ' ' + f1(y) + 'Z" fill="' + ink + '"/>'); }
  const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const glyph = (ch, x, y, h, w) => ch === 'I' ? [[[x, y - h / 2], [x, y + h / 2]]] : ch === 'V' ? [[[x - w / 2, y - h / 2], [x, y + h / 2]], [[x + w / 2, y - h / 2], [x, y + h / 2]]] : [[[x - w / 2, y - h / 2], [x + w / 2, y + h / 2]], [[x + w / 2, y - h / 2], [x - w / 2, y + h / 2]]];
  ROMAN.forEach((t, i) => {
    const ang = (i / 12) * 360, rad = ((ang - 90) * Math.PI) / 180, c0 = [cx + Math.cos(rad) * 50, cy + Math.sin(rad) * 50];
    const d = [];
    [...t].forEach((ch, k) => { const x = (k - (t.length - 1) / 2) * 4.2; for (const seg of glyph(ch, x, 0, 6, 3.6)) d.push('M' + f1(seg[0][0]) + ' ' + f1(seg[0][1]) + 'L' + f1(seg[1][0]) + ' ' + f1(seg[1][1])); });
    P.raw('<path transform="translate(' + f1(c0[0]) + ' ' + f1(c0[1]) + ') rotate(' + ang + ')" d="' + d.join('') + '" fill="none" stroke="' + ink + '" stroke-width="1" stroke-linecap="round"/>');
  });
  P.raw('<circle cx="' + cx + '" cy="' + cy + '" r="30" fill="none" stroke="' + ink + '" stroke-width=".5"/>');
  // the stuck station on the dial: a small cartouche where the needle jams
  P.part(box(cx - 24, cy + 26, 48, 12), { tone: () => 0.2, layers: [hatch(0, 2, 0.8, 0.1)], fill: '#efe3c0', seed: 420, wash: [WASH.glow2, 0.4], halo: 0, outline: 0.8 });
  for (const k of [-16, -8, 0, 8, 16]) P.line([[cx + k - 2, cy + 32], [cx + k + 2, cy + 32]], 0.9, 0.9);
  // gear windows on the left
  for (const [gx, gy, gr, n, rot] of [[62, 156, 20, 12, 0.2], [62, 226, 20, 10, 0.5]]) {
    P.part(ellipse(gx, gy, gr + 6, gr + 6, 32), { tone: blobTone(gx, gy, gr + 6, gr + 6, { gain: 0.6, amb: 0.2 }), layers: [hatch(-45, 1.5, 1.2, 0.1)], fill: '#e9d9a4', seed: 421 + gy, wash: [WASH.brass, 0.8], halo: 0, outline: 1.3 });
    P.part(ellipse(gx, gy, gr + 1, gr + 1, 32), { tone: (x, y) => clamp(0.8 - 0.3 * gauss(x, gx - 6, 10) * gauss(y, gy - 6, 10)), layers: [hatch(70, 1.3, 1.1, 0.1)], fill: '#6c5a42', seed: 423 + gy, wash: null, halo: 0, outline: 1 });
    const g = GEAR(gx, gy, gr - 4, n, rot);
    P.part(g, { tone: blobTone(gx, gy, gr, gr, { gain: 0.7 }), layers: [hatch(-30, 1.4, 1.1, 0.1)], fill: '#e9d9a4', seed: 425 + gy, wash: [WASH.brass, 0.85], halo: 0, outline: 0.9 });
    P.raw('<circle cx="' + gx + '" cy="' + gy + '" r="3" fill="' + ink + '"/>');
  }
  // crank socket on the right and a pair of rivets
  P.part(ellipse(HINGE.crank[0], HINGE.crank[1], 15, 15, 24), { tone: blobTone(238, 214, 15, 15), layers: [hatch(-45, 1.5, 1.2, 0.1)], fill: '#e9d9a4', seed: 427, wash: [WASH.brass, 0.85], halo: 0, outline: 1.2 });
  P.raw('<circle cx="238" cy="214" r="5" fill="' + ink + '"/>');
  for (const [x, y] of [[40, 110], [260, 110], [40, 296], [260, 296], [112, 296], [188, 296]]) P.raw('<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".9"/>');
  // lower brass plaque with engraved lines (no lettering: the type is set by the page)
  P.part(box(100, 276, 100, 20), { tone: () => 0.25, layers: [hatch(0, 2.1, 0.9, 0.1)], fill: '#e9d9a4', seed: 428, wash: [WASH.brass, 0.85], halo: 0, outline: 1.1 });
  for (let i = 0; i < 6; i++) P.line([[112 + i * 14, 286], [112 + i * 14 + 8, 286]], 1.1, 0.9);
  // vents on the right
  for (let i = 0; i < 4; i++) P.line([[212, 250 + i * 6], [262, 250 + i * 6]], 1.3, 0.9);
}
function drawNeedle(P) {
  const [cx, cy] = DIAL;
  const blade = cr([[cx, cy - 58, 1], [cx + 4, cy - 20], [cx + 2.6, cy + 6, 1], [cx, cy + 20, 1], [cx - 2.6, cy + 6, 1], [cx - 4, cy - 20]], true, 4);
  P.part(blade, { tone: (x) => clamp(0.3 + 0.5 * sstep(cx - 3, cx + 4, x)), layers: [hatch(88, 1.3, 1.1, 0.1, 1.5)], fill: '#c9cabf', seed: 431, wash: [WASH.cap, 0.5], halo: 1.2, outline: 1.1 });
  P.part(ellipse(cx, cy, 8, 8, 20), { tone: blobTone(cx, cy, 8, 8), layers: [hatch(-45, 1.2, 1.1, 0.1)], fill: '#e9d9a4', seed: 432, wash: [WASH.brass, 0.85], halo: 1.2, outline: 1.1 });
  P.raw('<circle cx="' + cx + '" cy="' + cy + '" r="2.2" fill="' + ink + '"/>');
}
function drawCrank(P) {
  const [cx, cy] = HINGE.crank;
  const arm = limb([[cx, cy], [cx + 22, cy], [cx + 44, cy + 2]], [9, 7.6, 7], 5, true);
  P.part(arm.outline, { tone: (x, y) => clamp(0.3 + 0.5 * sstep(cy - 4, cy + 6, y)), layers: [hatch(2, 1.4, 1.1, 0.1)], fill: '#e9d9a4', seed: 441, wash: [WASH.brass, 0.85], halo: 1.4, outline: 1.1 });
  P.part(ellipse(cx + 46, cy + 2, 11, 11, 24), { tone: blobTone(cx + 46, cy + 2, 11, 11), layers: [hatch(-45, 1.3, 1.1, 0.1)], fill: '#a7692f', seed: 442, wash: [WASH.wood2, 0.7], halo: 1.4, outline: 1.2 });
  P.raw('<circle cx="' + cx + '" cy="' + cy + '" r="4.4" fill="' + ink + '"/>');
}
function drawDoor(P, side) {
  const x0 = side < 0 ? 116 : 150, hinge = side < 0 ? 116 : 184;
  const d = side < 0 ? [[116, 100, 1], [116, 66], [124, 54], [150, 46], [150, 100, 1]] : [[150, 46, 1], [176, 54], [184, 66], [184, 100, 1], [150, 100, 1]];
  P.part(cr(d, true, 5), { tone: (x, y) => clamp(0.34 + 0.3 * sstep(x0, x0 + 34, x) * (side < 0 ? 1 : -1) + 0.3 * (side < 0 ? 0 : 0.4)), layers: [hatch(88, 1.8, 1.4, 0.08, 2), hatch(35, 2.4, 1.1, 0.55)], seed: 451 + side, wash: [WASH.wood, 0.6], halo: 0, outline: 1.3 });
  P.line(cr(side < 0 ? [[121, 96], [121, 68], [127, 58], [146, 52]] : [[154, 52], [173, 58], [179, 68], [179, 96]], false, 4), 0.6, 0.8);
  P.raw('<circle cx="' + (side < 0 ? 143 : 157) + '" cy="82" r="2.4" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".9"/>');
}
function drawStain(P) {
  const pts = [];
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = 34 + 12 * Math.sin(a * 3 + 1) + 8 * (vnoise(i * 1.7, 3, 2) - 0.5); pts.push([188 + Math.cos(a) * r * 0.95, 262 + Math.sin(a) * r * 0.5]); }
  const blot = cr(pts, true, 3);
  P.part(blot, { tone: (x, y) => clamp(0.08 + 0.34 * gauss(x, 188, 26) * gauss(y, 262, 11)), layers: [hatch(70, 2.2, 0.9, 0.05, 1.8), hatch(-20, 3, 0.8, 0.4)], fill: null, seed: 461, wash: ['#6b3d1a', 0.78], halo: 0, outline: 0 });
  for (const [x, w, h] of [[170, 6, 36], [196, 5, 30], [214, 4, 22]]) P.part(limb([[x, 262], [x + 0.5, 262 + h * 0.5], [x, 262 + h]], [w, w * 0.8, w * 0.6], 4, true).outline, { tone: () => 0.3, layers: [hatch(88, 2, 0.8, 0.1)], fill: null, seed: 462 + x, wash: ['#6b3d1a', 0.75], halo: 0, outline: 0 });
}
function drawStuck(P) {
  // steam curls over the shoulders and a few sparks on the dial's rim side
  for (const [x, y, s, f] of [[60, 78, 1, 1], [242, 70, 1.15, -1], [30, 40, 0.8, -1], [270, 36, 0.7, 1]]) {
    const c = cr([[x, y + 20 * s], [x + 10 * s * f, y + 8 * s], [x - 6 * s * f, y - 6 * s], [x + 8 * s * f, y - 20 * s], [x, y - 34 * s]], false, 6);
    P.line(c, 1.6 * s, 0.9);
    P.line(c.map(p => [p[0] + 3 * f, p[1] + 1]), 0.7 * s, 0.6);
    P.raw('<circle cx="' + f1(x + 2 * f) + '" cy="' + f1(y - 36 * s) + '" r="' + f1(4 * s) + '" fill="' + CARD + '" stroke="' + ink + '" stroke-width=".9" fill-opacity=".85"/>');
  }
}

export function machine(layer = 'body') {
  const P = new Plate(31);
  ({ body: drawBody, needle: drawNeedle, crank: drawCrank, doorL: p => drawDoor(p, -1), doorR: p => drawDoor(p, 1), stain: drawStain, stuck: drawStuck })[layer](P);
  const crop = LAYERS[layer];
  return { frame: crop, plate: P, svg: (scale = 1, o = {}) => P.svg(crop, { scale, ...o }) };
}
