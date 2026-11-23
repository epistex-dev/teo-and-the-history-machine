// Chapter 9 Alpine village in a winter night about 1582: a narrow snow lane between log houses falls away at its head. One lantern on a post hangs over the well; past its glow the slope sinks into dark
// under a ridge of mountains. Snow lies on the steps and the roof edges, pine logs are stacked under the eaves. No figure, no costume, no mask, no track.
import { clamp, sstep, f1, cr, vnoise, rng, fanLines, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, glow, flame } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, BERRY, view } from './scenery.mjs';
import { nightSky, crystals } from './night.mjs';

const DEEP = '#6c5a42', LOG = '#6b3d1a';
const EAVES = 2.35, ZEND = 9, ZNEAR = 0.8;
const DESIGN = {
  portrait: { m: 300, lane: 1.1, lamp: [-0.55, 8.6, 1.1], well: [0.25, 8.6], reach: 130, doors: { '-1': [[3.1, 3.8]], 1: [[6.6, 7.4]] }, wins: { '-1': [[4.3, 4.9]], 1: [[2.7, 3.3], [8.0, 8.6]] }, wood: { '-1': [[6.0, 7.8]], 1: [[3.6, 4.7]] } },
  landscape: { m: 250, lane: 2.4, lamp: [-0.8, 4.5, 1.45], well: [-0.4, 4.9], reach: 110, doors: { '-1': [[3.4, 4.3]], 1: [[6.6, 7.6]] }, wins: { '-1': [[5.0, 5.8]], 1: [[3.0, 3.8], [8.2, 9.0]] }, wood: { '-1': [[6.0, 8.0]], 1: [[4.3, 5.8]] } },
};

export function lantern(P, x, y, s, seed) {
  P.line([[x, y - 12 * s], [x, y]], 1.0);
  P.part(cr([[x - 8 * s, y + 1 * s, 1], [x - 5 * s, y - 3 * s], [x, y - 6 * s, 1], [x + 5 * s, y - 3 * s], [x + 8 * s, y + 1 * s, 1]], true, 3), { tone: () => 0.5, layers: [hatch(70, 1.3, 1.0, 0.1, 1.5)], seed, fill: '#8a6a3c', halo: 0, outline: 0.9, wash: [WASH.wood2, 0.7] });
  P.part(box(x - 6.5 * s, y + 1 * s, 13 * s, 21 * s), { tone: () => 0.1, layers: [hatch(80, 2.4, 0.6, 0.05, 1.6)], seed: seed + 1, fill: '#f6ecc0', halo: 0, outline: 1.1, wash: [WASH.glow, 0.8] });
  for (const k of [-0.33, 0.33]) P.line([[x + k * 13 * s, y + 1 * s], [x + k * 13 * s, y + 22 * s]], 0.7, 0.9);
  flame(P, x, y + 19 * s, 15 * s, seed + 2);
  P.part(box(x - 8 * s, y + 22 * s, 16 * s, 3.4 * s), { tone: () => 0.5, layers: [hatch(0, 1.3, 1.0, 0.1, 1.5)], seed: seed + 3, fill: '#8a6a3c', halo: 0, outline: 0.9, wash: [WASH.wood2, 0.7] });
}

export function village(orientation = 'portrait') {
  const L = LAYOUTS['ch9-village'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr, ray, quad } = view(L, D.m), LANE = D.lane;
  const P = new Plate(59);
  const [lX, lz, lY] = D.lamp, top = pr(lX, lY + 1.2, lz), lamp = [top[0] + (portrait ? 10 : 9), top[1] + 16];
  const crest = pr(0, 0, ZEND)[1];
  const tone = (x, y) => {
    const light = pool(x, y, [lamp[0], lamp[1] + 14], D.reach, 0.95);
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 420 : 190)) * 0.8)) * 0.3;
    return clamp(0.86 - 0.8 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 12) - 0.5));
  };
  // ---------------------------------------------------------------- sky and two ridges of mountains
  nightSky(P, { W, h: vy + 10, seed: 1901, n: portrait ? 50 : 70, skip: (x, y) => Math.hypot(x - lamp[0], y - lamp[1]) < 40, fade: 0.3 });
  const ridge = (seed, base, amp, step, k) => { const pts = [[-10, vy + 12], [-10, base]]; for (let x = 0; x <= W + 10; x += step) pts.push([x, base - amp * (0.15 + 0.85 * Math.pow(vnoise(x * k, seed, seed), 1.4)) * (0.6 + 0.4 * Math.sin(x * 0.011 + seed))]); pts.push([W + 10, vy + 12]); return pts; };
  const farR = ridge(3, vy - 6, portrait ? 78 : 60, 14, 0.012), nearR = ridge(9, vy + 2, portrait ? 44 : 34, 10, 0.02);
  const peak = (pts) => Math.min(...pts.map((p) => p[1]));
  P.part(farR, { tone: (x, y) => clamp(0.34 + 0.5 * sstep(peak(farR) + 6, vy + 6, y) + 0.1 * (vnoise(x * 0.05, y * 0.1, 3) - 0.5)), layers: [hatch(4, 2.4, 1.0, 0.1, 2.2), hatch(-38, 3.4, 0.8, 0.55)], seed: 1902, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.55] });
  P.part(nearR, { tone: (x, y) => clamp(0.55 + 0.35 * sstep(peak(nearR) + 4, vy + 8, y)), layers: [hatch(2, 2.2, 1.1, 0.1, 2.2), hatch(-30, 3, 0.9, 0.5)], seed: 1903, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.65] });
  // ---------------------------------------------------------------- the valley beyond the head of the slope: dark, a few unlit roofs far below
  const valley = [[-10, vy + 6], [W + 10, vy + 6], [W + 10, crest + 4], [-10, crest + 4]];
  P.part(valley, { tone: (x, y) => clamp(0.82 + 0.06 * (vnoise(x * 0.05, y * 0.1, 5) - 0.5)), layers: [hatch(1, 2.2, 1.2, 0.1, 2.2), hatch(-34, 3.2, 1.0, 0.5), hatch(60, 3.8, 0.8, 0.7)], seed: 1904, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.6] });
  { const r = rng(43), n = portrait ? 5 : 7; for (let i = 0; i < n; i++) { const x = vx + (r() - 0.5) * 230, y = vy + 12 + r() * (crest - vy - 22), s = 0.5 + 0.5 * ((y - vy) / (crest - vy)), w = 14 * s;
      P.part([[x - w, y, 1], [x - w * 0.3, y - 6 * s, 1], [x + w * 0.3, y - 6 * s, 1], [x + w, y, 1]], { tone: () => 0.5, layers: [hatch(88, 1.6, 1.0, 0.1, 1.6)], seed: 1905 + i, fill: CARD, halo: 0, outline: 0.8, wash: [BLUE, 0.4] });
      P.line([[x - w * 0.45, y - 5.4 * s], [x + w * 0.45, y - 5.4 * s]], 1.6 * s, 1, BERRY); } }
  // ---------------------------------------------------------------- the snow lane running to the crest
  const lane = quad([pr(-LANE, 0, ZEND), pr(LANE, 0, ZEND), ray(pr(LANE, 0, ZNEAR), W + 30), [W + 30, H + 30], [-30, H + 30], ray(pr(-LANE, 0, ZNEAR), -30)]);
  const fan = fanLines([vx, vy], Array.from({ length: 40 }, (_, i) => vx + (i - 20) * (portrait ? 26 : 30)), vy + 300, crest, H + 20);
  P.part(lane, { tone: (x, y) => Math.min(0.9, clamp(0.12 + 0.62 * sstep(vy + 130, crest - 4, 840 - y + 0 * x) * 0 + tone(x, y) * 0.85 + 0.45 * sstep(vy + 105, crest, y) * 0 + 0.1 * (vnoise(x * 0.05, y * 0.12, 7) - 0.5))), layers: [{ lines: fan, w: 0.9, lo: 0.3, step: 2.6, wob: 0.6 }], seed: 1910, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.3] });
  { const r = rng(17); for (let i = 0; i < (portrait ? 40 : 34); i++) { const z = 1.4 + Math.pow(r(), 1.3) * 7, X = (r() * 2 - 1) * LANE * 0.95, p = pr(X, 0, z), w = (0.5 + r() * 1.3) * (D.m / z) * 0.5;
    P.line(cr([[p[0] - w, p[1] + 1.2], [p[0] - w * 0.3, p[1] - 0.8], [p[0] + w * 0.4, p[1] - 0.6], [p[0] + w, p[1] + 1.4]], false, 4), 0.8, 0.55); } }
  // ---------------------------------------------------------------- log houses along both sides of the lane
  const wq = (X, y0, y1, a, b) => quad([pr(X, y1, a), pr(X, y1, b), pr(X, y0, b), pr(X, y0, a)]);
  for (const sg of [-1, 1]) {
    const X = sg * LANE;
    P.part(wq(X, 0, EAVES, ZNEAR, ZEND), { tone: (x, y) => Math.min(0.86, clamp(tone(x, y) * 0.92 + 0.1)), layers: [hatch(sg < 0 ? 12 : -12, 2.5, 1.1, 0.08, 2.2), hatch(80, 3.4, 0.8, 0.5)], seed: 1920 + sg, fill: CARD, halo: 0, outline: 1.3, wash: [LOG, 0.5] });
    for (let h = 0.2; h < EAVES; h += 0.2) P.line([pr(X, h, ZNEAR), pr(X, h, ZEND)], 0.7, 0.8);
    for (const z of [3.9, 6.1]) P.line([pr(X, 0, z), pr(X, EAVES, z)], 1.6, 1);
    // the eave: soffit, board, and the snow cornice lying over the roof edge
    const ox = sg * (LANE - 0.4);
    P.part(quad([pr(X, EAVES, ZNEAR), pr(ox, EAVES + 0.05, ZNEAR), pr(ox, EAVES + 0.05, ZEND), pr(X, EAVES, ZEND)]), { tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.8 + 0.28)), layers: [hatch(0, 1.7, 1.1, 0.08, 1.8), hatch(sg < 0 ? 12 : -12, 2.6, 0.8, 0.5)], seed: 1924 + sg, fill: CARD, halo: 0, outline: 1.2, wash: [LOG, 0.55] });
    P.part(wq(ox, EAVES + 0.05, EAVES + 0.24, ZNEAR, ZEND), { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.2), layers: [hatch(0, 1.7, 1.0, 0.08, 1.8)], seed: 1926 + sg, fill: CARD, halo: 0, outline: 1.2, wash: [LOG, 0.5] });
    { const r = rng(88 + sg), up = [], lo = []; for (let z = 1.0; z < ZEND; z *= 1.05) { up.push(pr(ox, EAVES + 0.24 + 0.1 + 0.16 * r(), z)); lo.push(pr(ox, EAVES + 0.2, z)); }
      P.part([...up, ...lo.reverse()], { tone: (x, y) => clamp(0.1 + 0.2 * (1 - pool(x, y, lamp, D.reach, 1))), layers: [hatch(0, 2.2, 0.8, 0.12, 1.8)], seed: 1928 + sg, fill: CARD, halo: 0, outline: 1.2, wash: [BLUE, 0.3] }); }
    // doors with half-buried steps, windows with shutters, pine logs stacked under the eave
    for (const [a, b] of D.doors[sg]) {
      P.part(wq(X, 0.05, 1.95, a, b), { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.3), layers: [hatch(90, 1.8, 1.1, 0.08, 1.8), hatch(22, 2.6, 0.8, 0.5)], seed: 1930 + Math.round(a * 10), fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.72] });
      for (let k = 1; k < 4; k++) P.line([pr(X, 0.05, a + ((b - a) * k) / 4), pr(X, 1.95, a + ((b - a) * k) / 4)], 0.6, 0.8);
      const st = quad([pr(X, 0.22, a - 0.05), pr(X, 0.22, b + 0.05), pr(X - sg * 0.5, 0.22, b + 0.05), pr(X - sg * 0.5, 0.22, a - 0.05)]);
      P.part(st, { tone: (x, y) => clamp(0.1 + 0.4 * (1 - pool(x, y, lamp, D.reach, 1))), layers: [hatch(0, 2.2, 0.8, 0.1, 1.8)], seed: 1934 + Math.round(a * 10), fill: CARD, halo: 0, outline: 1.2, wash: [BLUE, 0.3] });
    }
    for (const [a, b] of D.wins[sg]) {
      P.part(wq(X, 1.0, 1.9, a - 0.08, b + 0.08), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 1936 + Math.round(a * 10), fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.75] });
      P.part(wq(X, 1.05, 1.85, a, b), { tone: () => 0.96, layers: [hatch(80, 1.5, 1.2, 0.1, 1.6)], seed: 1938 + Math.round(a * 10), fill: CARD, halo: 0, outline: 0.9, wash: null });
      P.line([pr(X, 1.45, a), pr(X, 1.45, b)], 0.9, 0.9);
      P.part(quad([pr(X, 0.98, a - 0.12), pr(X, 0.98, b + 0.12), pr(X - sg * 0.12, 0.98, b + 0.12), pr(X - sg * 0.12, 0.98, a - 0.12)]), { tone: () => 0.05, layers: [], seed: 1939, fill: CARD, halo: 0, outline: 1.0, wash: [BLUE, 0.3] });
    }
    for (const [a, b] of D.wood[sg]) {
      const bx = sg * (LANE - 0.5), rows = 5;
      P.part(quad([pr(X, 0, a), pr(X, 0, b), pr(bx, 0, b), pr(bx, 0, a)]), { tone: () => 0.8, layers: [hatch(0, 2.2, 1.0, 0.1, 2.2)], seed: 1941 + sg, fill: CARD, halo: 0, outline: 0, wash: null });
      P.part(wq(bx, 0, 1.25, a, b), { tone: (x, y) => clamp(tone(x, y) * 0.7 + 0.22), layers: [hatch(88, 1.7, 1.1, 0.08, 1.8)], seed: 1943 + sg, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood, 0.55] });
      const z0 = a, z1 = b;
      for (let i = 0; i < rows; i++) for (let z = z0 + (i % 2) * 0.09; z < z1 - 0.05; z += 0.22) { const c = pr(bx, 0.12 + i * 0.24, z + 0.1), q = pr(bx, 0.12 + i * 0.24, z + 0.1), rr = Math.max(0.9, (0.09 * D.m) / (z + 0.1));
        P.raw('<ellipse cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" rx="' + f1(rr * 0.55) + '" ry="' + f1(rr) + '" fill="#e0d2ac" stroke="' + ink + '" stroke-width=".6"/><ellipse cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" rx="' + f1(rr * 0.2) + '" ry="' + f1(rr * 0.4) + '" fill="none" stroke="' + ink + '" stroke-width=".35"/>'); } }
    // snow banked against the foot of the wall
    { const r = rng(21 + sg), up = [], lo = []; for (let z = 1.0; z < ZEND; z *= 1.05) { up.push(pr(X - sg * (0.12 + 0.1 * r()), 0.2 + 0.2 * r(), z)); lo.push(pr(X - sg * 0.55, 0, z)); }
      P.part([...up, ...lo.reverse()], { tone: (x, y) => clamp(0.12 + 0.3 * (1 - pool(x, y, lamp, D.reach, 1))), layers: [hatch(0, 2.4, 0.8, 0.12, 1.8)], seed: 1950 + sg, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.3] }); }
  }
  // ---------------------------------------------------------------- the post with its lantern and the well under it
  { const wb = pr(D.well[0], 0, D.well[1]), s = D.m / D.well[1], r = 0.6 * s, h = 0.55 * s, ry = r * 0.3;
    P.part(cr([[wb[0] - r, wb[1] - h, 1], [wb[0] - r, wb[1], 1], [wb[0] - r * 0.7, wb[1] + ry * 0.8], [wb[0], wb[1] + ry], [wb[0] + r * 0.7, wb[1] + ry * 0.8], [wb[0] + r, wb[1], 1], [wb[0] + r, wb[1] - h, 1]], true, 4), { tone: (x, y) => clamp(0.3 + 0.4 * sstep(wb[0] - r, wb[0] + r, x) + 0.2 * (1 - pool(x, y, lamp, D.reach, 1))), layers: [hatch(88, 1.5, 1.1, 0.08, 1.6), hatch(10, 2.4, 0.8, 0.5)], seed: 1960, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
    for (const t of [0.33, 0.66]) P.line(cr([[wb[0] - r, wb[1] - h * t], [wb[0], wb[1] - h * t + ry], [wb[0] + r, wb[1] - h * t]], false, 5), 0.6, 0.8);
    for (let i = 0; i < 5; i++) P.line([[wb[0] - r + (r * 2 * (i + 0.5)) / 5 * 0 + (i * r) / 2.5 + 3, wb[1] - h * 0.9], [wb[0] - r + (i * r) / 2.5 + 3, wb[1] - h * 0.9 + 0]], 0.1, 0);
    const lid = (k) => [[wb[0] - r * k, wb[1] - h], [wb[0] - r * k * 0.7, wb[1] - h - ry * 0.8 * k], [wb[0], wb[1] - h - ry * k], [wb[0] + r * k * 0.7, wb[1] - h - ry * 0.8 * k], [wb[0] + r * k, wb[1] - h], [wb[0] + r * k * 0.7, wb[1] - h + ry * 0.8 * k], [wb[0], wb[1] - h + ry * k], [wb[0] - r * k * 0.7, wb[1] - h + ry * 0.8 * k]];
    P.part(cr(lid(1.04), true, 4), { tone: (x, y) => clamp(0.3 + 0.3 * (1 - pool(x, y, lamp, D.reach, 1))), layers: [hatch(88, 1.6, 1.0, 0.08, 1.6)], seed: 1961, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.7] });
    for (let i = -2; i <= 2; i++) P.line([[wb[0] + i * r * 0.36, wb[1] - h - ry * 0.85 * (1 - Math.abs(i) * 0.18)], [wb[0] + i * r * 0.36, wb[1] - h + ry * 0.85 * (1 - Math.abs(i) * 0.18)]], 0.7, 0.9);
    P.part(cr([[wb[0] - r * 0.1, wb[1] - h - ry * 0.55], [wb[0] + r * 0.5, wb[1] - h - ry * 0.5], [wb[0] + r * 0.62, wb[1] - h - ry * 0.05], [wb[0] + r * 0.1, wb[1] - h + ry * 0.2], [wb[0] - r * 0.25, wb[1] - h - ry * 0.1]], true, 4), { tone: () => 0.06, layers: [], seed: 1962, fill: CARD, halo: 0, outline: 0.9, wash: [BLUE, 0.2] }); }
  { const pb = pr(lX, 0, lz), pt = pr(lX, lY + 1.2, lz), w = (0.14 * D.m) / lz;
    P.part(box(pb[0] - w / 2, pt[1], w, pb[1] - pt[1]), { tone: (x, y) => clamp(0.3 + 0.35 * sstep(pb[0] - w / 2, pb[0] + w / 2, x) + 0.2 * (1 - pool(x, y, lamp, 120, 0.9))), layers: [hatch(90, 1.6, 1.2, 0.08, 1.8), hatch(18, 2.4, 0.8, 0.5)], seed: 1970, fill: CARD, halo: 0.6, outline: 1.2, wash: [WASH.wood2, 0.75] });
    P.line(cr([[pb[0], pt[1] + 14], [pb[0] + 6, pt[1] + 3], [lamp[0], pt[1] + 2]], false, 4), 1.8, 1);
    lantern(P, lamp[0], pt[1] + 4, portrait ? 1.05 : 0.95, 1972); }
  glow(P, lamp[0], lamp[1] + 14, portrait ? 150 : 130, portrait ? 120 : 100, 0.85);
  crystals(P, [0, vy + 10, W, H], portrait ? 300 : 260, 91, (x, y) => tone(x, y) > 0.42);
  const lampRect = [lamp[0] - 9, top[1] - 9, 18, 40];
  const wb = pr(D.well[0], 0, D.well[1]), ws = D.m / D.well[1], cy = wb[1] - 0.55 * ws, sheet = [wb[0] - 18, cy - 13, 36, 26], layers = { 'draft-face': { at: [wb[0] - 20.6, cy - 16.9], width: 40 }, 'draft-holes': { at: [wb[0] - 20.6, cy - 16.9], width: 40 } };
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp, layers, keys: { lantern: lampRect, sheet }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
