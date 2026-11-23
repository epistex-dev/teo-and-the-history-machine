// Chapter 12 an English street in June 1647, evening: the front of a print shop seen head-on. Plaster and timber below, the upper storey jettied out over the door, a stone step, and one lamp
// bracketed beside the door. A line runs from a hook on the wall to a post in the street, with printed sheets pegged along it: lit above, in the shadow of the jetty below. The print is only
// grey rules, no letters. No figure, no herald, no name on any sheet.
import { clamp, sstep, f1, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, view } from './scenery.mjs';
import { nightSky } from './night.mjs';
import { lantern } from './village.mjs';

const WOOD = '#6b3d1a', TILE = '#8a6a3c', PAPER = '#f1e6c6';
const Z = 7, ZJ = 6.5;
const DESIGN = {
  portrait: { m: 300, z: 7, half: 4.6, door: [1.15, 2.15], lamp: [0.55, 1.58], reach: 78, a: [20, 282], b: [335, 372], s0: 0.82, s1: 1.4, wins: [[-3.4, -2.5], [-0.6, 0.3], [2.5, 3.4]], stack: [-2.9, -2.3], crowAt: 0.97 },
  landscape: { m: 250, z: 4, half: 7.4, door: [-1.3, -0.3], lamp: [-1.85, 1.75], reach: 70, a: [120, 62], b: [515, 124], s0: 0.95, s1: 1.4, wins: [[-5.4, -4.4], [-3.4, -2.6], [1.4, 2.4], [3.6, 4.6]], stack: [-5.0, -4.3], crowAt: 0.99 },
};
const SHEETS = [0.1, 0.26, 0.4, 0.54, 0.68, 0.82];

export function street(orientation = 'portrait') {
  const L = LAYOUTS['ch12-street'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs } = view(L, D.m), z0 = D.z, zj = z0 - 0.5;
  const P = new Plate(60), K = portrait ? 1 : 1.35;
  const fx = (X, z = z0) => vx + (X * D.m) / z, fy = (Y, z = z0) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = z0) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const base = fy(0), UP = 2.35, TOP = 4.5;
  const [la, ly] = D.lamp, lampTop = [fx(la + 0.0, z0), fy(ly + 0.35)], flame = [lampTop[0], lampTop[1] + 24];
  const tone = (x, y) => {
    const light = pool(x, y, [flame[0], flame[1] + 6], D.reach, 0.9);
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 420 : 200)) * 0.8)) * 0.28;
    return clamp(0.86 - 0.8 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 12) - 0.5));
  };
  // ---------------------------------------------------------------- sky and the roof against it
  nightSky(P, { W, h: fy(TOP, zj) + 4, seed: 2001, n: portrait ? 36 : 50, fade: 0.5, top: 0.8 });
  { const ridge = fy(TOP + 1.7, zj), eave = fy(TOP, zj), l = fx(-D.half, zj), r = fx(D.half, zj);
    P.part([[l - 20, eave, 1], [l + (r - l) * 0.04, ridge, 1], [r - (r - l) * 0.04, ridge, 1], [r + 20, eave, 1]], { tone: (x, y) => clamp(0.64 + 0.2 * sstep(ridge, eave, y)), layers: [hatch(88, 3.0, 1.1, 0.1, 2.2), hatch(8, 4.6, 0.8, 0.55)], seed: 2002, fill: CARD, halo: 0, outline: 1.2, wash: [TILE, 0.5] });
    for (let y = ridge + 6; y < eave; y += 7) P.line([[l + (r - l) * 0.04 * (1 - (y - ridge) / (eave - ridge)) - 10, y], [r - (r - l) * 0.04 * (1 - (y - ridge) / (eave - ridge)) + 10, y]], 0.5, 0.55);
    const sx = [fx(D.stack[0], zj), fx(D.stack[1], zj)];
    P.part(box(sx[0], ridge - 22, sx[1] - sx[0], 30), { tone: () => 0.6, layers: [hatch(90, 1.8, 1.1, 0.08, 1.8)], seed: 2003, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.45] }); }
  // ---------------------------------------------------------------- the street: cobbles and the lamp's light on them
  const ground = [[-20, base - 2], [W + 20, base - 2], [W + 20, H + 10], [-20, H + 10]];
  P.part(ground, { tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.9 + 0.14 + 0.12 * (vnoise(x * 0.05, y * 0.18, 9) - 0.5))), layers: [hatch(0.6, 3.2 * K, 1.1, 0.1, 2.6, { wob: 0.5 }), hatch(-33, 5.0 * K, 0.9, 0.5), hatch(56, 6.5 * K, 0.7, 0.68)], seed: 2010, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.6] });
  { const r = rng(61); for (let i = 0; i < (portrait ? 26 : 38); i++) { const y = base + 4 + Math.pow(r(), 0.8) * (H - base - 14), t = (y - vy) / hs, x = r() * W, s = 0.5 + 2.2 * t * (0.6 + r() * 0.6);
      P.part(cr([[x - 9 * s, y, 1], [x - 5 * s, y - 3 * s], [x + 6 * s, y - 3.4 * s], [x + 10 * s, y, 1], [x + 4 * s, y + 2.6 * s], [x - 6 * s, y + 2.4 * s]], true, 4), { tone: (px, py) => clamp(0.36 + 0.3 * sstep(x - 9 * s, x + 10 * s, px) + 0.25 * tone(px, py)), layers: [hatch(0, 1.6, 1.0, 0.1, 1.8)], seed: 2011 + i, fill: CARD, halo: 0, outline: 0.8, wash: [STONE, 0.5] }); } }
  // ---------------------------------------------------------------- upper storey, jettied out: face, windows, timber, and the soffit under it
  const UL = -D.half, UR = D.half, jl = (X) => fx(X, zj);
  P.part(wall(UL, UR, UP + 0.12, TOP, zj), { tone: (x, y) => Math.min(0.88, clamp(tone(x, y) * 0.9 + 0.16)), layers: [hatch(2, 3.4 * K, 1.1, 0.08, 2.4), hatch(78, 5 * K, 0.8, 0.5)], seed: 2020, fill: CARD, halo: 0, outline: 1.2, wash: [BLUE, 0.55] });
  for (const [a, b] of D.wins) { const q = wall(a, b, UP + 0.7, UP + 1.6, zj);
    P.part(wall(a - 0.1, b + 0.1, UP + 0.62, UP + 1.7, zj), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2021, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
    P.part(q, { tone: () => 0.96, layers: [hatch(80, 1.5, 1.2, 0.1, 1.6)], seed: 2022, fill: CARD, halo: 0, outline: 0.9, wash: [BLUE, 0.4] });
    P.line([[(q[0][0] + q[1][0]) / 2, q[0][1]], [(q[0][0] + q[1][0]) / 2, q[3][1]]], 0.9, 0.9); P.line([[q[0][0], (q[0][1] + q[3][1]) / 2], [q[1][0], (q[0][1] + q[3][1]) / 2]], 0.9, 0.9); }
  for (const Y0 of [UP + 0.12, TOP - 0.16]) P.part(wall(UL - 0.05, UR + 0.05, Y0, Y0 + 0.16, zj), { tone: () => 0.5, layers: [hatch(0, 1.6, 1.1, 0.06, 1.8)], seed: 2023, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.72] });
  for (let X = UL + 0.5; X < UR; X += 1.15) P.part(wall(X, X + 0.13, UP + 0.12, TOP, zj), { tone: () => 0.45, layers: [hatch(90, 1.8, 1.1, 0.06, 1.8)], seed: 2024, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
  P.part([[fx(UL, zj), fy(UP + 0.12, zj), 1], [fx(UR, zj), fy(UP + 0.12, zj), 1], [fx(UR, z0), fy(UP, z0), 1], [fx(UL, z0), fy(UP, z0), 1]], { tone: (x, y) => clamp(0.82 - 0.4 * pool(x, y, flame, D.reach * 1.2, 0.8)), layers: [hatch(0, 1.5, 1.2, 0.08, 1.6), hatch(86, 2.4, 0.9, 0.4)], seed: 2025, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.6] });
  // ---------------------------------------------------------------- the ground floor: plaster, plinth, timber frame, one dark window, the door on its stone step
  P.part(wall(UL, UR, 0.35, UP), { tone: (x, y) => Math.min(0.82, clamp(tone(x, y) * 0.95 + 0.12)), layers: [hatch(2, 3.4 * K, 1.1, 0.08, 2.4), hatch(78, 5 * K, 0.8, 0.5)], seed: 2030, fill: CARD, halo: 0, outline: 1.2, wash: [BLUE, 0.55] });
  P.part(wall(UL, UR, 0, 0.37), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.22), layers: [hatch(0, 1.7, 1.1, 0.08, 1.8), hatch(72, 2.6, 0.8, 0.5)], seed: 2031, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
  const timber = (X0, X1, Y0, Y1, seed) => P.part(wall(X0, X1, Y0, Y1), { tone: (x, y) => clamp(0.34 + 0.3 * (1 - pool(x, y, flame, 120, 1))), layers: [hatch(90, 1.8, 1.1, 0.06, 1.8)], seed, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.72] });
  timber(UL - 0.05, UR + 0.05, 0.37, 0.5, 2040); timber(UL - 0.05, UR + 0.05, UP - 0.16, UP, 2041);
  const [da, db] = D.door;
  { const wa = D.wins[0][0] + 0.3, wb2 = wa + 1.0;
    P.part(wall(wa, wb2, 0.9, 1.8), { tone: () => 0.95, layers: [hatch(80, 1.6, 1.2, 0.1, 1.8)], seed: 2032, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.5] });
    P.line([[fx((wa + wb2) / 2), fy(1.8)], [fx((wa + wb2) / 2), fy(0.9)]], 1.0, 0.9); }
  const dx0 = fx(da), dx1 = fx(db), dt = fy(2.1), dbm = fy(0.3);
  P.part(box(dx0 - 4, dt - 4, dx1 - dx0 + 8, dbm - dt + 4), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2033, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.75] });
  P.part(box(dx0, dt, dx1 - dx0, dbm - dt), { tone: (x, y) => clamp(0.34 + 0.2 * sstep(dx0, dx1, x) + 0.3 * (1 - pool(x, y, flame, D.reach * 1.3, 0.9))), layers: [hatch(90, 1.5, 1.2, 0.08, 1.8), hatch(18, 2.4, 0.9, 0.5)], seed: 2034, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.7] });
  for (let k = 1; k < 4; k++) P.line([[dx0 + ((dx1 - dx0) * k) / 4, dt], [dx0 + ((dx1 - dx0) * k) / 4, dbm]], 0.6, 0.9);
  P.raw('<circle cx="' + f1(dx0 + 5) + '" cy="' + f1(fy(1.05)) + '" r="1.5" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".6"/>');
  const sa = da - 0.15, sb = db + 0.15, sz = z0 - 0.7, stepTop = [[fx(sa), fy(0.3)], [fx(sb), fy(0.3)], [fx(sb, sz), fy(0.3, sz)], [fx(sa, sz), fy(0.3, sz)]];
  P.part(stepTop, { tone: (x, y) => clamp(0.16 + 0.34 * (1 - pool(x, y, flame, 90, 1))), layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2035, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.65] });
  P.part(box(fx(sa, sz), fy(0.3, sz), fx(sb, sz) - fx(sa, sz), fy(0, sz) - fy(0.3, sz)), { tone: (x, y) => clamp(0.4 + 0.2 * (1 - pool(x, y, flame, 90, 1))), layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2036, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] });
  // ---------------------------------------------------------------- the lamp on its iron bracket, and its glow
  { const wx = fx(la), top = fy(ly + 0.5);
    P.line([[wx, top - 16], [wx, top - 2]], 1.3, 1); P.line(cr([[wx - 14, top - 16], [wx, top - 15], [wx, top - 4]], false, 4), 1.6, 1);
    lantern(P, wx, top + 2, portrait ? 0.8 : 0.9, 2050); }
  glow(P, flame[0], flame[1] + 4, portrait ? 96 : 100, portrait ? 80 : 84, 0.8);
  P.raw('<ellipse cx="' + f1(flame[0]) + '" cy="' + f1(flame[1] + 10) + '" rx="' + (portrait ? 70 : 74) + '" ry="' + (portrait ? 58 : 62) + '" fill="url(#warm)" fill-opacity=".5" filter="url(#rag)" style="mix-blend-mode:screen"/>');
  // ---------------------------------------------------------------- the line with its sheets, from the hook on the wall to the post in the street
  const A = D.a, B = D.b, at = (t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + 7 * Math.sin(Math.PI * t) * (portrait ? 1 : 1.4)];
  const sc = (t) => D.s0 + (D.s1 - D.s0) * t, sheet = {}; const rects = [];
  { const wob = rng(77);
    P.part(box(A[0] - 5, A[1] - 5, 8, 8), { tone: () => 0.6, layers: [], seed: 2060, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
    const pts = []; for (let k = 0; k <= 20; k++) pts.push(at(k / 20)); P.line(pts, 1.1, 0.95);
    SHEETS.forEach((t, i) => {
      const [x, y] = at(t), s = sc(t), w = 21 * s * (portrait ? 1 : 1.25), h = 29 * s * (portrait ? 1 : 1.25), sk = (wob() - 0.5) * 3;
      const lightAt = (px, py) => pool(px, py, [flame[0], flame[1] + 6], D.reach * 1.1, 0.9);
      P.part([[x - w / 2 + sk, y + 2, 1], [x + w / 2 + sk, y + 2, 1], [x + w / 2 + sk * 1.4, y + h, 1], [x - w / 2 + sk * 0.6, y + h, 1]], { tone: (px, py) => clamp(0.1 + 0.25 * (1 - lightAt(px, py)) + 0.5 * sstep(y + h * 0.42, y + h * 0.62, py)), layers: [hatch(88, 2.0, 0.9, 0.05, 1.8), hatch(-20, 3.4, 0.7, 0.4)], seed: 2061 + i, fill: PAPER, halo: 0.5, outline: 0.9, wash: ['#e6c98c', 0.3] });
      for (let k = 0; k < 7; k++) { const yy = y + 5 + k * (h * 0.075), a = x - w * 0.36 + sk * 0.3, b = x + w * 0.36 + sk * 0.3 - (k % 3) * w * 0.12; P.line([[a, yy], [b, yy]], 0.55, 0.55 - 0.6 * sstep(0.35, 0.55, (yy - y) / h)); }
      for (const dx of [-0.32, 0.32]) P.raw('<rect x="' + f1(x + dx * w + sk * 0.1 - 1.1) + '" y="' + f1(y - 2.2) + '" width="2.2" height="5" fill="#a7692f" stroke="' + ink + '" stroke-width=".5"/>');
      rects.push([x - w / 2 + sk, y - 2, w, h + 2]);
    });
    const [px, py] = B, ph = 70 * (D.m / 300) * (portrait ? 1 : 0.9);
    P.part(box(px - 5, py, 10, ph), { tone: (x) => clamp(0.3 + 0.3 * sstep(px - 5, px + 5, x)), layers: [hatch(90, 1.6, 1.2, 0.08, 1.8), hatch(18, 2.4, 0.8, 0.5)], seed: 2070, fill: CARD, halo: 0.6, outline: 1.2, wash: [WASH.wood2, 0.75] });
    P.part(cr([[px - 6.5, py + 1, 1], [px - 4, py - 3], [px + 4, py - 3], [px + 6.5, py + 1, 1]], true, 3), { tone: () => 0.4, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2071, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.65] }); }
  // the near sheet that the light reaches half way: the one closest to the lamp
  let best = 0, bd = 1e9; rects.forEach((r, i) => { const d = Math.abs(r[0] + r[2] / 2 - flame[0]); if (d < bd) { bd = d; best = i; } });
  const sheetRect = rects[best], tread = fy(0.3, sz), stepRect = [fx(sa) - 2, tread - 22, fx(sb) - fx(sa) + 4, 24];
  const layers = { 'step-apple': { at: [fx(sa) + 4, tread - 21], width: 22 }, 'lone-slip': { at: [fx(sb) - 36, tread - 14], width: 32 } };
  const lampRect = [flame[0] - 11, fy(ly + 0.5) - 17, 22, 42], post = [B[0], B[1]];
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], flame, post, layers, keys: { lamp: lampRect, sheet: sheetRect, step: stepRect }, step: [fx(sa), fy(0.3), fx(sb) - fx(sa), fy(0.3, sz) - fy(0.3)], svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
