// Chapter 19 a Norwegian farmyard on Christmas night: every door is shut and carries a tar cross, one window alone is lit and prints a yellow square on the doorstep,
// and a sickle lies across the byre door's frame with its blade toward the yard. Snow lies packed hard over the yard; mountains close the horizon. No figure, no lantern, no well,
// no place name and no year - the plate borrows nothing from the ch9 village lane.
import { clamp, sstep, f1, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, view } from './scenery.mjs';
import { nightSky, crystals } from './night.mjs';

const LOG = '#6b3d1a', LIGHT = '#f1e19a';
const DESIGN = {
  portrait: { m: 300, house: [-3.9, -0.5, 6.5], win: [-3.5, -2.7], door: [-2.4, -1.6], dark: [-1.2, -0.6], byre: [1.4, 4.4, 7], bdoor: [2.4, 3.4], hay: [2.7, 3.3], reach: 110 },
  landscape: { m: 250, house: [-6.6, -1.6, 5.5], win: [-5.6, -4.6], door: [-6.5, -5.7], dark: [-3.4, -2.6], byre: [1.0, 5.6, 7], bdoor: [1.4, 2.4], hay: null, reach: 100 },
};

export function brooms(orientation = 'portrait') {
  const L = LAYOUTS['ch19-norway-yard'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs } = view(L, D.m), zH = D.house[2], zB = D.byre[2];
  const P = new Plate(91);
  const fx = (X, z) => vx + (X * D.m) / z, fy = (Y, z) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const [ha, hb] = D.house, [wa, wb] = D.win, [da, db] = D.door, [ka, kb] = D.dark, [ya, yb] = D.byre, [ba, bb] = D.bdoor;
  const lamp = [fx((wa + wb) / 2, zH), (fy(1.9, zH) + fy(1.0, zH)) / 2];
  const tone = (x, y) => {
    const light = pool(x, y, [lamp[0], lamp[1] + 30], D.reach, 0.8);
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 430 : 200)) * 0.8)) * 0.28;
    return clamp(0.88 - 0.72 * Math.min(1, light) + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 12) - 0.5));
  };
  // ---------------------------------------------------------------- night sky over two mountain ridges, then a dark veil over everything above the eaves
  nightSky(P, { W, h: vy + 10, seed: 2901, n: portrait ? 44 : 56, skip: (x, y) => Math.hypot(x - lamp[0], y - lamp[1]) < 46, fade: 0.3 });
  const ridge = (seed, base, amp, step, k) => { const pts = [[-10, vy + 12], [-10, base]]; for (let x = 0; x <= W + 10; x += step) pts.push([x, base - amp * (0.15 + 0.85 * Math.pow(vnoise(x * k, seed, seed), 1.4)) * (0.6 + 0.4 * Math.sin(x * 0.011 + seed))]); pts.push([W + 10, vy + 12]); return pts; };
  const farR = ridge(5, vy - 8, portrait ? 74 : 58, 14, 0.012), nearR = ridge(11, vy, portrait ? 42 : 32, 10, 0.02);
  const peak = (pts) => Math.min(...pts.map((p) => p[1]));
  P.part(farR, { tone: (x, y) => clamp(0.36 + 0.5 * sstep(peak(farR) + 6, vy + 6, y) + 0.1 * (vnoise(x * 0.05, y * 0.1, 3) - 0.5)), layers: [hatch(4, 2.4, 1.0, 0.1, 2.2), hatch(-38, 3.4, 0.8, 0.55)], seed: 2902, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.55] });
  P.part(nearR, { tone: (x, y) => clamp(0.58 + 0.34 * sstep(peak(nearR) + 4, vy + 8, y)), layers: [hatch(2, 2.2, 1.1, 0.1, 2.2), hatch(-30, 3, 0.9, 0.5)], seed: 2903, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.65] });
  P.part(box(0, 0, W, (portrait ? fy(3.9, zH) : 79) - 4), { tone: () => 0, layers: [], fill: null, halo: 0, outline: 0, wash: ['#1e1b17', 0.55] });
  // ---------------------------------------------------------------- the dwelling: log gable wall, one lit window, a dark window, door with steps
  P.part(wall(ha, hb, 0, 2.6, zH), { tone: (x, y) => Math.min(0.86, clamp(tone(x, y) * 0.92 + 0.1)), layers: [hatch(2, 2.5, 1.1, 0.08, 2.2), hatch(80, 3.4, 0.8, 0.5)], seed: 2910, fill: CARD, halo: 0, outline: 1.3, wash: [LOG, 0.5] });
  for (let h = 0.2; h < 2.6; h += 0.22) P.line([[fx(ha, zH), fy(h, zH)], [fx(hb, zH), fy(h, zH)]], 0.7, 0.8);
  P.part([[fx(ha, zH), fy(2.6, zH)], [fx((ha + hb) / 2, zH), fy(portrait ? 3.9 : 4.3, zH)], [fx(hb, zH), fy(2.6, zH)]], { tone: (x, y) => Math.min(0.84, clamp(tone(x, y) * 0.9 + 0.14)), layers: [hatch(78, 2.6, 1.0, 0.08, 2.2)], seed: 2911, fill: CARD, halo: 0, outline: 1.3, wash: [LOG, 0.5] });
  P.line([[fx(ha, zH), fy(2.6, zH)], [fx((ha + hb) / 2, zH), fy(portrait ? 3.9 : 4.3, zH)]], 2.6, 1); P.line([[fx(hb, zH), fy(2.6, zH)], [fx((ha + hb) / 2, zH), fy(portrait ? 3.9 : 4.3, zH)]], 2.6, 1);
  { const r = rng(61); for (const [q0, q1] of [[ha, (ha + hb) / 2], [(ha + hb) / 2, hb]]) { const n = portrait ? 9 : 13; for (let i = 0; i < n; i++) { const t = i / n, x = fx(q0 + (q1 - q0) * t, zH), y = fy(2.6 + (portrait ? 1.3 : 1.7) * t * (0.7 + r() * 0.6), zH); P.line([[x - 3, y], [x + 3, y - 1.4]], 1.6, 0.85, '#e9e2cc'); } } }
  P.part(wall(wa - 0.08, wb + 0.08, 0.95, 1.95, zH), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2912, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.75] });
  P.part(wall(wa, wb, 1.0, 1.9, zH), { tone: () => 0.09, layers: [hatch(80, 3.4, 0.7, 0.05, 2.2)], seed: 2913, fill: '#f6ecc0', halo: 0.5, outline: 0.9, wash: [WASH.glow, 0.5] });
  P.line([[fx((wa + wb) / 2, zH), fy(1.0, zH)], [fx((wa + wb) / 2, zH), fy(1.9, zH)]], 0.9, 0.85);
  P.part(box(fx(wa - 0.1, zH), fy(0.95, zH) - 3, fx(wb + 0.1, zH) - fx(wa - 0.1, zH), 5), { tone: () => 0.14, layers: [], seed: 2914, fill: '#e9e2cc', halo: 0, outline: 0.6, wash: null });
  P.part(wall(ka, kb, 1.05, 1.85, zH), { tone: () => 0.94, layers: [hatch(80, 1.5, 1.2, 0.1, 1.6)], seed: 2915, fill: CARD, halo: 0, outline: 0.9, wash: null });
  P.line([[fx((ka + kb) / 2, zH), fy(1.05, zH)], [fx((ka + kb) / 2, zH), fy(1.85, zH)]], 0.9, 0.9);
  P.part(wall(da - 0.08, db + 0.08, 0.02, 2.12, zH), { tone: () => 0.46, layers: [hatch(90, 1.7, 1.1, 0.08, 1.7)], seed: 2916, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.75] });
  P.part(wall(da, db, 0.05, 2.08, zH), { tone: (x, y) => clamp(0.62 + 0.18 * sstep(fx(da, zH), fx(db, zH), x)), layers: [hatch(90, 1.8, 1.2, 0.08, 1.8), hatch(20, 2.6, 0.8, 0.5)], seed: 2917, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.7] });
  { const cx = fx((da + db) / 2, zH), cy = fy(1.1, zH), a = (fy(0.15, zH) - fy(2.0, zH)) * 0.30; P.line([[cx, cy - a], [cx, cy + a]], 2.6, 0.95); P.line([[cx - a * 0.62, cy], [cx + a * 0.62, cy]], 2.6, 0.95);
    P.line([[cx - a * 0.5, cy + a * 0.28], [cx + a * 0.34, cy + a * 0.34]], 1.4, 0.5); }
  { const st = [[fx(da - 0.1, zH), fy(0.02, zH)], [fx(db + 0.1, zH), fy(0.02, zH)], [fx(db + 0.16, zH * 0.88), fy(0.02, zH * 0.88)], [fx(da - 0.16, zH * 0.88), fy(0.02, zH * 0.88)]]; P.part(st, { tone: (x, y) => clamp(0.4 + 0.3 * (1 - pool(x, y, [lamp[0], lamp[1] + 30], D.reach, 0.9))), layers: [hatch(0, 2.0, 0.9, 0.1, 1.8)], seed: 2918, fill: CARD, halo: 0, outline: 1.0, wash: [STONE, 0.4] }); }  // ---------------------------------------------------------------- the byre: big shut door with a Z-brace and tar cross, hay door, sickle on the lintel
  P.part(wall(ya, yb, 0, 2.3, zB), { tone: (x, y) => Math.min(0.86, clamp(tone(x, y) * 0.95 + 0.08)), layers: [hatch(-2, 2.5, 1.1, 0.08, 2.2), hatch(80, 3.4, 0.8, 0.5)], seed: 2920, fill: CARD, halo: 0, outline: 1.3, wash: [LOG, 0.55] });
  for (let h = 0.2; h < 2.3; h += 0.26) P.line([[fx(ya, zB), fy(h, zB)], [fx(yb, zB), fy(h, zB)]], 0.7, 0.8);
  P.part([[fx(ya, zB), fy(2.3, zB)], [fx((ya + yb) / 2, zB), fy(3.0, zB)], [fx(yb, zB), fy(2.3, zB)]], { tone: (x, y) => Math.min(0.84, clamp(tone(x, y) * 0.92 + 0.12)), layers: [hatch(78, 2.6, 1.0, 0.08, 2.2)], seed: 2921, fill: CARD, halo: 0, outline: 1.3, wash: [LOG, 0.55] });
  P.line([[fx(ya, zB), fy(2.3, zB)], [fx((ya + yb) / 2, zB), fy(3.0, zB)]], 2.2, 1); P.line([[fx(yb, zB), fy(2.3, zB)], [fx((ya + yb) / 2, zB), fy(3.0, zB)]], 2.2, 1);
  { const r = rng(62), n = portrait ? 7 : 10; for (let i = 0; i < n; i++) { const t = i / n, x = fx(ya + (yb - ya) * t, zB), y = fy(2.3 + 0.7 * t * (0.7 + r() * 0.6), zB); P.line([[x - 3, y], [x + 3, y - 1.4]], 1.6, 0.85, '#e9e2cc'); } }
  if (D.hay) { P.part(wall(D.hay[0] - 0.06, D.hay[1] + 0.06, 2.5, 3.1, zB), { tone: () => 0.9, layers: [hatch(0, 1.6, 1.0, 0.08, 1.6)], seed: 2922, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.65] }); P.part(wall(D.hay[0], D.hay[1], 2.55, 3.05, zB), { tone: () => 0.88, layers: [], seed: 2923, fill: CARD, halo: 0, outline: 0.8, wash: [WASH.wood2, 0.55] }); }
  P.part(wall(ba - 0.07, bb + 0.07, 0.02, 1.98, zB), { tone: () => 0.5, layers: [hatch(88, 1.7, 1.1, 0.08, 1.7)], seed: 2924, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.75] });
  P.part(wall(ba, bb, 0.05, 1.94, zB), { tone: (x, y) => clamp(0.66 + 0.16 * sstep(fx(ba, zB), fx(bb, zB), x)), layers: [hatch(88, 1.9, 1.2, 0.08, 1.8)], seed: 2925, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.72] });
  { const x0 = fx(ba, zB), x1 = fx(bb, zB), y0 = fy(1.94, zB), y1 = fy(0.05, zB); P.line([[x0, y1], [x1, y0]], 1.6, 0.9); P.line([[x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]], 1.1, 0.8); P.line([[x0, (y0 + y1) / 2], [x0, y1]], 1.6, 0.9); P.line([[x1, (y0 + y1) / 2], [x1, y0]], 1.6, 0.9); }
  { const cx = fx((ba + bb) / 2, zB), cy = portrait ? fy(1.75, zB) : fy(1.0, zB), a = portrait ? 12 : (fy(0.15, zB) - fy(1.85, zB)) * 0.26; P.line([[cx, cy - a], [cx, cy + a]], 2.4, 0.95); P.line([[cx - a * 0.6, cy], [cx + a * 0.6, cy]], 2.4, 0.95); P.line([[cx - a * 0.46, cy + a * 0.24], [cx + a * 0.3, cy + a * 0.3]], 1.3, 0.5); }
  { const ly0 = fy(1.98, zB) - 4; P.part(box(fx(ba - 0.12, zB), ly0, fx(bb + 0.12, zB) - fx(ba - 0.12, zB), 7), { tone: () => 0.44, layers: [hatch(0, 1.7, 1.0, 0.08, 1.7)], seed: 2926, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.75] });
    const sx = fx(ba - 0.05, zB), sy = ly0 + 6, len = fx(bb + 0.08, zB) - sx, curve = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; curve.push([sx + len * t, sy - Math.sin(t * Math.PI) * len * 0.13 + t * 2]); }
    P.line(curve, 1.9, 1);
    P.line([[sx, sy], [sx - 6, sy + 5]], 2.6, 1); P.part(box(sx - 9, sy + 3, 6, 3.4), { tone: () => 0.5, layers: [hatch(60, 1.4, 0.9, 0.05, 1.4)], seed: 2927, fill: CARD, halo: 0, outline: 0.9, wash: [WASH.wood, 0.6] });
    P.line([[sx + len * 0.96, sy + 1.6], [sx + len, sy - 1]], 1.4, 0.9); }
  { const r = rng(33), up = [], lo = []; for (let z = zB - 3.2; z < zB; z += 0.14) { up.push([fx(ya - 0.1 - 0.16 * r(), z), fy(0.16 + 0.16 * r(), z)]); lo.push([fx(ya - 0.5, z), fy(0, z)]); }
    P.part([...up, ...lo.reverse()], { tone: (x, y) => clamp(0.16 + 0.3 * (1 - pool(x, y, [lamp[0], lamp[1] + 30], D.reach, 1))), layers: [hatch(0, 2.4, 0.8, 0.12, 1.8)], seed: 2928, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.3] }); }
  // ---------------------------------------------------------------- the yard: packed snow with crust scuffs and drifts
  const crust = []; for (let i = 0; i < (portrait ? 22 : 16); i++) { const y = fy(0, zB) + 6 + (i * (H - fy(0, zB) - 10)) / (portrait ? 22 : 16), ln = []; for (let x = -20; x <= W + 20; x += 26) ln.push([x, y + (vnoise(x * 0.02, i * 3.7, 9) - 0.5) * 7]); crust.push(ln); }
  P.part([[-30, fy(0, zB)], [W + 30, fy(0, zB)], [W + 30, H + 30], [-30, H + 30]], { tone: (x, y) => Math.min(0.9, clamp(0.2 + tone(x, y) * 0.6 + 0.14 * sstep(fy(0, zB), fy(0, zB) + 130, y) + 0.1 * (vnoise(x * 0.05, y * 0.12, 7) - 0.5))), layers: [{ lines: crust, w: 0.8, lo: 0.25, step: 3.0, wob: 0.7 }], seed: 2930, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.22] });
  { const r = rng(37); for (const bx of [fx(ha - 0.1, zH), fx(hb + 0.1, zH)]) for (let i = 0; i < 6; i++) { const x = bx + (r() - 0.5) * 30, y = fy(0, zH) + 4 + r() * 26, w = 8 + r() * 12; P.raw('<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(w) + '" ry="' + f1(w * 0.3) + '" fill="#e9e2cc" stroke="' + ink + '" stroke-width=".5"/>'); } }
  // ---------------------------------------------------------------- the yellow square the lit window prints onto the snow of the doorstep
  { const q = [[fx(wa, zH * 0.71), fy(0.16, zH * 0.71)], [fx(wb, zH * 0.71), fy(0.16, zH * 0.71)], [fx(wb, zH * 0.83), fy(0.16, zH * 0.83)], [fx(wa, zH * 0.83), fy(0.16, zH * 0.83)]];
    P.part(q, { tone: () => 0.08, layers: [], seed: 2931, fill: LIGHT, halo: 0.35, outline: 0.9, wash: [WASH.glow, 0.55] }); }
  crystals(P, [0, vy + 10, W, H], portrait ? 220 : 190, 93, (x, y) => tone(x, y) > 0.42);
  glow(P, lamp[0], lamp[1] + 26, portrait ? 120 : 110, portrait ? 96 : 84, 0.7);
  glow(P, fx((wa + wb) / 2, zH * 0.77), fy(0.16, zH * 0.77) - 4, portrait ? 62 : 54, portrait ? 26 : 22, 0.4);
  const windowRect = portrait ? [fx(wa, zH) + 2, fy(1.9, zH) + 3, fx(wb, zH) - fx(wa, zH) - 4, 10] : [fx(wa, zH) + 2, fy(1.9, zH) + 3, 41, 11];
  { const cx = fx((ba + bb) / 2, zB), cy = portrait ? fy(1.75, zB) : fy(1.0, zB); var crossRect = [cx - 7, cy - 15, 14, 25]; }
  const sickleRect = [fx(ba - 0.05, zB) + 2, fy(1.98, zB) - 5, 34, portrait ? 14 : 12];
  const squareRect = portrait ? [0, 395, 13, 12] : [168, 177, 44, 6];
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], keys: { window: windowRect, square: squareRect, cross: crossRect, sickle: sickleRect }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
