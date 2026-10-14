import { BotanicalElement, Letter, PaletteColors, PerchPoint, SpriteRecord } from '../types';
import { at, buildSmoothPath, eo, jit, spr } from './math';
import { FONT_FAMILY } from '../constants';

export interface RenderBackend {
  fill(p: [number, number][], col: string): void;
  stroke(p: [number, number][], col: string, w: number): void;
  rect(x: number, y: number, w: number, h: number, col: string): void;
  text(ch: string, x: number, y: number, S: number, col: string): void;
  sprite(
    slot: 'flower' | 'leaf' | 'stalk',
    cx: number,
    cy: number,
    w: number,
    h: number,
    rot: number,
    ax?: number,
    ay?: number
  ): boolean;
}

export function createCanvasBackend(
  g: CanvasRenderingContext2D,
  sprites: SpriteRecord
): RenderBackend {
  return {
    fill: (p, col) => {
      g.beginPath();
      buildSmoothPath(g, p, true);
      g.fillStyle = col;
      g.fill();
    },
    stroke: (p, col, w) => {
      g.beginPath();
      buildSmoothPath(g, p, false);
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke();
    },
    rect: (x, y, w, h, col) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
    },
    text: (ch, x, y, S, col) => {
      g.font = `700 ${S}px ${FONT_FAMILY}`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillStyle = col;
      g.fillText(ch, x, y);
    },
    sprite: (slot, cx, cy, w, h, rot, ax = 0.5, ay = 0.5) => {
      const sp = sprites[slot];
      if (!sp || !sp.img) return false;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.drawImage(sp.img, -w * ax, -h * ay, w, h);
      g.restore();
      return true;
    }
  };
}

export interface SvgBackendResult {
  backend: RenderBackend;
  getElements(): string;
}

export function createSvgBackend(sprites: SpriteRecord): SvgBackendResult {
  const parts: string[] = [];
  const n = (v: number) => Math.round(v * 100) / 100;

  const pb = () => ({
    d: '',
    moveTo(x: number, y: number) {
      this.d += `M${n(x)} ${n(y)}`;
    },
    lineTo(x: number, y: number) {
      this.d += `L${n(x)} ${n(y)}`;
    },
    quadraticCurveTo(a: number, b: number, x: number, y: number) {
      this.d += `Q${n(a)} ${n(b)} ${n(x)} ${n(y)}`;
    },
    closePath() {
      this.d += 'Z';
    }
  });

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const backend: RenderBackend = {
    fill: (p, col) => {
      const b = pb();
      buildSmoothPath(b, p, true);
      parts.push(`<path d="${b.d}" fill="${col}"/>`);
    },
    stroke: (p, col, w) => {
      const b = pb();
      buildSmoothPath(b, p, false);
      parts.push(
        `<path d="${b.d}" fill="none" stroke="${col}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    },
    rect: (x, y, w, h, col) => {
      parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${col}"/>`);
    },
    text: (ch, x, y, S, col) => {
      parts.push(
        `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="700" font-size="${n(S)}" fill="${col}">${esc(ch)}</text>`
      );
    },
    sprite: (slot, cx, cy, w, h, rot, ax = 0.5, ay = 0.5) => {
      const sp = sprites[slot];
      if (!sp || !sp.cleanUrl) return false;
      const deg = n((rot * 180) / Math.PI);
      parts.push(
        `<image href="${sp.cleanUrl}" x="${n(-w * ax)}" y="${n(-h * ay)}" width="${n(w)}" height="${n(h)}" transform="translate(${n(cx)} ${n(cy)}) rotate(${deg})"/>`
      );
      return true;
    }
  };

  return {
    backend,
    getElements: () => parts.join('')
  };
}

export function strokeRange(
  B: RenderBackend,
  P: [number, number][],
  a: number,
  b: number,
  col: string,
  w: number,
  sprites: SpriteRecord
): void {
  const n = P.length - 1;
  const ia = a * n;
  const ib = b * n;

  const lerp = (t: number): [number, number] => {
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    return [
      P[i][0] + (P[i + 1][0] - P[i][0]) * f,
      P[i][1] + (P[i + 1][1] - P[i][1]) * f
    ];
  };

  const pts: [number, number][] = [lerp(ia)];
  for (let i = Math.floor(ia) + 1; i < ib; i++) {
    pts.push(P[i]);
  }
  pts.push(lerp(ib));
  if (pts.length < 2) return;

  const sp = sprites.stalk;
  if (sp && (sp.img || sp.cleanUrl)) {
    const sc = sp.scale || 1;
    const thick = Math.max(4, w * 3.6 * sc);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const segLen = Math.hypot(dx, dy);
      if (segLen < 0.5) continue;
      const ang = Math.atan2(dy, dx);
      B.sprite(
        'stalk',
        (p0[0] + p1[0]) / 2,
        (p0[1] + p1[1]) / 2,
        segLen * 1.28,
        thick,
        ang,
        0.5,
        0.5
      );
    }
    return;
  }

  B.stroke(pts, col, w);
}

export function drawStem(
  B: RenderBackend,
  P: [number, number][],
  a: number,
  b: number,
  col: string,
  w: number,
  sprites: SpriteRecord
): void {
  strokeRange(B, P, a, b, col, w, sprites);
}

export function drawThorn(
  B: RenderBackend,
  P: [number, number][],
  u: number,
  s: number,
  S: number,
  col: string,
  sprites: SpriteRecord
): void {
  if (sprites.stalk && (sprites.stalk.img || sprites.stalk.cleanUrl)) return;
  const [p, a] = at(P, u);
  const d = a + s * 2.3;
  const L = S * 0.045;
  B.stroke([p, [p[0] + Math.cos(d) * L, p[1] + Math.sin(d) * L]], col, S * 0.022);
}

export function drawLeaf(
  B: RenderBackend,
  bx: number,
  by: number,
  a: number,
  L: number,
  bend: number,
  C: PaletteColors['C'],
  sprites: SpriteRecord
): void {
  if (L < 0.5) return;
  const sp = sprites.leaf;
  if (sp && (sp.img || sp.cleanUrl)) {
    const sc = sp.scale || 1;
    const aspect = sp.img ? sp.img.width / sp.img.height : 1;
    const len = L * 1.15 * sc;
    const wid = len / Math.max(0.4, Math.min(2.5, aspect));
    B.sprite('leaf', bx, by, len, wid, a, 0.05, 0.5);
    return;
  }

  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const px = -sa;
  const py = ca;
  const ax = (u: number): [number, number] => {
    const b = Math.sin(Math.PI * u) * bend * 0.15 * L;
    return [bx + ca * u * L + px * b, by + sa * u * L + py * b];
  };

  const hw = (u: number) => L * 0.18 * Math.sin(Math.PI * Math.pow(u, 0.8));
  const N = 12;
  const s1: [number, number][] = [];
  const s2: [number, number][] = [];

  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const c = ax(u);
    const w = hw(u);
    s1.push([c[0] + px * w, c[1] + py * w]);
    s2.push([c[0] - px * w, c[1] - py * w]);
  }

  const tip = ax(1);
  const base = ax(0);
  B.fill([base, ...s1.slice(1, N), tip, tip, ...s2.slice(1, N).reverse(), base], C.blue);

  if (L > 6) {
    const v: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      v.push(ax(0.08 + (0.72 * i) / 8));
    }
    B.stroke(v, C.vein, Math.max(0.8, L * 0.03));
  }
}

export function drawRose(
  B: RenderBackend,
  cx: number,
  cy: number,
  R: number,
  rot: number,
  e: { ph1?: number; ph2?: number; turns?: number },
  a: number,
  tl: [number, number] | null,
  C: PaletteColors['C'],
  sprites: SpriteRecord
): void {
  const sp = sprites.flower;
  if (sp && (sp.img || sp.cleanUrl)) {
    const bloom = spr(a / 900, 8, 14);
    if (bloom <= 0.001) return;
    const sc = (sp.scale || 1) * bloom;
    const aspect = sp.img ? sp.img.width / sp.img.height : 1;
    const d = R * 2.35 * sc;
    const w = aspect >= 1 ? d : d * aspect;
    const h = aspect >= 1 ? d / aspect : d;
    const tx = tl ? tl[0] * R * 0.18 : 0;
    const ty = tl ? tl[1] * R * 0.18 : 0;
    B.sprite('flower', cx + tx, cy + ty, w, h, rot, 0.5, 0.5);
    return;
  }

  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const tm = tl ? Math.hypot(tl[0], tl[1]) : 0;
  const ux = tm ? tl![0] / tm : 0;
  const uy = tm ? tl![1] / tm : 0;
  const sq = -0.28 * tm;

  const T = (x: number, y: number, z = 0): [number, number] => {
    let dx = x * cr - y * sr;
    let dy = x * sr + y * cr;
    if (tm) {
      const k = (dx * ux + dy * uy) * sq;
      dx += k * ux + tl![0] * R * z;
      dy += k * uy + tl![1] * R * z;
    }
    return [cx + dx, cy + dy];
  };

  const P = [
    [0, -0.36, 0.56, 0.54, 0, 0, 0],
    [-0.5, -0.06, 0.6, 0.6, -0.35, 0, 0],
    [0.52, -0.06, 0.6, 0.6, 0.35, 0, 0],
    [-0.42, 0.3, 0.62, 0.48, 0.2, 0.12, 1],
    [0.47, 0.3, 0.62, 0.48, -0.2, 0.12, 1],
    [0.05, 0.42, 0.56, 0.38, 0, 0.14, 0]
  ];

  const ax0 = 0;
  const ay0 = 0.5;
  const lw = Math.max(0.8, R * 0.045);
  const st = 85;

  const ph1 = e.ph1 ?? 0;
  const ph2 = e.ph2 ?? 0;
  const turns = e.turns ?? 1.8;

  P.forEach((q, i) => {
    const s = spr((a - i * st) / 1000, 8, 14);
    if (s <= 0.001) return;
    const open = (1 - Math.min(1, s)) * (q[0] < 0 ? 0.5 : -0.5);
    const ang = q[4] + open;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);

    const pt = (th: number): [number, number] => {
      const rr = 1 + 0.08 * Math.sin(3 * th + ph1 + i) + 0.04 * Math.sin(5 * th + ph2);
      const lx = Math.cos(th) * q[2] * rr;
      const ly = Math.sin(th) * q[3] * rr;
      const px = q[0] + lx * ca - ly * sa;
      const py = q[1] + lx * sa + ly * ca;
      return T((ax0 + (px - ax0) * s) * R, (ay0 + (py - ay0) * s) * R, q[5]);
    };

    const pts: [number, number][] = [];
    for (let k = 0; k < 26; k++) {
      pts.push(pt((k / 26) * Math.PI * 2));
    }
    B.fill(pts, C.red);

    if (q[6] && R >= 12 && s > 0.4) {
      const arc: [number, number][] = [];
      for (let k = 0; k <= 14; k++) {
        arc.push(pt(Math.PI * (1.18 + (0.64 * k) / 14)));
      }
      strokeRange(B, arc, 0, Math.min(1, (s - 0.4) / 0.5), C.line, lw * 0.8, sprites);
    }
  });

  const fr = eo((a - P.length * st - 80) / 520);
  if (fr > 0 && R > 3) {
    const spPts: [number, number][] = [];
    const sclPts: [number, number][] = [];
    const effTurns = R < 20 ? Math.min(turns, 1.3) : R < 32 ? turns * 0.8 : turns;
    for (let i = 0; i <= 70; i++) {
      const u = i / 70;
      const th = ph1 + u * effTurns * Math.PI * 2;
      const rr = R * (0.08 + 0.57 * u);
      spPts.push(
        T(
          Math.cos(th) * rr * 1.05,
          Math.sin(th) * rr * 0.72 - 0.12 * R,
          0.34 - 0.24 * u
        )
      );
    }
    strokeRange(B, spPts, 0, fr, C.line, lw, sprites);

    if (R >= 14) {
      for (let i = 0; i <= 36; i++) {
        const u = i / 36;
        sclPts.push(
          T(
            (-0.72 + 1.5 * u) * R,
            0.36 * R + 0.16 * R * Math.abs(Math.sin(u * Math.PI * 3)),
            0.18
          )
        );
      }
      strokeRange(B, sclPts, 0, fr, C.line, lw, sprites);
    }
  }
}

export interface BotanicalSceneOptions {
  letters: Letter[];
  S: number;
  C: PaletteColors['C'];
  boil?: boolean;
  recoil?: number;
  speed?: number;
  wither?: number;
  textAll?: boolean;
}

export function renderBotanicalScene(
  B: RenderBackend,
  now: number,
  st: BotanicalSceneOptions,
  sprites: SpriteRecord,
  perch: PerchPoint[]
): void {
  const S = st.S;
  const L = st.letters;
  const act = L.filter((l) => !l.dead);
  const sp = st.speed || 1;
  const f = st.boil ? Math.floor(now / 120) : 0;
  const amp = st.boil ? Math.max(0.8, S * 0.01) : 0;

  const kd = (l: Letter) =>
    l.dead ? 1 - eo((now - l.dead) / (st.wither || 260)) : 1;

  const wpt = (l: Letter, x: number, y: number): [number, number] => {
    if (l.birth != null) {
      const t = ((now - l.birth) * sp) / 1000;
      if (t > 0 && t < 2.5) {
        const hh = Math.max(0, (l.y! - y) / S);
        const dmp = Math.exp(-t * 3.2);
        const dir = l.id % 2 ? 1 : -1;
        x += S * 0.07 * hh * dmp * Math.sin(t * 11) * dir;
        y += S * 0.035 * hh * dmp * Math.sin(t * 11 + 1.2);
      }
    }
    if (l.lean) {
      const hh = Math.min(2.5, Math.max(0, (l.y! - y) / S));
      const fv = hh * hh * 0.5 + hh * 0.5;
      x += l.lean[0] * S * 0.1 * fv;
      y += l.lean[1] * S * 0.05 * fv;
    }
    return [x, y];
  };

  const drawStemWrapper = (e: BotanicalElement, l: Letter, age: number, kk: number, layer: number, frO?: number) => {
    const fr = frO != null ? frO : eo((age - e.d0) / (e.dur || 600)) * kk;
    if (fr <= 0 || !e.pts || !e.segs) return;
    const j = jit(e.id, f, amp);
    const P: [number, number][] = e.pts.map((p) =>
      wpt(l, l.x! + p[0] * S + j[0], l.y! + p[1] * S + j[1])
    );
    for (const sg of e.segs) {
      if (sg.layer !== layer) continue;
      const b = Math.min(sg.u1, fr);
      if (b <= sg.u0) continue;
      drawStem(B, P, sg.u0, b, st.C.blue, S * 0.022 * (e.w || 1), sprites);
    }
    if (e.thorns) {
      for (const th of e.thorns) {
        if (fr > th.u) {
          const segLayer = e.segs.find((s) => th.u >= s.u0 && th.u <= s.u1)?.layer ?? 0;
          if (segLayer === layer) {
            drawThorn(B, P, th.u, th.s, S, st.C.blue, sprites);
          }
        }
      }
    }
  };

  const drawElWrapper = (e: BotanicalElement, l: Letter, age: number, kk: number) => {
    const j = jit(e.id, f, amp);
    const p = wpt(l, l.x! + (e.x || 0) * S + j[0], l.y! + (e.y || 0) * S + j[1]);

    if (e.t === 'leaf') {
      const sc = spr((age - e.d0) / 1000, 7, 15) * kk;
      if (sc <= 0) return;
      drawLeaf(B, p[0], p[1], (e.a || 0) + j[2], (e.L || 0.15) * S * sc, e.bend || 0, st.C, sprites);
    } else if (e.t === 'rose') {
      const a = age - e.d0;
      if (a < 0 || kk <= 0.001) return;
      if (!l.dead && a > 700) {
        perch.push({ id: e.id, x: p[0], y: p[1], R: (e.R || 0.15) * S * kk });
      }
      drawRose(
        B,
        p[0],
        p[1],
        (e.R || 0.15) * S * kk,
        (e.rot || 0) + j[2],
        e,
        a,
        null,
        st.C,
        sprites
      );
    }
  };

  const drawLayer = (layer: number) => {
    for (const l of L) {
      if (l.ch === ' ' || !l.els) continue;
      const age = (now - (l.birth || 0)) * sp;
      const kk = kd(l);
      const each = (e: BotanicalElement) => {
        if (e.t === 'stem') drawStemWrapper(e, l, age, kk, layer);
        else if (e.layer === layer) drawElWrapper(e, l, age, kk);
      };
      l.els.forEach(each);
      if (l.endEls) l.endEls.forEach(each);

      const i = act.indexOf(l);
      const nx = i >= 0 ? act[i + 1] : null;
      if (l.tend && (l.dead || !nx || nx.ch === ' ')) {
        let fr = eo(((now - (l.tb || 0)) * sp - 150) / 450);
        if (l.cut != null) {
          fr *= 1 - eo(((now - l.cut) * sp) / 150) * Math.min(0.85, (st.recoil || 20) / (0.6 * S));
        }
        for (const e of l.tend) {
          drawStemWrapper(e, l, age, kk, layer, fr * kk);
        }
      }
    }
  };

  drawLayer(0);
  for (const l of L) {
    if (l.ch !== ' ' && (st.textAll || !l.dead)) {
      B.text(l.ch, l.x!, l.y!, S, st.C.text);
    }
  }
  drawLayer(1);
}
