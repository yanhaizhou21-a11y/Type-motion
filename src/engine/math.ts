export function h(n: number): number {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
}

export function spr(t: number, k: number = 7, w: number = 16): number {
  if (t <= 0) return 0;
  return 1 - Math.exp(-t * k) * Math.cos(t * w);
}

export function eo(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
}

export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bez(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
  n: number
): [number, number][] {
  const P: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    P.push([
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]
    ]);
  }
  return P;
}

export function at(P: [number, number][], u: number): [[number, number], number] {
  const n = P.length;
  const i = Math.min(n - 2, Math.max(1, Math.round(u * (n - 1))));
  return [P[i], Math.atan2(P[i + 1][1] - P[i - 1][1], P[i + 1][0] - P[i - 1][0])];
}

export function jit(id: number, f: number, amp: number): [number, number, number] {
  if (!amp) return [0, 0, 0];
  return [
    (h(id * 1.37 + f * 7.13) * 2 - 1) * amp,
    (h(id * 2.71 + f * 3.11) * 2 - 1) * amp,
    (h(id * 5.3 + f * 1.7) * 2 - 1) * 0.035
  ];
}

export interface PathReceiver {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
}

export function buildSmoothPath(c: PathReceiver, p: [number, number][], closed: boolean): void {
  const n = p.length;
  if (n < 2) return;
  const m = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2
  ];

  if (closed) {
    const s = m(p[n - 1], p[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const q = m(p[i], p[(i + 1) % n]);
      c.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]);
    }
    c.closePath();
  } else {
    c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const q = m(p[i], p[i + 1]);
      c.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]);
    }
    c.lineTo(p[n - 1][0], p[n - 1][1]);
  }
}

// IEEE 802.3 CRC32 Implementation
let crcTable: Uint32Array | null = null;

export function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  crcTable = t;
  return t;
}

export function computeCrc32(data: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = table[(c ^ data[i]) & 255] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function clampDimension(val: number, min = 200, max = 4096): number {
  if (isNaN(val)) return 1080;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function swapDimensions(w: number, h: number): { w: number; h: number } {
  return { w: h, h: w };
}

export function calculateAspectRatio(w: number, h: number): string {
  if (!w || !h) return '1 / 1';
  return `${w} / ${h}`;
}
