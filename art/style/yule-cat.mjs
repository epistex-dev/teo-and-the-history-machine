// Chapter 15 an Icelandic wool workshop at 23:49 in the 19th century: a timber room seen head-on, a plank floor swept with wool dust, dark cross beams with
// skeins of yarn hanging from them - two flanking the beam where Quạ Đồn perches. A hanging lantern lights the knitting table under it, where carded wool is
// piled and Tèo's folded tally sheet with its thirteen ink marks rests. On the left stands the worn spinning wheel with a half-drawn thread, on the right the
// loom with its grey wool cloth. Wool dust rises around the machine's feet. No figure and no animal are drawn here.
import { clamp, sstep, f1, cr, vnoise, rng, fanLines, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow, flame } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { STONE, view } from './scenery.mjs';

const WOOL = '#f3ead0', WOOL2 = '#e9e2cc', TWINE = '#cdbd8c', CLOTH = '#c9cabf', LOOMD = '#4d3a22';
const Z = 3.2;
const DESIGN = {
  portrait: { m: 243, half: 3.0, ceil: 2.4, table: [-0.55, 0.4], top: 1.3, tn: 0.6, lampX: -0.12, lampY: 1.85, lampZ: 1.4, beamNear: 1.9, beamFar: 4.2, tie: 1.9, tieZ: 1.5, wheelC: -1.5, wheelZ: 2.7, loom: [1.35, 2.55], loomZ: 2.9, cloth: [1.5, 2.45, 0.72, 1.45], skeins: [-1.3, -0.72, 0.55, 1.21], reach: 76, bw: 30, vig: [190, 540, 410], pile: [-0.36, 0.0], sheetX: 0.12 },
  landscape: { m: 250, half: 5.8, ceil: 2.4, table: [-1.5, 0.6], top: 0.85, tn: 0.5, lampX: -1.0, lampY: 1.1, lampZ: 2.9, beamNear: 2.9, beamFar: 4.6, tie: 1.6, tieZ: 2.9, wheelC: -2.4, wheelZ: 2.9, loom: [1.6, 3.2], loomZ: 3.0, cloth: [1.9, 3.0, 0.5, 1.2], skeins: [-2.2, -1.35, 0.3, 2.3, 3.1], reach: 66, bw: 30, vig: [340, 700, 160], pile: [-0.9, -0.35], sheetX: 0.1 },
};

export function yuleCat(orientation = 'portrait') {
  const L = LAYOUTS['ch15-wool-workshop'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr, ray, quad } = view(L, D.m), CEIL = D.ceil, SC = D.m / 356;
  const P = new Plate(72);
  const fx = (X, z = Z) => vx + (X * D.m) / z, fy = (Y, z = Z) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = Z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const [ta0, tb0] = D.table, base = fy(0), ceilY = fy(CEIL), lx = fx(D.lampX, D.lampZ), by = fy(D.lampY, D.lampZ), flameP = [lx, by - 4];
  const tone = (x, y) => {
    const light = pool(x, y, flameP, D.reach, 0.95) + 0.16 * pool(x, y, [lx, by + (portrait ? 120 : 40)], D.reach * 1.5, 0.8);
    const vig = sstep(D.vig[0], D.vig[1], Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - D.vig[2]) * 0.8)) * 0.3;
    return clamp(0.88 - 0.8 * Math.min(1, light) + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 13) - 0.5));
  };
  // ---------------------------------------------------------------- back wall of vertical timber planks
  P.part(wall(-D.half, D.half, 0, CEIL), { tone: (x, y) => Math.min(0.92, clamp(tone(x, y) * 0.95 + 0.14)), layers: [hatch(1, 2.4, 1.1, 0.06, 2.2), hatch(78, 3.4, 0.8, 0.5)], seed: 2201, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.5] });
  { const r = rng(9); const pw = portrait ? 34 : 42; for (let x = ((vx % pw) + pw) % pw - pw; x <= W; x += pw) P.line([[x, ceilY], [x + (r() - 0.5) * 3, base]], 0.9, 0.8); }
  { const r = rng(11); for (let i = 0; i < 4; i++) { const x = fx((r() * 2 - 1) * D.half * 0.8), y = fy(0.5 + r() * 1.8), n = 4, pts = [[x, y]]; for (let k = 1; k <= n; k++) pts.push([pts[k - 1][0] + (r() - 0.5) * 6, pts[k - 1][1] + 3 + r() * 4]); P.line(pts, 0.5, 0.65); } }
  // ---------------------------------------------------------------- plank floor swept with wool dust
  floor(P, { W, H, hy: base, vp: L.vp, bw: D.bw, tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.9 + 0.14 + 0.16 * (vnoise(x * 0.03, y * 0.16, 9) - 0.5))), seed: 2250, wash: [WASH.wood, 0.5], joint: { min: 0.5, spread: 0.7 }, grain: 0.7, grid: 1.0, shadowLo: 0.38, cols: Math.ceil((W * hs) / ((base - vy) * D.bw)) + 10 });
  // ---------------------------------------------------------------- smoke-dark plank ceiling on the cross beams
  const cLeft = pr(-D.half, CEIL, Z), cRight = pr(D.half, CEIL, Z);
  const ceil = quad([cLeft, cRight, ray(cRight, W + 30), [W + 30, -30], [-30, -30], ray(cLeft, -30)]);
  const pw = portrait ? 0.42 : 0.55, gapXs = [];
  for (let X = -6.4; X <= 6.4; X += pw) gapXs.push(fx(X));
  const plankAt = (x, y) => { const t = (y - vy) / (ceilY - vy), b0 = vx + (gapXs[0] - vx) * t; return Math.floor((x - b0) / ((gapXs[1] - gapXs[0]) * t)); };
  P.part(ceil, { tone: (x, y) => { const i = Math.max(0, plankAt(x, y)); return clamp(0.78 + 0.14 * ((i * 137) % 7) / 7 + 0.18 * sstep(vy - 40, vy - 330, y) - 0.5 * sstep(vx - 60, vx + 200, x) - 0.3 * sstep(vy - 160, vy, y) + 0.3 * (vnoise(x * 0.012, y * 0.02, 5) - 0.5) - 0.25 * pool(x, y, flameP, 120, 1)); }, layers: [hatch(3, 2.4, 0.62, 0.6, 2.0, { wob: 0.22 }), { lines: fanLines([vx, vy], gapXs, vy - 300, ceilY, -40), w: 0.9, lo: 0.42, step: 2.2, wob: 0.15 }], seed: 2200, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.55] });
  const beam = (zb, hB, seed) => { const yT = fy(CEIL, zb), yB = yT + (hB * D.m) / zb, x0 = fx(-D.half, zb), x1 = fx(D.half, zb);
    P.part([[x0, yT, 1], [x1, yT, 1], [x1, yB, 1], [x0, yB, 1]], { tone: (x, y) => clamp(0.4 + 0.3 * sstep(yT, yB, y) + 0.16 * sstep(vx - 40, vx + 210, x) - 0.14 * pool(x, y, flameP, D.reach * 1.6, 1) + 0.12 * (vnoise(x * 0.045, y * 0.09, 6) - 0.5)), layers: [hatch(0, 2.6, 1.05, 0.08, 2.4)], seed, fill: CARD, halo: 0.8, outline: 1.1, wash: [WASH.wood2, 0.62] });
    P.line([[x0, yB], [x1, yB]], 1.5, 0.9); return yB; };
  // ---------------------------------------------------------------- the worn spinning wheel, standing still, thread half drawn
  { const z = D.wheelZ, cx = fx(D.wheelC, z), cy = fy(1.05, z), r = (0.5 * D.m) / z;
    const pts = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1]); }
    P.part(cr(pts, true, 4), { tone: (x) => clamp(0.5 - 0.14 * pool(x, cy, flameP, D.reach, 1)), layers: [hatch(45, 1.7, 1.0, 0.1, 2.0)], seed: 2210, fill: CARD, halo: 0.6, outline: 1.3, wash: [WASH.wood2, 0.7] });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P.line([[cx, cy], [cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94]], 0.9, 0.8); }
    P.raw('<ellipse cx="' + f1(cx) + '" cy="' + f1(cy) + '" rx="' + f1(r * 0.13) + '" ry="' + f1(r * 0.13) + '" fill="' + LOOMD + '" stroke="' + ink + '" stroke-width=".8"/>');
    for (const s of [-1, 1]) P.part(box(cx + s * r * 0.42 - 2.4, cy - r * 0.55, 4.8, fy(0, z) - cy + r * 0.55), { tone: () => 0.52, layers: [hatch(90, 1.5, 1.0, 0.08, 1.6)], seed: 2211 + s, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
    P.part(box(cx - r * 0.62, fy(0, z) - 8, r * 1.24, 8), { tone: () => 0.46, layers: [hatch(0, 1.5, 1.0, 0.08, 1.6)], seed: 2214, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.75] });
    P.part(box(cx + r * 0.72, cy - r * 0.34, r * 0.3, r * 0.16), { tone: () => 0.42, layers: [hatch(0, 1.3, 0.9, 0.08, 1.5)], seed: 2215, fill: CARD, halo: 0, outline: 0.9, wash: [WASH.brass, 0.5] });
    const th = [[cx + r * 0.85, cy - r * 0.24], [cx + r * 1.15, cy - r * 0.5 + 6], [cx + r * 1.5, cy - r * 0.62], [fx((ta0 + tb0) / 2 - 0.3, z + 0.15), fy(D.top, z + 0.15) + 6]];
    P.line(th, 0.65, 0.6); }
  // ---------------------------------------------------------------- the loom with its grey wool cloth
  { const z = D.loomZ, [la, lb] = D.loom, [ca, cb, cy0, cy1] = D.cloth;
    for (const X of [la, lb]) P.part(box(fx(X, z) - 3.4, fy(portrait ? 2.05 : 2.0, z), 6.8, fy(0, z) - fy(portrait ? 2.05 : 2.0, z)), { tone: (x) => clamp(0.46 - 0.1 * pool(x, flameP[1], flameP, D.reach, 1)), layers: [hatch(90, 1.6, 1.05, 0.08, 1.8)], seed: 2220 + Math.round(X * 10), fill: CARD, halo: 0, outline: 1.2, wash: [LOOMD, 0.55] });
    P.part(box(fx(la, z) - 5, fy(portrait ? 2.05 : 2.0, z) - 2, fx(lb, z) - fx(la, z) + 10, 9), { tone: () => 0.4, layers: [hatch(0, 1.5, 1.0, 0.08, 1.6)], seed: 2222, fill: CARD, halo: 0, outline: 1.1, wash: [LOOMD, 0.6] });
    const ct = fy(cy1, z), cbm = fy(cy0, z);
    P.part(box(fx(ca, z) - 3, ct - 5, fx(cb, z) - fx(ca, z) + 6, 7), { tone: () => 0.44, layers: [hatch(0, 1.4, 1.0, 0.08, 1.5)], seed: 2223, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.6] });
    P.part(wall(ca, cb, cy0, cy1, z), { tone: (x, y) => clamp(0.62 + 0.12 * sstep(ct, cbm, y) - 0.12 * pool(x, y, flameP, D.reach * 1.4, 1) + 0.06 * (vnoise(x * 0.05, y * 0.09, 6) - 0.5)), layers: [hatch(0, 2.0, 0.8, 0.14, 2.2), hatch(90, 2.6, 0.7, 0.5, 2.6)], seed: 2224, fill: CLOTH, halo: 0, outline: 1.1, wash: [STONE, 0.35] });
    for (let x = fx(ca, z) + 2; x < fx(cb, z) - 1; x += 4) P.line([[x, fy(portrait ? 2.05 : 2.0, z) + 7], [x + (vnoise(x, 1, 4) - 0.5) * 2, ct - 5]], 0.45, 0.7);
    P.part(box(fx(la + 0.1, z) - 2, cbm + 4, fx(cb - 0.1, z) - fx(la + 0.1, z) + 4, 6), { tone: () => 0.42, layers: [hatch(0, 1.4, 0.9, 0.08, 1.5)], seed: 2225, fill: CARD, halo: 0, outline: 1.0, wash: [LOOMD, 0.5] }); }
  // ---------------------------------------------------------------- the knitting table under the lantern: wool pile and the tally sheet
  { const tz = Z - 0.3, zn = Z - D.tn, [ta, tb] = D.table, top = D.top;
    for (const [X, z] of [[ta + 0.05, tz], [tb - 0.05, tz], [ta + 0.08, zn + 0.05], [tb - 0.08, zn + 0.05]]) P.part(box(fx(X, z) - 2.2, fy(top, z), 4.4, fy(0, z) - fy(top, z)), { tone: () => 0.5, layers: [hatch(90, 1.5, 1.0, 0.08, 1.6)], seed: 2230 + Math.round(X * 10 + z * 3), fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
    { const sh = [[fx(ta + 0.05, tz - 0.05), fy(0.45, tz - 0.05)], [fx(tb - 0.05, tz - 0.05), fy(0.45, tz - 0.05)], [fx(tb - 0.05, zn + 0.05), fy(0.45, zn + 0.05)], [fx(ta + 0.05, zn + 0.05), fy(0.45, zn + 0.05)]]; P.part(sh, { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.1), layers: [hatch(0, 1.6, 1.0, 0.06, 1.8)], seed: 2231, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood, 0.55] }); }
    P.part([[fx(ta, tz), fy(top, tz)], [fx(tb, tz), fy(top, tz)], [fx(tb, zn), fy(top, zn)], [fx(ta, zn), fy(top, zn)]], { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.12), layers: [hatch(0, 1.6, 1.1, 0.06, 1.8), hatch(8, 3, 0.7, 0.5)], seed: 2232, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood, 0.55] });
    P.part(wall(ta, tb, top - 0.07, top, zn), { tone: () => 0.5, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2233, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.7] });
    const r = rng(41); const [pa, pb] = D.pile, py = fy(top, Z - 0.4);
    for (let i = 0; i < 5; i++) { const bx = fx(pa + (pb - pa) * (0.12 + 0.19 * i), Z - 0.4), rr = (portrait ? 9 : 12) * SC * 1.5 + r() * 3, bby = py - 4 - r() * 7;
      P.raw('<ellipse cx="' + f1(bx) + '" cy="' + f1(bby) + '" rx="' + f1(rr) + '" ry="' + f1(rr * 0.62) + '" fill="' + (i % 2 ? WOOL : WOOL2) + '" stroke="' + ink + '" stroke-width=".8"/>'); }
    for (let k = 0; k < 6; k++) { const fxr = fx(pa + (pb - pa) * r(), Z - 0.4); P.line([[fxr, py - 3 - r() * 9], [fxr + (r() - 0.5) * 10, py - 6 - r() * 9]], 0.5, 0.7); }
    const szh = Z - 0.4, sx = fx(D.sheetX, szh), sy = fy(top, szh);
    P.part([[sx - 21, sy - 9], [sx + 21, sy - 9], [sx + 21, sy + 9], [sx - 21, sy + 9]], { tone: () => 0.12, layers: [], seed: 2234, fill: CARD, halo: 0.5, outline: 0.9, wash: null });
    P.line([[sx - 14, sy - 3], [sx + 15, sy - 4]], 0.4, 0.5);
    for (let k = 0; k < 13; k++) P.line([[sx - 15 + k * 2.45, sy - 1], [sx - 15 + k * 2.45, sy + 4]], 0.55, 0.9); }
  const nearB = beam(D.beamNear, portrait ? 0.14 : 0.13, 2202);
  beam(D.beamFar, portrait ? 0.12 : 0.13, 2203);
  const yT = fy(D.tie, D.tieZ), yB = yT + (0.13 * D.m) / D.tieZ, x0 = fx(-D.half, D.tieZ), x1 = fx(D.half, D.tieZ);
  P.part([[x0, yT, 1], [x1, yT, 1], [x1, yB, 1], [x0, yB, 1]], { tone: (x, y) => clamp(0.4 + 0.3 * sstep(yT, yB, y) - 0.14 * pool(x, y, flameP, D.reach * 1.6, 1) + 0.12 * (vnoise(x * 0.045, y * 0.09, 6) - 0.5)), layers: [hatch(0, 2.6, 1.05, 0.08, 2.4)], seed: 2204, fill: CARD, halo: 0.8, outline: 1.1, wash: [WASH.wood2, 0.62] });
  P.line([[x0, yB], [x1, yB]], 1.5, 0.9); const hangB = yB;
  // ---------------------------------------------------------------- skeins of yarn hanging from the beam Quạ Đồn perches on
  { const r = rng(23);
    const skein = (X) => { const x = fx(X, D.beamNear), w = (portrait ? 10 : 12) * SC * 1.4, h = w * 1.7;
      P.line([[x, hangB], [x, hangB + 4]], 0.8, 0.85);
      P.raw('<ellipse cx="' + f1(x) + '" cy="' + f1(hangB + 4 + h / 2) + '" rx="' + f1(w) + '" ry="' + f1(h / 2) + '" fill="' + WOOL + '" stroke="' + ink + '" stroke-width="1.4"/>');
      P.raw('<ellipse cx="' + f1(x) + '" cy="' + f1(hangB + 4 + h / 2) + '" rx="' + f1(w * 0.62) + '" ry="' + f1(h * 0.3) + '" fill="none" stroke="' + ink + '" stroke-width=".7"/>');
      for (let k = 1; k <= 3; k++) P.line([[x - w + k * (2 * w) / 4, hangB + 6 + r() * 2], [x - w * 0.5 + k * (w) / 2.6, hangB + 2 + h - r() * 2]], 0.6, 0.75); }
    for (const X of D.skeins) skein(X); }
  // ---------------------------------------------------------------- the hanging lantern over the table
  { P.line([[lx, portrait ? nearB : hangB], [lx, by - 22]], 0.9, 0.85);
    P.part(box(lx - 8, by - 22, 16, 5), { tone: () => 0.35, layers: [hatch(0, 1.2, 0.9, 0.08, 1.4)], seed: 2240, fill: CARD, halo: 0, outline: 0.9, wash: [WASH.brass, 0.7] });
    P.part(box(lx - 12, by - 17, 24, 27), { tone: (x) => clamp(0.1 + 0.1 * sstep(lx - 12, lx + 12, x)), layers: [], seed: 2241, fill: CARD, halo: 1.2, outline: 1.0, wash: null });
    P.line([[lx - 12, by - 17], [lx + 12, by - 17]], 0.8, 0.9); P.line([[lx - 12, by + 10], [lx + 12, by + 10]], 0.8, 0.9);
    P.line([[lx - 4, by - 14], [lx - 4, by + 8]], 0.6, 0.6); P.line([[lx + 5, by - 14], [lx + 5, by + 8]], 0.6, 0.6);
    flame(P, lx, by - 2, portrait ? 15 : 13, 2242);
    P.part(box(lx - 10, by + 10, 20, 6), { tone: () => 0.3, layers: [hatch(0, 1.2, 0.9, 0.08, 1.4)], seed: 2243, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.brass, 0.75] }); }
  // ---------------------------------------------------------------- wool dust rising around the machine's feet
  { const r = rng(61); const [mx, my] = portrait ? [186, 622] : [540, 274];
    for (let k = 0; k < 16; k++) { const a = r() * Math.PI * 2, d = 10 + r() * 60, x = mx + Math.cos(a) * d * 1.4, y = my - r() * 70;
      P.raw('<ellipse cx="' + f1(x) + '" cy="' + f1(Math.min(y, my - 6)) + '" rx="' + f1(1 + r() * 1.6) + '" ry="' + f1(0.7 + r() * 1.1) + '" fill="' + WOOL + '" fill-opacity="' + (0.35 + r() * 0.35).toFixed(2) + '" stroke="none"/>'); }
    for (let k = 0; k < 6; k++) { const x = mx + (r() - 0.5) * 150, y = my - 40 - r() * 120; P.line([[x, y], [x + (r() - 0.5) * 14, y - 8 - r() * 12]], 0.45, 0.5); } }
  glow(P, lx, by, portrait ? 80 : 66, portrait ? 66 : 56, 0.9);
  const lampRect = [lx - 12, by - 12, 24, 36], pileKey = [fx(D.pile[0], Z - 0.4), fy(D.top, Z - 0.4) - 16, fx(D.pile[1], Z - 0.4) - fx(D.pile[0], Z - 0.4), 22];
  const szh2 = Z - 0.4, pc = [fx(D.sheetX, szh2), fy(D.top, szh2)], sheet = [pc[0] - 21, pc[1] - 9, 42, 18];
  const dark = portrait ? [356, 330, 26, 26] : [555, 140, 40, 50]; // landscape art is cropped at the sides, keep the probe near the loom
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp: [lx, by], layers: {}, keys: { lamp: lampRect, wool: pileKey, sheet, dark }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}