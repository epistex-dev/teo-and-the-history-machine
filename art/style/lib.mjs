// Engraving engine: procedural burin lines whose width follows a tone field.
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const f1 = n => { const r = Math.round(n * 10) / 10; return Object.is(r, -0) ? '0' : String(r); };

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(ix, iy, s) { let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function vnoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y, s = 0) => 0.55 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.15 * vnoise(x * 4.3, y * 4.3, s + 13);

// Smooth curve through points; a point [x,y,1] is a sharp corner.
export function cr(pts, closed = false, n = 6) {
  const N = pts.length, out = [];
  const get = i => closed ? pts[((i % N) + N) % N] : pts[Math.max(0, Math.min(N - 1, i))];
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const p1 = get(i), p2 = get(i + 1);
    const p0 = p1[2] ? p1 : get(i - 1), p3 = p2[2] ? p2 : get(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const c = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([c(0), c(1)]);
    }
  }
  if (!closed) out.push([pts[N - 1][0], pts[N - 1][1]]);
  return out;
}
export const D = (pts, closed = true) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (closed ? 'Z' : '');
export const bbox = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1]; };
export function inPoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
export function distPoly(pts, x, y) {
  let best = 1e9;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L);
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
  }
  return best;
}
// soft mask: 1 inside, falls to 0 over `soft` px outside (negative soft -> fades inside)
export function soft(pts, s = 6) {
  const bb = bbox(pts);
  return (x, y) => {
    if (x < bb[0] - s - 1 || x > bb[2] + s + 1 || y < bb[1] - s - 1 || y > bb[3] + s + 1) return 0;
    const ins = inPoly(pts, x, y);
    const d = distPoly(pts, x, y);
    return ins ? clamp(0.5 + d / (2 * Math.abs(s))) : clamp(0.5 - d / (2 * Math.abs(s)));
  };
}
export const inside = pts => { const bb = bbox(pts); return (x, y) => x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && inPoly(pts, x, y); };
export const ellipse = (cx, cy, rx, ry, n = 40, rot = 0, a0 = 0, a1 = Math.PI * 2) => {
  const o = [], c = Math.cos(rot), s = Math.sin(rot);
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const m = full ? n : n + 1;
  for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / n, x = rx * Math.cos(a), y = ry * Math.sin(a); o.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return o;
};

// ---- line families ----
export function family(angleDeg, gap, bb, jit = 0, seed = 1) {
  const a = angleDeg * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], nrm = [-u[1], u[0]];
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, R = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 2;
  const r = rng(seed), out = [];
  for (let s = -R; s <= R; s += gap) {
    const so = s + (jit ? (r() - 0.5) * jit * gap : 0);
    const p = [cx + so * nrm[0], cy + so * nrm[1]];
    const seg = clipLine([p[0] - R * u[0], p[1] - R * u[1]], [p[0] + R * u[0], p[1] + R * u[1]], bb);
    if (seg) out.push(seg);
  }
  return out;
}
function clipLine(a, b, bb) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - bb[0]], [dx, bb[2] - a[0]], [-dy, a[1] - bb[1]], [dy, bb[3] - a[1]]]) {
    if (p === 0) { if (q < 0) return null; } else { const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
  }
  return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
}
// fan of lines through a vanishing point, from y=ya to y=yb at given x positions on the y=yref line
export const fanLines = (vp, xs, yref, ya, yb) => xs.map(x => { const k = (ya - vp[1]) / (yref - vp[1]), k2 = (yb - vp[1]) / (yref - vp[1]); return [[vp[0] + (x - vp[0]) * k, ya], [vp[0] + (x - vp[0]) * k2, yb]]; });

// ---- engraving ----
// lines: array of polylines. tone(x,y) in 0..1. Returns path data for filled swelling lines.
export function engrave(lines, o) {
  const { tone, inside: ins = null, w = 1.4, lo = 0.05, hi = 0.9, gamma = 0.9, step = 2.2, wob = 0.3, seed = 1, minw = 0.22, wmod = 0.18 } = o;
  const r = rng(seed); let d = [];
  let li = 0;
  for (const ln of lines) {
    li++;
    // resample
    const pts = [];
    let acc = 0;
    for (let i = 0; i < ln.length - 1; i++) {
      const a = ln[i], b = ln[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) { const t = k / n; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, acc + L * t]); }
      acc += L;
    }
    const last = ln[ln.length - 1]; pts.push([last[0], last[1], acc]);
    const ph = r() * 40, ph2 = r() * 90;
    // normals + widths
    const P = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const nx = -dy, ny = dx;
      const wv = (vnoise(p[0] * 0.045 + 3, p[1] * 0.045, seed) - 0.5) * 2 * wob + Math.sin(p[2] * 0.05 + ph) * wob * 0.35;
      const x = p[0] + nx * wv, y = p[1] + ny * wv;
      let T = 0;
      if (!ins || ins(p[0], p[1])) T = tone(p[0], p[1]);
      let ww = T <= lo ? 0 : w * Math.pow(clamp((T - lo) / (hi - lo)), gamma);
      ww *= 1 - wmod + wmod * 2 * vnoise(p[2] * 0.22 + ph2, li * 3.1, seed + 5);
      return [x, y, nx, ny, ww];
    });
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        const A = [], B = [];
        for (const q of run) { A.push(f1(q[0] + q[2] * q[4] / 2) + ' ' + f1(q[1] + q[3] * q[4] / 2)); B.push(f1(q[0] - q[2] * q[4] / 2) + ' ' + f1(q[1] - q[3] * q[4] / 2)); }
        d.push('M' + A.join('L') + 'L' + B.reverse().join('L') + 'Z');
      } else if (run.length === 1) {
        const q = run[0]; if (q[4] > 0.6) d.push('M' + f1(q[0]) + ' ' + f1(q[1]) + 'm-' + f1(q[4] / 2) + ' 0a' + f1(q[4] / 2) + ' ' + f1(q[4] / 2) + ' 0 1 0 ' + f1(q[4]) + ' 0a' + f1(q[4] / 2) + ' ' + f1(q[4] / 2) + ' 0 1 0 -' + f1(q[4]) + ' 0Z');
      }
      run = [];
    };
    for (const q of P) { if (q[4] >= minw) run.push(q); else flush(); }
    flush();
  }
  return d.join('');
}

// Convenience: multi-layer cross-hatch over a region.
// layers: [{angle,gap,lo,hi,w,...}]
export function hatchRegion(bb, tone, ins, layers, seed = 1) {
  let d = '';
  layers.forEach((L, i) => {
    const lines = L.lines || family(L.angle, L.gap, bb, L.jit ?? 0.25, seed + i * 17);
    d += engrave(lines, { tone: L.tfn ? ((x, y) => L.tfn(tone(x, y), x, y)) : tone, inside: ins, w: L.w ?? 1.3, lo: L.lo ?? 0.05, hi: L.hi ?? 0.95, gamma: L.gamma ?? 0.9, step: L.step ?? 2.2, wob: L.wob ?? 0.3, seed: seed + i * 31, minw: L.minw ?? 0.24 });
  });
  return d;
}

// Contour stroke helper: returns svg path element
export const stroke = (pts, closed = false, w = 1, col = '#1b1712', extra = '') => `<path d="${D(pts, closed)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
export const fillp = (pts, col, extra = '') => `<path d="${D(pts, true)}" fill="${col}" ${extra}/>`;
export const ink = '#1b1712';
export const paper = '#ece2c8';
