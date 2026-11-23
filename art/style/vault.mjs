// Chapter 6 calendar vault in Rome, mid 4th century: a barrel-vaulted stone hall in one-point perspective, both walls a lattice of pigeonholes with rolled calendars,
// flagstones, a table at the far end with an open codex under its own small lamp, and one bronze oil lamp hanging from the vault as the key light.
import { clamp, sstep, f1, cr, ellipse, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow, flame } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { STONE, view, joints } from './scenery.mjs';

const FAR = 7;
const DESIGN = {
  portrait: { m: 300, wall: 1.1, spring: 2.3, crown: 3.3, bw: 70, lamp: [236, 310], chain: 150 },
  landscape: { m: 270, wall: 1.7, spring: 1.7, crown: 2.6, bw: 80, lamp: [470, 76], chain: 90 },
};

export function vault(orientation = 'portrait') {
  const L = LAYOUTS['ch6-vault'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, pr, ray, E, quad } = view(L, D.m), WALL_X = D.wall, SPRING = D.spring, CROWN = D.crown;
  const P = new Plate(56);
  const far = { l: pr(-WALL_X, 0, FAR)[0], r: pr(WALL_X, 0, FAR)[0], b: pr(0, 0, FAR)[1], s: pr(0, SPRING, FAR)[1] };
  const lamp = D.lamp, tableP = pr(0, 0.85, 5.6), tl = [tableP[0], tableP[1] - 9];
  const tone = (x, y) => {
    const light = Math.min(1, pool(x, y, lamp, portrait ? 150 : 170, 0.9) + 0.55 * pool(x, y, tl, 36, 0.9));
    const vig = sstep(portrait ? 200 : 360, portrait ? 520 : 740, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 380 : 180)) * 0.8)) * 0.3;
    return clamp(0.82 - 0.76 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 6) - 0.5));
  };
  const topL = pr(-WALL_X, SPRING, FAR), botL = pr(-WALL_X, 0, FAR), topR = pr(WALL_X, SPRING, FAR), botR = pr(WALL_X, 0, FAR);
  // ---------------------------------------------------------------- end wall, floor, side walls
  P.part(box(far.l, far.s, far.r - far.l, far.b - far.s), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.1), layers: [hatch(0, 2.2, 1.1, 0.06, 2), hatch(70, 3, 0.8, 0.55)], seed: 1601, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.5] });
  floor(P, { W, H, hy: far.b, vp: L.vp, bw: D.bw, tone, seed: 1650, wash: [STONE, 0.55], joint: { min: 0.22, spread: 0.45 }, grain: 0.6, grid: 1.1, shadowLo: 0.4 });
  const sideWall = (sg) => { const t = sg < 0 ? topL : topR, b = sg < 0 ? botL : botR, xe = sg < 0 ? -30 : W + 30; return quad([t, b, ray(b, xe), ray(t, xe)]); };
  for (const sg of [-1, 1]) {
    P.part(sideWall(sg), { tone: (x, y) => Math.min(0.66, clamp(tone(x, y) * 0.9 + 0.1)), layers: [hatch(sg < 0 ? 12 : -12, 2.6, 1.1, 0.06, 2.2), hatch(78, 3.4, 0.8, 0.5)], seed: 1610 + sg, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.5] });
    const X = sg * WALL_X, wq = (y0, y1, a, b) => quad([pr(X, y1, a), pr(X, y1, b), pr(X, y0, b), pr(X, y0, a)]);
    P.part(wq(0, 0.2, 0.2, FAR), { tone: (x, y) => clamp(tone(x, y) * 0.5 + 0.12), layers: [hatch(0, 1.6, 1.1, 0.08)], seed: 1614 + sg, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.7] });
    // pigeonholes: five tiers of recesses between the plinth and the spring of the vault
    const r = rng(1620 + sg), rows = 5, y0 = 0.28, rh = (SPRING - 0.1 - y0) / rows;
    for (let z = 0.45, k = 0; z < FAR - 0.25; k++) {
      const zb = z * 1.17, za = z + (zb - z) * 0.1, zc = zb - (zb - z) * 0.1;
      for (let i = 0; i < rows; i++) {
        const ya = y0 + i * rh + rh * 0.08, yb = y0 + (i + 1) * rh - rh * 0.08, q = wq(ya, yb, za, zc);
        if (q.length < 3) continue;
        const xs = q.map((p) => p[0]), w = Math.max(...xs) - Math.min(...xs), hh = Math.max(...q.map((p) => p[1])) - Math.min(...q.map((p) => p[1]));
        if (w < 2 || hh < 3) continue;
        P.part(q, { tone: (x, y) => clamp(tone(x, y) * 0.55 + 0.42), layers: [hatch(90, 1.9, 1.0, 0.1, 1.8), hatch(25, 2.8, 0.8, 0.6)], seed: 1700 + k * 17 + i + (sg > 0 ? 400 : 0), fill: CARD, halo: 0, outline: 0.9, wash: [WASH.wood2, 0.35] });
        // rolled calendars lying along the pigeonhole: a pale strip with a round end toward the aisle
        const near = Math.min(za, zc), far2 = Math.max(za, zc);
        if (w > 7 && hh > 9 && r() < 0.72) {
          const n = 1 + Math.floor(r() * 3), th = ((yb - ya) / (n + 0.6)) * 0.42;
          for (let j = 0; j < n; j++) {
            const yc = ya + ((yb - ya) * (j + 0.8)) / (n + 0.6), zn = near + (far2 - near) * 0.12 * r(), zf = far2 - (far2 - near) * 0.1 * r(), sq = wq(yc - th, yc + th, zn, zf);
            if (sq.length < 3) continue;
            P.part(sq, { tone: (x, y) => clamp(0.12 + 0.5 * sstep(yc - th, yc + th, y) * 0.8), layers: [hatch(0, 1.3, 0.7, 0.1, 1.4)], seed: 1800 + k * 31 + i * 7 + j, fill: '#e9e2cc', halo: 0, outline: 0.7, wash: [WASH.glow2, 0.4] });
            const e = pr(X, yc, zn);
            const ry = Math.abs(pr(X, yc + th, zn)[1] - pr(X, yc - th, zn)[1]) / 2;
            P.part(ellipse(e[0], e[1], Math.max(0.6, ry * 0.45), Math.max(0.8, ry), 12), { tone: () => 0.1, layers: [hatch(80, 1.2, 0.6, 0.05, 1.3)], seed: 1900 + k * 31 + i * 7 + j, fill: '#f3ead0', halo: 0, outline: 0.6, wash: null });
          }
        }
      }
      z = zb;
    }
  }
  // ---------------------------------------------------------------- the barrel vault: ceiling, ribs, the lunette over the end wall
  const ceil = quad([topL, topR, ray(topR, W + 30), [W + 30, -30], [-30, -30], ray(topL, -30)]);
  const fan = Array.from({ length: 40 }, (_, i) => vx + (i - 20) * (portrait ? 34 : 50));
  P.part(ceil, { tone: (x, y) => clamp(tone(x, y) * 0.78 + 0.16), layers: [hatch(0, 2.4, 1.1, 0.08, 2.2), hatch(76, 3.6, 0.8, 0.58)], seed: 1630, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.5] });
  const arch = (z) => { const pts = []; for (let k = 0; k <= 24; k++) { const th = (k / 24) * Math.PI; pts.push(pr(WALL_X * Math.cos(th), SPRING + (CROWN - SPRING) * Math.sin(th), z)); } return pts; };
  { const lun = arch(FAR), pts = [[far.l, far.s], ...lun.reverse().slice(1, -1), [far.r, far.s]];
    P.part(pts, { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.16), layers: [hatch(0, 2.2, 1.1, 0.06, 2), hatch(70, 3, 0.8, 0.55)], seed: 1631, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.5] }); }
  for (const z of [1.5, 2.6, 3.9, 5.4]) { const a = arch(z); P.line(a, Math.max(1.4, 5 / z), 1); P.line(a.map((p) => [p[0], p[1] + Math.max(1.2, 5 / z)]), 0.6, 0.8); }
  // ---------------------------------------------------------------- the table at the far end: an open codex and a small lamp
  { const c = tableP, tw = (1.1 * D.m) / 5.6, th = (0.05 * D.m) / 5.6, leg = (0.85 * D.m) / 5.6;
    for (const dx of [-0.42, 0.42]) P.part(box(c[0] + dx * tw - 1.6, c[1], 3.2, leg), { tone: () => 0.6, layers: [hatch(90, 1.4, 1.0, 0.1, 1.6)], seed: 1660 + Math.round(dx * 10), fill: CARD, halo: 0, outline: 0.8, wash: [STONE, 0.6] });
    P.part(box(c[0] - tw / 2, c[1] - th, tw, th * 1.6), { tone: () => 0.42, layers: [hatch(0, 1.4, 1.0, 0.1, 1.6)], seed: 1662, fill: CARD, halo: 0, outline: 0.9, wash: [STONE, 0.7] });
    const pw = tw * 0.26, ph = pw * 0.7, by = c[1] - th;
    for (const sg of [-1, 1]) { P.part([[c[0], by, 1], [c[0] + sg * pw, by - 1.2, 1], [c[0] + sg * pw, by - ph, 1], [c[0], by - ph * 0.8, 1]], { tone: () => 0.1, layers: [hatch(2, 2.2, 0.5, 0.05, 1.6)], seed: 1663 + sg, fill: '#f6ecc0', halo: 0, outline: 0.7, wash: [WASH.glow2, 0.4] });
      for (let i = 1; i < 4; i++) P.line([[c[0] + sg * pw * 0.12, by - ph * (0.2 + i * 0.16)], [c[0] + sg * pw * 0.88, by - ph * (0.28 + i * 0.16)]], 0.35, 0.85); }
    const lx = c[0] + tw * 0.34, ly = by - 0.5; P.part(cr([[lx - 3, ly, 1], [lx - 2, ly - 3], [lx + 2, ly - 3], [lx + 3, ly, 1]], true, 3), { tone: () => 0.3, layers: [hatch(70, 1.2, 0.8, 0.1, 1.4)], seed: 1665, fill: '#e9d9a4', halo: 0, outline: 0.7, wash: [WASH.brass, 0.85] });
    flame(P, lx - 3.4, ly - 2.4, 6, 1666); }
  // ---------------------------------------------------------------- the hanging bronze lamp: chain from the vault, bowl, three flames
  { const [lx, ly] = lamp, s = portrait ? 1 : 0.9, top = ly - D.chain;
    P.line([[lx, top], [lx, ly - 4 * s]], 1.2); P.line([[lx - 1.4, top + 6], [lx - 1.4, ly - 4 * s]], 0.5, 0.7);
    for (const k of [-0.45, 0.45]) P.line([[lx, ly - 4 * s], [lx + k * 30 * s, ly + 10 * s]], 0.8);
    const bowl = cr([[lx - 28 * s, ly + 8 * s, 1], [lx - 22 * s, ly + 22 * s], [lx, ly + 30 * s], [lx + 22 * s, ly + 22 * s], [lx + 28 * s, ly + 8 * s, 1]], true, 5);
    P.part(bowl, { tone: (x) => clamp(0.3 + 0.5 * sstep(lx - 24 * s, lx + 24 * s, x)), layers: [hatch(70, 1.4, 1.2, 0.08)], seed: 1670, fill: '#e9d9a4', halo: 0.8, outline: 1.2, wash: [WASH.brass, 0.85] });
    P.line([[lx - 28 * s, ly + 8 * s], [lx, ly + 3 * s], [lx + 28 * s, ly + 8 * s]], 1.0);
    for (const sx of [-26, 0, 26]) { P.line([[lx + sx * s, ly + 8 * s], [lx + sx * s * 1.2, ly + 2 * s]], 2.2); flame(P, lx + sx * s * 1.2, ly + 1 * s, (sx === 0 ? 17 : 14) * s, 1672 + sx); } }
  glow(P, lamp[0], lamp[1] + 6, portrait ? 150 : 170, portrait ? 120 : 100, 0.8);
  glow(P, tl[0], tl[1], 26, 22, 0.8);
  const crown = { lamp, top: lamp[1] - 20, bottom: lamp[1] + 32, left: lamp[0] - 36, right: lamp[0] + 36 };
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], crown, keys: { crown: [crown.left, crown.top, crown.right - crown.left, crown.bottom - crown.top] }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
