// Chapter 14 an Icelandic farm kitchen late on a December night in the mid-19th century: a small turf-and-stone room seen head-on, a smoke-dark plank ceiling on
// cross beams, a flagstone floor with ash tracked across it. A small window with its shutters ajar, snowy mountains beyond, a low oil lamp lit on the stone sill
// and a plank table under it holding a blank sheet from Oberndorf; a tall shelf dresser on the left wall and pine logs stacked in the dark front corner. The
// hearth on the right is cold: a sooted hood, and a wooden bar laid across the mouth, with a row of crow prints in the ash running from the mouth to the cup
// at the machine's foot. No figure, no animal, no fire in the hearth, no clock.
import { clamp, sstep, f1, cr, vnoise, rng, fanLines, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, view, oilLamp } from './scenery.mjs';
import { crystals } from './night.mjs';

const SOOT = '#3a352e', STRAW = '#e0d2ac', LOG = '#6b3d1a', SNOW = '#f1e6c6';
const Z = 3.2;
const DESIGN = {
  portrait: { m: 243, half: 3.0, ceil: 2.4, win: [-0.45, 0.27], sill: 1.5, head: 2.2, hearth: [1.7, 2.8], hoodB: 1.2, barT: 1.16, barB: 1.06, barX: [-0.12, -0.34], table: [-0.55, 0.4], top: 1.3, tn: 0.6, lamp: -0.1, sw: 0.3, bw: 30, reach: 78, dresser: [-2.3, -1.5], dz: 3.0, dTop: 2.45, wood: [-1.4, -0.75], wz: 1.7, prints: [-0.18, -0.35, 2.6, 2.1] },
  landscape: { m: 250, half: 5.8, ceil: 2.4, win: [-1.95, -1.05], sill: 1.25, head: 2.15, hearth: [-0.15, 0.95], hoodB: 1.62, barT: 1.56, barB: 1.44, barX: [-0.2, 0.12], table: [-1.5, 0.6], top: 0.85, tn: 0.5, lamp: -1.3, sw: 0.3, bw: 30, reach: 72, dresser: [-5.2, -4.1], dz: 3.0, dTop: 2.3, wood: [1.9, 2.82], wz: 1.6, prints: [-1.79, 0.31, 2.7, 1.91] },
};

export function yuleLads(orientation = 'portrait') {
  const L = LAYOUTS['ch14-iceland-kitchen'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr, ray, quad } = view(L, D.m), CEIL = D.ceil, SC = D.m / 356;
  const P = new Plate(72);
  const fx = (X, z = Z) => vx + (X * D.m) / z, fy = (Y, z = Z) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = Z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const [wa, wb] = D.win, [ha, hb] = D.hearth, [ta0, tb0] = D.table, base = fy(0), ceilY = fy(CEIL);
  const lampXY = [fx(D.lamp), fy(D.sill)], ls = SC * (portrait ? 1.0 : 0.8), flameP = [lampXY[0] + 14 * ls - 27 * ls, lampXY[1] + 2 - 20 * ls];
  const tone = (x, y) => {
    const light = pool(x, y, flameP, D.reach, 0.95) + 0.22 * pool(x, y, [fx((wa + wb) / 2), fy((D.sill + D.head) / 2)], 64, 1);
    const vig = sstep(portrait ? 190 : 340, portrait ? 540 : 700, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 410 : 160)) * 0.8)) * 0.3;
    return clamp(0.88 - 0.8 * Math.min(1, light) + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 13) - 0.5));
  };
  // ---------------------------------------------------------------- back wall: stone under turf plaster, cracks
  P.part(wall(-D.half, D.half, 0, CEIL), { tone: (x, y) => Math.min(0.92, clamp(tone(x, y) * 0.95 + 0.14)), layers: [hatch(1, 2.4, 1.1, 0.06, 2.2), hatch(78, 3.4, 0.8, 0.5)], seed: 2101, fill: CARD, halo: 0, outline: 1.3, wash: [STONE, 0.4] });
  { const r = rng(9); for (let i = 0; i < 5; i++) { const x = fx((r() * 2 - 1) * D.half * 0.9), y = fy(0.4 + r() * 1.9), n = 5, pts = [[x, y]]; for (let k = 1; k <= n; k++) pts.push([pts[k - 1][0] + (r() - 0.5) * 7, pts[k - 1][1] + 3 + r() * 5]); P.line(pts, 0.5, 0.7); } }
  // ---------------------------------------------------------------- flagstone floor with ash dragged across it
  floor(P, { W, H, hy: base, vp: L.vp, bw: D.bw, tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.9 + 0.14 + 0.18 * (vnoise(x * 0.03, y * 0.16, 9) - 0.5))), seed: 2150, wash: [STONE, 0.5], joint: { min: 0.3, spread: 0.42 }, grain: 0.8, grid: 0.85, shadowLo: 0.4, cols: Math.ceil((W * hs) / ((base - vy) * D.bw)) + 10 });
  // ---------------------------------------------------------------- smoke-dark plank ceiling on two cross beams
  const cLeft = pr(-D.half, CEIL, Z), cRight = pr(D.half, CEIL, Z);
  const ceil = quad([cLeft, cRight, ray(cRight, W + 30), [W + 30, -30], [-30, -30], ray(cLeft, -30)]);
  const pw = portrait ? 0.42 : 0.55, gapXs = [];
  for (let X = -6.4; X <= 6.4; X += pw) gapXs.push(fx(X));
  const plankAt = (x, y) => { const t = (y - vy) / (ceilY - vy), b0 = vx + (gapXs[0] - vx) * t; return Math.floor((x - b0) / ((gapXs[1] - gapXs[0]) * t)); };
  P.part(ceil, { tone: (x, y) => { const i = Math.max(0, plankAt(x, y)); return clamp(0.58 + 0.18 * ((i * 137) % 7) / 7 + 0.18 * sstep(vy - 40, vy - 330, y) - 0.5 * sstep(vx - 60, vx + 200, x) - 0.3 * sstep(vy - 160, vy, y) + 0.3 * (vnoise(x * 0.012, y * 0.02, 5) - 0.5) - 0.2 * pool(x, y, flameP, 120, 1)); }, layers: [hatch(3, 2.4, 0.62, 0.6, 2.0, { wob: 0.22 }), { lines: fanLines([vx, vy], gapXs, vy - 300, ceilY, -40), w: 0.9, lo: 0.42, step: 2.2, wob: 0.15 }], seed: 2100, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.55] });
  const beam = (zb, hB, seed) => { const yT = fy(CEIL, zb), yB = yT + (hB * D.m) / zb, x0 = fx(-D.half, zb), x1 = fx(D.half, zb);
    P.part([[x0, yT, 1], [x1, yT, 1], [x1, yB, 1], [x0, yB, 1]], { tone: (x, y) => clamp(0.42 + 0.3 * sstep(yT, yB, y) + 0.16 * sstep(vx - 40, vx + 210, x) - 0.12 * pool(x, y, flameP, D.reach * 1.6, 1) + 0.12 * (vnoise(x * 0.045, y * 0.09, 6) - 0.5)), layers: [hatch(0, 2.6, 1.05, 0.08, 2.4)], seed, fill: CARD, halo: 0.8, outline: 1.1, wash: [WASH.wood2, 0.62] });
    P.line([[x0, yB], [x1, yB]], 1.5, 0.9); return yB; };
  beam(portrait ? 1.9 : 4.2, 0.14, 2102);
  if (portrait) { const yBn = beam(0.42, 0.10, 2104); const r = rng(77); for (let k = 0; k < 3; k++) { const hx = 40 + r() * 110, len = 14 + r() * 16; P.line([[hx, yBn], [hx, yBn + len]], 0.8, 0.85); P.part(cr([[hx, yBn + len, 1], [hx - 5, yBn + 4 + len], [hx - 5, yBn + 16 + len], [hx, yBn + 22 + len], [hx + 5, yBn + 16 + len], [hx + 5, yBn + 4 + len]], true, 3), { tone: () => 0.45, layers: [hatch(66, 1.6, 1.1, 0.06, 1.8)], seed: 2108 + k, fill: CARD, halo: 1, outline: 0.9, wash: [STRAW, 0.5] }); } }
  else beam(2.4, 0.15, 2106);
  // ---------------------------------------------------------------- the small window: shutters ajar, snowy mountains beyond, lamp and table under it
  { const x0 = fx(wa), x1 = fx(wb), t0 = fy(D.head), t1 = fy(D.sill), sw = (x1 - x0) * D.sw;
    P.part(box(x0 - 4, t0 - 4, x1 - x0 + 8, t1 - t0 + 6), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2110, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.75] });
    P.part(box(x0, t0, x1 - x0, t1 - t0), { tone: (x, y) => clamp(0.84 - 0.4 * sstep(t0, t1, y) - 0.1 * (vnoise(x * 0.05, y * 0.05, 4) - 0.5)), layers: [hatch(0, 2.4, 1.1, 0.1, 2.2), hatch(28, 3.2, 0.9, 0.55, 2.2)], seed: 2111, fill: CARD, halo: 0, outline: 1.2, wash: [BLUE, 0.8] });
    crystals(P, [x0 + 3, t0 + 3, x1 - 3, t1 - 12], 6, 33);
    { const mid = (t0 + t1) / 2, ridge = [[x0 - 2, mid + 4], [x0 + (x1 - x0) * 0.3, mid - 8], [x0 + (x1 - x0) * 0.62, mid + 1], [x1 + 2, mid - 11], [x1 + 2, t1 - 2], [x0 - 2, t1 - 2]];
      P.part(ridge, { tone: () => 0.52, layers: [hatch(72, 2.0, 1.0, 0.1, 2.2)], seed: 2112, fill: CARD, halo: 0, outline: 0.8, wash: [STONE, 0.35] });
      P.part([[x0 - 2, mid + 4], [x0 + (x1 - x0) * 0.3, mid - 8], [x0 + (x1 - x0) * 0.32, mid - 4], [x0 + 2, mid + 7]], { tone: () => 0.3, layers: [], seed: 2113, fill: SNOW, halo: 0, outline: 0, wash: [] });
      P.part([[x1 + 2, mid - 11], [x0 + (x1 - x0) * 0.62, mid + 1], [x0 + (x1 - x0) * 0.66, mid - 2], [x1, mid - 14]], { tone: () => 0.3, layers: [], seed: 2114, fill: SNOW, halo: 0, outline: 0, wash: [] }); }
    P.line([[(x0 + x1) / 2, t0], [(x0 + x1) / 2, t1]], 1.3, 1); P.line([[x0, t0 + (t1 - t0) * 0.45], [x1, t0 + (t1 - t0) * 0.45]], 1.3, 1);
    for (const sg of [-1, 1]) { const xs = sg < 0 ? x0 - sw - 4 : x1 + 4;
      P.part([[xs, t0 - 3, 1], [xs + sw, t0 + (sg < 0 ? 4 : -2), 1], [xs + sw, t1 + 2 - (sg < 0 ? 0 : 4), 1], [xs, t1 + 3, 1]], { tone: (x) => clamp(0.4 + 0.3 * sstep(xs, xs + sw, x) * sg * -1 + 0.15), layers: [hatch(90, 1.8, 1.1, 0.08, 1.8)], seed: 2115 + sg, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.75] });
      for (let k = 1; k < 3; k++) P.line([[xs + (sw * k) / 3, t0 + (sg < 0 ? 1 : 0)], [xs + (sw * k) / 3, t1]], 0.5, 0.8); }
    const sz = Z - 0.28;
    P.part([[fx(wa - 0.12), t1 + 4], [fx(wb + 0.12), t1 + 4], [fx(wb + 0.12, sz), fy(D.sill - 0.04, sz) + 4], [fx(wa - 0.12, sz), fy(D.sill - 0.04, sz) + 4]], { tone: (x, y) => clamp(0.15 + 0.3 * (1 - pool(x, y, lampXY, 70, 1))), layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2116, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.65] });
    P.part(box(fx(wa - 0.12, sz), fy(D.sill - 0.04, sz) + 4, fx(wb + 0.12, sz) - fx(wa - 0.12, sz), 7), { tone: () => 0.5, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2117, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] });
    oilLamp(P, lampXY[0] + 14 * ls, lampXY[1] + 2, ls, 2118, 16);
    const tz = Z - 0.3, zn = Z - D.tn, [ta, tb] = D.table, top = D.top, tt = [[fx(ta, tz), fy(top, tz)], [fx(tb, tz), fy(top, tz)], [fx(tb, zn), fy(top, zn)], [fx(ta, zn), fy(top, zn)]];
    for (const [X, z] of [[ta + 0.05, tz], [tb - 0.05, tz], [ta + 0.08, zn + 0.05], [tb - 0.08, zn + 0.05]]) P.part(box(fx(X, z) - 2.2, fy(top, z), 4.4, fy(0, z) - fy(top, z)), { tone: () => 0.5, layers: [hatch(90, 1.5, 1.0, 0.08, 1.6)], seed: 2119 + Math.round(X * 10 + z * 3), fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
    { const sh = [[fx(ta + 0.05, tz - 0.05), fy(0.45, tz - 0.05)], [fx(tb - 0.05, tz - 0.05), fy(0.45, tz - 0.05)], [fx(tb - 0.05, zn + 0.05), fy(0.45, zn + 0.05)], [fx(ta + 0.05, zn + 0.05), fy(0.45, zn + 0.05)]]; P.part(sh, { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.1), layers: [hatch(0, 1.6, 1.0, 0.06, 1.8)], seed: 2121, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood, 0.55] }); }
    P.part(tt, { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.12), layers: [hatch(0, 1.6, 1.1, 0.06, 1.8), hatch(8, 3, 0.7, 0.5)], seed: 2122, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood, 0.55] });
    P.part(wall(ta, tb, top - 0.07, top, zn), { tone: () => 0.5, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2124, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.7] });
    const szh = Z - 0.4, sx0 = (ta0 + tb0) / 2 - 0.2, sx1 = (ta0 + tb0) / 2 + 0.2, sy = fy(top, szh);
    P.part([[fx(sx0, szh), sy], [fx(sx1, szh), sy], [fx(sx1, szh) + 3, sy + 11], [fx(sx0, szh) - 3, sy + 11]], { tone: (x, y) => clamp(0.3 + 0.1 * sstep(sy, sy + 11, y)), layers: [hatch(0, 1.2, 0.9, 0.08, 1.5)], seed: 2126, fill: CARD, halo: 0.6, outline: 0.9, wash: [] }); }
  // ---------------------------------------------------------------- the dresser on the left wall and logs in the dark corner
  { const [da, db] = D.dresser, dz = D.dz, x0 = fx(da, dz), x1 = fx(db, dz), t0 = fy(D.dTop, dz), t1 = fy(0, dz);
    P.part(box(x0, t0, x1 - x0, t1 - t0), { tone: (x, y) => clamp(0.55 + 0.1 * (vnoise(x * 0.06, y * 0.08, 4) - 0.5)), layers: [hatch(90, 1.7, 1.1, 0.08, 1.9), hatch(16, 2.6, 0.8, 0.5)], seed: 2130, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.7] });
    for (const Y of [D.dTop - 0.55, D.dTop - 1.1, D.dTop - 1.65]) { const yy = fy(Y, dz); P.part(box(x0 + 3, yy, x1 - x0 - 6, (D.dTop - 1.95 < Y ? 4 : 7)), { tone: () => 0.62, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2131 + Math.round(Y * 10), fill: CARD, halo: 0, outline: 1, wash: [WASH.wood2, 0.6] }); }
    { const r = rng(31); for (let i = 0; i < 7; i++) { const sx = x0 + 6 + r() * (x1 - x0 - 14), sy = fy(D.dTop - 0.4, dz), rr = 3.5 + r() * 3; P.raw('<ellipse cx="' + f1(sx) + '" cy="' + f1(sy) + '" rx="' + f1(rr) + '" ry="' + f1(rr * 0.7) + '" fill="' + CARD + '" stroke="' + ink + '" stroke-width=".7"/>'); } }
    P.line([[x0, t0], [x1, t0]], 1.6, 1);
    const [g0, g1] = D.wood, gz = D.wz, gx0 = fx(g0, gz), gx1 = fx(g1, gz), gy = fy(0, gz);
    P.part(box(gx0, fy(0.75, gz), gx1 - gx0, gy - fy(0.75, gz)), { tone: (x, y) => clamp(0.68 + 0.2 * sstep(fy(0.75, gz), gy, y) - 0.15 * pool(x, y, flameP, D.reach * 1.3, 1)), layers: [hatch(84, 1.9, 1.0, 0.1, 2.2)], seed: 2135, fill: CARD, halo: 0, outline: 1.2, wash: [LOG, 0.6] });
    const r = rng(51);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) { const lx = gx0 + 2 + i * ((gx1 - gx0 - 4) / 3) + r() * 3, ly = fy(0.72, gz) + 5 + row * ((gy - fy(0.72, gz)) / 4), lr = (gx1 - gx0) / 8;
      P.raw('<ellipse cx="' + f1(lx) + '" cy="' + f1(ly) + '" rx="' + f1(lr) + '" ry="' + f1(lr * 0.55) + '" fill="' + CARD + '" stroke="' + ink + '" stroke-width=".7" fill-opacity=".9"/><ellipse cx="' + f1(lx) + '" cy="' + f1(ly) + '" rx="' + f1(lr * 0.55) + '" ry="' + f1(lr * 0.3) + '" fill="none" stroke="' + ink + '" stroke-width=".5"/>'); } }
  // ---------------------------------------------------------------- the cold hearth: hood, the bar laid across the mouth, ash with crow prints
  { const barT = fy(D.barT), barB = fy(D.barB), hoodB = fy(D.hoodB), bx0 = fx(ha + D.barX[0]), bx1 = fx(hb + D.barX[1]);
    const hood = [[fx(ha + 0.1), ceilY, 1], [fx(hb - 0.1), ceilY, 1], [fx(hb), hoodB, 1], [fx(ha), hoodB, 1]];
    P.part(hood, { tone: (x, y) => clamp(0.72 + 0.2 * sstep(ceilY, hoodB, y) * -1 + 0.18 * (vnoise(x * 0.06, y * 0.06, 3) - 0.5) + 0.35 * (1 - pool(x, y, flameP, D.reach * 2, 1))), layers: [hatch(88, 2.1, 1.1, 0.06, 2), hatch(14, 3, 0.9, 0.5)], seed: 2140, fill: CARD, halo: 0, outline: 1.3, wash: [STONE, 0.55] });
    P.part(wall(ha, hb, D.barB - 0.06, D.barT), { tone: () => 0.95, layers: [hatch(88, 1.6, 1.2, 0.06, 1.6), hatch(20, 2.2, 1.1, 0.3, 1.8), hatch(-30, 3, 1.0, 0.6)], seed: 2141, fill: CARD, halo: 0, outline: 1.3, wash: [SOOT, 0.7] });
    const bz = Z - 0.5;
    P.part([[bx0, barT], [bx1, barT], [fx(hb + D.barX[1], bz), fy(D.barB, bz)], [fx(ha + D.barX[0], bz), fy(D.barB, bz)]], { tone: (x) => clamp(0.34 + 0.1 * sstep(bx0, bx1, x)), layers: [hatch(0, 1.5, 1.1, 0.08, 1.7)], seed: 2142, fill: CARD, halo: 1, outline: 1.2, wash: [WASH.wood2, 0.7] });
    P.part(wall(ha, hb, 0.16, D.barB, bz), { tone: () => 0.95, layers: [hatch(88, 1.6, 1.2, 0.06, 1.6), hatch(20, 2.4, 1.1, 0.3, 1.8)], seed: 2143, fill: CARD, halo: 0, outline: 1.2, wash: [SOOT, 0.75] });
    { const r = rng(14); const ash = []; for (let k = 0; k <= 12; k++) { const t = k / 12; ash.push([fx(ha + 0.08 + (hb - ha - 0.16) * t), fy(0.32 + 0.08 * Math.sin(t * 3.4) + 0.03 * r())]); }
      P.part([...ash, [fx(hb - 0.08), fy(0.3)], [fx(ha + 0.08), fy(0.3)]], { tone: () => 0.35, layers: [hatch(0, 2.2, 0.8, 0.1, 1.8)], seed: 2144, fill: CARD, halo: 0, outline: 0.9, wash: [SOOT, 0.4] }); }
    const drawPrint = (x, y, s, rot) => {
      for (const [dx, dy] of [[-4, 0], [0, -3.5], [4, 0]]) { const px = x + Math.cos(rot) * dx * s - Math.sin(rot) * dy * s, py = y + Math.sin(rot) * dx * s + Math.cos(rot) * dy * s;
        P.line([[px, py], [px + Math.sin(rot) * 6.3 * s, py - Math.cos(rot) * 6.3 * s]], 1.1 * s + 0.4, 0.75); }
      P.raw('<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(2.6 * s) + '" ry="' + f1(2 * s) + '" fill="' + SOOT + '" fill-opacity=".6" stroke="none"/>'); };
    const [pa, pb, za, zb] = D.prints, n = 6;
    for (let k = 0; k <= n; k++) { const t = k / n, X = pa + (pb - pa) * t, z = za + (zb - za) * t;
      drawPrint(fx(X, z), fy(0, z) + 3, (Z - z) * 0.55 + 0.55, 0.3 * Math.sin(k * 2.1) + (pb - pa > 0 ? 0.4 : -0.2)); } }
  glow(P, lampXY[0] - 6, lampXY[1] - 16, portrait ? 82 : 70, portrait ? 70 : 60, 0.9);
  const lx = lampXY[0] + 14 * ls, ly = lampXY[1] + 2, lampRect = [lx - 30 * ls, ly - 40 * ls, 56 * ls, 42 * ls], winRect = [fx(wa) - 1, fy(D.head) - 6, fx(wb) - fx(wa) + 2, fy(D.sill) - fy(D.head) + 14];
  const barRect = [fx(ha + D.barX[0]) - 4, fy(D.barT) - 4, fx(hb + D.barX[1]) - fx(ha + D.barX[0]) + 8, fy(D.barB) - fy(D.barT) + 6];
  const pc = [fx((ta0 + tb0) / 2, Z - 0.3 - (D.tn - 0.3) / 2), fy(D.top, Z - 0.3 - (D.tn - 0.3) / 2)], sheet = [pc[0] - 21, pc[1] - 9, 42, 18];
  const bz = Z - 0.5, mzx = Math.min(fx(ha, bz) + 4, W - 40), mouth = [mzx, fy(D.barB, bz) + 6, Math.min(fx(hb, bz) - fx(ha, bz) - 8, W - 14 - mzx), fy(0.16, bz) - fy(D.barB, bz) - 14];
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp: lampXY, layers: {}, keys: { lamp: lampRect, window: winRect, bar: barRect, sheet, mouth }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
