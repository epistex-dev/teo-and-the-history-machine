// Chapter 17 a Catalan farmhouse kitchen late on 24 December: a whitewashed room seen head-on, stone floor, a plank ceiling on a cross beam. The open hearth on
// the left burns with a low fire of olive wood, throwing a warm halo across the room. In the left corner, at the edge of the halo, the Caga Tió log lies under
// its blanket with a red barretina and a smile, a stick leaning against the blanket's edge and an adult hand resting on it; small shadows of children gather
// around the blanket. On the right a plank table holds Tèo's sketch sheet and pencil. No figure, no animal, no clock.
import { clamp, sstep, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow, flame } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { STONE, view, joints } from './scenery.mjs';

const Z = 3.2, LOG = '#6b3d1a', CAP = '#b8362b';
const DESIGN = {
  portrait: { m: 243, half: 3.0, ceil: 2.4, hearth: [-2.3, -1.4], hz: 2.9, hood: 1.42, tioX: [-1.66, -1.0], tz: 2.3, table: [0.3, 1.3], top: 1.2, zn: 2.7, sheetX: 0.75, reach: 96, bw: 30, vig: [190, 540, 410], beam: 1.9 },
  landscape: { m: 250, half: 5.8, ceil: 2.4, hearth: [-3.0, -2.2], hz: 3.0, hood: 1.42, tioX: [-1.95, -1.15], tz: 2.6, table: [-1.1, -0.05], top: 0.85, zn: 2.7, sheetX: -0.55, reach: 72, bw: 30, vig: [340, 700, 160], beam: 2.9 },
};

export function cagaTio(orientation = 'portrait') {
  const L = LAYOUTS['ch17-tio-corner'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs, pr, ray, quad } = view(L, D.m), CEIL = D.ceil, SC = D.m / 356;
  const P = new Plate(72);
  const fx = (X, z = Z) => vx + (X * D.m) / z, fy = (Y, z = Z) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = Z) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const [ha, hb] = D.hearth, hz = D.hz, base = fy(D.top), tn = fy(D.top, D.zn), ceilY = fy(CEIL), flameP = [fx((ha + hb) / 2, hz), fy(0.72, hz)];
  const tone = (x, y) => {
    const light = pool(x, y, flameP, D.reach, 0.95) + 0.14 * pool(x, y, [flameP[0], flameP[1] - (portrait ? 90 : 55)], D.reach * 1.6, 0.8);
    const vig = sstep(D.vig[0], D.vig[1], Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - D.vig[2]) * 0.8)) * 0.3;
    return clamp(0.88 - 0.8 * Math.min(1, light) + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 13) - 0.5));
  };
  // ---------------------------------------------------------------- whitewashed back wall, smoke-dark above the hearth
  P.part(wall(-D.half, D.half, 0, CEIL), { tone: (x, y) => Math.min(0.93, clamp(tone(x, y) * 0.92 + 0.16 + (x < fx(hb, Z) ? 0.22 * sstep(fx(hb, Z), fx(ha, Z), x) : 0))), layers: [hatch(88, 3.4, 0.9, 0.06, 2.6), hatch(10, 4.2, 0.7, 0.5)], seed: 2401, fill: CARD, halo: 0, outline: 1.2, wash: null });
  { const r = rng(19); for (let i = 0; i < 4; i++) { const x = fx((r() * 2 - 1) * D.half * 0.8, Z), y = fy(0.6 + r() * 1.5, Z); P.line([[x, y], [x + 5 + r() * 8, y + 2 + r() * 5]], 0.8, 0.5); } }
  // ---------------------------------------------------------------- stone floor with tracked ash near the hearth
  floor(P, { W, H, hy: base, vp: L.vp, bw: D.bw, tone: (x, y) => Math.min(0.9, clamp(tone(x, y) * 0.9 + 0.14 + 0.15 * (vnoise(x * 0.03, y * 0.16, 9) - 0.5))), seed: 2450, wash: [WASH.wood, 0.35], joint: { min: 0.5, spread: 0.7 }, grain: 0.5, grid: 1.0, shadowLo: 0.38, cols: Math.ceil((W * hs) / ((base - vy) * D.bw)) + 10 });
  joints(P, wall(-D.half, D.half, 0, 0.02, 2.6), 2, 10, 2451, 0.5);
  // ---------------------------------------------------------------- plank ceiling on one cross beam
  const cLeft = pr(-D.half, CEIL, Z), cRight = pr(D.half, CEIL, Z);
  const ceil = quad([cLeft, cRight, ray(cRight, W + 30), [W + 30, -30], [-30, -30], ray(cLeft, -30)]);
  const pw = portrait ? 0.42 : 0.55, gapXs = [];
  for (let X = -6.4; X <= 6.4; X += pw) gapXs.push(fx(X));
  P.part(ceil, { tone: (x, y) => clamp(0.78 + 0.14 * (((Math.abs(Math.round(x / (portrait ? 102 : 96))) * 137) % 7) / 7) + 0.1 * (vnoise(x * 0.05, y * 0.05, 7) - 0.5)), layers: [hatch(0, 1.9, 1.0, 0.06, 2), hatch(74, 2.8, 0.8, 0.5)], seed: 2405, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood, 0.6] });
  { const r = rng(33); for (let i = 1; i < 9; i++) P.line([[gapXs[i] + (r() - 0.5) * 4, ceilY], [gapXs[i] + (r() - 0.5) * 6, -30]], 0.8, 0.85); }
  { const hB = portrait ? 0.13 : 0.14; P.part(quad([[pr(-D.half, D.beam + hB / 2, Z), pr(D.half, D.beam + hB / 2, Z), ray(pr(D.half, D.beam + hB / 2, Z), W + 30), ray(pr(-D.half, D.beam + hB / 2, Z), -30)]]), { tone: () => 0.82, layers: [hatch(0, 1.4, 1.0, 0.08, 1.8)], seed: 2406, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.8] }); P.part(box(-30, fy(D.beam - hB / 2, Z), W + 60, fy(D.beam + hB / 2, Z) - fy(D.beam - hB / 2, Z)), { tone: () => 0.8, layers: [hatch(88, 1.6, 1.0, 0.08, 2)], seed: 2407, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.85] }); }
  // ---------------------------------------------------------------- open hearth of stone with a low fire of olive wood
  { const yTop = fy(1.32, hz), yHood = fy(D.hood, hz), y0 = fy(1.15, hz), y1 = fy(0.35, hz), x0 = fx(ha, hz), x1 = fx(hb, hz);
    P.part([[x0, yHood, 1], [x1, yHood, 1], [x1 + 14, yTop - 6], [x1 + 14, y1 + 8], [x0 - 14, y1 + 8], [x0 - 14, yTop - 6]], true, 3, { tone: (x, y) => clamp(0.62 + 0.14 * sstep(yHood, y1 + 8, y) + 0.08 * (vnoise(x * 0.08, y * 0.08, 6) - 0.5)), layers: [hatch(0, 2.2, 1.0, 0.08, 2.2), hatch(82, 2.6, 0.8, 0.5)], seed: 2410, fill: CARD, halo: 0.6, outline: 1.3, wash: [STONE, 0.6] });
    joints(P, [[x0 - 14, yTop - 6, 1], [x1 + 14, yTop - 6, 1], [x1 + 14, y1 + 8, 1], [x0 - 14, y1 + 8, 1]], 4, 6, 2411, 0.6);
    P.part(box(x0 - 4, y0, x1 - x0 + 8, y1 - y0), { tone: (x, y) => clamp(0.84 - 0.5 * pool(x, y, flameP, D.reach * 0.7, 1) + 0.06 * (vnoise(x * 0.1, y * 0.1, 5) - 0.5)), layers: [hatch(88, 1.8, 1.0, 0.08, 2)], seed: 2412, fill: CARD, halo: 0, outline: 1.1, wash: null });
    for (const [lx0, ly0, lx1] of [[x0 + 8, y1 - 4, x1 - 6], [x0 + 4, y1 - 10, x1 - 12]]) P.line([[lx0, ly0], [lx1, ly0 + 3]], 5.5, 0.95, LOG);
    flame(P, flameP[0] - 10, y1 - 6, 26, 2413); flame(P, flameP[0] + 8, y1 - 8, 19, 2414); }
  // ---------------------------------------------------------------- the Caga Tió log under its blanket, stick and adult hand
  { const tz = D.tz, x0 = fx(D.tioX[0], tz), x1 = fx(D.tioX[1], tz), yB = fy(0.46, tz), yF = fy(0, tz);
    for (const [sx, sy, rx, ry] of [[x0 - 2, yF - 4, 20, 7], [x0 + 26, yF - 2, 24, 8], [x0 + 44, yF - 5, 18, 6]]) { const pts = []; for (let a = 0; a <= 10; a++) pts.push([sx + Math.cos((a / 10) * 2 * Math.PI) * rx, sy + Math.sin((a / 10) * 2 * Math.PI) * ry]); P.part(pts, true, 3, { tone: () => 0.8, seed: 2415, fill: CARD, halo: 0, outline: 0.7, wash: null }); }
    P.part([[x0 - 8, yB - 2, 1], [x1 + 6, yB - 4, 1], [x1 + 10, yF - 6], [x1 - 2, yF], [x0 + 2, yF], [x0 - 12, yF - 6]], true, 3, { tone: (x, y) => clamp(0.5 + 0.12 * sstep(yB - 2, yF, y) + 0.08 * (vnoise(x * 0.07, y * 0.07, 6) - 0.5) - 0.18 * pool(x, y, flameP, D.reach * 1.1, 1)), layers: [hatch(4, 2.0, 0.9, 0.08, 2), hatch(80, 2.6, 0.7, 0.5)], seed: 2416, fill: CARD, halo: 0.7, outline: 1.1, wash: [WASH.coat, 0.55] });
    { const r = rng(37); for (let i = 0; i < 4; i++) P.line([[x0 - 4 + i * (x1 - x0) / 3.4, yB], [x0 + i * (x1 - x0) / 3.4 + 3, yF - 2]], 0.8, 0.6); }
    P.part(cr([[x0 + 2, yF - 14, 1], [x0 - 4, yF - 10], [x0 - 3, yF - 4, 1], [x0 + 4, yF - 3, 1], [x0 + 10, yF - 7], [x0 + 9, yF - 13, 1]], true, 4), { tone: () => 0.42, layers: [hatch(30, 1.4, 0.9, 0.08, 1.8)], seed: 2417, fill: CARD, halo: 0.7, outline: 1.1, wash: [LOG, 0.85] });
    P.line([[x0 + 3, yF - 10], [x0 + 7, yF - 10]], 1, 0.85); P.line([[x0 + 3, yF - 7], [x0 + 7, yF - 8]], 1.1, 0.8); P.line([[x0 + 4, yF - 5], [x0 + 7, yF - 5.5]], 0.9, 0.7);
    P.part(cr([[x0 - 2, yF - 16, 1], [x0 + 6, yF - 22, 1], [x0 + 15, yF - 19], [x0 + 12, yF - 14, 1], [x0 + 3, yF - 13.5, 1]], true, 4), { tone: () => 0.28, layers: [hatch(24, 1.5, 1.0, 0.08, 1.8)], seed: 2418, fill: CARD, halo: 0.8, outline: 1.1, wash: [CAP, 0.9] });
    P.line([[x0 + 16, yF - 17], [x0 + 21, yF - 15.5]], 1.6, 0.9, CAP);
    P.line([[x1 + 2, yB + 2], [x1 + 14, yF + 2]], 2.6, 0.95); P.line([[x1 + 2, yB + 2], [x1 + 14, yF + 2]], 2.6, 0.95, WASH.wood);
    P.part(cr([[x1 - 6, yB - 4, 1], [x1 - 1, yB - 8], [x1 + 2, yB - 6, 1], [x1 + 1, yB - 2, 1], [x1 - 3, yB, 1]], true, 3), { tone: () => 0.34, layers: [hatch(70, 1.2, 0.8, 0.06, 1.6)], seed: 2419, fill: CARD, halo: 0.5, outline: 0.9, wash: [WASH.skin, 0.7] }); }
  // ---------------------------------------------------------------- plank table with the sketch sheet and pencil
  P.part([[fx(D.table[0], Z), base - 1, 1], [fx(D.table[1], Z), base - 1, 1], [fx(D.table[1], D.zn), tn, 1], [fx(D.table[0], D.zn), tn, 1]], { tone: (x) => clamp(0.34 + 0.12 * sstep(fx(D.table[0], Z), fx(D.table[1], Z), x)), layers: [hatch(0, 1.3, 1.0, 0.08, 1.7)], seed: 2420, fill: CARD, halo: 0.7, outline: 1.2, wash: [WASH.wood, 0.75] });
  { const sx = fx(D.sheetX, Z), sy = base - 1.5, x0 = fx(D.sheetX - 0.13, Z + 0.05), x1 = fx(D.sheetX + 0.13, Z + 0.05), x2 = fx(D.sheetX + 0.14, D.zn), x3 = fx(D.sheetX - 0.12, D.zn), y0 = fy(D.top, Z + 0.05), y1 = fy(D.top, D.zn);
    P.part([[x0, y0, 1], [x1, y0, 1], [x2, y1, 1], [x3, y1, 1]], { tone: () => 0.1, seed: 2421, fill: '#efe3c0', halo: 0.8, outline: 0.9, wash: null });
    { const r = rng(41); for (let i = 0; i < 5; i++) { const px = sx - 10 + r() * 20, py = sy - 1 + r() * 3; P.line([[px, py], [px + 3 + r() * 4, py + 1 + r() * 2]], 0.8, 0.75); } }
    P.line([[sx + 18, sy + 4], [sx + 33, sy + 6]], 2.4, 0.85, '#cfa24a'); P.line([[sx + 33, sy + 6], [sx + 36, sy + 6.6]], 2.4, 0.9); }
  // ---------------------------------------------------------------- warm halo of the fire
  glow(P, flameP[0], flameP[1] - 6, portrait ? 92 : 74, portrait ? 78 : 62, 0.9);
  const keys = {
    fire: [flameP[0] - 24, fy(0.9, hz) - 4, 32, 34],
    tio: [fx(D.tioX[0], D.tz) - 4, fy(0.46, D.tz) - 8, fx(D.tioX[1], D.tz) - fx(D.tioX[0], D.tz) + 4, fy(0, D.tz) - fy(0.46, D.tz) + 8],
    sheet: [fx(D.sheetX, Z) - 22, base - 7, 44, 13],
    dark: portrait ? [330, 310, 30, 30] : [700, 130, 30, 30],
  };
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp: flameP, layers: {}, keys, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
