// Plate: collects engraved parts in z-order. Each part is a paper-filled silhouette with hatching, a contour and its own hand-tint wash,
// so a later part hides the wash of an earlier one. Figures are baked as alpha sprites, so every wash is drawn inside an isolated group.
import { clamp, mix, sstep, f1, cr, D, bbox, inside, family, engrave, hatchRegion, stroke, fillp, ink, paper, vnoise } from './lib.mjs';

export const P = d => `<path d="${d}" fill="${ink}"/>`;
export const gauss = (v, c, w) => Math.exp(-Math.pow((v - c) / w, 2));
export const TINT = { dx: 1.1, dy: 0.8 };
export const WASH = { wood: '#b9803f', wood2: '#a7692f', brass: '#e4b04a', coat: '#4f7a4b', cap: '#b8362b', skin: '#e59a78', sky: '#4f6f98', sky2: '#9db6cf', flame: '#f08a2c', glow: '#ffd25a', glow2: '#f4b447' };

// tube polygon around a centreline with a width profile (widths are spread evenly along the line)
export function limb(center, widths, n = 8, round = false) {
  const c = cr(center, false, n), m = c.length, L = [], R = [];
  const wAt = t => { const s = t * (widths.length - 1), i = Math.min(widths.length - 2, Math.floor(s)); return mix(widths[i], widths[i + 1], s - i); };
  for (let i = 0; i < m; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(m - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = wAt(i / (m - 1)) / 2;
    L.push([c[i][0] - dy * w, c[i][1] + dx * w]); R.push([c[i][0] + dy * w, c[i][1] - dx * w]);
  }
  let outline = [...L, ...R.reverse()];
  if (round) {
    const f0 = Math.atan2(c[1][1] - c[0][1], c[1][0] - c[0][0]), f1 = Math.atan2(c[m - 1][1] - c[m - 2][1], c[m - 1][0] - c[m - 2][0]);
    const w0 = wAt(0) / 2, w1 = wAt(1) / 2, endArc = [], startArc = [];
    for (let k = 1; k < 6; k++) {
      const e = f1 + Math.PI / 2 - (Math.PI * k) / 6, s = f0 - Math.PI / 2 - (Math.PI * k) / 6;
      endArc.push([c[m - 1][0] + Math.cos(e) * w1, c[m - 1][1] + Math.sin(e) * w1]);
      startArc.push([c[0][0] + Math.cos(s) * w0, c[0][1] + Math.sin(s) * w0]);
    }
    outline = [...L, ...endArc, ...R.reverse(), ...startArc];
  }
  return { outline, center: c, widths, wAt };
}

// cylinder shading across a tube: light is a unit-ish vector (lx, ly) in the picture plane plus lz toward the viewer
export function tubeTone(tube, o = {}) {
  const { lx = 0.62, ly = -0.45, lz = 0.64, amb = 0.12, gain = 0.82, bias = 0, rim = 0 } = o;
  const c = tube.center, m = c.length;
  return (x, y) => {
    let best = 1e9, bi = 0;
    for (let i = 0; i < m; i++) { const d = (c[i][0] - x) ** 2 + (c[i][1] - y) ** 2; if (d < best) { best = d; bi = i; } }
    const a = c[Math.max(0, bi - 1)], b = c[Math.min(m - 1, bi + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const half = Math.max(0.5, tube.wAt(bi / (m - 1)) / 2);
    const s = clamp(((x - c[bi][0]) * -dy + (y - c[bi][1]) * dx) / half, -1, 1);
    const nz = Math.sqrt(1 - s * s), nx = -dy * s, ny = dx * s;
    const I = Math.max(0, nx * lx + ny * ly + nz * lz);
    return clamp(1 - amb - gain * I + bias + rim * s * s * s * s);
  };
}

// ellipsoid shading for blobs: (cx,cy) centre, rx/ry radii, light from the upper left
export function blobTone(cx, cy, rx, ry, o = {}) {
  const { lx = -0.62, ly = -0.5, lz = 0.6, amb = 0.1, gain = 0.85, bias = 0 } = o;
  return (x, y) => {
    const nx = clamp((x - cx) / rx, -1, 1), ny = clamp((y - cy) / ry, -1, 1), nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return clamp(1 - amb - gain * Math.max(0, nx * lx + ny * ly + nz * lz) + bias);
  };
}

export class Plate {
  constructor(seed = 1) { this.z = []; this.seed = seed; this.n = 0; }
  nextSeed() { this.n += 1; return this.seed * 101 + this.n * 7; }
  raw(s) { this.z.push(s); }
  // primitive stamps with numeric coordinates, so a point-transform wrapper can move them (posed Tèo bodies)
  dot(x, y, r, fill = ink, sw = 0.7) { this.z.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${fill}"${sw ? ` stroke="${ink}" stroke-width="${f1(sw)}"` : ''}/>`); }
  ring(x, y, rx, ry, fill = ink, op = 1) { this.z.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}" fill-opacity="${op}"/>`); }
  box(x, y, w, h, attrs) { this.z.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" ${attrs}/>`); }
  // pts: silhouette polygon; tone(x,y) in 0..1; layers: hatch families (see hatchRegion)
  part(pts, o = {}) {
    const { tone = () => 0.3, layers = [{ angle: 80, gap: 1.9, w: 1.3, lo: 0.08, step: 2 }], fill = paper, halo = 2.2, outline = 1.1, wash = null, washPts = null, seed = this.nextSeed(), hatchOver = null } = o;
    if (pts.length < 3) return pts;
    const g = [];
    if (halo) g.push(stroke(pts, true, halo, paper));
    if (fill) g.push(fillp(pts, fill));
    const ib = inside(pts), bb = bbox(pts);
    g.push(P(hatchRegion(bb, tone, ib, layers, seed)));
    if (hatchOver) g.push(hatchOver);
    if (outline) g.push(stroke(pts, true, outline));
    if (wash) g.push(this.tint(washPts || pts, wash[0], wash[1]));
    this.z.push(g.join(''));
    return pts;
  }
  tint(pts, col, op) { return `<path d="${D(pts)}" fill="${col}" fill-opacity="${op}" filter="url(#rag)" transform="translate(${TINT.dx} ${TINT.dy})" style="mix-blend-mode:multiply"/>`; }
  line(pts, w = 0.9, op = 1, col = ink) { this.z.push(stroke(pts, false, w, col, op < 1 ? `stroke-opacity="${op}"` : '')); }
  hatch(pts, o) { // free hatch inside a polygon with no fill
    const { tone, layers, seed = this.nextSeed() } = o;
    this.z.push(P(hatchRegion(bbox(pts), tone, inside(pts), layers, seed)));
  }
  group(attr, fn) { const n = this.z.length; fn(); const inner = this.z.splice(n); this.z.push(`<g ${attr}>${inner.join('')}</g>`); }
  svg(view, o = {}) {
    const [x, y, w, h] = view;
    const { bg = null, scale = 1, filterDefs = true } = o;
    const defs = '<defs><filter id="rag" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${f1(w * scale)}" height="${f1(h * scale)}" viewBox="${x} ${y} ${w} ${h}">${defs}${bg ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>` : ''}<g style="isolation:isolate">${this.z.join('')}</g></svg>`;
  }
}


// five-finger hand. The wrist is at (x, y) and the hand points along ang (deg; 0 = +x, 90 = down); side -1 mirrors it.
// curl bends every finger joint toward the thumb side (in-plane), splay opens the fingers, thumb is the angle of the thumb away from the index.
export function hand(plate, o) {
  const { x, y, ang = 90, size = 1, curl = 0.3, splay = 0.12, thumb = 0.45, side = 1, fill = '#f5eed8', tone = () => 0.2, seed = 1, wash = [WASH.skin, 0.5], fingersOnly = false } = o;
  const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const T = (u, v) => [x + (u * c - v * side * s) * size, y + (u * s + v * side * c) * size];
  const mk = (pts, w, n = 5) => limb(pts, w.map(k => k * size), n, true);
  const part = (poly, i, hatch = 1.4) => plate.part(poly, { tone, layers: [{ angle: ang + 6, gap: hatch, w: 0.7, lo: 0.1, step: 1.4, wob: 0.08 }], fill, halo: 0, outline: 0.7, seed: seed + i, wash });
  const palm = cr([T(0, -5.4), T(4, -7.8), T(9, -8.4), T(14, -7.8), T(17.4, -5), T(17.8, 0), T(17.4, 5), T(15, 7.4), T(9, 7), T(4, 6.6), T(0, 5.6)], true, 5);
  part(palm, 1);
  const chains = [
    { base: [16.4, -5.4], len: [5.8, 4, 3.2], w: [3.9, 3.7, 3.3, 2.6], k: 1.0 },
    { base: [16.8, -1.9], len: [6.4, 4.4, 3.4], w: [3.9, 3.7, 3.3, 2.6], k: 1.08 },
    { base: [16.6, 1.6], len: [5.9, 4.1, 3.2], w: [3.7, 3.5, 3.1, 2.4], k: 1.15 },
    { base: [16.0, 4.8], len: [4.6, 3.3, 2.8], w: [3.3, 3.1, 2.8, 2.2], k: 1.25 },
  ];
  const fin = chains.map((f, i) => {
    let ang0 = (-0.1 + (i - 1.1) * splay * 0.6) * 1; // spread from the middle of the hand
    const pts = [T(f.base[0], f.base[1])];
    let [u, v] = f.base;
    for (let k = 0; k < 3; k++) { ang0 += curl * f.k * (0.5 + 0.3 * k) * 0.55; u += Math.cos(ang0) * f.len[k]; v += Math.sin(ang0) * f.len[k]; pts.push(T(u, v)); }
    return mk(pts, f.w);
  });
  // thumb: starts at the thenar, points away from the index
  const sp = 0.6 + thumb * 0.8;
  const tp = [[4.5, -5.6], [8.4, -7.2 - sp * 1.6], [13, -7.9 - sp * 3.0 + curl * 1.2], [17.2, -8.2 - sp * 4.2 + curl * 2.8]].map(p => T(p[0], p[1]));
  const th = mk(tp, [5.2, 4.4, 3.8, 2.9]);
  [3, 2, 1, 0].forEach(i => part(fin[i].outline, 10 + i));
  part(th.outline, 20);
  // knuckles and joint creases
  for (let i = 0; i < 4; i++) {
    const ct = fin[i].center, p = ct[Math.floor(ct.length / 3)], q = ct[Math.floor((2 * ct.length) / 3)];
    for (const m of [p, q]) plate.line([[m[0] - 1.1 * size, m[1] - 0.2], [m[0] + 1.1 * size, m[1] + 0.2]], 0.3, 0.55);
  }
}
