// Quạ Đồn (carrion crow) and Cúc Cu (common cuckoo) as field-guide plates. Each bird is a headless body plus one head sprite per expression;
// the head carries the neck stub, so every expression turns the same neck joint and no silhouette ghost is left behind.
import { clamp, mix, sstep, f1, cr, ink, vnoise } from './lib.mjs';
import { Plate, gauss, blobTone, limb, WASH } from './draw.mjs';

const CARD = '#f5eed8';
const hatch = (angle, gap, w, lo, step = 1.6, extra = {}) => ({ angle, gap, w, lo, step, ...extra });
const tr = (pts, dx, dy, rot = 0, ox = 0, oy = 0) => { const c = Math.cos(rot), s = Math.sin(rot); return pts.map(([x, y, k]) => [ox + (x - ox) * c - (y - oy) * s + dx, oy + (x - ox) * s + (y - oy) * c + dy, k]); };

export const CROW_EXPR = ['normal', 'talking', 'smug', 'surprised', 'doubtful'];
export const CUCKOO_EXPR = ['normal', 'talking', 'smug', 'surprised', 'deflated'];

// brow ridge, lid, gape, head tilt (deg, positive = chin down), pupil offset; shared by both birds
const BE = {
  normal: { brow: [0, 0], lid: 0.15, gape: 0, tilt: 0, corner: 0 },
  talking: { brow: [-0.4, -0.2], lid: 0.05, gape: 1, tilt: -4, corner: 0.4 },
  smug: { brow: [-1.0, 1.2], lid: 0.55, gape: 0, tilt: -9, corner: -1 },
  surprised: { brow: [-3, -3], lid: -0.5, gape: 0.55, tilt: -6, corner: 0.2 },
  doubtful: { brow: [2.2, -3.4], lid: 0.3, gape: 0, tilt: 8, corner: 1.2 },
  deflated: { brow: [2.6, 2.2], lid: 0.6, gape: 0.25, tilt: 14, corner: 1.6 },
};

// ---------------------------------------------------------------------------------------------------------- crow: faces left, perched, feet at y = 0
export const CROW_FRAME = [-70, -190, 150, 196];
const CROW_NECK = [-26, -120];
function crowBody(P) {
  const dark = '#2a2620';
  const leg = (x, bend) => {
    P.part(limb([[x, -26], [x + bend, -14], [x + bend * 0.6, -4]], [6.4, 4.4, 4.2], 5, true).outline, { tone: () => 0.8, layers: [hatch(80, 1.6, 1.1, 0.1)], halo: 1.4, outline: 0.9, fill: '#d8cfb4', seed: 311 + x, wash: [WASH.wood2, 0.5] });
    for (const [dx, dy] of [[-10, 1.2], [8, 1.4], [-4, 2.4]]) P.line([[x + bend * 0.6, -4], [x + bend * 0.6 + dx, -2 + dy * 0.2], [x + bend * 0.6 + dx * 1.15, 0.6]], 2.0, 1);
  };
  leg(-6, -3); leg(10, 2);
  // tail: long wedge pointing down-right
  const tail = cr([[22, -62, 1], [38, -42], [62, -14], [70, 2, 1], [60, 4, 1], [40, -10], [20, -32], [8, -48, 1]], true, 5);
  P.part(tail, { tone: (x, y) => clamp(0.82 - 0.2 * gauss(y, -34 - (x - 36) * 0.6, 4)), layers: [hatch(-58, 1.5, 1.35, 0.1, 1.5), hatch(30, 2, 1.0, 0.5)], fill: dark, halo: 2, outline: 1.1, seed: 321, wash: [WASH.sky, 0.28] });
  // body
  const body = cr([[-28, -112, 1], [-38, -100], [-42, -84], [-36, -62], [-22, -42], [-2, -30], [20, -28], [30, -40], [28, -70], [22, -94], [8, -110], [-12, -116]], true, 5);
  P.part(body, { tone: (x, y) => clamp(0.74 - 0.5 * gauss(x, -26, 7) * gauss(y, -88, 22) - 0.3 * gauss(x, 8, 8) * gauss(y, -100, 7) + 0.14 * sstep(-70, -34, y)), layers: [hatch(-52, 1.25, 1.35, 0.1, 1.4, { wob: 0.15 }), hatch(22, 1.9, 1.0, 0.55)], fill: dark, halo: 2.2, outline: 1.2, seed: 322, wash: [WASH.sky, 0.32] });
  // folded wing, scalloped with white-line feathers
  const wing = cr([[8, -104, 1], [20, -86], [28, -56], [36, -24, 1], [22, -22, 1], [4, -38], [-10, -64], [-12, -88]], true, 5);
  P.part(wing, { tone: (x, y) => clamp(0.66 - 0.35 * gauss(x, 0, 9) * gauss(y, -84, 14) + 0.1 * (vnoise(x * .2, y * .2, 3) - 0.5)), layers: [hatch(-46, 1.4, 1.35, 0.1, 1.4), hatch(34, 1.9, 1, 0.5)], fill: '#1e1b17', halo: 1.4, outline: 1.1, seed: 323, wash: [WASH.sky, 0.38] });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
    const x = 12 - r * 5 + k * 6 - 2, y = -86 + r * 11 + k * 5;
    P.raw('<path d="M' + f1(x) + ' ' + f1(y) + ' q4 5 9 2" fill="none" stroke="' + CARD + '" stroke-width=".7" stroke-opacity=".75"/>');
  }
  for (let i = 0; i < 4; i++) P.line([[22 + i * 4, -40 + i * 2], [34 + i * 5, -14 + i * 1]], 0.7, 0.8, CARD);
  // sheen
  P.line(cr([[-34, -94], [-33, -78], [-27, -60]], false, 4), 1.6, 0.8, CARD);
  return { neck: CROW_NECK };
}
function crowHead(P, expr) {
  const e = BE[expr], dark = '#2a2620';
  const [nx, ny] = CROW_NECK, rot = (e.tilt * Math.PI) / 180;
  const T = pts => tr(pts, 0, 0, rot, nx + 4, ny + 10);
  const contour = cr(T([[-22, -112], [-24, -128], [-22, -140], [-12, -151], [0, -153], [10, -146], [15, -130], [16, -114], [12, -100]]), false, 5);
  const head = cr([...contour, ...T([[8, -90], [-4, -90], [-16, -96]])], true, 4);
  P.part(head, { tone: (x, y) => clamp(0.8 - 0.4 * gauss(x, -10, 5) * gauss(y, -138, 8) + 0.05), layers: [hatch(-50, 1.25, 1.35, 0.1, 1.4), hatch(20, 1.9, 1, 0.55)], fill: dark, halo: 0, outline: 0, seed: 331, wash: [WASH.sky, 0.3] });
  P.line(contour, 1.25);
  P.line(cr(T([[-18, -138], [-14, -148], [-6, -150]]), false, 4), 1.4, 0.75, CARD);
  // bill: upper and lower mandible, gape opens the lower one
  const g = e.gape * 12;
  const up = cr(T([[-20, -136, 1], [-34, -132], [-52, -124], [-62, -117], [-48, -121], [-30, -122], [-18, -124, 1]]), true, 5);
  const lo = cr(T([[-18, -124, 1], [-30, -122 + g * 0.3], [-48, -120 + g], [-58, -114 + g * 1.3], [-44, -112 + g * 0.8], [-26, -114 + g * 0.35], [-16, -116, 1]]), true, 5);
  if (e.gape > 0.1) P.part(cr(T([[-18, -124, 1], [-30, -122], [-46, -120 + g * 0.4], [-44, -112 + g * 0.8], [-24, -114 + g * 0.35], [-16, -116, 1]]), true, 4), { tone: () => 1, layers: [hatch(0, 1.6, 1.3, 0.1)], fill: '#5b1a1a', halo: 0, outline: 0.9, seed: 336, wash: [WASH.cap, 0.4] });
  P.part(lo, { tone: () => 0.82, layers: [hatch(-30, 1.3, 1.2, 0.1)], fill: '#3a352e', halo: 1.2, outline: 1.1, seed: 332, wash: [WASH.sky, 0.2] });
  P.part(up, { tone: (x, y) => clamp(0.78 - 0.3 * gauss(y, -134, 3)), layers: [hatch(-30, 1.3, 1.2, 0.1)], fill: '#3a352e', halo: 1.2, outline: 1.1, seed: 333, wash: [WASH.sky, 0.2] });
  P.line(cr(T([[-34, -123], [-48, -121]]), false, 3), 0.6, 0.8, CARD);
  // rictus: the mouth corner turns up (smug) or down (doubtful, deflated)
  const mc = T([[-17, -117]])[0];
  P.line(cr([mc, [mc[0] + 4, mc[1] + e.corner * 2.2 - 1], [mc[0] + 8, mc[1] + e.corner * 4.4 - 3]], false, 4), 1.1, 0.95, CARD);
  // eye + brow ridge
  const ex = T([[-6, -132]])[0];
  const ey = ex[1];
  P.raw('<ellipse cx="' + f1(ex[0]) + '" cy="' + f1(ey) + '" rx="' + (e.lid < 0 ? 5.4 : 4.6) + '" ry="' + (e.lid < 0 ? 5.4 : 4.6) + '" fill="#e4d6a6" stroke="' + CARD + '" stroke-width=".6"/>');
  const pr = e.lid < 0 ? 1.7 : 2.4;
  P.raw('<circle cx="' + f1(ex[0] - 0.8) + '" cy="' + f1(ey + (expr === 'doubtful' ? -1 : 0.2)) + '" r="' + pr + '" fill="' + ink + '"/><circle cx="' + f1(ex[0] - 1.6) + '" cy="' + f1(ey - 1) + '" r=".7" fill="' + CARD + '"/>');
  if (e.lid > 0) P.raw('<clipPath id="cl"><circle cx="' + f1(ex[0]) + '" cy="' + f1(ey) + '" r="4.6"/></clipPath><g clip-path="url(#cl)"><path d="M' + f1(ex[0] - 6) + ' ' + f1(ey - 6) + 'H' + f1(ex[0] + 6) + 'V' + f1(ey - 4.6 + 9.2 * e.lid + (expr === 'doubtful' ? 0 : 0)) + 'Q' + f1(ex[0]) + ' ' + f1(ey - 4.6 + 9.2 * e.lid + 2.4) + ' ' + f1(ex[0] - 6) + ' ' + f1(ey - 4.6 + 9.2 * e.lid - (expr === 'smug' ? 1.4 : 0)) + 'Z" fill="' + dark + '"/></g><path d="M' + f1(ex[0] - 4.6) + ' ' + f1(ey - 4.6 + 9.2 * e.lid - (expr === 'smug' ? 1.4 : 0)) + 'Q' + f1(ex[0]) + ' ' + f1(ey - 4.6 + 9.2 * e.lid + 2.4) + ' ' + f1(ex[0] + 4.6) + ' ' + f1(ey - 4.6 + 9.2 * e.lid) + '" fill="none" stroke="' + CARD + '" stroke-width=".8"/>');
  const [bIn, bOut] = e.brow;
  P.line(cr([[ex[0] + 7, ey - 8 + bOut], [ex[0], ey - 9.2 + (bIn + bOut) / 2 - Math.abs(bIn - bOut) * 0.1], [ex[0] - 7.5, ey - 7.2 + bIn]], false, 4), 1.9, 1, CARD);
  P.line(cr([[ex[0] + 7, ey - 8 + bOut], [ex[0], ey - 9.2 + (bIn + bOut) / 2], [ex[0] - 7.5, ey - 7.2 + bIn]], false, 4).map(p => [p[0], p[1] - 0.9]), 0.7, 0.9, ink);
  // throat feather stubs where the head meets the body
  for (let i = 0; i < 4; i++) P.line([[nx - 14 + i * 6, ny + 8], [nx - 10 + i * 6, ny + 16]], 0.7, 0.7, CARD);
}

// ---------------------------------------------------------------------------------------------------------- cuckoo: faces left, feet at y = 0
export const CUCKOO_FRAME = [-62, -150, 130, 158];
const CK_NECK = [-18, -92];
function cuckooBody(P) {
  const grey = '#cfd0c4';
  P.part(limb([[-4, -22], [-4, -10], [-5, -3]], [5, 4, 4], 4, true).outline, { tone: () => 0.7, layers: [hatch(80, 1.6, 1.1, 0.1)], halo: 1.2, outline: 0.9, fill: '#e8d7a0', seed: 341, wash: [WASH.glow2, 0.6] });
  P.part(limb([[10, -22], [10, -10], [9, -3]], [5, 4, 4], 4, true).outline, { tone: () => 0.7, layers: [hatch(80, 1.6, 1.1, 0.1)], halo: 1.2, outline: 0.9, fill: '#e8d7a0', seed: 342, wash: [WASH.glow2, 0.6] });
  for (const x of [-5, 9]) P.line([[x - 8, 1.5], [x - 4, -3], [x, -3.2], [x + 7, 1.5]], 1.2);
  // long barred tail
  const tail = cr([[16, -44, 1], [30, -32], [46, -12], [54, 4, 1], [44, 4, 1], [28, -8], [12, -26], [4, -38, 1]], true, 5);
  P.part(tail, { tone: (x, y) => clamp(0.55 - 0.1 * gauss(x, 30, 12)), layers: [hatch(-55, 1.5, 1.2, 0.1, 1.5), hatch(35, 2.2, 0.9, 0.5)], fill: grey, halo: 2, outline: 1.1, seed: 343, wash: [WASH.sky2, 0.55] });
  for (let i = 0; i < 4; i++) { const t = 0.2 + i * 0.2; P.line([[mix(10, 36, t) - 6, mix(-44, -6, t) + 4], [mix(10, 36, t) + 8, mix(-44, -6, t) - 4]], 1.5, 0.9); }
  // body
  const body = cr([[-20, -90, 1], [-30, -78], [-34, -60], [-28, -42], [-14, -28], [4, -22], [20, -30], [26, -52], [24, -74], [12, -90], [-4, -96]], true, 5);
  P.part(body, { tone: blobTone(-4, -62, 30, 36, { gain: 0.78 }), layers: [hatch(-50, 1.35, 1.1, 0.1, 1.5), hatch(24, 2, 0.9, 0.5)], fill: CARD, halo: 2.2, outline: 1.15, seed: 344, wash: [WASH.sky2, 0.34] });
  // barred breast
  for (let i = 0; i < 8; i++) { const y = -78 + i * 6.2, xl = -30 + Math.sin(i * 0.4) * -1 + (i > 5 ? 6 + (i - 5) * 3 : 0), xr = -4 + i * 1.4; P.line(cr([[xl + 3, y + 1], [(xl + xr) / 2, y + 2.4], [xr, y]], false, 4), 1.1, 0.95); }
  // folded wing
  const wing = cr([[2, -88, 1], [14, -76], [22, -52], [26, -26, 1], [14, -20, 1], [2, -34], [-6, -56], [-4, -76]], true, 5);
  P.part(wing, { tone: (x, y) => clamp(0.4 + 0.2 * sstep(-80, -26, y) - 0.16 * gauss(x, 0, 6) * gauss(y, -78, 8)), layers: [hatch(-44, 1.3, 1.25, 0.1, 1.4), hatch(30, 1.9, 1, 0.55)], fill: '#dcdccf', halo: 1.2, outline: 1.1, seed: 345, wash: [WASH.sky, 0.36] });
  for (let i = 0; i < 4; i++) P.line([[6 + i * 4, -70 + i * 11], [18 + i * 2, -64 + i * 11]], 0.6, 0.8);
  return { neck: CK_NECK };
}
function cuckooHead(P, expr) {
  const e = BE[expr], [nx, ny] = CK_NECK, rot = (e.tilt * Math.PI) / 180;
  const T = pts => tr(pts, 0, 0, rot, nx + 6, ny + 8);
  const contour = cr(T([[-17, -98], [-19, -112], [-11, -124], [3, -128], [14, -120], [17, -104], [14, -90]]), false, 5);
  const head = cr([...contour, ...T([[8, -80], [-4, -80], [-14, -84]])], true, 4);
  P.part(head, { tone: blobTone(-2, -108, 17, 18, { gain: 0.78 }), layers: [hatch(-50, 1.3, 1.05, 0.1), hatch(25, 1.9, 0.9, 0.5)], fill: '#c9cabf', halo: 0, outline: 0, seed: 351, wash: [WASH.sky2, 0.5] });
  P.line(contour, 1.15);
  const g = e.gape * 5.6;
  const up = cr(T([[-12, -112, 1], [-22, -110], [-34, -104], [-40, -99], [-28, -102], [-14, -104, 1]]), true, 5);
  const lo = cr(T([[-14, -104, 1], [-26, -101 + g * 0.3], [-36, -97 + g], [-30, -94 + g * 0.9], [-18, -97 + g * 0.3], [-10, -98, 1]]), true, 5);
  if (e.gape > 0.1) P.part(cr(T([[-14, -104, 1], [-26, -102], [-34, -100 + g * 0.4], [-28, -95 + g * 0.8], [-14, -98 + g * 0.2]]), true, 4), { tone: () => 1, layers: [hatch(0, 1.5, 1.2, 0.1)], fill: '#5b1a1a', halo: 0, outline: 0.8, seed: 356, wash: [WASH.cap, 0.45] });
  P.part(lo, { tone: () => 0.55, layers: [hatch(-30, 1.2, 1.0, 0.1)], fill: '#cdbd8c', halo: 1, outline: 1.0, seed: 352, wash: [WASH.glow2, 0.5] });
  P.part(up, { tone: () => 0.8, layers: [hatch(-30, 1.2, 1.1, 0.1)], fill: '#3a352e', halo: 1, outline: 1.0, seed: 353, wash: [WASH.sky, 0.2] });
  const mc = T([[-10, -100]])[0];
  P.line(cr([mc, [mc[0] + 3, mc[1] + e.corner * 1.6 - 0.8], [mc[0] + 6, mc[1] + e.corner * 3.2 - 2.4]], false, 4), 0.9, 0.95);
  const ex = T([[-2, -111]])[0], ey = ex[1];
  const R = e.lid < 0 ? 5 : 4.1;
  P.raw('<circle cx="' + f1(ex[0]) + '" cy="' + f1(ey) + '" r="' + R + '" fill="#f1e19a" stroke="' + ink + '" stroke-width=".8"/><circle cx="' + f1(ex[0] - 0.6) + '" cy="' + f1(ey + 0.2) + '" r="' + (e.lid < 0 ? 1.6 : 2.2) + '" fill="' + ink + '"/><circle cx="' + f1(ex[0] - 1.3) + '" cy="' + f1(ey - 0.8) + '" r=".65" fill="' + CARD + '"/>');
  if (e.lid > 0) P.raw('<clipPath id="cl"><circle cx="' + f1(ex[0]) + '" cy="' + f1(ey) + '" r="' + R + '"/></clipPath><g clip-path="url(#cl)"><path d="M' + f1(ex[0] - R - 1) + ' ' + f1(ey - R - 1) + 'H' + f1(ex[0] + R + 1) + 'V' + f1(ey - R + 2 * R * e.lid) + 'Q' + f1(ex[0]) + ' ' + f1(ey - R + 2 * R * e.lid + 2) + ' ' + f1(ex[0] - R - 1) + ' ' + f1(ey - R + 2 * R * e.lid) + 'Z" fill="#c9cabf" stroke="' + ink + '" stroke-width=".8"/></g>');
  const [bIn, bOut] = e.brow;
  P.line(cr([[ex[0] - 6, ey - 6 + bIn], [ex[0], ey - 7.2 + (bIn + bOut) / 2], [ex[0] + 6, ey - 6 + bOut]], false, 4), 1.5, 1);
  P.line(cr([[ex[0] - 6, ey - 5.2 + bIn], [ex[0], ey - 6.2 + (bIn + bOut) / 2]], false, 4), 0.5, 0.8);
  // crest tuft
  P.line(cr(T([[4, -124], [10, -134], [18, -134]]), false, 4), 1.0, 1);
}

// figure = body + head; both come back as plates so the bake can place them separately or together
export function crow(expr = 'normal', part = 'all') {
  const P = new Plate(21); const out = [];
  if (part !== 'head') crowBody(P);
  if (part !== 'body') crowHead(P, expr);
  return { frame: CROW_FRAME, neck: CROW_NECK, plate: P, svg: (scale = 1, o = {}) => P.svg(CROW_FRAME, { scale, ...o }) };
}
export function cuckoo(expr = 'normal', part = 'all') {
  const P = new Plate(22);
  if (part !== 'head') cuckooBody(P);
  if (part !== 'body') cuckooHead(P, expr);
  return { frame: CUCKOO_FRAME, neck: CK_NECK, plate: P, svg: (scale = 1, o = {}) => P.svg(CUCKOO_FRAME, { scale, ...o }) };
}
