// Chapter 5 night outside Bethlehem: a stony hillside rising to the right under a hatched night sky, the small town far off on the left with a few lit windows, a path of flat stones,
// and an empty spot on the slope where the script reveals the manger and its oil lamp (the prop manger-lamp, lit.mjs). No figure of any kind and no animal.
import { clamp, sstep, f1, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, stars } from './scenery.mjs';

const STRAW = '#e8d7a0', DEEP = '#6c5a42';
const DESIGN = {
  portrait: { manger: [232, 338], hill: 90, hillW: 230, town: [10, 120], rocks: [[16, 420, 1.2], [44, 520, 1.5], [362, 470, 1.3], [372, 560, 1.6]], pathFrom: [150, 612], pathTo: [226, 358] },
  landscape: { manger: [440, 170], hill: 70, hillW: 340, town: [30, 160], rocks: [[30, 220, 1.5], [120, 300, 1.7], [805, 245, 1.5], [870, 300, 1.7], [400, 330, 1.2]], pathFrom: [392, 300], pathTo: [424, 184] },
};

const rock = (P, x, y, s, seed, tone) => {
  const r = rng(seed), n = 7, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.75 + r() * 0.5; pts.push([x + Math.cos(a) * 17 * s * k, y + Math.sin(a) * 11 * s * k]); }
  P.part(cr(pts, true, 4), { tone: (px, py) => clamp(tone(px, py) * 0.7 + 0.28 + 0.25 * sstep(x - 14 * s, x + 16 * s, px)), layers: [hatch(70, 2.0, 1.1, 0.08, 1.8), hatch(15, 2.8, 0.8, 0.5)], seed, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.5] });
};

export function bethlehem(orientation = 'portrait') {
  const L = LAYOUTS['ch5-bethlehem'][orientation], D = DESIGN[orientation], [W, H] = L.size, [, hz] = L.vp, portrait = orientation === 'portrait';
  const P = new Plate(55);
  const ry = (x) => hz + 6 - D.hill * Math.pow(sstep(W - D.hillW, W, x), 1.2) + 3 * Math.sin(x * 0.05);
  const mx = D.manger[0], my = D.manger[1];
  const tone = (x, y) => {
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.1 : 0.9), (y - (portrait ? 500 : 230)) * 0.8)) * 0.18;
    return clamp(0.8 + vig + 0.07 * (vnoise(x * 0.05, y * 0.05, 7) - 0.5));
  };
  // ---------------------------------------------------------------- night sky: dense burin work, a few paper dots for stars
  const sky = box(0, 0, W, hz + 60);
  P.part(sky, { tone: (x, y) => clamp(0.88 - 0.4 * sstep(0, hz, y) + 0.05 * (vnoise(x * 0.03, y * 0.05, 3) - 0.5)), layers: [hatch(0, 2.5, 1.2, 0.1, 2.2), hatch(28, 3.2, 0.9, 0.55, 2.2)], seed: 1501, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.85] });
  stars(P, [0, 6, W, hz - 10], portrait ? 46 : 70, 15);
  // ---------------------------------------------------------------- far hills and the town below
  const far = [[-10, H], [-10, hz - 4]];
  for (let x = 0; x <= W + 10; x += 22) far.push([x, hz - 6 - 14 * vnoise(x * 0.02, 2, 5) - (portrait ? 0 : 8) * vnoise(x * 0.01, 9, 4)]);
  far.push([W + 10, H]);
  P.part(far, { tone: (x, y) => clamp(0.8 - 0.1 * sstep(hz - 20, hz + 10, y)), layers: [hatch(4, 2.2, 1.1, 0.1, 2.2), hatch(-30, 3.0, 0.9, 0.55)], seed: 1502, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.75] });
  { const [t0, t1] = D.town, r = rng(33), base = hz + 3;
    P.part(box(t0 - 6, base - 3, t1 - t0 + 12, 12), { tone: () => 0.7, layers: [hatch(2, 2.2, 1.0, 0.1, 2)], seed: 1509, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.55] });
    for (let x = t0, i = 0; x < t1 - 10; i++) { const w = 12 + r() * 12, h = 10 + r() * 10, top = base - h;
      P.part([[x, top, 1], [x + w, top, 1], [x + w, base + 3, 1], [x, base + 3, 1]], { tone: (px) => clamp(0.55 + 0.2 * sstep(x, x + w, px)), layers: [hatch(90, 1.8, 1.0, 0.1, 1.6), hatch(20, 2.6, 0.7, 0.55)], seed: 1510 + i, fill: CARD, halo: 0, outline: 0.9, wash: [DEEP, 0.6] });
      P.line([[x - 1, top], [x + w + 1, top]], 1.1, 1);
      if (i % 4 === 2) P.part(cr([[x + 1, top, 1], [x + 2, top - 5], [x + w / 2, top - 8], [x + w - 2, top - 5], [x + w - 1, top, 1]], true, 4), { tone: () => 0.6, layers: [hatch(80, 1.8, 0.9, 0.1, 1.6)], seed: 1530 + i, fill: CARD, halo: 0, outline: 0.9, wash: [DEEP, 0.5] });
      for (let k = 0; k < (i % 3 === 0 ? 2 : 1); k++) { const wx = x + w * (0.3 + 0.35 * k), wy = top + h * 0.35; if (i % 2 === 0) P.raw('<rect x="' + f1(wx) + '" y="' + f1(wy) + '" width="2.6" height="3.4" fill="#fff3b0" stroke="' + ink + '" stroke-width=".3"/><rect x="' + f1(wx) + '" y="' + f1(wy) + '" width="2.6" height="3.4" fill="' + WASH.flame + '" fill-opacity=".85" style="mix-blend-mode:multiply"/>'); else P.raw('<rect x="' + f1(wx) + '" y="' + f1(wy) + '" width="2.2" height="3" fill="' + ink + '"/>'); }
      x += w + 1.5 + r() * 3; } }
  // ---------------------------------------------------------------- the stony slope
  const slope = [[-10, H + 10], [-10, ry(-10)]];
  for (let x = 0; x <= W + 10; x += 10) slope.push([x, ry(Math.min(x, W))]);
  slope.push([W + 10, H + 10]);
  P.part(slope, { tone: (x, y) => Math.min(0.84, clamp(tone(x, y) * 0.95 + 0.06 + 0.18 * (vnoise(x * 0.03, y * 0.12, 9) - 0.5))), layers: [hatch(6, 2.7, 1.1, 0.1, 2.2, { wob: 0.5 }), hatch(-32, 3.8, 0.9, 0.48), hatch(58, 4.6, 0.8, 0.66)], seed: 1503, fill: CARD, halo: 0, outline: 1.2, wash: [DEEP, 0.4] });
  P.raw('<path d="' + 'M0 ' + f1(H) + 'L0 ' + f1(ry(0)) + slope.slice(2, -1).map((p) => 'L' + f1(p[0]) + ' ' + f1(p[1])).join('') + 'L' + W + ' ' + f1(H) + 'Z" fill="' + BLUE + '" fill-opacity=".42" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  // strata on the hillside: short courses of ledge lines
  { const r = rng(61); for (let i = 0; i < 16; i++) { const x = r() * D.hillW * 0.9, y = ry(x) + 12 + r() * (portrait ? 110 : 60); P.line(cr([[x, y], [x + 18 + r() * 24, y + 1.5], [x + 40 + r() * 20, y - 0.5]], false, 4), 0.8, 0.8); } }
  // ledges of bare rock breaking out of the hillside
  { const r = rng(57), spots = portrait ? [[18, 96], [104, 40], [160, 150], [250, 24], [30, 190], [330, 22]] : [[20, 60], [150, 36], [250, 80], [560, 30], [700, 20], [80, 150]];
    spots.forEach(([x, dy], i) => { const w = 46 + r() * 40, y = ry(x) + dy, top = [], bot = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6, taper = Math.sin(Math.PI * t) ** 0.6; top.push([x + t * w, y - 2 * taper + 1.5 * Math.sin(t * 9 + i)]); bot.push([x + t * w, y + 9 * taper + 1.5 * Math.sin(t * 7 + i)]); }
      P.part([...top, ...bot.reverse()], { tone: (px, py) => clamp(0.72 + 0.2 * sstep(x + w, x, px)), layers: [hatch(80, 2.0, 1.1, 0.1, 1.8), hatch(8, 2.8, 0.8, 0.5)], seed: 1580 + i, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.4] }); }); }
  { const r = rng(91); for (let i = 0; i < (portrait ? 34 : 40); i++) { const x = r() * W, y = ry(x) + 24 + r() * (H - ry(x) - 60); if (Math.hypot(x - mx, y - my) < 50) continue; for (const dx of [-3, 0, 3]) P.line([[x + dx * 0.4, y], [x + dx * 1.5, y - 6 - r() * 4]], 0.7, 0.9); } }
  // ---------------------------------------------------------------- path of flat stones up to the manger
  { const [x0, y0] = D.pathFrom, [x1, y1] = D.pathTo, n = 7;
    for (let i = 0; i < n; i++) { const t = i / (n - 1), x = x0 + (x1 - x0) * t + (i % 2 ? 7 : -7) * (1 - t), y = y0 + (y1 - y0) * (1 - Math.pow(1 - t, 1.6)), s = 1.5 - 1.05 * t;
      P.part(cr([[x - 17 * s, y, 1], [x - 10 * s, y - 6 * s], [x + 12 * s, y - 6.5 * s], [x + 19 * s, y, 1], [x + 8 * s, y + 5 * s], [x - 10 * s, y + 4.5 * s]], true, 4), { tone: (px) => clamp(0.4 + 0.25 * sstep(x - 18 * s, x + 18 * s, px) + 0.2 * tone(px, y)), layers: [hatch(0, 1.8, 1.0, 0.08, 1.8)], seed: 1530 + i, fill: CARD, halo: 0, outline: 1.1, wash: [STONE, 0.55] }); } }
  // flat-topped stone step (bac da) knee-high, where the script seats Teo to spread the cards (both orientations; the portrait one sits under Teo's default x, the landscape one is reached with `land 123,274`)
  if (!portrait) {
    const step = cr([[96, 274, 1], [97, 203], [104, 196.5, 1], [142, 196, 1], [150, 203], [150, 273, 1]], true, 4);
    P.part(step, { tone: (px, py) => clamp(0.45 + 0.25 * sstep(96, 150, px) + 0.2 * (vnoise(px * 0.1, py * 0.1, 6) - 0.5) + 0.22 * sstep(203, 273, py)), layers: [hatch(6, 2.2, 1.05, 0.1, 1.8), hatch(78, 2.8, 0.85, 0.55)], seed: 1562, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.55] });
    P.line([[97, 205], [149, 204]], 0.8, 0.7); P.line([[99, 258], [148, 258]], 0.6, 0.5);
  } else {
    const step = cr([[70, 622, 1], [71, 537], [78, 530, 1], [118, 529.5, 1], [126, 537], [126, 621, 1]], true, 4);
    P.part(step, { tone: (px, py) => clamp(0.45 + 0.25 * sstep(70, 126, px) + 0.2 * (vnoise(px * 0.1, py * 0.1, 6) - 0.5) + 0.22 * sstep(537, 621, py)), layers: [hatch(6, 2.2, 1.05, 0.1, 1.8), hatch(78, 2.8, 0.85, 0.55)], seed: 1563, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.55] });
    P.line([[71, 539], [125, 538]], 0.8, 0.7); P.line([[73, 605], [124, 605]], 0.6, 0.5);
  }
  for (const [x, y, s] of D.rocks) rock(P, x, y, s, 1540 + Math.round(x), tone);
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
