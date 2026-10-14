import { Letter, PaletteColors, PosterEngineData, SpriteRecord, TextureConfig, BotanicalElement, PerchPoint } from '../types';
import { PRESETS } from '../constants';
import { rng, eo, jit, spr } from './math';
import { genLetterBotanicals, genEndBotanicals, drawButterfly } from './botanical';
import { createSvgBackend, drawStem, drawLeaf, drawRose, RenderBackend } from './renderer';
import { TextureCompositor } from './textures';

export function layoutCore(
  A: Letter[],
  W: number,
  H: number,
  prevWrapped: boolean,
  measureWidth: (ch: string) => number
): { S: number; wrapped: boolean; n: number } {
  const maxW = W * 0.8;
  const S0 = Math.min(W, H) * 0.28;
  const LH = 2.1;
  const ws = A.map((l) => measureWidth(l.ch));
  const words: { sp?: boolean; idx: number[] }[] = [];
  let cur: { idx: number[] } | null = null;

  A.forEach((l, i) => {
    if (l.ch === ' ') {
      if (cur) {
        words.push(cur);
        cur = null;
      }
      words.push({ sp: true, idx: [i] });
    } else {
      if (!cur) cur = { idx: [] };
      cur.idx.push(i);
    }
  });
  if (cur) words.push(cur);

  const lineW = (li: number[], S: number) => {
    let e = li.length;
    while (e > 0 && A[li[e - 1]].ch === ' ') e--;
    let w = 0;
    for (let k = 0; k < e; k++) w += ws[li[k]];
    return w * S;
  };

  const wrap = (S: number) => {
    const lines: number[][] = [[]];
    let lw = 0;
    for (const w of words) {
      const ww = w.idx.reduce((s, i) => s + ws[i], 0) * S;
      if (!w.sp && lw > 0 && lw + ww > maxW) {
        lines.push([]);
        lw = 0;
      }
      lines[lines.length - 1].push(...w.idx);
      lw += ww;
    }
    return lines;
  };

  let lines = [A.map((_, i) => i)];
  const unit = lineW(lines[0], 1);
  let S = unit > 0 ? Math.min(S0, maxW / unit) : S0;
  const multi = words.filter((w) => !w.sp).length > 1;
  const portraitBias = H > W * 1.15 ? 0.14 : 0.1;
  let wrapped =
    multi &&
    (S < H * portraitBias || (prevWrapped && S < H * (portraitBias + 0.04)));

  if (wrapped) {
    let lo = Math.min(W, H) * 0.03;
    let hi = Math.min(W, H) * 0.22;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2;
      const ls = wrap(mid);
      const ok =
        ls.every((li) => lineW(li, mid) <= maxW) &&
        ls.length * LH * mid <= H * 0.82;
      if (ok) lo = mid;
      else hi = mid;
    }
    S = lo;
    lines = wrap(S);
    if (lines.length < 2) wrapped = false;
  }

  const n = lines.length;
  const lh = LH * S;
  lines.forEach((li, k) => {
    let x = W / 2 - lineW(li, S) / 2;
    const y = H / 2 + (k - (n - 1) / 2) * lh + 0.33 * S;
    li.forEach((i) => {
      const l = A[i];
      const w = ws[i] * S;
      l.tx = x + w / 2;
      l.ty = y;
      l.tw = w;
      l.line = k;
      x += w;
    });
  });

  return { S, wrapped, n };
}

export function buildPoster(
  text: string,
  seed: number,
  presetId: string,
  pw: number,
  ph: number,
  loopDur: number,
  measureWidth: (ch: string) => number
): PosterEngineData {
  const pr = PRESETS.find((p) => p.id === presetId) || PRESETS[0];
  const cleanText = (text || '').slice(0, 48) || ' ';
  const PW = pw || 1080;
  const PH = ph || 1080;

  const randFn = rng(seed * 7919 + 1);
  const L: Letter[] = [];
  let prev: Letter | null = null;
  let uid = 1;

  for (const ch of cleanText) {
    if (ch === ' ') {
      const sp: Letter = { ch: ' ', id: 9000 + uid++, els: [], ws: 0, wi: 0, prev: null };
      L.push(sp);
      prev = sp;
      continue;
    }
    const same = Boolean(prev && prev.ch !== ' ');
    const l: Letter = {
      ch,
      id: 9000 + uid++,
      ws: same && prev ? prev.ws : Math.floor(randFn() * 1e9),
      wi: same && prev ? prev.wi + 1 : 0,
      prev: same ? prev : null
    };
    genLetterBotanicals(l, measureWidth, 1, randFn);
    L.push(l);
    prev = l;
  }

  const n = L.length;
  const step =
    pr.id === 'grow'
      ? Math.min(110, 3000 / n)
      : pr.id === 'typed'
      ? Math.min(85, 3600 / n)
      : 0;
  const off = pr.id === 'grow' ? 200 : pr.id === 'typed' ? 300 : 0;
  L.forEach((l, i) => {
    l.b = off + i * step;
  });

  if (pr.id === 'scatter') {
    const r = rng(seed * 31 + 5);
    L.forEach((l) => {
      l.b = 150 + r() * 2400;
    });
  }

  const wd = Math.min(60, 900 / n);
  L.forEach((l, i) => {
    l.d = pr.id === 'scatter' ? 4700 + i * 8 : 4200 + (n - 1 - i) * wd;
    const nx = L[i + 1];
    l.cutRel = null;
    if (pr.id !== 'scatter' && l.ch !== ' ' && nx && nx.ch === ' ') {
      l.cutRel = Math.max(30, nx.b! - l.b!);
      genEndBotanicals(l, l.cutRel, measureWidth, 1, randFn);
    }
  });

  const res = layoutCore(L, PW, PH, false, measureWidth);
  const S = res.S;
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;

  const addP = (l: Letter, x: number, y: number, r = 0) => {
    const X = l.tx! + x * S;
    const Y = l.ty! + y * S;
    const R = r * S;
    x0 = Math.min(x0, X - R);
    x1 = Math.max(x1, X + R);
    y0 = Math.min(y0, Y - R);
    y1 = Math.max(y1, Y + R);
  };

  for (const l of L) {
    if (l.ch === ' ') continue;
    addP(l, -l.tw! / S / 2, -0.75);
    addP(l, l.tw! / S / 2, 0.1);
    const all = [...(l.els || []), ...(l.endEls || [])];
    for (const e of all) {
      if (e.t === 'stem' && e.pts) e.pts.forEach((q) => addP(l, q[0], q[1], 0.02));
      else if (e.t === 'leaf') addP(l, e.x!, e.y!, e.L!);
      else if (e.t === 'rose') addP(l, e.x!, e.y!, e.R! * 1.15);
    }
  }

  let tx0 = 1e9;
  let tx1 = -1e9;
  let ty0 = 1e9;
  let ty1 = -1e9;
  for (const l of L) {
    if (l.ch !== ' ') {
      tx0 = Math.min(tx0, l.tx! - l.tw! / 2);
      tx1 = Math.max(tx1, l.tx! + l.tw! / 2);
      ty0 = Math.min(ty0, l.ty! - 0.72 * S);
      ty1 = Math.max(ty1, l.ty!);
    }
  }

  const halfW = PW * 0.44;
  const halfH = PH * 0.44;
  const bcx = (tx0 + tx1) / 2;
  const bcy = (ty0 + ty1) / 2;
  const k = Math.min(
    1.25,
    halfW / Math.max(1, bcx - x0, x1 - bcx),
    halfH / Math.max(1, bcy - y0, y1 - bcy)
  );

  L.forEach((l) => {
    l.tx = PW / 2 + (l.tx! - bcx) * k;
    l.ty = PH / 2 + (l.ty! - bcy) * k;
    l.tw = (l.tw || 0) * k;
    l.x = l.tx;
    l.y = l.ty;
  });

  const effT = loopDur && loopDur > 0 ? loopDur : pr.T;
  return { letters: L, S: S * k, T: effT, preset: pr.id, W: PW, H: PH };
}

export interface PosterRenderOptions {
  boil?: boolean;
  recoil?: number;
  speed?: number;
  wither?: number;
  textAll?: boolean;
  warp?: (x: number, y: number, l: Letter) => [number, number];
  rotw?: (e: BotanicalElement) => number;
}

export function renderPosterElements(
  B: RenderBackend,
  now: number,
  st: PosterRenderOptions & { letters: Letter[]; S: number; C: PaletteColors['C'] },
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
    l.dead ? 1 - eo((now - l.dead) / (st.wither || 600)) : 1;

  const wpt = (l: Letter, x: number, y: number): [number, number] => {
    return st.warp ? st.warp(x, y, l) : [x, y];
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
            drawStem(B, P, th.u, th.u, st.C.blue, S * 0.022, sprites);
          }
        }
      }
    }
  };

  const drawElWrapper = (e: BotanicalElement, l: Letter, age: number, kk: number) => {
    const j = jit(e.id, f, amp);
    const p = wpt(l, l.x! + (e.x || 0) * S + j[0], l.y! + (e.y || 0) * S + j[1]);
    const rw = st.rotw ? st.rotw(e) : 0;

    if (e.t === 'leaf') {
      const sc = spr((age - e.d0) / 1000, 7, 15) * kk;
      if (sc <= 0) return;
      drawLeaf(B, p[0], p[1], (e.a || 0) + j[2] + rw, (e.L || 0.15) * S * sc, e.bend || 0, st.C, sprites);
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
        (e.rot || 0) + j[2] + rw,
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

export function drawPosterFly(
  B: RenderBackend,
  tt: number,
  P: PosterEngineData,
  C: PaletteColors['C'],
  perch: PerchPoint[]
): void {
  const ps = perch.slice().sort((a, b) => a.x - b.x);
  if (!ps.length) return;
  const p1 = ps[Math.floor(ps.length * 0.25)];
  const p2 = ps[Math.min(ps.length - 1, Math.floor(ps.length * 0.75))];
  const A: [number, number] = [-80, P.H * 0.28];
  const s1: [number, number] = [p1.x, p1.y - p1.R * 0.55];
  const s2: [number, number] = [p2.x, p2.y - p2.R * 0.55];
  const E: [number, number] = [P.W + 80, P.H * 0.24];
  const sz = Math.max(12, P.S * 0.09);
  const t = tt / 1000;

  const leg = (a: [number, number], b: [number, number], u: number, lift: number): [number, number] => {
    const e = eo(Math.max(0, Math.min(1, u)));
    return [
      a[0] + (b[0] - a[0]) * e,
      a[1] + (b[1] - a[1]) * e - Math.sin(e * Math.PI) * lift
    ];
  };

  let p: [number, number];
  let flying = true;
  let vx = 0;

  if (t < 1.8) {
    p = leg(A, s1, t / 1.8, 160);
    vx = 1;
  } else if (t < 3.4) {
    p = s1;
    flying = false;
  } else if (t < 4.6) {
    p = leg(s1, s2, (t - 3.4) / 1.2, 140);
    vx = s2[0] > s1[0] ? 1 : -1;
  } else if (t < 5.8) {
    p = s2;
    flying = false;
  } else {
    p = leg(s2, E, (t - 5.8) / 1.2, 60);
    vx = 1;
  }

  let o: number;
  let ang: number;
  if (flying) {
    o = Math.abs(Math.cos(t * 17));
    p = [p[0] + Math.sin(t * 7) * 6, p[1] + Math.sin(t * 13) * 4];
    ang = vx * 0.3;
  } else {
    const burst = (t > 2.4 && t < 2.8) || (t > 5 && t < 5.3);
    o = burst
      ? 0.2 + 0.8 * Math.abs(Math.cos(t * 9))
      : 0.3 + 0.1 * Math.sin(t * 3);
    ang = 0;
  }

  drawButterfly(B, p[0], p[1], sz, ang, o, C);
}

export function drawPosterScene(
  B: RenderBackend,
  t: number,
  P: PosterEngineData,
  pc: PaletteColors,
  sprites: SpriteRecord,
  isStillPic = false
): void {
  const PW = P.W || 1080;
  const PH = P.H || 1080;
  B.rect(0, 0, PW, PH, pc.bg);

  const tt = ((t % P.T) + P.T) % P.T;
  const L = P.letters;
  const perch: PerchPoint[] = [];

  const st: PosterRenderOptions & { letters: Letter[]; S: number; C: PaletteColors['C'] } = {
    letters: L,
    S: P.S,
    C: pc.C,
    boil: !isStillPic,
    recoil: 20,
    speed: 1,
    wither: 600,
    textAll: true
  };

  L.forEach((l) => {
    l.x = l.tx;
    l.y = l.ty;
    l.dead = null;
  });

  const setBase = (base: number) =>
    L.forEach((l) => {
      l.birth = base + (l.b || 0);
      l.tb = l.birth;
      l.cut = l.cutRel != null ? l.birth + l.cutRel : null;
    });

  let lightPos: [number, number] | null = null;

  if (P.preset === 'breathe') {
    setBase(-1e5);
    const ph = (tt / P.T) * Math.PI * 2;
    const S = P.S;
    st.warp = (x, y, l) => {
      const h = Math.max(0, (l.y! - y) / S);
      return [
        x + Math.sin(ph + l.x! * 0.004 + h * 1.1) * S * 0.03 * h,
        y + Math.cos(ph + x * 0.003) * S * 0.008 * h
      ];
    };
    st.rotw = (e) => Math.sin(ph + (e.id || 0) * 0.7) * 0.12;
  } else if (P.preset === 'grow' || P.preset === 'scatter') {
    setBase(0);
    L.forEach((l) => {
      if (tt >= (l.d || 0)) l.dead = l.d;
    });
  } else if (P.preset === 'wind') {
    setBase(-1e5);
    const S = P.S;
    const u = tt / P.T;
    const front = -0.35 + u * 1.9;
    st.warp = (x, y, l) => {
      const hh = Math.max(0, (l.y! - y) / S);
      const d = l.x! / PW - front;
      const g =
        d < 0 ? Math.exp(d * 2.2) * Math.cos(-d * 9) : Math.exp(-d * d * 30);
      const idle = Math.sin((tt / 1000) * 1.6 + l.x! * 0.01) * 0.012;
      return [
        x + (g * 0.13 + idle) * S * hh * hh * 0.6 + (g * 0.13 + idle) * S * hh * 0.4,
        y + Math.abs(g) * 0.02 * S * hh
      ];
    };
    st.rotw = (e) => {
      const d = (e.x || 0) / PW - front;
      return (d < 0 ? Math.exp(d * 2.2) * Math.cos(-d * 9) : Math.exp(-d * d * 30)) * 0.35;
    };
  } else if (P.preset === 'reach') {
    setBase(-1e5);
    const S = P.S;
    const ph = (tt / P.T) * Math.PI * 2;
    const lx = PW / 2 + Math.sin(ph) * (PW * 0.4);
    const ly = PH / 2 + Math.sin(ph * 2) * (PH * 0.24);
    lightPos = [lx, ly];
    st.warp = (x, y, l) => {
      const dx = lx - l.x!;
      const dy = ly - (l.y! - S * 0.6);
      const d = Math.hypot(dx, dy) || 1;
      const w = Math.max(0, 1 - d / (Math.max(PW, PH) * 0.52));
      const s = w * w * (3 - 2 * w);
      const hh = Math.min(2.5, Math.max(0, (l.y! - y) / S));
      const f = hh * hh * 0.5 + hh * 0.5;
      return [x + (dx / d) * s * S * 0.12 * f, y + (dy / d) * s * S * 0.06 * f];
    };
    st.rotw = (e) => {
      const a = Math.atan2(ly - (e.y || 0), lx - (e.x || 0));
      return Math.sin(a) * 0.15;
    };
  } else if (P.preset === 'visit') {
    setBase(-1e5);
    const ph = (tt / P.T) * Math.PI * 2;
    st.warp = (x, y, l) => {
      const hh = Math.max(0, (l.y! - y) / P.S);
      return [x + Math.sin(ph + l.x! * 0.004 + hh) * P.S * 0.015 * hh, y];
    };
  } else {
    if (tt >= 4400) return;
    setBase(0);
    st.letters = L.filter((l) => tt >= (l.birth || 0));
    st.textAll = false;
  }

  renderPosterElements(B, tt, st, sprites, perch);

  if (P.preset === 'reach' && lightPos) {
    const r = P.S * 0.09;
    const pts: [number, number][] = [];
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      pts.push([lightPos[0] + Math.cos(a) * r, lightPos[1] + Math.sin(a) * r]);
    }
    B.fill(pts, st.C.line);
  }

  if (P.preset === 'visit') {
    drawPosterFly(B, tt, P, st.C, perch);
  }

  if (P.preset === 'typed') {
    const born = st.letters;
    const last = born[born.length - 1];
    const S = P.S;
    if (Math.floor(tt / 400) % 2 === 0 || (last && tt - (last.birth || 0) < 300)) {
      const x = last ? last.tx! + last.tw! / 2 + 0.07 * S : PW / 2;
      const y = last ? last.ty! - 0.33 * S : PH / 2;
      const w = Math.max(2, S * 0.03);
      const h = 0.8 * S;
      B.rect(x - w / 2, y - h / 2, w, h, st.C.text);
    }
  }
}

export function exportPosterSvgString(
  P: PosterEngineData,
  t: number,
  palette: PaletteColors,
  sprites: SpriteRecord,
  tex: TextureConfig,
  compositor: TextureCompositor
): string {
  const PW = P.W || 1080;
  const PH = P.H || 1080;
  const svgBackend = createSvgBackend(sprites);

  drawPosterScene(svgBackend.backend, t, P, palette, sprites, true);
  const elements = svgBackend.getElements();
  const texSvg = compositor.getTextureSvgElements(tex, PW, PH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}"><defs><style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;display=swap');text{font-family:'Playfair Display',Georgia,serif;font-weight:700;}</style>${texSvg.defs}</defs><rect width="100%" height="100%" fill="${palette.bg}"/>${elements}${texSvg.rects}</svg>`;
}
