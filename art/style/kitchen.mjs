// Chapter 10 Italian farmhouse kitchen on the night of the Epiphany: a small room seen head-on, plaster walls, a brick floor, a plank ceiling on cross beams with a herb bundle hanging from the near one. The hearth on the right is cold (a swept hood, a mantel beam
// over the opening, ash on the stone); the window left of it holds an oil lamp lit for the night, with a worktable under it; a closed door with a broom leaning against its frame. In portrait the lamp, the broom and the table
// stand in the strip of wall between Tèo and the machine and above the machine's roof, so the figures never cover them.
// The wall beside the window is bare plaster: the script shows its shadow play there (the prop in lit.mjs). No figure, no animal, no fire in the hearth.
import { clamp, sstep, f1, cr, vnoise, rng, fanLines, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, view, oilLamp } from './scenery.mjs';
import { crystals } from './night.mjs';

const BRICK = '#a7692f', SOOT = '#3a352e', STRAW = '#e0d2ac';
const Z = 3.2;
const DESIGN = {
  portrait: { m: 243, half: 2.6, ceil: 2.4, win: [0.0, 0.62], sill: 1.5, head: 2.2, hearth: [1.62, 2.7], mantel: [0.8, 1.1], door: [-1.2, -0.4], table: [-0.15, 0.85], top: 1.3, tn: 0.6, lamp: 0.3, patch: [0.84, 1.12, 0.66], sw: 0.3, bw: 34, reach: 70, side: false },
  landscape: { m: 247, half: 2.4, ceil: 2.5, win: [-1.2, -0.3], sill: 1.25, head: 2.15, hearth: [1.15, 2.3], mantel: [1.2, 1.5], door: [-2.35, -1.5], table: [-1.25, 0.2], top: 0.78, tn: 0.9, lamp: -0.72, patch: [0.14, 0.95, 0.78], sw: 0.46, bw: 34, reach: 78, side: true },
};
export const PATCH_RATIO = 1.7;

export function kitchen(orientation = 'portrait') {
  const L = LAYOUTS['ch10-kitchen'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr, ray, quad } = view(L, D.m), CEIL = D.ceil, MANTEL = D.mantel, SC = D.m / 356;
  const P = new Plate(60);
  const fx = (X, z = Z) => vx + (X * D.m) / z, fy = (Y, z = Z) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = Z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const [ta0, tb0] = D.table, [wa, wb] = D.win, [ha, hb] = D.hearth, [da, db] = D.door, base = fy(0), ceilY = fy(CEIL);
  const lampXY = [fx(D.lamp), fy(D.sill)], ls = SC * (portrait ? 1.1 : 0.8), flameP = [lampXY[0] + 14 * ls - 27 * ls, lampXY[1] + 2 - 20 * ls];
  const tone = (x, y) => {
    const light = pool(x, y, flameP, D.reach, 0.95) + 0.25 * pool(x, y, [fx(0.7), fy(0.9)], 30, 1) * 0;
    const vig = sstep(portrait ? 190 : 330, portrait ? 520 : 680, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 400 : 150)) * 0.8)) * 0.3;
    return clamp(0.86 - 0.8 * Math.min(1, light) + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 13) - 0.5));
  };
  // ---------------------------------------------------------------- back wall: plaster over stone, a few cracks
  P.part(wall(-D.half, D.half, 0, CEIL), { tone: (x, y) => Math.min(0.92, clamp(tone(x, y) * 0.95 + 0.14)), layers: [hatch(1, 2.4, 1.1, 0.06, 2.2), hatch(78, 3.4, 0.8, 0.5)], seed: 2001, fill: CARD, halo: 0, outline: 1.3, wash: [STONE, 0.4] });
  { const r = rng(8); for (let i = 0; i < 5; i++) { const x = fx((r() * 2 - 1) * D.half * 0.9), y = fy(0.4 + r() * 1.9), n = 5, pts = [[x, y]]; for (let k = 1; k <= n; k++) pts.push([pts[k - 1][0] + (r() - 0.5) * 7, pts[k - 1][1] + 3 + r() * 5]); P.line(pts, 0.5, 0.7); } }
  // ---------------------------------------------------------------- brick floor, ash on the hearth stone
  const tl = (x, y) => tone(x, y);
  floor(P, { W, H, hy: base, vp: L.vp, bw: D.bw, tone: tl, seed: 2050, wash: [BRICK, 0.5], joint: { min: 0.11, spread: 0.24 }, grain: 0.75, grid: 0.9, shadowLo: 0.38, cols: Math.ceil((W * hs) / ((base - vy) * D.bw)) + 10 });
  // ---------------------------------------------------------------- ceiling: planks in depth with staggered cross-joints, cross beams and a herb bundle hanging from the near beam
  const cLeft = pr(-D.half, CEIL, Z), cRight = pr(D.half, CEIL, Z);
  const ceil = quad([cLeft, cRight, ray(cRight, W + 30), [W + 30, -30], [-30, -30], ray(cLeft, -30)]);
  const pw = portrait ? 0.42 : 0.5, gapXs = [];
  for (let X = -3.4; X <= 6.2; X += pw) gapXs.push(fx(X));
  const plankAt = (x, y) => { const t = (y - vy) / (ceilY - vy), b0 = vx + (gapXs[0] - vx) * t; return Math.floor((x - b0) / ((gapXs[1] - gapXs[0]) * t)); };
  const joints = []; { const r = rng(2061); for (let i = 0; i < gapXs.length - 1; i++) { const nJ = 2 + Math.floor(r() * 2); for (let k = 0; k < nJ; k++) { const y = 6 + r() * Math.max(24, ceilY - 12), t = (y - vy) / (ceilY - vy); joints.push([[vx + (gapXs[i] - vx) * t, y], [vx + (gapXs[i + 1] - vx) * t, y]]); } } }
  P.part(ceil, { tone: (x, y) => { const i = Math.max(0, plankAt(x, y)); return clamp(tone(x, y) * 0.5 + 0.3 + (0.3 * ((i * 137 + 41) % 11)) / 11 - 0.1 + 0.4 * sstep(vy - 40, vy - 330, y) - 0.5 * sstep(vx - 60, vx + 160, x) - 0.22 * sstep(vy - 140, vy, y) + 0.3 * (vnoise(x * 0.012, y * 0.02, 5) - 0.5) + 0.14 * (vnoise(x * 0.05, y * 0.09, 4) - 0.5) - 0.25 * pool(x, y, flameP, 130, 1), 0.45, 0.95); }, layers: [hatch(3, 2.8, 0.85, 0.28, 2.1, { wob: 0.26 }), { lines: fanLines([vx, vy], gapXs, vy - 300, ceilY, -40), w: 0.9, lo: 0.3, step: 2.0, wob: 0.15 }, { lines: fanLines([vx, vy], gapXs.slice(0, -1).map((x, i) => (x + gapXs[i + 1]) / 2 + (gapXs[i + 1] - x) * 0.2), vy - 300, ceilY, -40), w: 0.55, lo: 0.12, step: 2.2, wob: 0.2 }], seed: 2060, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.55] });
  for (const [a, b] of joints) P.line([a, b], 0.6, 0.8);
  const beam = (zb, hB, seed) => { const yT = fy(CEIL, zb), yB = yT + (hB * D.m) / zb, x0 = fx(portrait ? -4 : -D.half, zb), x1 = fx(portrait ? 6 : D.half, zb);
    P.part([[x0, yT, 1], [x1, yT, 1], [x1, yB, 1], [x0, yB, 1]], { tone: (x, y) => clamp(0.52 + 0.34 * sstep(yT, yB, y) + 0.18 * sstep(vx - 40, vx + 210, x) - 0.12 * pool(x, y, flameP, D.reach * 1.6, 1) + 0.12 * (vnoise(x * 0.045, y * 0.09, 6) - 0.5)), layers: [hatch(0, 2.6, 1.05, 0.08, 2.4)], seed, fill: CARD, halo: 0.8, outline: 1.1, wash: [WASH.wood2, 0.8] });
    P.line([[x0, yB], [x1, yB]], 1.5, 0.9);
    return yB; };
  if (portrait) { beam(1.9, 0.14, 2062); const yBn = beam(0.42, 0.10, 2064);
    const hx = 48, hb2 = yBn + 26, bw2 = 8.5;
    P.line([[hx, yBn + 1], [hx, hb2]], 0.8, 0.85);
    P.part(cr([[hx, hb2, 1], [hx - bw2, hb2 + 8], [hx - bw2 + 1, hb2 + 22], [hx, hb2 + 31], [hx + bw2 - 1, hb2 + 22], [hx + bw2, hb2 + 8]], true, 3), { tone: (x, y) => clamp(0.3 + 0.35 * sstep(hb2, hb2 + 31, y) + 0.2 * (vnoise(x * 0.09, y * 0.09, 4) - 0.5)), layers: [hatch(66, 1.7, 1.1, 0.06, 1.9), hatch(-40, 2.6, 0.9, 0.5)], seed: 2068, fill: CARD, halo: 1, outline: 1, wash: [WASH.coat, 0.45] });
    P.line([[hx - 6, hb2 + 3], [hx + 6, hb2 + 3]], 1.1, 0.9);
    for (const k of [-0.5, -0.15, 0.25, 0.6]) P.line([[hx + k * 7, hb2 + 6], [hx + k * 8.5, hb2 + 28]], 0.5, 0.8); } else beam(2.95, 0.15, 2066);
  // side walls of the room, where the stage shows them
  if (D.side) for (const sg of [-1, 1]) { const X = sg * D.half, wq = quad([pr(X, CEIL, Z), pr(X, 0, Z), ray(pr(X, 0, Z), sg < 0 ? -30 : W + 30), ray(pr(X, CEIL, Z), sg < 0 ? -30 : W + 30)]);
    P.part(wq, { tone: (x, y) => Math.min(0.92, clamp(tone(x, y) * 0.95 + 0.2)), layers: [hatch(sg < 0 ? 12 : -12, 3.4, 1.0, 0.1, 3.2)], seed: 2070 + sg, fill: CARD, halo: 0, outline: 1.3, wash: [STONE, 0.4] }); }
  // ---------------------------------------------------------------- the cold hearth: hood, mantel beam, dark opening, swept ash on the stone
  { const hl = fx(ha), hr = fx(hb), hood = [[fx(ha + 0.12), fy(CEIL), 1], [fx(hb - 0.12), fy(CEIL), 1], [hr, fy(MANTEL[1]), 1], [hl, fy(MANTEL[1]), 1]];
    P.part(hood, { tone: (x, y) => clamp(0.66 + 0.2 * sstep(fy(CEIL), fy(MANTEL[1]), y) * -1 + 0.18 * (vnoise(x * 0.06, y * 0.06, 3) - 0.5)), layers: [hatch(88, 2.1, 1.1, 0.06, 2), hatch(14, 3, 0.9, 0.5)], seed: 2080, fill: CARD, halo: 0, outline: 1.3, wash: [STONE, 0.55] });
    P.part(wall(ha, hb, 0.3, MANTEL[0]), { tone: () => 0.95, layers: [hatch(88, 1.6, 1.2, 0.06, 1.6), hatch(20, 2.2, 1.1, 0.3, 1.8), hatch(-30, 3, 1.0, 0.6)], seed: 2081, fill: CARD, halo: 0, outline: 1.3, wash: [{ s: 0 }.s ? STONE : SOOT, 0.7] });
    P.part(wall(ha - 0.3, hb + 0.3, MANTEL[0], MANTEL[1]), { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.36), layers: [hatch(0, 1.5, 1.2, 0.06, 1.8), hatch(84, 2.6, 0.8, 0.5)], seed: 2082, fill: CARD, halo: 0, outline: 1.4, wash: [WASH.wood2, 0.78] });
    for (const sg of [-1, 1]) { const ex = sg < 0 ? fx(ha - 0.3) : fx(hb + 0.3), ey = (fy(MANTEL[0]) + fy(MANTEL[1])) / 2, er = (fy(MANTEL[0]) - fy(MANTEL[1])) / 2; P.raw('<ellipse cx="' + f1(ex) + '" cy="' + f1(ey) + '" rx="' + f1(er * 0.35) + '" ry="' + f1(er) + '" fill="#a7692f" fill-opacity=".55" stroke="' + ink + '" stroke-width=".9"/><ellipse cx="' + f1(ex) + '" cy="' + f1(ey) + '" rx="' + f1(er * 0.14) + '" ry="' + f1(er * 0.4) + '" fill="none" stroke="' + ink + '" stroke-width=".5"/>'); }
    for (const X of [ha - 0.04, hb - 0.12]) P.part(wall(X, X + 0.16, 0.3, MANTEL[0]), { tone: () => 0.5, layers: [hatch(88, 1.6, 1.0, 0.08, 1.8)], seed: 2083 + Math.round(X * 10), fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
    const lz = Z - 0.55, ledge = [[fx(ha - 0.18), fy(0.34)], [fx(hb + 0.18), fy(0.34)], [fx(hb + 0.18, lz), fy(0.34, lz)], [fx(ha - 0.18, lz), fy(0.34, lz)]];
    P.part(ledge, { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.2), layers: [hatch(0, 1.5, 1.0, 0.08, 1.6)], seed: 2086, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
    P.part(wall(ha - 0.18, hb + 0.18, 0.2, 0.34, lz), { tone: () => 0.5, layers: [hatch(0, 1.5, 1.0, 0.08, 1.6)], seed: 2087, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
    const r = rng(14); const ash = []; for (let k = 0; k <= 12; k++) { const t = k / 12; ash.push([fx(ha + 0.12 + (hb - ha - 0.24) * t), fy(0.3 + 0.1 * Math.sin(t * 3.4) + 0.03 * r())]); }
    P.part([...ash, [fx(hb - 0.12), fy(0.3)], [fx(ha + 0.12), fy(0.3)]], { tone: () => 0.35, layers: [hatch(0, 2.2, 0.8, 0.1, 1.8)], seed: 2088, fill: CARD, halo: 0, outline: 0.9, wash: [SOOT, 0.4] }); }
  // ---------------------------------------------------------------- window with the shutters back, a stone sill, the lit oil lamp, and the plank table under it
  { const x0 = fx(wa), x1 = fx(wb), t0 = fy(D.head), t1 = fy(D.sill), sw = (x1 - x0) * D.sw;
    P.part(box(x0 - 4, t0 - 4, x1 - x0 + 8, t1 - t0 + 6), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2090, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.75] });
    P.part(box(x0, t0, x1 - x0, t1 - t0), { tone: (x, y) => clamp(0.82 - 0.35 * sstep(t0, t1, y)), layers: [hatch(0, 2.4, 1.1, 0.1, 2.2), hatch(28, 3.2, 0.9, 0.55, 2.2)], seed: 2091, fill: CARD, halo: 0, outline: 1.2, wash: [BLUE, 0.85] });
    crystals(P, [x0 + 3, t0 + 3, x1 - 3, t1 - 12], 6, 33);
    P.line([[(x0 + x1) / 2, t0], [(x0 + x1) / 2, t1]], 1.3, 1); P.line([[x0, t0 + (t1 - t0) * 0.45], [x1, t0 + (t1 - t0) * 0.45]], 1.3, 1);
    for (const sg of [-1, 1]) { const xs = sg < 0 ? x0 - sw - 4 : x1 + 4;
      P.part([[xs, t0 - 3, 1], [xs + sw, t0 + (sg < 0 ? 4 : -2), 1], [xs + sw, t1 + 2 - (sg < 0 ? 0 : 4), 1], [xs, t1 + 3, 1]], { tone: (x) => clamp(0.4 + 0.3 * sstep(xs, xs + sw, x) * sg * -1 + 0.15), layers: [hatch(90, 1.8, 1.1, 0.08, 1.8)], seed: 2092 + sg, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.75] });
      for (let k = 1; k < 3; k++) P.line([[xs + (sw * k) / 3, t0 + (sg < 0 ? 1 : 0)], [xs + (sw * k) / 3, t1]], 0.5, 0.8); }
    const sz = Z - 0.28;
    P.part([[fx(wa - 0.12), t1 + 4], [fx(wb + 0.12), t1 + 4], [fx(wb + 0.12, sz), fy(D.sill - 0.04, sz) + 4], [fx(wa - 0.12, sz), fy(D.sill - 0.04, sz) + 4]], { tone: (x, y) => clamp(0.15 + 0.3 * (1 - pool(x, y, lampXY, 70, 1))), layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2094, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.65] });
    P.part(box(fx(wa - 0.12, sz), fy(D.sill - 0.04, sz) + 4, fx(wb + 0.12, sz) - fx(wa - 0.12, sz), 7), { tone: () => 0.5, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2095, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] });
    oilLamp(P, lampXY[0] + 14 * ls, lampXY[1] + 2, ls, 2096, 18);
    const tz = Z - 0.3, zn = Z - D.tn, [ta, tb] = D.table, top = D.top, tt = [[fx(ta, tz), fy(top, tz)], [fx(tb, tz), fy(top, tz)], [fx(tb, zn), fy(top, zn)], [fx(ta, zn), fy(top, zn)]];
    for (const [X, z] of [[ta + 0.05, tz], [tb - 0.05, tz], [ta + 0.08, zn + 0.05], [tb - 0.08, zn + 0.05]]) P.part(box(fx(X, z) - 2.2, fy(top, z), 4.4, fy(0, z) - fy(top, z)), { tone: () => 0.5, layers: [hatch(90, 1.5, 1.0, 0.08, 1.6)], seed: 2097 + Math.round(X * 10 + z * 3), fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
    { const sh = [[fx(ta + 0.05, tz - 0.05), fy(0.45, tz - 0.05)], [fx(tb - 0.05, tz - 0.05), fy(0.45, tz - 0.05)], [fx(tb - 0.05, zn + 0.05), fy(0.45, zn + 0.05)], [fx(ta + 0.05, zn + 0.05), fy(0.45, zn + 0.05)]]; P.part(sh, { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.1), layers: [hatch(0, 1.6, 1.0, 0.06, 1.8)], seed: 2105, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood, 0.55] }); }
    P.part(tt, { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.12), layers: [hatch(0, 1.6, 1.1, 0.06, 1.8), hatch(8, 3, 0.7, 0.5)], seed: 2102, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood, 0.55] });
    P.part(wall(ta, tb, top - 0.07, top, zn), { tone: () => 0.5, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2104, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.7] }); }
  // ---------------------------------------------------------------- the door at the left edge and the broom leaning against its frame
  { const x0 = fx(da), x1 = fx(db), t0 = fy(2.0), t1 = base;
    P.part(box(x0 - 5, t0 - 5, x1 - x0 + 10, t1 - t0 + 5), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2110, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.75] });
    P.part(box(x0, t0, x1 - x0, t1 - t0), { tone: (x) => clamp(0.55 + 0.2 * sstep(x0, x1, x) * 0 + 0.1), layers: [hatch(90, 1.5, 1.2, 0.08, 1.8), hatch(18, 2.4, 0.9, 0.5)], seed: 2111, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.7] });
    for (let k = 1; k < 4; k++) P.line([[x0 + ((x1 - x0) * k) / 4, t0], [x0 + ((x1 - x0) * k) / 4, t1]], 0.6, 0.8);
    for (const Y of [0.5, 1.5]) P.line([[x0, fy(Y)], [x1, fy(Y)]], 1.6, 1);
    const bx = x1 + 10.5 * SC, s = SC, bt = fy(1.72), bb = fy(0.02), lean = 6 * s;
    P.line([[bx + lean, bt], [bx, bb - 40 * s]], 2.6 * s + 2.2, 1, CARD);
    P.line([[bx + lean, bt], [bx, bb - 40 * s]], 2.2 * s + 0.5, 1);
    P.line([[bx + lean, bt], [bx, bb - 40 * s]], 0.9, 1, STRAW);
    P.part(cr([[bx, bb - 48 * s, 1], [bx - 13 * s, bb - 40 * s], [bx - 19 * s, bb - 18 * s], [bx - 16 * s, bb - 2 * s, 1], [bx + 16 * s, bb - 2 * s, 1], [bx + 19 * s, bb - 18 * s], [bx + 13 * s, bb - 40 * s]], true, 4), { tone: (x, y) => clamp(0.26 + 0.26 * sstep(bb - 46 * s, bb, y) + 0.15 * (1 - pool(x, y, lampXY, D.reach * 1.4, 1)) + 0.1 * (vnoise(x * 0.08, y * 0.08, 3) - 0.5)), layers: [hatch(84, 1.6, 1.1, 0.06, 1.7), hatch(96, 2.4, 0.8, 0.5)], seed: 2112, fill: CARD, halo: 1.2, outline: 1.1, wash: [STRAW, 0.65] });
    P.line([[bx - 14 * s, bb - 34 * s], [bx + 14 * s, bb - 34 * s]], 1.3 * s + 0.5, 1);
    P.line([[bx - 13 * s, bb - 27 * s], [bx + 13 * s, bb - 27 * s]], 1.1 * s + 0.4, 1);
    for (const k of [-0.75, -0.3, 0.15, 0.6]) P.line([[bx + k * 13 * s, bb - 6 * s], [bx + k * 7 * s, bb - 36 * s]], 0.5, 0.8); }
  glow(P, lampXY[0] - 6, lampXY[1] - 16, portrait ? 78 : 66, portrait ? 66 : 56, 0.9);
  const lx = lampXY[0] + 14 * ls, ly = lampXY[1] + 2, lampRect = [lx - 30 * ls, ly - 40 * ls, 56 * ls, 42 * ls], winRect = [fx(wa) - 6, fy(D.head) - 6, fx(wb) - fx(wa) + 12, fy(D.sill) - fy(D.head) + 14];
  const patchW = fx(D.patch[0] + D.patch[2]) - fx(D.patch[0]), patch = [fx(D.patch[0]), fy(D.patch[1]) - patchW * PATCH_RATIO, patchW, patchW * PATCH_RATIO];
  const broomRect = [fx(db) - 9.5 * SC, fy(1.9), 38 * SC + 2, base - fy(1.9)], mantel = [fx(ha), fy(MANTEL[1]), fx(hb) - fx(ha), fy(MANTEL[0]) - fy(MANTEL[1])];
  const pc = [fx((ta0 + tb0) / 2, Z - 0.3 - (D.tn - 0.3) / 2), fy(D.top, Z - 0.3 - (D.tn - 0.3) / 2)], page = [pc[0] - 20, pc[1] - 9, 40, 18];
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp: lampXY, mantel, patch, layers: { 'name-page': { at: [pc[0] - 21.3, pc[1] - 12], width: 42.7 } }, page, keys: { patch, lamp: lampRect, window: winRect, broom: broomRect, page }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
