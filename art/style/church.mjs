// Chapter 13 Oberndorf in Salzburg country, the evening of 24/12/1818: the front of a village church seen head-on, a plain plastered wall under a snow roof, one closed double door of plank on
// two snow-capped steps with a thread of candle light through the seam and a strip of it on the snow, and a small open porch beside the door whose roof throws the dark where the crow waits.
// Nobody on the steps, no footprint, no window lit, no face. The lit square that the machine throws on the door is a separate layer.
import { clamp, sstep, f1, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, BERRY, view } from './scenery.mjs';
import { nightSky, crystals } from './night.mjs';

const WOOD = '#6b3d1a', TILE = '#8a6a3c';
const DESIGN = {
  portrait: { m: 250, z: 7, half: 5.8, door: [0.5, 2.0], dt: 2.8, porch: [2.65, 5.2], reach: 90, win: [-2.9, -2.0], snowWin: 0, side: 1 },
  landscape: { m: 215, z: 4.6, half: 9.4, door: [-0.7, 0.9], dt: 2.9, porch: [-4.6, -1.5], reach: 80, win: [3.0, 3.9], side: -1 },
};
export const DOOR_FRAME = [60, 90];

export function church(orientation = 'portrait') {
  const L = LAYOUTS['ch13-church'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs } = view(L, D.m), z0 = D.z, zf = z0 - 1.1;
  const P = new Plate(61);
  const fx = (X, z = z0) => vx + (X * D.m) / z, fy = (Y, z = z0) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = z0) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const base = fy(0), EAVE = 4.6, RIDGE = 7.2;
  const [da, db] = D.door, dc = (da + db) / 2, [pa, pb] = D.porch, DB = 0.5, DT = D.dt;
  const seam = [fx(dc), fy(DB + 0.5)];
  const tone = (x, y) => {
    const light = pool(x, y, [seam[0], fy(0.6)], D.reach, 0.9);
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 420 : 200)) * 0.8)) * 0.28;
    return clamp(0.84 - 0.7 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 14) - 0.5));
  };
  // ---------------------------------------------------------------- sky, the snow roof and the gable
  nightSky(P, { W, h: fy(EAVE) + 4, seed: 2101, n: portrait ? 40 : 60, fade: 0.45, top: 0.88 });
  { const l = fx(-D.half - 0.4), r = fx(D.half + 0.4), eave = fy(EAVE), ridge = fy(RIDGE), mid = (l + r) / 2;
    P.part([[l, eave, 1], [mid - 6, ridge, 1], [mid + 6, ridge, 1], [r, eave, 1]], { tone: (x, y) => clamp(0.18 + 0.3 * sstep(ridge, eave, y) + 0.1 * (vnoise(x * 0.05, y * 0.1, 2) - 0.5)), layers: [hatch(88, 2.6, 0.8, 0.12, 2.2), hatch(10, 3.6, 0.7, 0.5)], seed: 2102, fill: CARD, halo: 0, outline: 1.3, wash: [BLUE, 0.28] });
    P.line([[mid, ridge], [mid, ridge - 26]], 1.8, 1); P.line([[mid - 7, ridge - 17], [mid + 7, ridge - 17]], 1.8, 1); }
  // ---------------------------------------------------------------- the plastered wall, plinth and quoins
  const UL = -D.half, UR = D.half;
  P.part(wall(UL, UR, 0.45, EAVE), { tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.95 + 0.24)), layers: [hatch(2, 3.4, 1.1, 0.08, 2.4), hatch(78, 5, 0.8, 0.5)], seed: 2110, fill: CARD, halo: 0, outline: 1.3, wash: [BLUE, 0.42] });
  P.part(wall(UL, UR, 0, 0.5), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.24), layers: [hatch(0, 1.7, 1.1, 0.08, 1.8), hatch(72, 2.6, 0.8, 0.5)], seed: 2111, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
  P.part(wall(UL, UR, EAVE - 0.14, EAVE + 0.12), { tone: () => 0.5, layers: [hatch(0, 1.6, 1.1, 0.08, 1.8)], seed: 2112, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
  { const wa = D.win[0], wb2 = D.win[1], wx0 = fx(wa), wx1 = fx(wb2), wt = fy(3.5), wbm = fy(1.7), wm = (wx0 + wx1) / 2;
    P.part([[wx0 - 3, wbm + 3, 1], [wx0 - 3, wt + (wx1 - wx0) * 0.4, 1], [wm, wt - 4, 1], [wx1 + 3, wt + (wx1 - wx0) * 0.4, 1], [wx1 + 3, wbm + 3, 1]], { tone: () => 0.5, layers: [hatch(80, 1.6, 1.1, 0.08, 1.6)], seed: 2113, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.6] });
    P.part([[wx0, wbm, 1], [wx0, wt + (wx1 - wx0) * 0.4, 1], [wm, wt, 1], [wx1, wt + (wx1 - wx0) * 0.4, 1], [wx1, wbm, 1]], { tone: () => 0.97, layers: [hatch(80, 1.5, 1.2, 0.1, 1.6), hatch(20, 2.4, 0.9, 0.5)], seed: 2114, fill: CARD, halo: 0, outline: 1.0, wash: [BLUE, 0.55] });
    P.line([[wm, wt], [wm, wbm]], 0.9, 0.9); P.line([[wx0, (wt + wbm) / 2 + 4], [wx1, (wt + wbm) / 2 + 4]], 0.9, 0.9);
    P.part(box(wx0 - 5, wbm + 3, wx1 - wx0 + 10, 5), { tone: () => 0.4, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2115, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] }); }
  for (let k = 0; k < 9; k++) for (const X of [UL, UR - 0.45]) P.part(wall(X, X + 0.45, 0.5 + k * 0.5, 0.5 + k * 0.5 + 0.47), { tone: () => 0.55 + 0.1 * (k % 2), layers: [hatch(0, 1.7, 1.0, 0.1, 1.8)], seed: 2116 + k, fill: CARD, halo: 0, outline: 0.8, wash: [STONE, 0.5] });
  // ---------------------------------------------------------------- the snow on the ground, the steps and the candle strip on them
  const ground = [[-20, base - 2], [W + 20, base - 2], [W + 20, H + 10], [-20, H + 10]];
  P.part(ground, { tone: (x, y) => Math.min(0.55, clamp(0.1 + tone(x, y) * 0.5 + 0.08 * (vnoise(x * 0.04, y * 0.12, 6) - 0.5))), layers: [{ angle: 0.5, gap: 5.6, w: 0.8, lo: 0.2, step: 2.8, wob: 0.6 }, hatch(-30, 8.5, 0.6, 0.6)], seed: 2120, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.3] });
  { const r = rng(21), up = [], lo = []; for (let X = UL; X <= UR; X += 0.3) { up.push([fx(X), base - 3 - 3 * r()]); } for (let X = UR; X >= UL; X -= 0.3) lo.push([fx(X), base + 6 + 4 * r()]);
    P.part([...up, ...lo], { tone: (x, y) => clamp(0.1 + 0.25 * (1 - pool(x, y, seam, D.reach, 1))), layers: [hatch(0, 2.6, 0.7, 0.12, 1.8)], seed: 2121, fill: CARD, halo: 0, outline: 1.0, wash: [BLUE, 0.25] }); }
  const st = (i) => { const Y = 0.5 - 0.18 * (i + 1), zz = z0 - 0.55 * (i + 1); return [[fx(da - 0.35 - 0.12 * i, zz), fy(Y, zz), 1], [fx(db + 0.35 + 0.12 * i, zz), fy(Y, zz), 1], [fx(db + 0.35 + 0.12 * i, zz), fy(0, zz), 1], [fx(da - 0.35 - 0.12 * i, zz), fy(0, zz), 1]]; };
  for (let i = 1; i >= 0; i--) { const q = st(i); P.part(q, { tone: (x, y) => clamp(0.04 + 0.2 * (1 - pool(x, y, seam, D.reach, 1))), layers: [hatch(0, 2.2, 0.9, 0.08, 1.6)], seed: 2122 + i, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.1] });
    const Y = 0.5 - 0.18 * (i + 1), zz = z0 - 0.55 * (i + 1), zp = zz + 0.55;
    P.part([[fx(da - 0.35 - 0.12 * i, zp), fy(Y, zp), 1], [fx(db + 0.35 + 0.12 * i, zp), fy(Y, zp), 1], [fx(db + 0.35 + 0.12 * i, zz), fy(Y, zz), 1], [fx(da - 0.35 - 0.12 * i, zz), fy(Y, zz), 1]], { tone: (x, y) => clamp(0.06 + 0.16 * (1 - pool(x, y, seam, D.reach, 1))), layers: [hatch(0, 2.4, 0.7, 0.1, 1.8)], seed: 2124 + i, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.2] }); }
  { const yb = fy(0, z0 - 1.1) - 2, yt = H, h0 = fx(db) - fx(da), x0 = seam[0]; P.raw('<defs><linearGradient id="candlestrip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd25a" stop-opacity=".7"/><stop offset=".5" stop-color="#f4b447" stop-opacity=".38"/><stop offset="1" stop-color="#f0a53a" stop-opacity="0"/></linearGradient></defs>');
    P.raw('<path d="M' + f1(x0 - h0 * 0.45) + ' ' + f1(yb) + 'L' + f1(x0 + h0 * 0.45) + ' ' + f1(yb) + 'L' + f1(x0 + h0 * 1.4) + ' ' + f1(yb + (portrait ? 70 : 50)) + 'L' + f1(x0 - h0 * 1.4) + ' ' + f1(yb + (portrait ? 70 : 50)) + 'Z" fill="url(#candlestrip)" filter="url(#rag)" style="mix-blend-mode:multiply"/>'); }
  // ---------------------------------------------------------------- the open porch beside the door: soffit, roof edge, two posts and a low rail; the dark under it
  const sgn = D.side, px0 = Math.min(pa, pb), px1 = Math.max(pa, pb);
  P.part(wall(px0, px1, 0.5, 2.8), { tone: (x, y) => clamp(0.74 + 0.1 * sstep(fy(0.5), fy(2.8), y) * 0 + 0.1 * (vnoise(x * 0.06, y * 0.06, 3) - 0.5)), layers: [hatch(2, 2.2, 1.1, 0.08, 2.0), hatch(78, 3.0, 0.9, 0.4)], seed: 2130, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.5] });
  P.part([[fx(px0), fy(2.95), 1], [fx(px1), fy(2.95), 1], [fx(px1, zf), fy(2.62, zf), 1], [fx(px0, zf), fy(2.62, zf), 1]], { tone: () => 0.85, layers: [hatch(0, 1.5, 1.2, 0.06, 1.6), hatch(84, 2.4, 0.9, 0.4)], seed: 2131, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.6] });
  for (const X of [px0 + 0.1, px1 - 0.25]) P.part(wall(X, X + 0.18, 0, 2.62, zf), { tone: (x) => clamp(0.4 + 0.3 * sstep(fx(X, zf), fx(X + 0.18, zf), x) + 0.25), layers: [hatch(90, 1.7, 1.1, 0.06, 1.8)], seed: 2132, fill: CARD, halo: 0.6, outline: 1.2, wash: [WASH.wood2, 0.7] });
  P.part(wall(px0 + 0.3, px1 - 0.4, 0.36, 0.45, zf), { tone: () => 0.5, layers: [hatch(0, 1.6, 1.1, 0.06, 1.8)], seed: 2136, fill: CARD, halo: 0.5, outline: 1.2, wash: [WASH.wood2, 0.72] });
  for (const X of [px0 + 0.45, px1 - 0.55]) P.part(wall(X, X + 0.12, 0, 0.36, zf), { tone: () => 0.5, layers: [hatch(90, 1.7, 1.1, 0.06, 1.8)], seed: 2137, fill: CARD, halo: 0.5, outline: 1.1, wash: [WASH.wood2, 0.72] });
  P.part(wall(px0, px1, 0.72, 0.86, zf), { tone: () => 0.5, layers: [hatch(0, 1.6, 1.1, 0.06, 1.8)], seed: 2133, fill: CARD, halo: 0.5, outline: 1.2, wash: [WASH.wood2, 0.72] });
  for (let k = 1; k < 7; k++) { const X = px0 + ((px1 - px0) * k) / 7; P.line([[fx(X, zf), fy(0.1, zf)], [fx(X, zf), fy(0.72, zf)]], 1.1, 0.9); }
  P.part(wall(px0 - 0.15, px1 + 0.15, 2.6, 2.86, zf), { tone: () => 0.55, layers: [hatch(0, 1.6, 1.1, 0.06, 1.8)], seed: 2134, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.7] });
  P.part(wall(px0 - 0.25, px1 + 0.25, 2.86, 3.1, zf), { tone: (x, y) => clamp(0.1 + 0.15 * (vnoise(x * 0.1, y * 0.2, 4) - 0.5) + 0.1), layers: [hatch(0, 2.4, 0.6, 0.12, 1.8)], seed: 2135, fill: CARD, halo: 0, outline: 1.2, wash: [BLUE, 0.18] });
  // ---------------------------------------------------------------- the door: stone surround, two leaves of plank, iron straps, ring, and light along the seam
  const dx0 = fx(da), dx1 = fx(db), dt = fy(DT), dbm = fy(DB), dm = (dx0 + dx1) / 2, lt = fy(DT + 0.38);
  P.part([[dx0 - 6, dbm + 2, 1], [dx0 - 6, lt, 1], [dx1 + 6, lt, 1], [dx1 + 6, dbm + 2, 1]], { tone: (x, y) => clamp(0.28 + 0.3 * (1 - pool(x, y, seam, D.reach, 1))), layers: [hatch(0, 1.5, 1.1, 0.08, 1.8), hatch(84, 2.4, 0.8, 0.5)], seed: 2140, fill: CARD, halo: 0, outline: 1.3, wash: [STONE, 0.65] });
  P.part(box(dx0, dt, dx1 - dx0, dbm - dt), { tone: (x, y) => clamp(0.3 + 0.2 * sstep(dx0, dx1, x) * 0 + 0.3 * (1 - pool(x, y, seam, D.reach * 1.2, 0.9)) + 0.1 * (vnoise(x * 0.1, y * 0.05, 8) - 0.5)), layers: [hatch(90, 1.5, 1.2, 0.08, 1.8), hatch(18, 2.4, 0.9, 0.5)], seed: 2141, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.7] });
  for (const f of [0.17, 0.33, 0.67, 0.83]) P.line([[dx0 + (dx1 - dx0) * f, dt], [dx0 + (dx1 - dx0) * f, dbm]], 0.6, 0.85);
  for (const f of [0.22, 0.72]) for (const [a, b] of [[dx0, dm - 2], [dm + 2, dx1]]) P.part(box(a + 1, dt + (dbm - dt) * f, b - a - 2, 3.4), { tone: () => 0.2, layers: [], seed: 2142, fill: CARD, halo: 0, outline: 0.9, wash: [ink, 0.55] });
  P.raw('<defs><linearGradient id="seamlight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd25a" stop-opacity=".25"/><stop offset=".5" stop-color="#fff3b0" stop-opacity=".95"/><stop offset="1" stop-color="#ffd25a" stop-opacity=".9"/></linearGradient></defs>');
  P.raw('<rect x="' + f1(dm - 1.1) + '" y="' + f1(dt + 2) + '" width="2.2" height="' + f1(dbm - dt - 2) + '" fill="url(#seamlight)" filter="url(#rag)"/>');
  P.raw('<rect x="' + f1(dx0 + 1) + '" y="' + f1(dbm - 2.2) + '" width="' + f1(dx1 - dx0 - 2) + '" height="2" fill="#fff3b0" fill-opacity=".85" filter="url(#rag)"/>');
  P.raw('<circle cx="' + f1(dm - 5) + '" cy="' + f1((dt + dbm) / 2) + '" r="2.3" fill="none" stroke="' + ink + '" stroke-width=".9"/>'); P.raw('<circle cx="' + f1(dm + 5) + '" cy="' + f1((dt + dbm) / 2) + '" r="2.3" fill="none" stroke="' + ink + '" stroke-width=".9"/>');
  glow(P, seam[0], seam[1] + 10, portrait ? 60 : 70, portrait ? 70 : 90, 0.6);
  crystals(P, [0, 0, W, H], portrait ? 220 : 260, 93, (x, y) => tone(x, y) > 0.3);
  const doorRect = [dx0 - 1, dt - 1, dx1 - dx0 + 2, dbm - dt + 2];
  const rail = [fx(portrait ? 3.3 : -1.9, zf), fy(0.45, zf)];
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], door: [dx0, dt, dx1 - dx0, dbm - dt], rail, layers: { 'door-shadows': { at: [dx0, dt], width: dx1 - dx0 }, 'choir-mark': { at: [dx0, dt], width: dx1 - dx0 }, 'door-calendar': { at: [dm - 12, dt + (dbm - dt) * 0.48], width: 24 } }, keys: { portal: doorRect }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
