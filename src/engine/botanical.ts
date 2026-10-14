import { BotanicalElement, Letter, WeaveSegment, Butterfly, PerchPoint, PaletteColors } from '../types';
import { rng, bez, at } from './math';

export interface WordParameters {
  roseP: number;
  leafy: number;
  dens: number;
  lean: number;
  big: number;
  curvy: number;
  bridgeP: number;
  w: number;
}

export function wordParams(ws: number, density = 1): WordParameters {
  const r = rng(ws * 7 + 13);
  return {
    roseP: 0.3 + r() * 0.3,
    leafy: (0.6 + r() * 0.8) * density,
    dens: density,
    lean: (r() - 0.5) * 0.6,
    big: 0.85 + r() * 0.45,
    curvy: 0.8 + r() * 0.6,
    bridgeP: Math.min(0.95, (0.45 + r() * 0.35) * density),
    w: 0.5
  };
}

export function vine(
  base: [number, number],
  dir: number,
  len: number,
  amp: number,
  waves: number,
  ph: number,
  bend: number,
  n = 40
): [number, number][] {
  const P: [number, number][] = [[base[0], base[1]]];
  const step = len / n;
  let x = base[0];
  let y = base[1];
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a =
      dir +
      bend * u +
      amp * Math.sin(u * Math.PI * waves + ph) * Math.min(1, u * 3);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    P.push([x, y]);
  }
  return P;
}

export function curl(
  P: [number, number][],
  sign: number,
  rad: number
): [number, number][] {
  const n = P.length;
  const e = P[n - 1];
  const a = Math.atan2(e[1] - P[n - 2][1], e[0] - P[n - 2][0]);
  const c: [number, number] = [
    e[0] - Math.sin(a) * sign * rad,
    e[1] + Math.cos(a) * sign * rad
  ];
  const a0 = Math.atan2(e[1] - c[1], e[0] - c[0]);
  for (let i = 1; i <= 14; i++) {
    const u = i / 14;
    const t = a0 + sign * u * Math.PI * 1.6;
    const rr = rad * (1 - 0.5 * u);
    P.push([c[0] + Math.cos(t) * rr, c[1] + Math.sin(t) * rr]);
  }
  return P;
}

export function weave(r: () => number, startLayer: number): WeaveSegment[] {
  const cuts: number[] = [];
  const nc = 1 + Math.floor(r() * 3);
  for (let i = 0; i < nc; i++) cuts.push(0.15 + r() * 0.7);
  cuts.sort((a, b) => a - b);
  const segs: WeaveSegment[] = [];
  let u0 = 0;
  let layer = startLayer;
  for (const c of cuts) {
    if (c <= u0) continue;
    segs.push({ u0, u1: c, layer });
    if (r() < 0.3) {
      const g = 0.02 + r() * 0.03;
      u0 = Math.min(0.98, c + g);
    } else {
      u0 = c;
    }
    layer = 1 - layer;
  }
  segs.push({ u0, u1: 1, layer });
  return segs;
}

export function layerAt(segs: WeaveSegment[], u: number): number {
  for (const s of segs) {
    if (u >= s.u0 && u <= s.u1) return s.layer;
  }
  return segs[segs.length - 1].layer;
}

export interface GrowOptions {
  base?: [number, number];
  dir?: number;
  len?: number;
  d0: number;
  tip?: 'rose' | 'fan' | 'leaf' | 'curl' | null;
  pts?: [number, number][];
  depth?: number;
  layer0?: number;
}

export function grow(
  r: () => number,
  E: BotanicalElement[],
  nid: () => number,
  p: WordParameters,
  o: GrowOptions
): [number, number][] {
  const tip =
    o.tip ||
    (r() < p.roseP
      ? 'rose'
      : r() < 0.45
      ? 'fan'
      : r() < 0.6
      ? 'leaf'
      : 'curl');

  let P =
    o.pts ||
    vine(
      o.base || [0, 0],
      o.dir ?? -Math.PI / 2,
      o.len ?? 0.8,
      (0.35 + r() * 0.45) * p.curvy,
      1 + r() * 1.6,
      r() * 6.28,
      (r() - 0.5) * 1.2,
      40
    );

  if (tip === 'curl') {
    P = curl(P, r() < 0.5 ? -1 : 1, 0.05 + r() * 0.05);
  }

  const segs = weave(r, o.layer0 != null ? o.layer0 : r() < 0.5 ? 0 : 1);
  const dur = Math.max(320, (o.len || 0.8) * 620);
  const thorns: { u: number; s: number }[] = [];
  const nt = Math.floor(r() * 2.5);
  for (let i = 0; i < nt; i++) {
    thorns.push({ u: 0.15 + r() * 0.65, s: r() < 0.5 ? -1 : 1 });
  }

  E.push({
    t: 'stem',
    id: nid(),
    pts: P,
    segs,
    d0: o.d0,
    dur,
    w: o.depth ? 0.82 : 1,
    thorns
  });

  const nl = Math.floor(r() * 2.8 * p.leafy);
  let sd = r() < 0.5 ? -1 : 1;
  for (let i = 0; i < nl; i++) {
    const u = 0.25 + r() * 0.6;
    const [q, a] = at(P, u);
    sd = -sd;
    E.push({
      t: 'leaf',
      id: nid(),
      x: q[0],
      y: q[1],
      a: a + sd * (0.55 + r() * 0.5),
      L: (0.14 + r() * 0.2) * (o.depth ? 0.8 : 1),
      bend: (r() - 0.5) * 1.2,
      layer: layerAt(segs, u),
      d0: o.d0 + dur * u
    });
  }

  const [tp, ta] = at(P, 1);
  const td = o.d0 + dur * 0.8;
  const tl = layerAt(segs, 1);

  if (tip === 'rose') {
    const R = (0.13 + r() * 0.15) * p.big * (o.depth ? 0.75 : 1);
    const over =
      tp[1] > -0.78 && tp[1] < 0.05 && Math.abs(tp[0]) < p.w * 0.5;
    const layer = over ? (r() < 0.22 ? 1 : 0) : r() < 0.6 ? 1 : tl;
    E.push({
      t: 'rose',
      id: nid(),
      x: tp[0],
      y: tp[1],
      R,
      rot: (r() - 0.5) * 1.0,
      ph1: r() * 6.28,
      ph2: r() * 6.28,
      turns: 1.8 + r() * 1,
      layer,
      d0: td
    });
    if (r() < 0.2) {
      const oo = ta + (r() < 0.5 ? 1 : -1) * 1.3;
      E.push({
        t: 'rose',
        id: nid(),
        x: tp[0] + Math.cos(oo) * R * 1.4,
        y: tp[1] + Math.sin(oo) * R * 1.4,
        R: R * (0.6 + r() * 0.3),
        rot: (r() - 0.5) * 1.2,
        ph1: r() * 6.28,
        ph2: r() * 6.28,
        turns: 1.8 + r(),
        layer,
        d0: td + 120
      });
    }
  } else if (tip === 'fan') {
    const spread = 0.6 + r() * 0.3;
    for (let j = 0; j < 2; j++) {
      E.push({
        t: 'leaf',
        id: nid(),
        x: tp[0],
        y: tp[1],
        a: ta + (j - 0.5) * spread,
        L: 0.2 + r() * 0.2,
        bend: (j - 0.5) * 0.8,
        layer: tl,
        d0: td + j * 60
      });
    }
  } else if (tip === 'leaf') {
    E.push({
      t: 'leaf',
      id: nid(),
      x: tp[0],
      y: tp[1],
      a: ta + (r() - 0.5) * 0.3,
      L: 0.16 + r() * 0.16,
      bend: r() - 0.5,
      layer: tl,
      d0: td
    });
  }

  if (!o.depth && r() < 0.3) {
    const u = 0.35 + r() * 0.35;
    const [q, a] = at(P, u);
    grow(r, E, nid, p, {
      base: q,
      dir: a + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.4),
      len: (o.len || 0.8) * (0.35 + r() * 0.2),
      d0: o.d0 + dur * u,
      depth: 1,
      layer0: layerAt(segs, u)
    });
  }

  return P;
}

export function genLetterBotanicals(
  l: Letter,
  measureWidth: (ch: string) => number,
  density = 1,
  randomFloat = Math.random
): void {
  const r = rng(
    (l.ws ^ Math.imul(l.wi + 1, 2654435761)) + Math.floor(randomFloat() * 1e6)
  );
  const p = wordParams(l.ws, density);
  const E: BotanicalElement[] = [];
  let k0 = 0;
  const nid = () => l.id * 100 + k0++;
  const w = measureWidth(l.ch);
  const inX = () => (r() - 0.5) * w * 0.7;
  p.w = w;

  const nUp = 1 + (r() < 0.45 * p.dens ? 1 : 0);
  for (let i = 0; i < nUp; i++) {
    grow(r, E, nid, p, {
      base: [inX(), -r() * 0.3],
      dir: -Math.PI / 2 + p.lean * 0.5 + (r() - 0.5) * 0.7,
      len: 0.6 + r() * 0.5,
      d0: 40 + i * 130,
      tip: l.wi === 0 && i === 0 ? 'rose' : null
    });
  }

  if (r() < 0.4 * p.dens) {
    grow(r, E, nid, p, {
      base: [inX(), -0.1 - r() * 0.35],
      dir: Math.PI / 2 + (r() - 0.5) * 0.8,
      len: 0.35 + r() * 0.35,
      d0: 160
    });
  }

  if (l.prev && r() < p.bridgeP) {
    const px = -(measureWidth(l.prev.ch) + w) / 2;
    const a: [number, number] = [inX(), -0.05 - r() * 0.55];
    const b: [number, number] = [px + (r() - 0.5) * 0.25, -0.05 - r() * 0.55];
    const bulge = (r() < 0.55 ? -1 : 1) * (0.4 + r() * 0.4);
    const dx = b[0] - a[0];
    let P = bez(
      a,
      [a[0] + dx * 0.15, a[1] + bulge],
      [b[0] - dx * 0.15, b[1] + bulge * 0.9],
      b,
      40
    );
    if (r() < 0.45) {
      P = P.slice(0, Math.floor(P.length * (0.7 + r() * 0.2)));
    }
    grow(r, E, nid, p, {
      pts: P,
      len: Math.abs(dx) + Math.abs(bulge),
      d0: 90,
      tip: r() < 0.5 ? 'curl' : r() < 0.5 ? 'leaf' : 'rose'
    });
  }

  if (l.wi === 0) {
    grow(r, E, nid, p, {
      base: [-w * 0.3, -0.15 - r() * 0.4],
      dir: Math.PI + (r() - 0.5) * 1.2,
      len: 0.45 + r() * 0.3,
      d0: 120,
      tip: 'curl'
    });
  }

  l.els = E;
  l.endEls = null;

  const T: BotanicalElement[] = [];
  const tr = rng(l.id * 977 + Math.floor(randomFloat() * 1e6));
  grow(
    tr,
    T,
    () => l.id * 100 + 90 + T.length,
    p,
    {
      base: [w * 0.25, -0.1 - tr() * 0.45],
      dir: (tr() - 0.5) * 1.4,
      len: 0.45 + tr() * 0.25,
      d0: 0,
      tip: 'curl',
      depth: 1
    }
  );
  l.tend = T.filter((e) => e.t === 'stem').slice(0, 1);
}

export function genEndBotanicals(
  l: Letter,
  rel: number,
  measureWidth: (ch: string) => number,
  density = 1,
  randomFloat = Math.random
): void {
  const r = rng(
    l.ws + l.wi * 31 + Math.floor(randomFloat() * 1e6)
  );
  const p = wordParams(l.ws, density);
  const E: BotanicalElement[] = [];
  let k0 = 50;
  const nid = () => l.id * 100 + k0++;
  const w = measureWidth(l.ch);
  const n = 1 + Math.floor(r() * 2.5);
  p.w = w;

  for (let i = 0; i < n; i++) {
    const dir =
      -Math.PI / 2 + 0.6 + (i - (n - 1) / 2) * 0.9 + (r() - 0.5) * 0.4;
    grow(r, E, nid, p, {
      base: [(r() - 0.2) * w * 0.6, -r() * 0.5],
      dir,
      len: 0.4 + r() * 0.45,
      d0: rel + 40 + i * 90,
      depth: 1,
      tip: i === 0 || r() < 0.5 ? 'rose' : 'fan'
    });
  }
  l.endEls = E;
}

export function drawButterfly(
  B: {
    fill(pts: [number, number][], col: string): void;
    stroke(pts: [number, number][], col: string, w: number): void;
  },
  x: number,
  y: number,
  s: number,
  ang: number,
  o: number,
  C: PaletteColors['C']
): void {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const T = (px: number, py: number): [number, number] => [
    x + (px * ca - py * sa) * s,
    y + (px * sa + py * ca) * s
  ];

  const wing = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    a: number,
    side: number
  ): [number, number][] => {
    const pts: [number, number][] = [];
    const c = Math.cos(a);
    const sn = Math.sin(a);
    for (let k = 0; k < 22; k++) {
      const th = (k / 22) * Math.PI * 2;
      const r = 1 + 0.08 * Math.sin(th * 3);
      const lx = Math.cos(th) * rx * r;
      const ly = Math.sin(th) * ry * r;
      pts.push(
        T(
          side * (cx + lx * c - ly * sn) * (0.12 + 0.88 * o),
          cy + lx * sn + ly * c
        )
      );
    }
    return pts;
  };

  for (const sd of [-1, 1]) {
    B.fill(wing(0.46, 0.28, 0.36, 0.3, 0.5 * sd * sd, sd), C.text);
    B.fill(wing(0.55, -0.32, 0.55, 0.36, -0.55, sd), C.text);
    if (o > 0.35) {
      B.fill(wing(0.66, -0.4, 0.13, 0.11, 0, sd), C.red);
    }
  }

  const body: [number, number][] = [];
  for (let k = 0; k < 18; k++) {
    const th = (k / 18) * Math.PI * 2;
    body.push(T(Math.cos(th) * 0.08, Math.sin(th) * 0.48));
  }
  B.fill(body, C.blue);

  const lw = Math.max(0.8, s * 0.05);
  B.stroke([T(0, -0.42), T(-0.14, -0.72), T(-0.24, -0.86)], C.blue, lw);
  B.stroke([T(0, -0.42), T(0.14, -0.72), T(0.24, -0.86)], C.blue, lw);
}

export function stepAndDrawFlies(
  B: {
    fill(pts: [number, number][], col: string): void;
    stroke(pts: [number, number][], col: string, w: number): void;
  },
  flies: Butterfly[],
  perch: PerchPoint[],
  now: number,
  C: PaletteColors['C'],
  W: number,
  H: number,
  dt: number
): Butterfly[] {
  const byId: Record<number, PerchPoint> = {};
  for (const p of perch) byId[p.id] = p;

  return flies.filter((f) => {
    const t = (now - f.t0) / 1000;
    let tx = f.hx;
    let ty = f.hy;

    if (f.st === 'sit' || f.st === 'fly') {
      const p = f.pid != null ? byId[f.pid] : null;
      if (!p) {
        f.st = 'leave';
        f.pid = null;
        f.ex = f.x < W / 2 ? -80 : W + 80;
        f.ey = f.y - H * 0.3;
      } else {
        tx = p.x + p.R * 0.05;
        ty = p.y - p.R * 0.55;
      }
    }

    if (f.st === 'wander') {
      tx = f.hx + Math.sin(t * 1.3 + f.seed) * 70;
      ty = f.hy + Math.sin(t * 2.1 + f.seed) * 40;
      if (t > 3.5) {
        f.st = 'leave';
        f.pid = null;
        f.ex = f.x < W / 2 ? -80 : W + 80;
        f.ey = f.y - H * 0.3;
      }
    }

    if (f.st === 'leave') {
      tx = f.ex ?? (f.x < W / 2 ? -80 : W + 80);
      ty = f.ey ?? (f.y - H * 0.3);
    }

    if (f.st === 'sit') {
      f.x += (tx - f.x) * 0.35;
      f.y += (ty - f.y) * 0.35;
      f.ang *= 0.85;
      f.ph += dt * 0.004;
      const burst = Math.sin((now / 1000) * 0.9 + f.seed) > 0.75;
      f.open = burst
        ? 0.2 + 0.8 * Math.abs(Math.cos((now / 1000) * 9 + f.seed))
        : 0.25 + 0.15 * Math.sin(f.ph);
    } else {
      const dx = tx - f.x;
      const dy = ty - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = f.st === 'leave' ? 0.42 : Math.min(0.34, 0.06 + d * 0.0016);
      const flut = Math.sin(t * 7 + f.seed) * 0.12;
      const wob = Math.cos(t * 4.3 + f.seed) * 0.1;
      const ax = (dx / d) * sp + wob - f.vx;
      const ay = (dy / d) * sp + flut - f.vy;

      f.vx += (ax * 0.06 * dt) / 16;
      f.vy += (ay * 0.06 * dt) / 16;
      f.x += f.vx * dt;
      f.y += f.vy * dt + Math.sin(t * 13 + f.seed) * 0.6;
      f.ang += (Math.max(-0.5, Math.min(0.5, f.vx * 1.4)) - f.ang) * 0.1;
      f.open = Math.abs(Math.cos(t * 17 + f.seed));

      if (f.st === 'fly' && d < 5) {
        f.st = 'sit';
        f.ph = 0;
      }
      if (
        f.st === 'leave' &&
        (f.x < -60 || f.x > W + 60 || f.y < -60)
      ) {
        return false;
      }
    }

    drawButterfly(B, f.x, f.y, f.sz, f.ang, f.open || 0, C);
    return true;
  });
}
