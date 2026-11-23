// Chapter 8 village yard in England about 1426, hard frost at night: a packed-earth yard under low mist, a timber-framed inn across it with a thatched roof, a closed plank door on its stone step and
// one lit window with its sill, whose light lies on the frozen earth as a strip. Smoke rises from the stack. Two dark cottages flank the inn. No figure, no sign, no animal.
import { clamp, sstep, f1, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, view } from './scenery.mjs';
import { nightSky, crystals, mist, smoke } from './night.mjs';

const EARTH = '#6c5a42', THATCH = '#8a6a3c', STRAW = '#cfa24a';
const Z = 8, ZC = 9.6;
const DESIGN = {
  portrait: { m: 300, half: 3.3, door: [-0.7, 0.2], win: [0.55, 1.65], dark: [[-2.7, -1.9], [2.3, 3.0]], cot: [[-9, -4.3], [4.3, 9]], stack: [1.9, 2.5], ruts: [[60, 150], [-10, 90]], bw: 1 },
  landscape: { m: 250, half: 4.0, door: [-0.7, 0.2], win: [0.55, 1.65], dark: [[-3.0, -2.2], [2.9, 3.6]], cot: [[-11, -4.9], [4.9, 11]], stack: [2.3, 2.9], ruts: [[330, 400], [250, 340]], bw: 1 },
};
const EAVES = 2.55, RIDGE = 4.25, PLINTH = 0.38;

export function yard(orientation = 'portrait') {
  const L = LAYOUTS['ch8-yard'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr } = view(L, D.m);
  const P = new Plate(58);
  const fx = (X, z = Z) => vx + (X * D.m) / z, fy = (Y, z = Z) => vy + (hs - Y * D.m) / z;
  const [wa, wb] = D.win, [da, db] = D.door;
  const win = [fx((wa + wb) / 2), fy(1.45)], base = fy(0), cbase = fy(0, ZC);
  const reach = portrait ? 74 : 56, spread = (y) => (y - base) / reach;
  const strip = (x, y) => { const t = spread(y); if (t < -0.04 || t > 1.15) return 0; const half = ((wb - wa) / 2 + 0.7 * t) * (D.m / Z) * (1 + 0.5 * t); return sstep(half + 10, half - 4, Math.abs(x - win[0])) * (1 - 0.7 * sstep(0.3, 1.15, t)); };
  const tone = (x, y) => {
    const light = Math.min(1, pool(x, y, win, portrait ? 150 : 130, 0.9) + 0.9 * strip(x, y));
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 440 : 200)) * 0.8)) * 0.3;
    return clamp(0.84 - 0.74 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 8) - 0.5));
  };
  const wall = (X0, X1, Y0, Y1, z = Z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  // ---------------------------------------------------------------- sky
  nightSky(P, { W, h: vy + 70, seed: 1801, n: portrait ? 40 : 60, skip: (x, y) => y > fy(RIDGE) - 10 && x > fx(-D.half) - 20 && x < fx(D.half) + 20 });
  // ---------------------------------------------------------------- the two dark cottages at the sides
  D.cot.forEach(([a, b], i) => {
    const z = ZC, h = 2.2, rh = 3.7;
    P.part(wall(a, b, 0, h, z), { tone: (x, y) => clamp(0.66 + 0.1 * (vnoise(x * 0.05, y * 0.05, 3) - 0.5)), layers: [hatch(4, 2.3, 1.1, 0.1, 2.2), hatch(72, 3.2, 0.9, 0.5)], seed: 1810 + i, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.5] });
    const roof = [[fx(a - 0.35, z), fy(h - 0.05, z), 1], [fx(a + 0.9, z), fy(rh, z), 1], [fx(b - 0.9, z), fy(rh, z), 1], [fx(b + 0.35, z), fy(h - 0.05, z), 1]];
    P.part(roof, { tone: () => 0.74, layers: [hatch(88, 1.9, 1.1, 0.1, 1.8), hatch(10, 3, 0.8, 0.55)], seed: 1812 + i, fill: CARD, halo: 0, outline: 1.2, wash: [THATCH, 0.55] });
    const wx = i ? a + 1.6 : b - 2.6;
    P.part(wall(wx, wx + 0.8, 0.9, 1.7, z), { tone: () => 0.95, layers: [hatch(80, 1.6, 1.2, 0.1, 1.8)], seed: 1814 + i, fill: CARD, halo: 0, outline: 1.0, wash: null });
  });
  // ---------------------------------------------------------------- the yard: packed earth, ruts, stones, frost
  const ground = [[-20, cbase - 2], [W + 20, cbase - 2], [W + 20, H + 10], [-20, H + 10]];
  P.part(ground, { tone: (x, y) => Math.min(0.88, clamp(tone(x, y) * 0.9 + 0.12 + 0.12 * (vnoise(x * 0.05, y * 0.18, 9) - 0.5))), layers: [hatch(0.6, 2.4, 1.1, 0.1, 2.4, { wob: 0.5 }), hatch(-33, 3.6, 0.9, 0.5), hatch(56, 4.6, 0.7, 0.68)], seed: 1830, fill: CARD, halo: 0, outline: 0, wash: [EARTH, 0.5] });
  P.raw('<path d="M0 ' + f1(base) + 'H' + W + 'V' + H + 'H0Z" fill="' + BLUE + '" fill-opacity=".26" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  const tu = [fx((da + db) / 2) + 6, base + 3];
  for (const [xa, xb] of D.ruts) for (const off of [0, 38]) P.line(cr([[tu[0] + (xa - vx) * 0.04 + off * 0.1, tu[1] + 4], [vx + (xa - vx) * 0.5 + off * 0.5, (tu[1] + H) / 2], [xb + off, H + 4]], false, 6), 1.1, 0.75);
  { const r = rng(61); for (let i = 0; i < 9; i++) { const y = base + 14 + Math.pow(r(), 0.8) * (H - base - 30), t = (y - vy) / hs, x = r() * W, s = 0.5 + 1.6 * t * (0.6 + r() * 0.6);
      if (Math.abs(x - win[0]) < 24 && y < base + 30) continue;
      P.part(cr([[x - 9 * s, y, 1], [x - 5 * s, y - 4 * s], [x + 6 * s, y - 4.4 * s], [x + 10 * s, y, 1], [x + 4 * s, y + 3.4 * s], [x - 6 * s, y + 3 * s]], true, 4), { tone: (px) => clamp(0.4 + 0.3 * sstep(x - 9 * s, x + 10 * s, px) + 0.25 * tone(px, y)), layers: [hatch(0, 1.8, 1.0, 0.08, 1.8)], seed: 1840 + i, fill: CARD, halo: 0, outline: 1.0, wash: [STONE, 0.5] }); } }
  crystals(P, [0, base + 4, W, H], portrait ? 520 : 420, 77, (x, y) => tone(x, y) > 0.3 && (Math.abs(x - win[0]) > 28 || y > base + 30));
  // ---------------------------------------------------------------- the inn: plaster, plinth, frame
  const l = -D.half, r = D.half;
  P.part(wall(l, r, PLINTH, EAVES), { tone: (x, y) => Math.min(0.8, clamp(tone(x, y) * 0.95 + 0.14)), layers: [hatch(2, 2.5, 1.1, 0.08, 2.2), hatch(78, 3.4, 0.8, 0.5)], seed: 1850, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.3] });
  P.part(wall(l, r, 0, PLINTH + 0.02), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.22), layers: [hatch(0, 1.7, 1.1, 0.08, 1.8), hatch(72, 2.6, 0.8, 0.5)], seed: 1851, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
  for (let X = l + 0.6; X < r - 0.3; X += 0.7 + (X * 7.3 % 0.5)) P.line([[fx(X), fy(PLINTH)], [fx(X), fy(0)]], 0.6, 0.85);
  // the lit window with its shutters thrown back, and a sill slab
  { const y0 = 0.95, y1 = 1.95, x0 = fx(wa), x1 = fx(wb), t0 = fy(y1), t1 = fy(y0);
    P.part(box(x0 - 3, t0 - 3, x1 - x0 + 6, t1 - t0 + 6), { tone: () => 0.35, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 1852, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.75] });
    P.part(box(x0, t0, x1 - x0, t1 - t0), { tone: () => 0.07, layers: [hatch(80, 2.4, 0.6, 0.05)], seed: 1853, fill: '#fff3b0', halo: 0, outline: 1.1, wash: [WASH.flame, 0.78] });
    P.line([[(x0 + x1) / 2, t0], [(x0 + x1) / 2, t1]], 1.2, 1); P.line([[x0, (t0 + t1) / 2], [x1, (t0 + t1) / 2]], 1.2, 1);
    for (const sg of [-1, 1]) { const xs = sg < 0 ? x0 - 0.5 * (x1 - x0) : x1, w = 0.5 * (x1 - x0);
      P.part(box(xs, t0 - 2, w - 1, t1 - t0 + 4), { tone: (x) => clamp(0.4 + 0.3 * sstep(xs, xs + w, x) * (sg < 0 ? -1 : 1) + 0.2), layers: [hatch(90, 1.8, 1.1, 0.08, 1.8)], seed: 1854 + sg, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.75] }); }
    const sz = Z - 0.22, sl = [[fx(wa - 0.1), t1 + 3], [fx(wb + 0.1), t1 + 3], [fx(wb + 0.1, sz), fy(y0 - 0.05, sz) + 3], [fx(wa - 0.1, sz), fy(y0 - 0.05, sz) + 3]];
    P.part(sl, { tone: (x, y) => clamp(0.18 + 0.3 * (1 - pool(x, y, win, 60, 1))), layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 1857, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.65] });
    P.part(box(fx(wa - 0.1, sz), fy(y0 - 0.05, sz) + 3, fx(wb + 0.1, sz) - fx(wa - 0.1, sz), 5), { tone: () => 0.45, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 1858, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] }); }
  // the closed plank door on its stone step, and two dark windows
  { const dx0 = fx(da), dx1 = fx(db), dt = fy(2.0), db_ = fy(PLINTH * 0.4);
    P.part(box(dx0 - 3, dt - 3, dx1 - dx0 + 6, db_ - dt + 3), { tone: () => 0.4, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 1860, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.75] });
    P.part(box(dx0, dt, dx1 - dx0, db_ - dt), { tone: (x) => clamp(0.5 + 0.2 * sstep(dx0, dx1, x)), layers: [hatch(90, 1.5, 1.2, 0.08, 1.8), hatch(18, 2.4, 0.9, 0.5)], seed: 1861, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.7] });
    for (let k = 1; k < 4; k++) P.line([[dx0 + ((dx1 - dx0) * k) / 4, dt], [dx0 + ((dx1 - dx0) * k) / 4, db_]], 0.6, 0.9);
    for (const Y of [0.5, 1.5]) P.line([[dx0, fy(Y)], [dx1 - 3, fy(Y)]], 1.5, 1);
    P.raw('<circle cx="' + f1(dx1 - 5) + '" cy="' + f1(fy(1.0)) + '" r="1.5" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".6"/>');
    const sz = Z - 0.55, a = fx(da - 0.15), b = fx(db + 0.15);
    P.part([[a, fy(0.16)], [b, fy(0.16)], [fx(db + 0.15, sz), fy(0.16, sz)], [fx(da - 0.15, sz), fy(0.16, sz)]], { tone: (x, y) => clamp(0.2 + 0.3 * (1 - pool(x, y, win, 90, 1))), layers: [hatch(0, 1.5, 1.0, 0.08, 1.6)], seed: 1862, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.6] });
    P.part(box(fx(da - 0.15, sz), fy(0.16, sz), fx(db + 0.15, sz) - fx(da - 0.15, sz), fy(0, sz) - fy(0.16, sz)), { tone: () => 0.4, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 1863, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] }); }
  D.dark.forEach(([a, b], i) => {
    P.part(box(fx(a), fy(1.8), fx(b) - fx(a), fy(1.0) - fy(1.8)), { tone: () => 0.95, layers: [hatch(80, 1.6, 1.2, 0.1, 1.8)], seed: 1865 + i, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.5] });
    P.line([[(fx(a) + fx(b)) / 2, fy(1.8)], [(fx(a) + fx(b)) / 2, fy(1.0)]], 1.0, 0.9); });
  // timber frame: sill plate, wall plate, posts, a rail above the openings, corner braces
  const timber = (X0, X1, Y0, Y1, seed) => P.part(wall(X0, X1, Y0, Y1), { tone: (x, y) => clamp(0.34 + 0.3 * (1 - pool(x, y, win, 120, 1))), layers: [hatch(90, 1.8, 1.1, 0.06, 1.8)], seed, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.72] });
  timber(l - 0.08, r + 0.08, PLINTH, PLINTH + 0.14, 1870); timber(l - 0.08, r + 0.08, EAVES - 0.16, EAVES, 1871); timber(l - 0.05, r + 0.05, 2.02, 2.16, 1872);
  [l - 0.05, r - 0.1, da - 0.12, db, wa - 0.12 - 0.12, wb + 0.04, -2.3, 2.15].forEach((X, i) => timber(X, X + 0.12, PLINTH, EAVES, 1873 + i));
  for (const [X0, X1, sg] of [[l, l + 0.9, 1], [r, r - 0.9, -1]]) P.line([[fx(X0 + sg * 0.1), fy(PLINTH + 0.14)], [fx(X1), fy(2.02)]], 2.2, 1);
  // ---------------------------------------------------------------- thatched roof and the stack
  { const ol = l - 0.4, or = r + 0.4, top = [[fx(l + 0.9), fy(RIDGE)], [fx(r - 0.9), fy(RIDGE)]], rg = rng(5), edge = [];
    for (let X = or; X >= ol; X -= 0.18) edge.push([fx(X), fy(EAVES - 0.1 - rg() * 0.22)]);
    const poly = [[fx(ol + 0.35), fy(EAVES + 0.02), 1], ...top, [fx(or - 0.35), fy(EAVES + 0.02), 1], ...edge.slice(0, -1)];
    const stk = [fx(D.stack[0]), fx(D.stack[1])];
    P.part(wall(D.stack[0], D.stack[1], RIDGE - 0.6, RIDGE + 0.85), { tone: (x, y) => clamp(0.4 + 0.3 * sstep(stk[0], stk[1], x)), layers: [hatch(90, 1.6, 1.1, 0.08, 1.8), hatch(8, 2.6, 0.8, 0.5)], seed: 1880, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
    P.part(poly, { tone: (x, y) => clamp(0.52 + 0.3 * sstep(fy(RIDGE), fy(EAVES), y) + 0.22 * (1 - pool(x, y, win, 150, 0.8))), layers: [hatch(88, 1.9, 1.15, 0.1, 1.8, { wob: 0.4 }), hatch(8, 3.0, 0.8, 0.55)], seed: 1881, fill: CARD, halo: 0, outline: 1.3, wash: [THATCH, 0.55] });
    for (let X = ol + 0.5; X < or - 0.4; X += 0.55) P.line([[fx(X * 0.82 + (X > 0 ? -0.3 : 0.3)), fy(RIDGE - 0.1)], [fx(X), fy(EAVES + 0.02)]], 0.55, 0.7);
    P.part(wall(D.stack[0] - 0.08, D.stack[1] + 0.08, RIDGE + 0.85, RIDGE + 1.0), { tone: () => 0.4, layers: [hatch(0, 1.5, 1.0, 0.08, 1.6)], seed: 1882, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] });
    smoke(P, (stk[0] + stk[1]) / 2, fy(RIDGE + 1.0), portrait ? 88 : 62, 1890, portrait ? 16 : 12); }
  // ---------------------------------------------------------------- the light on the earth, glow at the window, mist across the yard
  { const yb = base, yt = base + reach * 1.15, h0 = ((wb - wa) / 2) * (D.m / Z) + 6, h1 = h0 + (0.7 * 1.15 * (D.m / Z) + 14) * 1.6;
    P.raw('<defs><linearGradient id="lightstrip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd25a" stop-opacity=".78"/><stop offset=".5" stop-color="#f4b447" stop-opacity=".45"/><stop offset="1" stop-color="#f0a53a" stop-opacity="0"/></linearGradient></defs>');
    P.raw('<path d="M' + f1(win[0] - h0) + ' ' + f1(yb) + 'L' + f1(win[0] + h0) + ' ' + f1(yb) + 'L' + f1(win[0] + h1) + ' ' + f1(yt) + 'L' + f1(win[0] - h1) + ' ' + f1(yt) + 'Z" fill="url(#lightstrip)" filter="url(#rag)" style="mix-blend-mode:multiply"/>'); }
  glow(P, win[0], win[1], portrait ? 70 : 60, portrait ? 56 : 50, 0.85);
  mist(P, [0, base - 4, W, base + (portrait ? 40 : 26)], portrait ? 6 : 5, 1899, 0.26);
  const window_ = [fx(wa) - 6, fy(1.95) - 6, fx(wb) - fx(wa) + 12, fy(0.9) - fy(1.95) + 12], doorRect = [fx(da) - 6, fy(2.0) - 4, fx(db) - fx(da) + 12, base + 14 - fy(2.0)];
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], window: win, keys: { window: window_, door: doorRect }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
