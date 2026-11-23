// Chapter 11 parlour in Strasbourg, 1605: a panelled room with plank floor seen head-on from a raised eye. A writing desk with one candle is the key light; its light ends at the middle of the room.
// In the far right corner a fir stands in a square wooden frame, a dark mass outside the light: its boughs carry nothing the eye can make out (the script reveals them in a lit square, tree-light in lit.mjs).
// No candle on the tree, no figure, no window.
import { clamp, sstep, f1, cr, vnoise, rng, fanLines, ink } from './lib.mjs';
import { Plate, WASH, limb } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow, candle } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { GREEN, STONE, view } from './scenery.mjs';

const Z = 4.4, CEIL = 2.6;
const DESIGN = {
  portrait: { m: 266, half: 2.7, desk: [-0.3, 0.7, 3.6], candleX: 0.1, tree: [2.0, 3.9, 0.97], apple: [1.2, 4.05], star: [0.45, 3.3], bw: 60, reach: 74, side: true, s: 0.62 },
  landscape: { m: 217, half: 2.7, desk: [-2.5, -1.1, 3.6], candleX: -1.6, tree: [0.8, 4.2, 0.96], apple: [-0.5, 4.05], star: [-1.85, 3.3], bw: 58, reach: 62, side: true, s: 0.8 },
};

/** The fir in its own units: base centre at (0, 0), y up is negative. Tiers of drooping boughs, each a tapering limb; the lit square of the script redraws the same boughs. */
export const TREE = { H: 156, W: 112 };
export function boughs() {
  const r = rng(11), out = [], N = 8;
  for (let k = 0; k < N; k++) {
    const f = k / (N - 1), y = -16 - f * (TREE.H - 36), L = (TREE.W / 2) * (1 - 0.86 * f) + 4;
    for (const s of [-1, 1]) for (let j = 0; j < 2; j++) {
      const l = L * (j ? 0.7 : 1) * (0.92 + 0.16 * r()), yy = y + j * 10 + (r() - 0.5) * 4, droop = l * (0.2 + 0.12 * r());
      out.push({ s, y0: yy, l, droop, w: 11 - f * 6, tier: k, j, seed: 100 + out.length });
    }
  }
  return out;
}
const boughPath = (b, x, y, sc) => limb([[x + b.s * 2 * sc, y + b.y0 * sc], [x + b.s * b.l * 0.5 * sc, y + (b.y0 + b.droop * 0.25) * sc], [x + b.s * b.l * sc, y + (b.y0 + b.droop) * sc]], [b.w * sc, b.w * 0.7 * sc, 1.2], 8);
/** Draws the fir with its base centre at (x, y), scaled by sc. lit: tone of the boughs (a function of the point) or null for the dark mass; clip: keep only boughs of the tiers <= maxTier. */
export function drawTree(P, x, y, sc, { tone, maxTier = 99, trunk = true, wash = 0.75, seed = 1 }) {
  const top = TREE.H * sc;
  if (trunk) P.part([[x - 3.4 * sc, y, 1], [x + 3.4 * sc, y, 1], [x + 1.2 * sc, y - top, 1], [x - 1.2 * sc, y - top, 1]], { tone: (px) => clamp(tone(px, y - 20 * sc) * 0.9 + 0.1), layers: [hatch(90, 1.5, 1.0, 0.08, 1.6)], seed: seed + 1, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.7] });
  const list = boughs().filter((b) => b.tier <= maxTier).sort((a, b) => a.tier - b.tier || a.j - b.j);
  for (const b of list) {
    const o = boughPath(b, x, y, sc);
    P.part(o.outline, { tone: (px, py) => clamp(tone(px, py)), layers: [hatch(b.s < 0 ? 18 : -18, 1.7 * Math.max(0.7, sc), 1.0, 0.1, 1.8), hatch(92, 2.6, 0.8, 0.5)], seed: seed + b.seed, fill: CARD, halo: 0.5, outline: 1.0, wash: [GREEN, wash] });
    const rr = rng(b.seed);
    for (let i = 0; i < 9; i++) { const t = 0.15 + 0.8 * rr(), c = o.center[Math.min(o.center.length - 1, Math.round(t * (o.center.length - 1)))], d = (rr() < 0.5 ? -1 : 1) * (o.wAt(t) / 2 + 0.5); P.line([[c[0], c[1] + d * 0.4], [c[0] + b.s * 4 * sc, c[1] + d + 2 * sc]], 0.5, 0.75); }
  }
  const tip = [x, y - top];
  P.part([[tip[0] - 4 * sc, tip[1] + 16 * sc, 1], [tip[0], tip[1] - 6 * sc, 1], [tip[0] + 4 * sc, tip[1] + 16 * sc, 1]], { tone: (px, py) => clamp(tone(px, py)), layers: [hatch(88, 1.6, 1.0, 0.1, 1.6)], seed: seed + 9, fill: CARD, halo: 0.4, outline: 1.0, wash: [GREEN, wash] });
}

export function parlour(orientation = 'portrait') {
  const L = LAYOUTS['ch11-parlour'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr, ray, quad } = view(L, D.m);
  const P = new Plate(61);
  const fx = (X, z = Z) => vx + (X * D.m) / z, fy = (Y, z = Z) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = Z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const [da, db, dz] = D.desk, base = fy(0), ceilY = fy(CEIL), topY = fy(0.8, dz), candleX = fx(D.candleX, dz);
  const flame = [candleX, topY - 26 * (D.m / 266)];
  const [tX, tZ, tShade] = D.tree, tree = [fx(tX, tZ), fy(0, tZ)];
  const tone = (x, y) => {
    const d = Math.hypot((x - flame[0]) * 0.95, y - flame[1]), light = 1 - sstep(D.reach * 0.35, D.reach * 1.7, d) * 0.9;
    const vig = sstep(portrait ? 190 : 330, portrait ? 520 : 680, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 380 : 140)) * 0.8)) * 0.3;
    return clamp(0.9 - 0.78 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 15) - 0.5));
  };
  // ---------------------------------------------------------------- back wall: panelling in upright boards with a dado rail
  P.part(wall(-D.half, D.half, 0, CEIL), { tone: (x, y) => Math.min(0.88, clamp(tone(x, y) * 0.85 + 0.12)), layers: [hatch(90, 2.1, 1.1, 0.06, 2), hatch(14, 3.2, 0.8, 0.5)], seed: 2101, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.5] });
  for (let X = -D.half + 0.28; X < D.half - 0.1; X += 0.28) P.line([[fx(X), fy(0)], [fx(X), fy(CEIL)]], 0.6, 0.7);
  P.part(wall(-D.half, D.half, 0.9, 1.02), { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.2), layers: [hatch(0, 1.5, 1.1, 0.08, 1.8)], seed: 2102, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.65] });
  // ---------------------------------------------------------------- plank floor
  floor(P, { W, H, hy: base, vp: L.vp, bw: D.bw, tone, seed: 2150, wash: [WASH.wood, 0.4], joint: { min: 0.5, spread: 0.7 }, grain: 0.7, grid: 1.0, shadowLo: 0.38, cols: Math.ceil((W * hs) / ((base - vy) * D.bw)) + 10 });
  // ---------------------------------------------------------------- ceiling and side walls
  const cL = pr(-D.half, CEIL, Z), cR = pr(D.half, CEIL, Z);
  const ceil = quad([cL, cR, ray(cR, W + 30), [W + 30, -30], [-30, -30], ray(cL, -30)]);
  const joists = fanLines([vx, vy], Array.from({ length: 44 }, (_, i) => vx + (i - 22) * 64), vy - 200, ceilY, -40);
  P.part(ceil, { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.4), layers: [hatch(0, 3.6, 1.0, 0.1, 3.2), { lines: joists, w: 1.0, lo: 0.2, step: 3.4 }], seed: 2160, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.5] });
  for (const z of [1.2, 1.8, 2.4, 3.0]) { const a = pr(-D.half, CEIL, z), b = pr(D.half, CEIL, z), c = pr(-D.half, CEIL - 0.3, z), d = pr(D.half, CEIL - 0.3, z);
    P.part(quad([a, b, d, c]), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.3), layers: [hatch(0, 1.6, 1.2, 0.06, 1.8), hatch(80, 2.6, 0.8, 0.5)], seed: 2162 + Math.round(z * 10), fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.78] }); }
  for (const sg of [-1, 1]) { const X = sg * D.half, e = sg < 0 ? -30 : W + 30;
    P.part(quad([pr(X, CEIL, Z), pr(X, 0, Z), ray(pr(X, 0, Z), e), ray(pr(X, CEIL, Z), e)]), { tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.9 + 0.2)), layers: [hatch(sg < 0 ? 12 : -12, 3.4, 1.0, 0.1, 3.2)], seed: 2170 + sg, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.5] }); }
  // ---------------------------------------------------------------- the fir in its square frame, far right corner: a dark mass
  { const sc = tShade * 0 + D.s, fw = 0.78;
    const corners = [[tX - fw / 2, tZ - fw / 2], [tX + fw / 2, tZ - fw / 2], [tX + fw / 2, tZ + fw / 2], [tX - fw / 2, tZ + fw / 2]].map(([X, z]) => pr(X, 0, z));
    const rail = (i) => { const a = corners[i], b = corners[(i + 1) % 4], hh = 0.1 * D.m / tZ; return [[a[0], a[1] - hh, 1], [b[0], b[1] - hh, 1], [b[0], b[1], 1], [a[0], a[1], 1]]; };
    for (const i of [0, 1, 3, 2]) P.part(rail(i), { tone: () => 0.7, layers: [hatch(0, 1.5, 1.0, 0.08, 1.6)], seed: 2180 + i, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.6] });
    drawTree(P, tree[0], tree[1], sc, { tone: (x, y) => clamp(0.9 - 0.08 * (vnoise(x * 0.1, y * 0.1, 3) - 0.5)), wash: 0.8, seed: 2200 }); }
  // ---------------------------------------------------------------- the writing desk with the one candle
  { const w = D.m / dz, tl = [fx(da, dz), topY], tr = [fx(db, dz), topY], dd = 0.55, zf = dz - dd, bl = [fx(da, zf), fy(0.8, zf)], br = [fx(db, zf), fy(0.8, zf)];
    const lit = (x, y) => clamp(tone(x, y) * 0.6 + 0.1);
    for (const [X, z] of [[da + 0.05, dz], [db - 0.05, dz], [da + 0.08, zf + 0.05], [db - 0.08, zf + 0.05]]) P.part(box(fx(X, z) - 2.4, fy(0.8, z), 4.8, fy(0, z) - fy(0.8, z)), { tone: lit, layers: [hatch(90, 1.5, 1.0, 0.08, 1.6)], seed: 2210 + Math.round(X * 10 + z * 3), fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
    P.part([[tl[0], tl[1], 1], [tr[0], tr[1], 1], [br[0], br[1], 1], [bl[0], bl[1], 1]], { tone: (x, y) => clamp(0.18 + 0.4 * sstep(D.reach * 0.2, D.reach * 1.2, Math.hypot(x - flame[0], y - flame[1]))), layers: [hatch(0, 1.5, 1.0, 0.06, 1.8), hatch(8, 3, 0.7, 0.5)], seed: 2214, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood, 0.5] });
    P.part(wall(da, db, 0.7, 0.8, zf), { tone: lit, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2215, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.7] });
    P.part(wall(da + 0.04, db - 0.04, 0.5, 0.7, zf), { tone: lit, layers: [hatch(90, 1.5, 1.0, 0.08, 1.6)], seed: 2216, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.6] });
    for (const t of [0.3, 0.7]) { const kx = fx(da + (db - da) * t, zf), ky = fy(0.6, zf); P.raw('<circle cx="' + f1(kx) + '" cy="' + f1(ky) + '" r="1.6" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".5"/>'); P.line([[fx(da + (db - da) * (t - 0.17), zf), fy(0.6, zf) + 6], [fx(da + (db - da) * (t + 0.17), zf), fy(0.6, zf) + 6]], 0.4, 0.5); }
    const s = D.m / 266, cb = [candleX, topY - 2];
    P.part(cr([[cb[0] - 9 * s, cb[1], 1], [cb[0] - 6 * s, cb[1] - 3 * s], [cb[0] + 6 * s, cb[1] - 3 * s], [cb[0] + 9 * s, cb[1], 1], [cb[0], cb[1] + 2 * s]], true, 4), { tone: () => 0.3, layers: [hatch(70, 1.2, 0.9, 0.1, 1.4)], seed: 2217, fill: '#e9d9a4', halo: 0, outline: 0.8, wash: [WASH.brass, 0.85] });
    candle(P, cb[0], cb[1] - 3 * s, 15 * s, 5 * s, 2218, 11 * s);
    var deskRect = [bl[0], tl[1], br[0] - bl[0], bl[1] - tl[1]]; }
  glow(P, flame[0], flame[1] + 6, portrait ? 66 : 56, portrait ? 56 : 46, 0.9);
  const ag = [fx(D.apple[0], D.apple[1]), fy(0, D.apple[1])], sc0 = [fx(D.star[0], D.star[1]), fy(0.8, D.star[1])];
  const apple = [ag[0] - 10, ag[1] - 19, 20, 19], star = [sc0[0] - 16, sc0[1] - 8, 32, 16];
  const layers = { apple: { at: [ag[0] - 11, ag[1] - 22], width: 22 }, 'paper-star': { at: [sc0[0] - 16, sc0[1] - 9], width: 32 } };
  const candleRect = [flame[0] - 8, flame[1] - 14, 16, 34], treeRect = [tree[0] - (TREE.W / 2) * D.s, tree[1] - TREE.H * D.s, TREE.W * D.s, TREE.H * D.s];
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], flame, tree, treeScale: D.s, layers, keys: { candle: candleRect, tree: treeRect, apple, star, desk: deskRect }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
