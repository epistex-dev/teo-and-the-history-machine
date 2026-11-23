// Tèo: slender adult elf, built from a skeleton (joint points) whose limbs are Catmull-Rom tubes that overlap each other.
// Body and head base are one alpha sprite per view; the expressions are a separate sheet of eyebrows, lids and mouth drawn over the head base.
import { clamp, mix, sstep, f1, cr, ellipse, bbox, vnoise, ink, paper } from './lib.mjs';
import { Plate, gauss, limb, tubeTone, hand, WASH } from './draw.mjs';
import { drawFace } from './faces.mjs';

export const CARD = '#f5eed8';
export const FRAME = [-96, -336, 192, 348];
const L = { lx: 0.62, ly: -0.42, lz: 0.66 };
const tt = (tube, o = {}) => tubeTone(tube, { ...L, ...o });
const lerpTable = (t, tab) => { if (t <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (t <= tab[i][0]) return mix(tab[i - 1][1], tab[i][1], (t - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0])); return tab[tab.length - 1][1]; };

export const VIEW = { front: { yaw: 0 }, 'three-quarter': { yaw: 0.62 } };
function ctx(view) { const yaw = VIEW[view].yaw, C = Math.cos(yaw), S = Math.sin(yaw); return { view, yaw, C, S, X: (x, z = 0) => x * C + z * S, three: yaw > 0 }; }
// skeleton, front view, feet at y = 0, crown of the skull at y = -300 (head = 43 = a seventh of the body)
export const SK = {
  neck: [0, -249], shL: [-31, -234], shR: [31, -234], elL: [-40, -190], elR: [47, -187], wrL: [-37, -144], wrR: [27, -158],
  hipL: [-12, -150], hipR: [13, -148], knL: [-14, -85], knR: [16, -85], anL: [-15, -14], anR: [19, -13],
};

// posed bodies: `read` bows the upper body toward the ground (squash about the hips), `sit` lifts a rigid upper body onto a stool
// (hips at -45, soles at +55, knees just under the tunic hem), `sheet` is the standing body with the folded calendar strip tucked in the belt.
export const POSE_GEO = {
  read: { frame: [-96, -310, 192, 322], face: [-18, -274, 38, 36] },
  sheet: { frame: FRAME, face: [-18, -296, 38, 42] },
  sit: { frame: [-96, -232, 192, 297], face: [-18, -191, 38, 42] },
};
const upT = (pose) => pose === 'sit' ? (x, y, c) => [x, y + 105, c]
  : pose === 'read' ? (x, y, c) => [x, y <= -150 ? -150 + (y + 150) * 0.85 : y, c]
  : (x, y, c) => [x, y, c];
// a drawing plate whose part/line/dot/ring/box route every coordinate through T (raw strings pass through untouched)
function posed(P, T) {
  return {
    part: (pts, o) => P.part(pts.map((pt) => T(pt[0], pt[1], pt[2])), o),
    line: (pts, w, op, col) => P.line(pts.map((pt) => T(pt[0], pt[1])), w, op, col),
    dot: (x, y, ...a) => P.dot(...T(x, y), ...a),
    ring: (x, y, rx, ry, ...a) => P.ring(...T(x, y), rx, ry, ...a),
    box: (x, y, w, h, attrs) => P.box(...T(x, y), w, h, attrs),
    raw: (st) => P.raw(st),
    hatch: (pts, o) => P.hatch(pts.map((pt) => T(pt[0], pt[1])), o),
    group: (attr, fn) => P.group(attr, fn),
  };
}

function legs(P, v) {
  const { X, three } = v, sk = SK;
  const jL = [[X(sk.hipL[0]), -150], [X(sk.knL[0] + 1.5, 6) - 1, -118], [X(sk.knL[0], 6), -85], [X(sk.anL[0] + 2, 8) , -50], [X(sk.anL[0], 8), -16]];
  const jR = [[X(sk.hipR[0]), -150], [X(sk.knR[0] - 1.5, -4), -118], [X(sk.knR[0], -4), -85], [X(sk.anR[0] - 2, -6), -50], [X(sk.anR[0], -6), -16]];
  const hoseR = limb(jR, [20.5, 17, 14, 16.5, 9], 7), hoseL = limb(jL, [21.5, 17.5, 14, 17, 9], 7);
  const hoses = [[hoseR, 111], [hoseL, 112]];
  const bootL = three
    ? cr([[-16.6, -40, 1], [0.4, -40, 1], [0.8, -26], [2.5, -17], [10, -10.5], [20, -6.5], [27, -3.8, 1], [23, 1.8], [0, 1.9], [-14, 1.6], [-18.4, -2, 1], [-17, -12], [-16, -26]], true, 5)
    : cr([[-24, -40, 1], [-8.5, -40, 1], [-8.5, -27], [-9, -17], [-5, -10], [3, -6.5], [12, -3, 1], [8, 1.8], [-10, 1.8], [-26, 1], [-36, -2.5, 1], [-33.5, -7], [-27, -12], [-24.6, -25]], true, 5);
  const bootR = three
    ? cr([[4, -40, 1], [20, -40, 1], [20.4, -27], [22, -18], [28, -11], [37, -7], [44, -4.2, 1], [41, 1.4], [22, 1.6], [6, 1.2], [2.4, -2, 1], [3.4, -12], [4, -26]], true, 5)
    : cr([[11, -40, 1], [28, -40, 1], [28.6, -26], [28.2, -16], [32, -10], [40, -6.5], [49, -2.5, 1], [45, 1.8], [26, 1.8], [10, 1], [4, -2, 1], [6, -8], [10, -14], [10.6, -26]], true, 5);
  const bt = (x0, x1) => (x, y) => clamp(0.52 + 0.3 * sstep(x1, x0, x) + 0.28 * sstep(-10, 0, y) - 0.12 * (vnoise(x * 0.4, y * 0.4, 6) - 0.5) - 0.2 * gauss(x, (x0 + x1) / 2 + 6, 5) * gauss(y, -20, 12));
  const bl = [{ angle: 74, gap: 1.7, w: 1.4, lo: 0.08, step: 2 }, { angle: 8, gap: 2.2, w: 1.1, lo: 0.52, step: 2 }];
  const cuffs = three
    ? [cr([[4, -47.5, 1], [20.4, -47, 1], [20.6, -37.6], [4.2, -38]], true, 4), cr([[-17, -47, 1], [1, -47.6, 1], [1.4, -38], [-17.4, -37.6]], true, 4)]
    : [cr([[9, -47.5, 1], [29.5, -47, 1], [29.6, -37.6], [9.4, -38]], true, 4), cr([[-26, -47, 1], [-7, -47.5, 1], [-6.6, -38], [-26.4, -37.6]], true, 4)];
  const order = [[hoseR, 111, bootR, cuffs[0], bt(three ? 4 : 8, three ? 44 : 46), 121, 124], [hoseL, 112, bootL, cuffs[1], (x, y) => clamp(bt(three ? -18 : -34, three ? 27 : 6)(x, y) + 0.08), 122, 123]];
  for (const [t, hs, boot, cuff, bto, bs, cs] of order) {
    const base = tubeTone(t, { ...L, gain: 0.8 });
    P.part(t.outline, { tone: (x, y) => clamp(base(x, y) * 0.9 + 0.14 * gauss(y, -85, 6) + 0.1 * (vnoise(x * 0.3, y * 0.2, 4) - 0.5)), layers: [{ angle: 86, gap: 1.9, w: 1.35, lo: 0.08, step: 2 }, { angle: 30, gap: 2.4, w: 1.1, lo: 0.58, step: 2 }], seed: hs, wash: [WASH.wood2, 0.5] });
    const k = t.center[Math.floor(t.center.length * 0.46)];
    P.line([[k[0] - 6, k[1] + 1], [k[0] - 1, k[1] + 3.6], [k[0] + 6, k[1] + 1.4]], 0.55, 0.75);
    P.line([[k[0] - 5, k[1] + 5], [k[0], k[1] + 6.6], [k[0] + 5, k[1] + 5.4]], 0.4, 0.55);
    P.part(boot, { tone: bto, layers: bl, seed: bs, wash: [WASH.wood2, 0.6] });
    P.part(cuff, { tone: (x, y) => clamp(0.15 + 0.3 * sstep(-14, -26, x) + 0.2 * sstep(-46, -38, y)), layers: [{ angle: 80, gap: 2, w: 1.0, lo: 0.1, step: 1.8 }], halo: 1.4, outline: 1, seed: cs, wash: [WASH.wood, 0.5] });
  }
  const soleA = three ? [[-18, 1], [-2, 1.8], [27, -0.4]] : [[-33, -1], [-12, 0.6], [8, 0.2]];
  const soleB = three ? [[3, 1], [22, 1.6], [44, -1.2]] : [[6, 0.5], [24, 0.6], [49, -0.4]];
  P.line(soleA, 1.6); P.line(soleB, 1.6);
}

function legsSit(P, v) {
  const { X, three } = v;
  // seated: the thighs hide under the tunic hem (y 0), the shins drop from the knee to the floor in front
  const jL = [[X(-12), -45], [X(-14, 22) - 1, -14], [X(-15, 24), -4], [X(-15, 22), 18], [X(-15, 20), 40]];
  const jR = [[X(13), -45], [X(15, 16) + 1, -16], [X(16, 18), -4], [X(18, 16), 18], [X(19, 14), 40]];
  const hoseR = limb(jR, [20, 15, 13.5, 13, 10.5], 6), hoseL = limb(jL, [21, 15.5, 14, 13.5, 10.5], 6);
  for (const [t, hs] of [[hoseR, 111], [hoseL, 112]]) {
    const base = tubeTone(t, { ...L, gain: 0.8 });
    P.part(t.outline, { tone: (x, y) => clamp(base(x, y) * 0.9 + 0.12 * gauss(y, 22, 9) + 0.08 * (vnoise(x * 0.3, y * 0.2, 4) - 0.5)), layers: [{ angle: 86, gap: 1.9, w: 1.35, lo: 0.08, step: 2 }, { angle: 30, gap: 2.4, w: 1.1, lo: 0.58, step: 2 }], seed: hs, wash: [WASH.wood2, 0.5] });
  }
  const bl = [{ angle: 74, gap: 1.7, w: 1.4, lo: 0.08, step: 2 }, { angle: 8, gap: 2.2, w: 1.1, lo: 0.52, step: 2 }];
  const bt = (x, y) => clamp(0.52 + 0.3 * sstep(-24, 22, x * (three ? -1 : 1)) + 0.26 * sstep(30, 52, y) - 0.12 * (vnoise(x * 0.4, y * 0.4, 6) - 0.5));
  const bootL = cr([[-27, 35, 1], [-10, 35, 1], [-10, 45], [-7, 52], [2, 54.5], [9, 50.5, 1], [8, 44], [8, 35]], true, 5);
  const bootR = cr([[9, 35, 1], [27, 35, 1], [27, 45], [25, 52], [15, 54.5], [8, 50.5, 1], [9, 44]], true, 5);
  const cuffL = cr([[-27, 35, 1], [-10, 35, 1], [-10, 44], [-27, 43]], true, 4);
  const cuffR = cr([[9, 35, 1], [27, 35, 1], [27, 44], [9, 43]], true, 4);
  P.part(bootL, { tone: bt, layers: bl, seed: 121, wash: [WASH.wood2, 0.6] });
  P.part(bootR, { tone: (x, y) => clamp(bt(x, y) + 0.06), layers: bl, seed: 124, wash: [WASH.wood2, 0.6] });
  const ct = { tone: (x, y) => clamp(0.15 + 0.3 * sstep(20, 8, x)), layers: [{ angle: 80, gap: 2, w: 1.0, lo: 0.1, step: 1.8 }], halo: 1.4, outline: 1, seed: 123, wash: [WASH.wood, 0.5] };
  P.part(cuffL, ct); P.part(cuffR, { ...ct, seed: 126 });
  P.line([[-27, 55], [-8, 56]], 1.6); P.line([[9, 56], [27, 55]], 1.6);
}

const lean = y => lerpTable(y, [[-250, 1.5], [-200, 0.4], [-165, -1.4], [-120, -2.4], [-100, -2.4]]);
const half = y => lerpTable(y, [[-247, 13], [-243, 27], [-238, 34.5], [-226, 36], [-205, 31], [-185, 24.5], [-168, 21.5], [-152, 25.5], [-130, 31], [-105, 35]]);
const halfV = (v, y) => Math.hypot(half(y) * v.C, half(y) * 0.62 * v.S);
const frontX = (v, y) => lean(y) + half(y) * 0.62 * v.S;
function tunic(P, v, T = null) {
  const ys = [-238, -226, -205, -185, -168, -152, -130, -110];
  const left = ys.map(y => [lean(y) - halfV(v, y), y]);
  const right = ys.map(y => [lean(y) + halfV(v, y), y]).reverse();
  const w = halfV(v, -105);
  const hem = []; for (let i = 0; i <= 8; i++) { const x = lean(-105) - w + ((2 * w) * i) / 8; hem.push([x, i === 0 || i === 8 ? -108 : (i % 2 ? -96 : -108) + 1.6 * Math.sin(i * 1.7), 1]); }
  const nk = halfV(v, -247) * 0.85;
  const topL = [[lean(-250) - nk, -250, 1], [lean(-247) - halfV(v, -244) * 0.75, -247.5], [lean(-244) - halfV(v, -242) * 0.92, -244.5]];
  const topR = [[lean(-244) + halfV(v, -242) * 0.92, -244.5], [lean(-247) + halfV(v, -244) * 0.75, -247.5], [lean(-250) + nk, -250, 1]];
  const pts = cr([...topL, ...left, ...hem, ...right, ...topR], true, 5);
  const torso = limb([[1.5, -248], [0.4, -205], [-1.4, -166], [-2.4, -110]].map((pt) => (T ? T(pt[0], pt[1]) : pt)), [halfV(v, -240) * 2, halfV(v, -205) * 2, halfV(v, -168) * 2, halfV(v, -125) * 2], 8);
  const fx = y => frontX(v, y);
  const folds = [[-20, 0.04, 5], [-8, 0.0, 4.2], [5, -0.02, 4], [17, -0.06, 4.4], [26, -0.12, 3.2]].map(([a, b, c]) => [a * v.C + (v.three ? 3 : 0), b, c]);
  const base = tt(torso, { gain: 0.78, amb: 0.1 });
  const tone = (x, y) => {
    let t = base(x, y) * 0.92 + 0.04;
    if (y > -165) for (const [fxx, sl, wd] of folds) t += 0.26 * gauss(x, fxx + sl * (y + 165), wd) * sstep(-165, -138, y) * (1 - 0.3 * sstep(-115, -104, y));
    t += 0.24 * gauss(x, fx(y), 3) * (y < -167 ? sstep(-232, -204, y) : 0);
    t += 0.3 * gauss(y, -165, 4.5) * 0.9;
    t += 0.22 * (gauss(x, -19 * v.C, 6) * gauss(y, -209, 12) + gauss(x, 22 * v.C, 7) * gauss(y, -212, 10));
    return clamp(t + (vnoise(x * 0.12, y * 0.12, 7) - 0.5) * 0.1);
  };
  P.part(pts, { tone, layers: [{ angle: 86, gap: 2.0, w: 1.55, lo: 0.06, step: 2.2, wob: 0.35 }, { angle: 36, gap: 2.5, w: 1.3, lo: 0.52, step: 2.2 }, { angle: -32, gap: 3.1, w: 1.15, lo: 0.8, step: 2.2 }], seed: 131, wash: [WASH.coat, 0.62] });
  for (const [fxx, sl, y0] of [[-21, 0.03, -158], [-9, 0, -156], [6, -0.02, -156], [18, -0.07, -156], [-28, 0.06, -146]]) { const xx = fxx * v.C + (v.three ? 5 : 0); P.line(cr([[xx, y0], [xx + sl * 20 - 1, y0 + 22], [xx + sl * 40, y0 + 48]], false, 6), 0.7, 0.85); }
  // placket and buttons run down the front centre line
  P.line(cr([-246, -200, -168].map(y => [fx(y) - 0.2, y]), false, 6), 0.75, 0.8);
  for (const y of [-226, -207, -188]) P.dot(fx(y) + 1.4, y, 1.6, CARD);
  // belt (sags toward the front), buckle on the front centre, pouch on the screen-left hip
  const bx0 = lean(-170), bw = halfV(v, -168) + 1.2;
  const sag = (x) => 1.2 * Math.cos(((x - fx(-168)) / (bw * 1.6)) * Math.PI / 2);
  const top = [], bot = [];
  for (let i = 0; i <= 8; i++) { const x = bx0 - bw + (2 * bw * i) / 8; top.push([x, -172.4 + sag(x) + 0.0 * i + 0.2 * (i - 4)]); bot.push([x, -163 + sag(x) + 0.2 * (i - 4)]); }
  const belt = [...top, ...bot.reverse()];
  P.part(belt, { tone: (x, y) => clamp(0.55 - 0.2 * sstep(-25, 25, x) + 0.25 * gauss(y, -161, 2)), layers: [{ angle: 1, gap: 1.6, w: 1.1, lo: 0.1, step: 2 }], halo: 0, outline: 1, seed: 133, wash: [WASH.wood2, 0.55] });
  const bkx = fx(-168);
  P.box(bkx - 5.5 * Math.max(v.C, 0.7), -175, 11 * Math.max(v.C, 0.72), 14.5, `rx="1" fill="${CARD}" stroke="${ink}" stroke-width="1.1"`);
  P.box(bkx - 2.8 * Math.max(v.C, 0.72), -171.8, 5.4 * Math.max(v.C, 0.72), 8.2, `fill="none" stroke="${ink}" stroke-width=".8"`);
  const px = v.X(-21.5, v.three ? 9 : 0);
  const pouch = cr([[px - 8.5, -158, 1], [px + 8.5, -159, 1], [px + 9.5, -142], [px + 4, -134], [px - 5, -135.5], [px - 9.5, -146]], true, 4);
  P.part(pouch, { tone: (x, y) => clamp(0.5 + 0.3 * sstep(px + 8, px - 8, x) * 0.6 - 0.15 * sstep(-160, -135, y) * 0.5), layers: [{ angle: 60, gap: 1.7, w: 1.2, lo: 0.06, step: 2 }], halo: 1.8, outline: 1, seed: 134, wash: [WASH.wood2, 0.5] });
  P.line([[px - 8.5, -151], [px + 9, -151.5]], 0.8); P.dot(px, -150, 1.4, ink, 0);
}

function sleeve(P, pts, widths, seed) {
  const t = limb(pts, widths, 7, true);
  const base = tt(t, { gain: 0.78 });
  const e = pts[2];
  P.part(t.outline, { tone: (x, y) => clamp(base(x, y) * 0.95 + 0.16 * gauss(Math.hypot(x - e[0], y - e[1]), 0, 8) + 0.14 * (vnoise(x * 0.2, y * 0.2, seed) - 0.5)), layers: [{ angle: 78, gap: 1.9, w: 1.4, lo: 0.08, step: 2 }, { angle: 24, gap: 2.4, w: 1.2, lo: 0.55, step: 2 }], seed, wash: [WASH.coat, 0.6] });
  P.line(cr([[e[0] - 5, e[1] - 2], [e[0], e[1] + 1], [e[0] + 5, e[1] - 2]], false, 4), 0.5, 0.7);
  P.line(cr([[e[0] - 4, e[1] + 5], [e[0], e[1] + 7], [e[0] + 4, e[1] + 5]], false, 4), 0.4, 0.55);
  return t;
}
function cuff(P, w, ang, wd, seed) {
  const a = ang * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const q = [[w[0] - nx * wd / 2 - ux * 4, w[1] - ny * wd / 2 - uy * 4], [w[0] + nx * wd / 2 - ux * 4, w[1] + ny * wd / 2 - uy * 4], [w[0] + nx * wd / 2 + ux * 3.5, w[1] + ny * wd / 2 + uy * 3.5], [w[0] - nx * wd / 2 + ux * 3.5, w[1] - ny * wd / 2 + uy * 3.5]];
  P.part(cr(q.map(p => [p[0], p[1], 1]), true, 3), { tone: (x, y) => clamp(0.2 + 0.4 * sstep(w[0] + 6, w[0] - 6, x)), layers: [{ angle: ang + 8, gap: 1.7, w: 0.9, lo: 0.1, step: 1.6 }], halo: 1.2, outline: 0.9, seed, wash: [WASH.wood, 0.45] });
}

// head base: hair, ears, neck, collar, face with the nose; the expressions come on top
const HCX = { front: 0, 'three-quarter': 1.2 };
function head(P, v) {
  const { three, C, S } = v, cx = HCX[v.view];
  const hairTone = (x, y) => clamp(0.66 - 0.2 * sstep(-14, 18, x) + 0.15 * gauss(y, -262, 5));
  const hl = { layers: [{ angle: 76, gap: 1.2, w: 1.1, lo: 0.1, step: 1.5, wob: 0.2 }, { angle: 18, gap: 1.6, w: 0.9, lo: 0.5, step: 1.5 }], halo: 1.4, outline: 0.8, wash: [WASH.wood2, 0.5], tone: hairTone };
  const earTone = { layers: [{ angle: 50, gap: 1.4, w: 0.8, lo: 0.1, step: 1.5 }], halo: 1.2, outline: 0.9, fill: CARD, wash: [WASH.skin, 0.5] };
  if (!three) {
    P.part(cr([[-15.5, -297, 1], [-18.6, -287], [-19.6, -274], [-18, -264], [-14.4, -259, 1], [-13.2, -268], [-14.4, -278], [-14.6, -290]], true, 4), { ...hl, seed: 141 });
    P.part(cr([[15.5, -297, 1], [18.2, -287], [19, -275], [17.5, -266], [14, -261, 1], [12.8, -269], [14.2, -278], [14.4, -290]], true, 4), { ...hl, seed: 142 });
    P.part(cr([[-14, -284, 1], [-19, -289], [-25, -298], [-29.5, -307, 1], [-25.5, -294], [-23, -282], [-19, -272.5], [-14, -268, 1]], true, 4), { ...earTone, tone: x => clamp(0.2 + 0.4 * sstep(-14, -26, x)), seed: 143 });
    P.part(cr([[14, -284, 1], [19, -289], [24, -296], [27.5, -304, 1], [24.5, -292], [22.5, -281.5], [19, -272.5], [14, -268, 1]], true, 4), { ...earTone, tone: () => 0.16, seed: 144 });
    P.line(cr([[-17, -281], [-21, -286], [-23.5, -293]], false, 4), 0.45, 0.8); P.line(cr([[16.5, -281], [20, -286], [22.4, -291]], false, 4), 0.4, 0.7);
  } else {
    // far ear: only the tip shows past the cheek
    P.part(cr([[12, -288, 1], [19, -292], [25, -299], [28.4, -306, 1], [25.6, -293], [23, -283], [17, -276], [12, -274, 1]], true, 4), { ...earTone, tone: () => 0.3, seed: 144 });
    P.part(cr([[-15, -297, 1], [-19.6, -288], [-21.6, -275], [-20, -265], [-15, -258.6, 1], [-11.6, -262], [-13.4, -273], [-13.6, -285]], true, 4), { ...hl, seed: 141 });
  }
  const neckC = three ? 2.2 : 0;
  const neck = limb([[neckC, -262], [neckC * 0.8, -252], [neckC * 0.6 + 0.5, -243]], [15, 14.5, 18], 5);
  P.part(neck.outline, { tone: (x, y) => clamp(0.12 + 0.45 * sstep(-262, -246, y) * (1 - 0.4 * sstep(-6, 8, x)) + 0.25 * sstep(-6 + neckC, -8 + neckC, x)), layers: [{ angle: 84, gap: 1.6, w: 0.95, lo: 0.08, step: 1.8 }, { angle: 20, gap: 2, w: 0.85, lo: 0.4, step: 1.8 }], halo: 0, outline: 0.9, fill: CARD, seed: 145, wash: [WASH.skin, 0.5] });
  // shirt collar and tunic neckline, centred on the chest's front line
  const vx = frontX(v, -232), nx0 = neckC * 0.6;
  const shirt = cr([[nx0 - 9, -249, 1], [nx0 + 9, -249, 1], [vx + 5, -238], [vx, -229], [vx - 5, -238]], true, 3);
  P.part(shirt, { tone: (x, y) => clamp(0.18 + 0.25 * sstep(-246, -230, y) + 0.2 * sstep(vx, vx - 9, x)), layers: [{ angle: 84, gap: 1.8, w: 0.8, lo: 0.1, step: 1.8 }], halo: 0, outline: 0.8, fill: CARD, seed: 146, wash: [WASH.skin, 0.12] });
  const colL = cr([[nx0 - 12.5, -252, 1], [nx0 - 3, -248.5], [vx - 5, -232], [vx - 8.5, -233, 1], [nx0 - 15, -241]], true, 4);
  const colR = cr([[nx0 + 12.5, -252, 1], [nx0 + 3, -248.5], [vx + 5, -232], [vx + 8.5, -233, 1], [nx0 + 15, -241]], true, 4);
  P.part(colL, { tone: x => clamp(0.55 + 0.25 * sstep(vx - 5, vx - 15, x)), layers: [{ angle: 70, gap: 1.7, w: 1.2, lo: 0.08, step: 1.8 }, { angle: 20, gap: 2.2, w: 1, lo: 0.6, step: 1.8 }], halo: 0, outline: 0.9, seed: 147, wash: [WASH.coat, 0.6] });
  P.part(colR, { tone: () => 0.3, layers: [{ angle: 60, gap: 1.8, w: 1.1, lo: 0.08, step: 1.8 }], halo: 0, outline: 0.9, seed: 148, wash: [WASH.coat, 0.55] });
  // face: ellipsoid cross sections; the lower face sits forward of the skull, so it slides toward the turn
  const aTab = [[-294, 14.0], [-284, 14.4], [-276, 14.0], [-268.5, 12.6], [-262, 9.6], [-258, 5], [-256.8, 0.6]];
  const fwd = y => lerpTable(y, [[-294, 0], [-284, 0], [-276, 1.5], [-268, 3.5], [-262, 5], [-258, 6.5], [-256.8, 7]]);
  const yl = [-294, -284, -276, -268.5, -262, -258, -256.8];
  const A = y => { const a = lerpTable(y, aTab), b = Math.max(a * 1.06, 5.2); return Math.hypot(a * C, b * S); };
  const Lft = yl.map(y => [cx - A(y) + fwd(y) * S * 0.7, y]), Rgt = yl.map(y => [cx + A(y) + fwd(y) * S * (three ? 1.0 : 0), y]).reverse();
  const faceTop = [[cx + 7, -297], [cx, -297.5], [cx - 7, -297]];
  const face = cr([[Lft[0][0], -294, 1], ...Lft.slice(1), ...Rgt.slice(0, -1), [Rgt[Rgt.length - 1][0], -294, 1], ...faceTop], true, 5);
  const faceTone = (x, y) => {
    const u = x - cx;
    let t = 0.04 + 0.4 * sstep(2, -14, u) * 0.9;
    t += 0.3 * gauss(u, -9 * C - 1, 4.2) * gauss(y, -271, 8);
    t += 0.3 * gauss(y, -283.5, 1.8) * sstep(-13, -8, u);
    t += 0.26 * gauss(y, -258.6, 2.6) * sstep(-10, -4, u);
    if (three) t += 0.22 * gauss(u, 14, 3.4) * gauss(y, -272, 10);
    return clamp(t);
  };
  P.part(face, { tone: faceTone, layers: [{ angle: 66, gap: 1.35, w: 0.8, lo: 0.1, step: 1.4, wob: 0.15 }, { angle: 8, gap: 1.6, w: 0.7, lo: 0.34, step: 1.4, wob: 0.12 }], halo: 1.6, outline: 0.95, fill: CARD, seed: 149, wash: [WASH.skin, 0.4] });
  if (three) P.part(cr([[-14.4, -284, 1], [-19.6, -289], [-25.6, -297.6], [-30.4, -307, 1], [-26.4, -294], [-23.8, -282], [-19.6, -272.6], [-14.4, -268, 1]].map(([x, y, c]) => [x + 3.6, y, c]), true, 4), { ...earTone, tone: x => clamp(0.2 + 0.4 * sstep(-10, -24, x)), seed: 143 });
  if (three) P.line(cr([[-14, -281], [-17.6, -285.5], [-20.4, -292]], false, 4), 0.45, 0.8);
  // nose on the surface of the head: (u across, y, z toward the viewer before the turn)
  const N = (u, y, z) => [cx + u * C + z * S, y];
  const nl = (pts, w, o = 1) => P.line(cr(pts.map(q => N(...q)), false, 4), w, o);
  nl([[-2.8, -281, 14.4], [-3.2, -273.5, 16], [-3.6, -270, 15.4]], 0.5, 0.8);
  nl([[-4.6, -268.6, 14.2], [-3, -266.6, 17], [-1, -266.2, 18.4], [1.2, -266.6, 17.4], [3.4, -268.4, 14.4]], 0.7, 0.95);
  nl([[-4.6, -268.6, 14.2], [-5.4, -270, 13.4], [-4.3, -271.3, 14]], 0.5, 0.85);
  if (!three) nl([[3.4, -268.4, 14.4], [4.8, -270, 13.6], [3.8, -271.5, 14]], 0.45, 0.75);
  nl([[0.5, -279, 15], [1.2, -272, 17.2], [2, -269, 16.4]], 0.35, three ? 0.8 : 0.55);
  if (three) nl([[2.4, -281, 14.6], [1.8, -273, 17.4], [0.8, -267.8, 18.6]], 0.55, 0.9);
  const n1 = N(-1.4, -266.4, 17.6), n2 = N(1.6, -266.5, 17.2);
  P.ring(n1[0], -266.4, 1.1 * Math.max(C, 0.6), 0.5, ink, 0.75);
  if (!three) P.ring(n2[0], -266.5, 1, 0.45, ink, 0.6);
  nl([[-12, -262, 8], [-8, -258.3, 10], [-3, -257, 11]], 0.45, 0.6);
}

function cap(P, v) {
  const { three, S } = v, cx = HCX[v.view], dx = three ? 2.6 : 0;
  const sh = (pts) => pts.map(([x, y, c]) => [x + dx, y, c]);
  const body = cr(sh([
    [-17.8, -290, 1], [-20.5, -301], [-19, -315], [-12, -326], [-1, -332], [11, -331.5], [24, -326], [36, -316], [46, -302], [53, -286],
    [55, -272], [51.5, -263.5, 1], [47.5, -268], [46, -279], [42.5, -291], [35, -301], [26, -307], [19, -306], [16.5, -291, 1], [8, -294], [0, -295], [-8, -294],
  ]), true, 5);
  const tone = (x, y) => {
    x -= dx;
    let t = 0.46 + 0.4 * sstep(8, -20, x) - 0.5 * sstep(-5, 25, x) * sstep(-332, -300, y);
    t += 0.3 * gauss(x, 30, 3.4) * gauss(y, -307, 12);
    t += 0.26 * gauss(x, 47, 3) * gauss(y, -279, 10);
    t += 0.28 * gauss(y, -294, 2.4);
    t -= 0.2 * gauss(x, 6, 7) * gauss(y, -323, 5);
    t += (vnoise(x * 0.18, y * 0.18, 7) - 0.5) * 0.14;
    return clamp(t);
  };
  P.part(body, { tone, layers: [{ angle: 38, gap: 1.9, w: 1.45, lo: 0.08, step: 2, wob: 0.3 }, { angle: -38, gap: 2.4, w: 1.2, lo: 0.52, step: 2 }], halo: 2.2, outline: 1.1, seed: 151, wash: [WASH.cap, 0.74] });
  for (const c of [[[12, -324], [26, -318], [38, -304]], [[-9, -324], [-16, -315], [-18, -304]], [[36, -296], [43, -288], [47, -278]], [[30, -313], [38, -308]]]) P.line(cr(sh(c), false, 5), 0.6, 0.8);
  // folded cuff wraps the head; its front is highest when seen from below
  const R = 18.6, upper = [], lower = [];
  for (let i = 0; i <= 12; i++) { const phi = -Math.PI / 2 - v.yaw + (Math.PI * i) / 12 + (three ? 0.06 : 0); const psi = phi + v.yaw; const x = cx + R * Math.sin(psi), yt = -293 - 5.5 * Math.cos(psi); upper.push([x, yt, i === 0 || i === 12 ? 1 : 0]); lower.push([x - (i === 0 ? 0 : 0), yt + 8.2 - 0.4 * Math.abs(Math.sin(psi))]); }
  const cuffPts = cr([...upper, ...lower.reverse()], true, 4);
  P.part(cuffPts, { tone: (x, y) => clamp(0.22 + 0.34 * sstep(8, -18, x - cx) + 0.3 * gauss(y, -290, 1.6) + 0.1 * (vnoise(x * 0.4, y * 0.4, 3) - 0.5)), layers: [{ angle: 84, gap: 1.5, w: 1.1, lo: 0.1, step: 1.6 }, { angle: 20, gap: 2.2, w: 0.8, lo: 0.55, step: 1.6 }], halo: 1.4, outline: 1, seed: 153, wash: [WASH.cap, 0.55] });
  P.line(cr(upper.map(([x, y]) => [x, y + 3.6]), false, 5), 0.5, 0.7);
}

export function teoBody(view = 'front', pose = 'stand') {
  const v = ctx(view), sk = SK, { X, three } = v;
  const T = upT(pose);
  const P = new Plate(11);
  P.raw(`<ellipse cx="${three ? 9 : 3}" cy="${pose === 'sit' ? 56 : 1.5}" rx="${three ? 46 : 50}" ry="4" fill="${ink}" fill-opacity=".5"/>`);
  const Q = posed(P, T);
  // the pose transform moves the shoulder girdle (and the forearm anchor mid-point) with the torso
  const shL = T(X(sk.shL[0]), sk.shL[1]), shR = T(X(sk.shR[0]), sk.shR[1]);
  const elL = T(X(sk.elL[0], 5), sk.elL[1]), elR = T(X(sk.elR[0], -4), sk.elR[1]);
  const wrL = T(X(sk.wrL[0], 8), sk.wrL[1]), wrR = T(X(sk.wrR[0], 2), sk.wrR[1]);
  const mid = (a, b, k, dx = 0) => [mix(a[0], b[0], k) + dx, mix(a[1], b[1], k)];
  // far arm (screen right) behind the torso: elbow out, forearm back to the pocket
  sleeve(P, [shR, mid(shR, elR, 0.5, 1), elR, three ? [wrR[0] + 3, T(0, -172)[1]] : [37, T(0, -173)[1]], wrR], [18, 18, 15.5, 14, 12.5], 161);
  if (pose === 'sit') legsSit(P, v); else legs(Q, v);
  tunic(Q, v, T);
  if (pose === 'sheet') sheetInBelt(P);
  if (!three) {
    cuff(P, wrR, 150, 14, 164);
    hand(P, { x: wrR[0] - 5, y: wrR[1] + 1, ang: 142, size: 0.9, curl: 0.2, thumb: 0.2, side: 1, seed: 180, tone: () => 0.22 });
  }
  // near arm (screen left) hangs relaxed
  sleeve(P, [shL, mid(shL, elL, 0.5, -0.5), elL, mid(elL, wrL, 0.5, 0.5), wrL], [19, 18.5, 16, 14.5, 12.5], 162);
  cuff(P, wrL, 92, 14.5, 163);
  hand(P, { x: wrL[0] + 0.5, y: wrL[1] + 2, ang: three ? 94 : 92, size: 1.0, curl: three ? 0.36 : 0.3, thumb: three ? 0.3 : 0.4, side: -1, seed: 170, tone: (x, y) => clamp(0.18 + 0.3 * sstep(wrL[0] + 4, wrL[0] - 8, x) + 0.1 * (vnoise(x, y, 3) - 0.5)) });
  head(Q, v);
  cap(Q, v);
  return { frame: (POSE_GEO[pose] ?? { frame: FRAME }).frame, plate: P, svg: (scale = 1, o = {}) => P.svg((POSE_GEO[pose] ?? { frame: FRAME }).frame, { scale, ...o }) };
}

// the folded calendar strip tucked into the belt, front right of the buckle
function sheetInBelt(P) {
  P.part(cr([[6.5, -163.5, 1], [24.5, -162.8, 1], [25.5, -149], [22, -146.8], [5.5, -147.8]], true, 4), { tone: (x) => clamp(0.6 - 0.3 * sstep(8, 25, x)), layers: [{ angle: 3, gap: 2.4, w: 0.8, lo: 0.12, step: 1.8 }], halo: 1.3, outline: 0.85, fill: CARD, seed: 156, wash: null });
  P.line([[8.5, -158.5], [23.5, -157.8]], 0.4, 0.6); P.line([[9, -155], [23.5, -154.2]], 0.35, 0.5); P.line([[9.5, -151.5], [23, -150.8]], 0.35, 0.45);
}
