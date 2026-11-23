// Chapter 4 English house corridor, 1784: panelled green walls and a plank floor with a red runner in one-point perspective, cross beams, two panel doors,
// a console table under a wall candle, and at the far end a door ajar with party light behind it. A bunch of mistletoe hangs from the nearest beam on a thread.
import { clamp, sstep, f1, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow, candle } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { GREEN, RED, BERRY, view } from './scenery.mjs';

const FAR = 6.5;
const DESIGN = {
  portrait: { wall: 1.05, m: 300, roof: 2.5, beam: 1.9, bunch: [195, 1, 70], bw: 40, sconceR: 4.4, sconceL: 5.2, table: [3.9, 4.9] },
  landscape: { wall: 1.7, m: 270, roof: 2.1, beam: 3.0, bunch: [408, 0.86, 16], bw: 36, sconceR: 4.4, sconceL: 5.2, table: [3.9, 4.9] },
};

function leaf(P, x, y, a, len, w, seed, deep = 0) {
  const c = Math.cos(a), s = Math.sin(a), T = (u, v, k) => (k ? [x + u * c - v * s, y + u * s + v * c, 1] : [x + u * c - v * s, y + u * s + v * c]);
  const pts = cr([T(0, 0, 1), T(len * 0.35, -w), T(len * 0.8, -w * 0.62), T(len, 0, 1), T(len * 0.8, w * 0.62), T(len * 0.35, w)], true, 4);
  const deg = (a * 180) / Math.PI;
  P.part(pts, { tone: (px, py) => clamp(0.22 + deep + 0.42 * sstep(-w, w, (px - x) * -s + (py - y) * c)), layers: [hatch(deg + 8, 1.5, 0.9, 0.1, 1.6)], seed, fill: CARD, halo: 0.7, outline: 0.8, wash: [GREEN, 0.78] });
  P.line([T(2, 0), T(len * 0.86, 0)], 0.5, 0.8);
}
function berries(P, x, y, s, seed) {
  const r = rng(seed);
  for (let i = 0; i < 3; i++) { const bx = x + (i - 1) * 4.6 * s + (r() - 0.5), by = y + (i === 1 ? 3.6 : 0) * s; P.raw('<circle cx="' + f1(bx) + '" cy="' + f1(by) + '" r="' + f1(3.1 * s) + '" fill="' + BERRY + '" stroke="' + ink + '" stroke-width=".7"/><path d="M' + f1(bx - 1.9 * s) + ' ' + f1(by + 0.6 * s) + 'q' + f1(1.9 * s) + ' ' + f1(2.2 * s) + ' ' + f1(3.6 * s) + ' 0" fill="none" stroke="' + ink + '" stroke-width=".5"/>'); }
}
/** A hanging ball of mistletoe: forked green stems with paired leaves, white berries at the forks, a red ribbon at the knot. (x, y) is the knot; s scales it. */
export function mistletoe(P, x, y, s, seed) {
  const r = rng(seed), R = 32 * s, cy = y + 6 * s + R;
  const tips = [];
  for (let i = 0; i < 12; i++) { const th = Math.PI * (-0.1 + (1.2 * i) / 11) + (r() - 0.5) * 0.1, k = 0.85 + r() * 0.25; tips.push([x + Math.cos(th) * R * k * 1.15, cy + Math.sin(th) * R * k * 0.95]); }
  const inner = [];
  for (let i = 0; i < 9; i++) { const th = Math.PI * (-0.05 + (1.1 * i) / 8) + (r() - 0.5) * 0.2, k = 0.25 + r() * 0.35; inner.push([x + Math.cos(th) * R * k * 1.2, cy + Math.sin(th) * R * k * 0.9 - 4 * s]); }
  inner.forEach(([tx, ty], i) => {
    const out = Math.atan2(ty - (y + 4 * s), tx - x);
    P.line([[x, y + 4 * s], [tx, ty]], 1.2 * s, 0.9);
    leaf(P, tx, ty, out - 0.55, 15 * s, 4.6 * s, seed + 600 + i * 4, 0.34);
    leaf(P, tx, ty, out + 0.55, 15 * s, 4.6 * s, seed + 602 + i * 4, 0.4);
  });
  tips.forEach(([tx, ty], i) => { P.line(cr([[x, y + 4 * s], [(x + tx) / 2 + (r() - 0.5) * 6 * s, (y + ty) / 2], [tx, ty]], false, 5), 1.5 * s, 0.95); });
  tips.forEach(([tx, ty], i) => {
    const out = Math.atan2(ty - (y + 4 * s), tx - x);
    leaf(P, tx, ty, out - 0.5, 19 * s, 5.4 * s, seed + 10 + i * 5, 0.1);
    leaf(P, tx, ty, out + 0.5, 19 * s, 5.4 * s, seed + 12 + i * 5, 0.2);
    leaf(P, (tx + x) / 2, (ty + y) / 2 + 3 * s, out + (i % 2 ? 0.9 : -0.9), 13 * s, 4.2 * s, seed + 14 + i * 5, 0.28);
    if (i % 3 === 1) berries(P, (tx + x) / 2 + (i % 2 ? 4 : -4) * s, (ty + y) / 2 + 6 * s, s, seed + 200 + i);
  });
  berries(P, x, cy, s * 1.1, seed + 300);
  const bow = cr([[x, y + 1, 1], [x - 11 * s, y - 7 * s], [x - 12 * s, y + 2 * s], [x - 2 * s, y + 4 * s, 1], [x + 12 * s, y + 3 * s], [x + 11 * s, y - 7 * s], [x, y + 1, 1]], true, 4);
  P.part(bow, { tone: (px) => clamp(0.32 + 0.3 * sstep(x - 12 * s, x + 12 * s, px)), layers: [hatch(60, 1.3, 1.0, 0.08, 1.6)], seed: seed + 400, fill: CARD, halo: 0.8, outline: 0.9, wash: [RED, 0.8] });
}

export function corridor(orientation = 'portrait') {
  const L = LAYOUTS['ch4-corridor'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, pr, ray, E, quad } = view(L, D.m), ROOF = D.roof, WALL_X = D.wall;
  const P = new Plate(54);
  const far = { l: pr(-WALL_X, 0, FAR)[0], r: pr(WALL_X, 0, FAR)[0], b: pr(0, 0, FAR)[1], t: pr(0, ROOF, FAR)[1] };
  const door = { l: pr(-0.42, 0, FAR)[0], r: pr(0.42, 0, FAR)[0], t: pr(0, 2.0, FAR)[1] };
  const sR = pr(WALL_X - 0.05, 1.6, D.sconceR), sL = pr(-WALL_X + 0.05, 1.6, D.sconceL), dG = [vx, (door.t + far.b) / 2];
  const tone = (x, y) => {
    const light = Math.min(1, pool(x, y, sR, portrait ? 120 : 130, 0.9) + 0.6 * pool(x, y, sL, portrait ? 70 : 80, 0.9) + 0.7 * pool(x, y, dG, portrait ? 60 : 60, 0.9));
    const vig = sstep(portrait ? 200 : 360, portrait ? 520 : 740, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 400 : 190)) * 0.8)) * 0.3;
    return clamp(0.76 - 0.7 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 4) - 0.5));
  };
  const topL = pr(-WALL_X, ROOF, FAR), botL = pr(-WALL_X, 0, FAR), topR = pr(WALL_X, ROOF, FAR), botR = pr(WALL_X, 0, FAR);
  // ---------------------------------------------------------------- end wall with the door ajar
  P.part(box(far.l, far.t, far.r - far.l, far.b - far.t), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.1), layers: [hatch(0, 2.2, 1.1, 0.06, 2), hatch(70, 3, 0.8, 0.55)], seed: 1401, fill: CARD, halo: 0, outline: 1.2, wash: [GREEN, 0.4] });
  const dh = far.b - door.t, dw = door.r - door.l;
  P.part(box(door.l, door.t, dw, dh), { tone: () => 0.06, layers: [hatch(80, 2.6, 0.6, 0.05)], seed: 1402, fill: '#fff3b0', halo: 0, outline: 1.1, wash: [WASH.flame, 0.7] });
  P.part([[door.l, door.t, 1], [door.l + dw * 0.34, door.t + dh * 0.04, 1], [door.l + dw * 0.34, far.b - dh * 0.02, 1], [door.l, far.b, 1]], { tone: () => 0.55, layers: [hatch(90, 1.8, 1.0, 0.1, 1.8)], seed: 1403, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
  // ---------------------------------------------------------------- planks with the runner and the light spilling through the door
  floor(P, { W, H, hy: far.b, vp: L.vp, bw: D.bw, tone, seed: 1450, wash: [WASH.wood, 0.4], joint: { min: 0.5, spread: 0.7 }, grain: 0.8, grid: 1.1 });
  P.part(quad([pr(-0.36, 0, 0.7), pr(0.36, 0, 0.7), pr(0.28, 0, FAR - 0.4), pr(-0.28, 0, FAR - 0.4)]), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.1), layers: [hatch(90, 2.4, 1.0, 0.1, 2.2)], seed: 1451, fill: CARD, halo: 0, outline: 1.2, wash: [RED, 0.62] });
  for (const X of [-0.3, -0.24, 0.24, 0.3]) P.line([pr(X, 0, 0.7), pr(X * 0.78, 0, FAR - 0.4)], 0.9, 0.8);
  P.part(quad([pr(-0.4, 0, FAR), pr(0.4, 0, FAR), pr(0.95, 0, 4.0), pr(-0.95, 0, 4.0)]), { tone: () => 0.05, layers: [hatch(90, 3.2, 0.5, 0.04)], seed: 1452, fill: null, halo: 0, outline: 0, wash: [WASH.glow, 0.5] });
  // ---------------------------------------------------------------- side walls with wainscot, rails, stiles and the cornice
  const sideWall = (sg) => { const t = sg < 0 ? topL : topR, b = sg < 0 ? botL : botR, xe = sg < 0 ? -30 : W + 30; return quad([t, b, ray(b, xe), ray(t, xe)]); };
  for (const sg of [-1, 1]) {
    const X = sg * WALL_X;
    P.part(sideWall(sg), { tone: (x, y) => Math.min(0.66, clamp(tone(x, y) * 0.9 + 0.08)), layers: [hatch(sg < 0 ? 14 : -14, 2.6, 1.1, 0.06, 2.2), hatch(78, 3.4, 0.8, 0.5)], seed: 1410 + sg, fill: CARD, halo: 0, outline: 1.2, wash: [GREEN, 0.5] });
    const wq = (y0, y1, z0, z1) => quad([pr(X, y1, z0), pr(X, y1, z1), pr(X, y0, z1), pr(X, y0, z0)]);
    P.part(wq(0, 0.95, 0.2, FAR), { tone: (x, y) => clamp(tone(x, y) * 0.85 + 0.18), layers: [hatch(90, 2.2, 1.2, 0.06, 2.2), hatch(25, 3, 0.9, 0.55)], seed: 1414 + sg, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.55] });
    for (let z = 0.5; z < FAR; z *= 1.28) P.line([pr(X, 0, z), pr(X, 0.95, z)], Math.max(0.5, 1.2 / z), 0.9);
    P.line([pr(X, 0.95, 0.2), pr(X, 0.95, FAR)], 1.6, 1);
    P.line([pr(X, 1.02, 0.2), pr(X, 1.02, FAR)], 0.7, 0.9);
    P.part(wq(ROOF - 0.12, ROOF, 0.2, FAR), { tone: (x, y) => clamp(tone(x, y) * 0.7 + 0.2), layers: [hatch(0, 1.6, 1.1, 0.08)], seed: 1418 + sg, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood, 0.5] });
  }
  // two panel doors
  [[1, 3.15, 3.85], [-1, 2.85, 3.55]].forEach(([sg, z0, z1], i) => {
    const X = sg * WALL_X, wq = (y0, y1, a, b) => quad([pr(X, y1, a), pr(X, y1, b), pr(X, y0, b), pr(X, y0, a)]), dz = (z1 - z0) * 0.14;
    P.part(wq(0, 2.05, z0, z1), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.2), layers: [hatch(90, 2.0, 1.2, 0.06, 2), hatch(24, 2.8, 0.9, 0.55)], seed: 1420 + i, fill: CARD, halo: 0, outline: 1.3, wash: [RED, 0.42] });
    for (const [a, b, c, d] of [[0.15, 0.95, z0 + dz, z1 - dz], [1.1, 1.9, z0 + dz, z1 - dz]]) P.part(wq(a, b, c, d), { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.2), layers: [hatch(90, 2.4, 0.8, 0.1, 2)], seed: 1424 + i * 2 + Math.round(a * 10), fill: null, halo: 0, outline: 0.9, wash: null });
    const k = pr(X, 1.0, z1 - dz * 0.6); P.raw('<circle cx="' + f1(k[0]) + '" cy="' + f1(k[1]) + '" r="' + f1(Math.max(1.4, 4.5 / ((z0 + z1) / 2))) + '" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".7"/>');
  });
  // ---------------------------------------------------------------- ceiling and cross beams
  const ceil = quad([topL, topR, ray(topR, W + 30), [W + 30, -30], [-30, -30], ray(topL, -30)]);
  P.part(ceil, { tone: (x, y) => clamp(tone(x, y) * 0.62 + 0.04 + 0.3 * sstep(vy * 0.7, 0, y)), layers: [hatch(0, 2.6, 1.0, 0.1, 2.2), hatch(70, 3.6, 0.7, 0.6)], seed: 1430, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.3] });
  for (const k of [-0.85, -0.55, -0.28, 0, 0.28, 0.55, 0.85]) P.line([pr(k * WALL_X, ROOF, 0.2), pr(k * WALL_X, ROOF, 6)], 0.8, 0.6);
  for (const z of [D.beam, 2.9, 3.9, 5.0]) { const a = pr(-WALL_X, ROOF, z), b = pr(WALL_X, ROOF, z), th = (0.2 * D.m) / z;
    P.part(quad([a, b, [b[0], b[1] + th], [a[0], a[1] + th]]), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.3), layers: [hatch(0, 1.5, 1.1, 0.08)], seed: 1434 + Math.round(z * 10), fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.65] }); }
  // ---------------------------------------------------------------- console table under the wall candle (right wall)
  let tableQuad = [];
  { const [z0, z1] = D.table, Xo = 0.62, top = 0.85;
    tableQuad = [pr(Xo, top, z0), pr(WALL_X, top, z0), pr(WALL_X, top, z1), pr(Xo, top, z1)];
    for (const [X, z] of [[Xo, z0], [Xo, z1], [WALL_X - 0.05, z1]]) P.line([pr(X, 0, z), pr(X, top, z)], Math.max(0.9, 3.2 / z), 1);
    P.part(quad([pr(Xo, top, z0), pr(WALL_X, top, z0), pr(WALL_X, top, z1), pr(Xo, top, z1)]), { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.15), layers: [hatch(0, 1.5, 1.1, 0.06, 1.8)], seed: 1440, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood, 0.55] });
    const base = pr(WALL_X - 0.2, top, (z0 + z1) / 2), ch = (0.2 * D.m) / ((z0 + z1) / 2);
    candle(P, base[0], base[1], ch, ch * 0.2, 1441, 0);
    const sc = pr(WALL_X - 0.05, 1.6, D.sconceR), sz = D.sconceR;
    P.part(box(sc[0] - 2, sc[1], 4, (0.22 * D.m) / sz), { tone: () => 0.4, layers: [hatch(80, 1.4, 1.0, 0.1)], seed: 1442, fill: '#e9d9a4', halo: 0, outline: 0.8, wash: [WASH.brass, 0.8] });
    candle(P, sc[0], sc[1], (0.2 * D.m) / sz, 3.2, 1443, 11);
    const sl = pr(-WALL_X + 0.05, 1.6, D.sconceL);
    candle(P, sl[0], sl[1], (0.2 * D.m) / D.sconceL, 2.8, 1444, 9); }
  // ---------------------------------------------------------------- the mistletoe on its thread
  let bunchKnot = 0;
  { const bz = D.beam, [bx, s, drop] = D.bunch, b = pr(0, ROOF, bz), th = (0.2 * D.m) / bz, top = b[1] + th, knot = top + drop;
    bunchKnot = knot;
    P.line([[bx, top], [bx, knot]], 1.1, 1);
    mistletoe(P, bx, knot, s, 1500); }
  glow(P, sR[0], sR[1], portrait ? 110 : 120, portrait ? 90 : 80, 0.8);
  glow(P, dG[0], dG[1], 50, 50, 0.85);
  const bunch = { x: D.bunch[0], s: D.bunch[1], top: bunchKnot - 8 * D.bunch[1], bottom: bunchKnot + 90 * D.bunch[1], left: D.bunch[0] - 44 * D.bunch[1], right: D.bunch[0] + 44 * D.bunch[1] };
  const tx = tableQuad.map((p) => p[0]), ty = tableQuad.map((p) => p[1]);
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], bunch, keys: { bunch: [bunch.left, bunch.top, bunch.right - bunch.left, bunch.bottom - bunch.top], table: [Math.min(...tx), Math.min(...ty), Math.max(...tx) - Math.min(...tx), Math.max(...ty) - Math.min(...ty)] }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
