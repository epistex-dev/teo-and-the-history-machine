// Chapter 16 a Troy print shop on the night of 23 December 1823: a plastered office seen head-on, an ink-stained plank floor, a plank ceiling on cross beams.
// A long composing stand runs behind the machine: two rows of lead-type cases with small empty compartments, an oil lamp with a glass shade lit at the right,
// a stack of unread newspapers and a misprint sheet turned over for pencil sketches of a saint with a sled, a pencil beside it. A hand press stands idle at the
// right with its lever down. An ink blot spreads at the stand's far end, outside the lamp glow. No figure, no animal, no text.
import { clamp, sstep, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { view } from './scenery.mjs';

const Z = 3.2;
const DESIGN = {
  portrait: { m: 243, half: 3.0, ceil: 2.4, table: [-1.55, 1.15], top: 1.2, zn: 2.7, lampX: -0.62, lampY: 1.5, rows: [1.45, 1.75], pressX: [1.35, 1.85], pressZ: 3.0, sheetX: -0.2, stackX: 0.3, blotX: 0.62, reach: 78, bw: 30, vig: [190, 540, 410], beam: 1.9 },
  landscape: { m: 250, half: 5.8, ceil: 2.4, table: [-3.05, -0.05], top: 0.85, zn: 2.7, lampX: -1.5, lampY: 1.12, rows: [1.25, 1.55], pressX: [2.05, 3.55], pressZ: 3.4, sheetX: -1.9, stackX: -2.62, blotX: -0.5, reach: 66, bw: 30, vig: [340, 700, 160], beam: 2.9 },
};

export function santaNy(orientation = 'portrait') {
  const sw = orientation === 'portrait' ? 32 : 44;
  const L = LAYOUTS['ch16-print-shop'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr, ray, quad } = view(L, D.m), CEIL = D.ceil, SC = D.m / 356;
  const P = new Plate(72);
  const fx = (X, z = Z) => vx + (X * D.m) / z, fy = (Y, z = Z) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = Z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const [ta0, tb0] = D.table, base = fy(D.top), tn = fy(D.top, D.zn), ceilY = fy(CEIL), lx = fx(D.lampX, Z), flameP = [lx, fy(D.lampY, Z)], zc = D.pressZ;
  const tone = (x, y) => {
    const light = pool(x, y, flameP, D.reach, 0.95) + 0.16 * pool(x, y, [lx, flameP[1] + (portrait ? 120 : 40)], D.reach * 1.5, 0.8);
    const vig = sstep(D.vig[0], D.vig[1], Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - D.vig[2]) * 0.8)) * 0.3;
    return clamp(0.88 - 0.8 * Math.min(1, light) + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 13) - 0.5));
  };
  // ---------------------------------------------------------------- back wall of plaster with ink splatters, dark wainscot below
  P.part(wall(-D.half, D.half, 0.55, CEIL), { tone: (x, y) => Math.min(0.92, clamp(tone(x, y) * 0.92 + 0.16)), layers: [hatch(88, 3.2, 0.9, 0.06, 2.4), hatch(12, 3.8, 0.7, 0.5)], seed: 2301, fill: CARD, halo: 0, outline: 1.2, wash: null });
  P.part(wall(-D.half, D.half, 0, 0.55), { tone: (x, y) => Math.min(0.94, clamp(tone(x, y) * 0.9 + 0.3)), layers: [hatch(0, 1.5, 1.0, 0.08, 1.8), hatch(88, 2.8, 0.8, 0.5)], seed: 2302, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.75] });
  P.line([[fx(-D.half, Z), fy(0.55, Z)], [fx(D.half, Z), fy(0.55, Z)]], 1.4, 0.95);
  { const r = rng(13); for (let i = 0; i < 5; i++) { const x = fx((r() * 2 - 1) * D.half * 0.85, Z), y = fy(0.7 + r() * 1.4, Z), s = 1.5 + r() * 2.5, pts = [[x, y, 1], [x + s, y - s * 0.4], [x + s * 1.4, y + s * 0.3], [x + s * 0.5, y + s * 0.8], [x - s * 0.6, y + s * 0.5]]; P.part(cr(pts, true, 3), { tone: () => 0.82, seed: 2303 + i, fill: CARD, halo: 0, outline: 0.8, wash: null }); } }
  // ---------------------------------------------------------------- plank floor with ink stains and a coffee ring by the machine's feet
  floor(P, { W, H, hy: base, vp: L.vp, bw: D.bw, tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.9 + 0.14 + 0.14 * (vnoise(x * 0.03, y * 0.16, 9) - 0.5))), seed: 2350, wash: [WASH.wood, 0.5], joint: { min: 0.5, spread: 0.7 }, grain: 0.7, grid: 1.0, shadowLo: 0.38, cols: Math.ceil((W * hs) / ((base - vy) * D.bw)) + 10 });
  { const r = rng(17); for (let i = 0; i < 6; i++) { const x = fx((r() * 2 - 1) * D.half * 0.7), y = base + (fy(0, Z) - base) * (0.15 + r() * 0.7), rx = 8 + r() * 16, ry = rx * 0.3, pts = []; for (let a = 0; a <= 10; a++) pts.push([x + Math.cos((a / 10) * 2 * Math.PI) * rx, y + Math.sin((a / 10) * 2 * Math.PI) * ry]); P.part(cr(pts, true, 3), { tone: () => 0.86, seed: 2351 + i, fill: CARD, halo: 0, outline: 0.6, wash: null }); } }
  { const cx = portrait ? 252 : 560, cy = portrait ? 590 : 246, rx = portrait ? 11 : 13, ry = portrait ? 3.5 : 4; for (const s of [1, 0.72]) { const pts = []; for (let a = 0; a <= 12; a++) pts.push([cx + Math.cos((a / 12) * 2 * Math.PI) * rx * s, cy + Math.sin((a / 12) * 2 * Math.PI) * ry * s]); P.line(pts, 1.6, 0.75, '#a7692f'); } }
  // ---------------------------------------------------------------- smoke-dark plank ceiling on one cross beam
  const cLeft = pr(-D.half, CEIL, Z), cRight = pr(D.half, CEIL, Z);
  const ceil = quad([cLeft, cRight, ray(cRight, W + 30), [W + 30, -30], [-30, -30], ray(cLeft, -30)]);
  const pw = portrait ? 0.42 : 0.55, gapXs = [];
  for (let X = -6.4; X <= 6.4; X += pw) gapXs.push(fx(X));
  P.part(ceil, { tone: (x, y) => clamp(0.78 + 0.14 * (((Math.abs(Math.round(x / (portrait ? 102 : 96))) * 137) % 7) / 7) + 0.1 * (vnoise(x * 0.05, y * 0.05, 7) - 0.5)), layers: [hatch(0, 1.9, 1.0, 0.06, 2), hatch(74, 2.8, 0.8, 0.5)], seed: 2305, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood, 0.6] });
  { const r = rng(31); for (let i = 1; i < 9; i++) P.line([[gapXs[i] + (r() - 0.5) * 4, ceilY], [gapXs[i] + (r() - 0.5) * 6, -30]], 0.8, 0.85); }
  { const hB = portrait ? 0.13 : 0.14; P.part(quad([[pr(-D.half, D.beam + hB / 2, Z), pr(D.half, D.beam + hB / 2, Z), ray(pr(D.half, D.beam + hB / 2, Z), W + 30), ray(pr(-D.half, D.beam + hB / 2, Z), -30)]]), { tone: () => 0.82, layers: [hatch(0, 1.4, 1.0, 0.08, 1.8)], seed: 2306, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.8] }); P.part(box(-30, fy(D.beam - hB / 2, Z), W + 60, fy(D.beam + hB / 2, Z) - fy(D.beam - hB / 2, Z)), { tone: () => 0.8, layers: [hatch(88, 1.6, 1.0, 0.08, 2)], seed: 2307, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.85] }); }
  // ---------------------------------------------------------------- composing stand: top, legs and two rows of lead-type cases
  P.part([[fx(ta0, Z), base - 1, 1], [fx(tb0, Z), base - 1, 1], [fx(tb0, D.zn), tn, 1], [fx(ta0, D.zn), tn, 1]], { tone: (x) => clamp(0.34 + 0.12 * sstep(fx(ta0, Z), fx(tb0, Z), x)), layers: [hatch(0, 1.3, 1.0, 0.08, 1.7)], seed: 2310, fill: CARD, halo: 0.7, outline: 1.2, wash: [WASH.wood, 0.75] });
  for (const LX of portrait ? [-1.5, -0.9] : [-2.9, -0.3]) { const lx0 = fx(LX, D.zn); P.part(box(lx0 - 2.5, tn, 5, fy(0, D.zn) - tn), { tone: () => 0.5, layers: [hatch(88, 1.5, 1.0, 0.08, 1.8)], seed: 2311, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.8] }); }
  for (let i = 0; i < D.rows.length; i++) {
    const yb = i === 0 ? D.top : D.rows[i - 1], yt = D.rows[i], zb2 = Z - 0.12;
    P.part([[fx(ta0 - 0.08, zb2), fy(yt, zb2), 1], [fx(tb0 + 0.08, zb2), fy(yt, zb2), 1], [fx(tb0 + 0.08, Z), fy(yb, Z), 1], [fx(ta0 - 0.08, Z), fy(yb, Z), 1]], { tone: (x, y) => clamp(0.5 + 0.1 * sstep(fy(yb, Z), fy(yt, zb2), y)), layers: [hatch(0, 1.2, 0.9, 0.08, 1.6)], seed: 2312 + i, fill: CARD, halo: 0.6, outline: 1, wash: [WASH.wood2, 0.7] });
    const a = [fx(ta0, zb2), fy(yt, zb2)], b = [fx(tb0, zb2), fy(yt, zb2)], c = [fx(tb0, Z), fy(yb, Z)], d = [fx(ta0, Z), fy(yb, Z)];
    P.line([[a[0], (a[1] + d[1]) / 2], [b[0], (b[1] + c[1]) / 2]], 0.8, 0.8); P.line([a, b], 0.9, 0.85);
    const r = rng(2313 + i), n = Math.floor((b[0] - a[0]) / 13);
    for (let k = 1; k < n; k++) { const x = a[0] + ((b[0] - a[0]) * k) / n, yt2 = a[1] + (d[1] - a[1]) * (k / n), yb2 = b[1] + (c[1] - b[1]) * (k / n); P.line([[x, yt2], [x, yb2]], 0.7, 0.8); if (r() > 0.7) P.line([[x - 4.5, yt2 + 3], [x - 4.5, yb2 - 3]], 1.6, 0.55); }
  }
  // ---------------------------------------------------------------- oil lamp with a glass shade on the stand
  const ls = SC * (portrait ? 1 : 0.9), lb = base - 1;
  P.part(cr([[lx - 11 * ls, lb, 1], [lx - 11 * ls, lb - 4 * ls], [lx - 8 * ls, lb - 10 * ls], [lx - 4 * ls, lb - 11.5 * ls], [lx + 4 * ls, lb - 11.5 * ls], [lx + 8 * ls, lb - 10 * ls], [lx + 11 * ls, lb - 4 * ls], [lx + 11 * ls, lb]], true, 3), { tone: () => 0.24, layers: [hatch(70, 1.3, 1.0, 0.08, 1.7)], seed: 2315, fill: '#e9d9a4', halo: 0.8, outline: 1.1, wash: [WASH.brass, 0.85] });
  P.part(box(lx - 9 * ls, lb - 48 * ls, 18 * ls, 38 * ls), { tone: () => 0.07, layers: [hatch(88, 3.4, 0.5, 0.03)], seed: 2316, fill: '#fff3b0', halo: 0.6, outline: 0.8, wash: [WASH.glow, 0.35] });
  P.part(box(lx - 5.5 * ls, lb - 52 * ls, 11 * ls, 5 * ls), { tone: () => 0.18, seed: 2317, fill: '#f6ecc0', halo: 0.5, outline: 0.8, wash: [WASH.glow, 0.4] });
  { const f = 15 * ls, y0 = lb - 27 * ls; P.part(cr([[lx - 2.6 * ls, y0, 1], [lx - 3 * ls, y0 - f * 0.28], [lx - 1.8 * ls, y0 - f * 0.62], [lx + 0.3 * ls, y0 - f, 1], [lx + 2.1 * ls, y0 - f * 0.6], [lx + 3 * ls, y0 - f * 0.28]], true, 5), { tone: () => 0.1, layers: [hatch(80, 2.4, 0.7, 0.05)], fill: '#fff3b0', seed: 2318, wash: [WASH.flame, 0.9], halo: 0, outline: 0.8 }); }
  P.line([[lx - 2 * ls, lb - 27 * ls], [lx + 2 * ls, lb - 27 * ls]], 1.4, 0.9);
  // ---------------------------------------------------------------- misprint sheet turned over, with pencil sketches and a pencil
  { const sx = fx(D.sheetX, Z), sy = base - 1.5, x0 = fx(D.sheetX - 0.26, Z + 0.05), x1 = fx(D.sheetX + 0.26, Z + 0.05), x2 = fx(D.sheetX + 0.28, D.zn), x3 = fx(D.sheetX - 0.24, D.zn), y0 = fy(D.top, Z + 0.05), y1 = fy(D.top, D.zn);
    P.part([[x0, y0, 1], [x1, y0, 1], [x2, y1, 1], [x3, y1, 1]], { tone: () => 0.1, seed: 2319, fill: '#efe3c0', halo: 0.8, outline: 0.9, wash: null });
    const r = rng(2321); for (let i = 0; i < 3; i++) { const cx = sx - 13 + i * 13, cy = sy + (r() - 0.5) * 2; P.line([[cx - 3, cy - 1], [cx - 1, cy - 6], [cx + 3, cy - 5]], 0.9, 0.85); P.line([[cx - 4, cy], [cx - 5, cy + 4], [cx - 2, cy + 6], [cx + 3, cy + 5], [cx + 5, cy + 1]], 0.9, 0.8); P.line([[cx - 5, cy + 6], [cx + 5, cy + 6]], 0.8, 0.75); }
    P.line([[sx + 25, sy + 4], [sx + 41, sy + 6]], 2.4, 0.85, '#cfa24a'); P.line([[sx + 41, sy + 6], [sx + 44, sy + 6.6]], 2.4, 0.9); }
  // ---------------------------------------------------------------- stack of unread newspapers
  { const stx = fx(D.stackX, Z); for (let k = 0; k < 4; k++) P.part(box(stx - sw / 2 + k * 1.5, base - 5 - k * 4.5, sw - k * 3, 5), { tone: () => 0.24 + 0.08 * (k % 2), layers: [hatch(0, 2.2, 0.6, 0.1, 2)], seed: 2322 + k, fill: k % 2 ? '#e9e2cc' : '#efe3c0', halo: 0.7, outline: 0.9, wash: null }); }
  // ---------------------------------------------------------------- hand press standing idle, lever down
  { const pa = fx(D.pressX[0] + 0.07, zc), pb = fx(D.pressX[1] - 0.07, zc), ptop = fy(2.3, zc);
    for (const px of [pa, pb]) P.part(box(px - 2.5, ptop, 5, fy(0.1, zc) - ptop), { tone: () => 0.58, layers: [hatch(88, 1.5, 1.0, 0.08, 1.8), hatch(16, 2.4, 0.8, 0.5)], seed: 2326, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.8] });
    P.part(box(pa - 8, ptop - 3, pb - pa + 16, 9), { tone: () => 0.62, layers: [hatch(0, 1.4, 1.0, 0.08, 1.8)], seed: 2327, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.85] });
    const cx = (pa + pb) / 2; P.part(box(cx - 2.5, ptop + 6, 5, 52), { tone: () => 0.55, layers: [hatch(88, 1.4, 1.0, 0.08, 1.8)], seed: 2328, fill: CARD, halo: 0, outline: 1, wash: [WASH.brass, 0.5] });
    for (let i = 0; i < 5; i++) P.line([[cx - 2.5, ptop + 12 + i * 10], [cx + 2.5, ptop + 16 + i * 10]], 1, 0.8);
    const platY = fy(1.5, zc); P.part(box(pa - 6, platY - 7, pb - pa + 12, 7), { tone: () => 0.5, layers: [hatch(0, 1.4, 1.0, 0.08, 1.7)], seed: 2329, fill: CARD, halo: 0.6, outline: 1.2, wash: [WASH.wood, 0.7] });
    P.part(box(pa - 2, platY + 4, pb - pa + 4, 13), { tone: (x, y) => clamp(0.78 + 0.06 * (vnoise(x * 0.08, y * 0.08, 5) - 0.5)), layers: [hatch(0, 1.6, 1.0, 0.08, 1.9)], seed: 2330, fill: CARD, halo: 0, outline: 1.1, wash: null });
    P.part(box(pa - 6, platY + 21, pb - pa + 12, 6), { tone: () => 0.52, layers: [hatch(0, 1.4, 1.0, 0.08, 1.7)], seed: 2331, fill: CARD, halo: 0.6, outline: 1.2, wash: [WASH.wood, 0.75] });
    P.line([[pb + 8, ptop], [pb + 8 + 31, ptop + 38], [pb + 8 + 39, ptop + 60]], 4.5, 0.9); P.line([[pb + 8, ptop], [pb + 8 + 31, ptop + 38], [pb + 8 + 39, ptop + 60]], 4.5, 0.9, WASH.wood2); }
  // ---------------------------------------------------------------- ink blot spreading at the stand's far end
  { const bx = fx(D.blotX, Z - 0.3), by2 = fy(D.top, Z - 0.3), pts = [[bx - 13, by2 + 3, 1], [bx - 6, by2 - 3], [bx, by2 - 4.5, 1], [bx + 7, by2 - 3], [bx + 13, by2 + 2, 1], [bx + 5, by2 + 6], [bx - 5, by2 + 6]]; P.part(cr(pts, true, 4), { tone: () => 0.85, seed: 2332, fill: CARD, halo: 0, outline: 0.8, wash: null }); P.line([[bx + 15, by2 + 4], [bx + 20, by2 + 7]], 2.4, 0.7); }
  // ---------------------------------------------------------------- glow
  glow(P, lx, flameP[1] - 6, portrait ? 46 : 40, portrait ? 38 : 32, 0.9);
  const dark = portrait ? [312, 366, 24, 9] : [636, 101, 40, 9];
  const keys = { lamp: [lx - 10 * ls, lb - 49 * ls, 20 * ls, 40 * ls], sheet: [fx(D.sheetX, Z) - 22, base - 7, 44, 13], stack: [fx(D.stackX, Z) - sw / 2, base - 24, sw, 21], dark };
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp: [lx, flameP[1]], layers: {}, keys, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
