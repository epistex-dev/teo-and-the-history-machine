// Title-screen scene: Teo and Cuc Cu meet the machine by lantern light.
// Same engraved engine and the same baked parts as the story art: the machine, Teo and Cuc Cu are
// embedded sprites; the composition adds wall, floor and light around them.
import { clamp, sstep, f1, cr, vnoise, rng, paper } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow, flame } from './room.mjs';
import { machine } from './machine.mjs';
import { teoBody } from './teo.mjs';
import { cuckoo } from './birds.mjs';

const MACH_LAYERS = ['body', 'doorL', 'doorR', 'needle', 'crank'];
const machZ = () => MACH_LAYERS.map((l) => machine(l).plate.z.join('')).join('');

/** Embed baked part plates (z is in the part's own frame units) at (tx, ty) scaled by s. */
const embed = (P, z, tx, ty, s) => P.raw('<g transform="translate(' + f1(tx) + ' ' + f1(ty) + ') scale(' + f1(s) + ')">' + z + '</g>');

/** Four-ray engraved star: small card diamond, reads as a sparkle against hatched dark. */
const star4 = (P, x, y, r) => {
  const q = r * 0.36;
  P.part([[x, y - r, 1], [x + q, y - q, 1], [x + r, y, 1], [x + q, y + q, 1], [x, y + r, 1], [x - q, y + q, 1], [x - r, y, 1], [x - q, y - q, 1]], { tone: () => 0.04, layers: [], fill: CARD, halo: 0, outline: 0.7, wash: [WASH.glow, 0.3], seed: 420 });
};

export function title() {
  const W = 440, H = 300, hy = 252, sM = 0.72, sT = 0.66, sC = 0.5;
  const mTx = 194, mTy = 7.2, tTx = 120, tTy = 249.4, cTx = 206, cTy = 255;
  const dial = [mTx + 150 * sM, mTy + 200 * sM], lamp = [74, 63];
  const P = new Plate(72);
  const tone = (x, y) => {
    const light = pool(x, y, dial, 145, 0.8) + 0.7 * pool(x, y, lamp, 100, 0.9);
    const vig = sstep(200, 440, Math.hypot(x - 220, (y - 140) * 1.25)) * 0.44;
    return clamp(0.62 - 0.55 * light + vig + 0.07 * (vnoise(x * 0.05, y * 0.06, 5) - 0.5));
  };
  P.part(box(0, 0, W, hy), { tone, layers: [hatch(88, 3.2, 0.95, 0.06, 2.4, { wob: 0.4 }), hatch(28, 4, 0.8, 0.48, 2.4)], seed: 721, fill: paper, halo: 0, outline: 0, wash: null });
  P.raw('<rect x="0" y="0" width="' + W + '" height="' + hy + '" fill="' + WASH.sky + '" fill-opacity=".3" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  const r = rng(422);
  for (const [x, y] of [[36, 40], [150, 25], [30, 132], [345, 30], [415, 58], [24, 200]]) star4(P, x + (r() - 0.5) * 4, y + (r() - 0.5) * 4, 1.6 + r() * 1.0);
  // hanging lantern over Teo
  P.line([[lamp[0], 0], [lamp[0], 28]], 1.6);
  P.part(cr([[lamp[0] - 10, 28, 1], [lamp[0] + 10, 28, 1], [lamp[0] + 7, 33, 1], [lamp[0] - 7, 33, 1]], true, 3), { tone: () => 0.3, layers: [hatch(80, 1.6, 1, 0.1)], seed: 402, fill: '#e9d9a4', halo: 0, outline: 1.1, wash: [WASH.brass, 0.8] });
  P.part(box(lamp[0] - 8, 33, 16, 36), { tone: (px, py) => clamp(0.18 + 0.3 * pool(px, py, lamp, 16, 1.1)), layers: [hatch(0, 1.6, 0.9, 0.07, 1.8)], seed: 403, fill: '#f3ead0', halo: 0, outline: 1.0, wash: [WASH.glow2, 0.35] });
  flame(P, lamp[0], 69, 12, 404);
  P.part(cr([[lamp[0] - 8, 69, 1], [lamp[0] + 8, 69, 1], [lamp[0] + 6, 74], [lamp[0] - 6, 74]], true, 3), { tone: () => 0.34, layers: [hatch(0, 1.5, 0.9, 0.1)], seed: 405, fill: '#e9d9a4', halo: 0, outline: 1.0, wash: [WASH.brass, 0.8] });
  P.part(box(0, 244, W, 10), { tone: (x) => clamp(0.42 + 0.18 * tone(x, 248)), layers: [hatch(0, 1.4, 1.3, 0.08)], seed: 722, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.7] });
  floor(P, { W, H, hy, vp: [230, 80], bw: 60, tone, seed: 940 });
  embed(P, machZ(), mTx, mTy, sM);
  embed(P, teoBody('front', 'normal').plate.z.join(''), tTx, tTy, sT);
  embed(P, cuckoo('normal', 'all').plate.z.join(''), cTx, cTy, sC);
  glow(P, dial[0], dial[1], 160, 140);
  glow(P, lamp[0], lamp[1] + 6, 85, 85);
  return { orientation: 'landscape', plate: P, frame: [0, 0, W, H], svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
