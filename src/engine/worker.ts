import { computeCrc32 } from './math';

export interface FloodFillResult {
  br: number;
  bg: number;
  bb: number;
}

export function detectConsensusBackground(
  d: Uint8ClampedArray,
  w: number,
  h: number
): [number, number, number] {
  const idx = (x: number, y: number) => (y * w + x) * 4;
  const samples = [
    idx(0, 0),
    idx(w - 1, 0),
    idx(0, h - 1),
    idx(w - 1, h - 1),
    idx(Math.floor(w / 2), 0),
    idx(Math.floor(w / 2), h - 1),
    idx(0, Math.floor(h / 2)),
    idx(w - 1, Math.floor(h / 2))
  ];

  let bestCenter = [d[samples[0]], d[samples[0] + 1], d[samples[0] + 2]];
  let maxAgreement = -1;

  for (const s of samples) {
    const r0 = d[s], g0 = d[s + 1], b0 = d[s + 2];
    let agreeCount = 0;
    for (const other of samples) {
      const dr = d[other] - r0;
      const dg = d[other + 1] - g0;
      const db = d[other + 2] - b0;
      if (Math.hypot(dr, dg, db) < 45) {
        agreeCount++;
      }
    }
    if (agreeCount > maxAgreement) {
      maxAgreement = agreeCount;
      bestCenter = [r0, g0, b0];
    }
  }

  return [bestCenter[0], bestCenter[1], bestCenter[2]];
}

export function processPixelsFloodFill(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  toleranceInput: number,
  featherPixels = 16,
  algorithm: 'flood' | 'global' = 'flood'
): FloodFillResult {
  const [br, bg, bb] = detectConsensusBackground(d, w, h);
  const tol = toleranceInput * 1.9;
  const total = w * h;

  if (algorithm === 'global') {
    for (let i = 0; i < total; i++) {
      const p = i * 4;
      if (d[p + 3] === 0) continue;
      const dr = d[p] - br, dg = d[p + 1] - bg, db = d[p + 2] - bb;
      const dist = Math.hypot(dr, dg, db);
      if (dist < tol) {
        d[p + 3] = 0;
      } else if (dist < tol + featherPixels) {
        d[p + 3] = Math.round(d[p + 3] * ((dist - tol) / featherPixels));
      }
    }
    return { br, bg, bb };
  }

  // Multi-seed breadth-first corner flood-fill
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  const pushSeed = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    const pi = p * 4;
    const dr = d[pi] - br, dg = d[pi + 1] - bg, db = d[pi + 2] - bb;
    if (Math.hypot(dr, dg, db) <= tol + featherPixels) {
      visited[p] = 1;
      queue[qTail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    pushSeed(x, 0);
    pushSeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushSeed(0, y);
    pushSeed(w - 1, y);
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % w;
    const y = (p / w) | 0;

    if (x > 0) checkNeighbor(x - 1, y);
    if (x < w - 1) checkNeighbor(x + 1, y);
    if (y > 0) checkNeighbor(x, y - 1);
    if (y < h - 1) checkNeighbor(x, y + 1);
  }

  function checkNeighbor(nx: number, ny: number) {
    const np = ny * w + nx;
    if (visited[np]) return;
    const pi = np * 4;
    if (d[pi + 3] === 0) return;
    const dr = d[pi] - br, dg = d[pi + 1] - bg, db = d[pi + 2] - bb;
    const dist = Math.hypot(dr, dg, db);
    if (dist <= tol + featherPixels) {
      visited[np] = 1;
      queue[qTail++] = np;
    }
  }

  for (let i = 0; i < total; i++) {
    if (visited[i]) {
      const p = i * 4;
      const dr = d[p] - br, dg = d[p + 1] - bg, db = d[p + 2] - bb;
      const dist = Math.hypot(dr, dg, db);
      if (dist < tol) {
        d[p + 3] = 0;
      } else if (dist < tol + featherPixels) {
        d[p + 3] = Math.round(d[p + 3] * ((dist - tol) / featherPixels));
      }
    }
  }

  return { br, bg, bb };
}

export function buildZipArchive(
  files: { name: string; data: Uint8Array }[]
): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const cen: Uint8Array[] = [];
  let off = 0;

  for (const f of files) {
    const nm = enc.encode(f.name);
    const cr = computeCrc32(f.data);
    const sz = f.data.length;

    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(8, 0, true);
    h.setUint16(12, 33, true);
    h.setUint32(14, cr, true);
    h.setUint32(18, sz, true);
    h.setUint32(22, sz, true);
    h.setUint16(26, nm.length, true);

    const hBytes = new Uint8Array(h.buffer);
    parts.push(hBytes, nm, f.data);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, cr, true);
    c.setUint32(20, sz, true);
    c.setUint32(24, sz, true);
    c.setUint16(28, nm.length, true);
    c.setUint32(42, off, true);

    const cBytes = new Uint8Array(c.buffer);
    cen.push(cBytes, nm);

    off += 30 + nm.length + sz;
  }

  const cs = cen.reduce((s, b) => s + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cs, true);
  e.setUint32(16, off, true);
  const eBytes = new Uint8Array(e.buffer);

  const totalLen = parts.reduce((s, b) => s + b.length, 0) + cs + 22;
  const out = new Uint8Array(totalLen);
  let cur = 0;
  for (const p of parts) {
    out.set(p, cur);
    cur += p.length;
  }
  for (const c of cen) {
    out.set(c, cur);
    cur += c.length;
  }
  out.set(eBytes, cur);
  return out;
}

// Web Worker message listener when running inside a Worker
if (typeof self !== 'undefined' && 'postMessage' in self && typeof window === 'undefined') {
  self.onmessage = (e: MessageEvent) => {
    const data = e.data;
    if (data.type === 'remove_bg') {
      const { buffer, w, h, tol, feather, id } = data;
      const clamped = new Uint8ClampedArray(buffer);
      processPixelsFloodFill(clamped, w, h, tol, feather);
      (self as unknown as Worker).postMessage(
        { type: 'remove_bg_done', id, buffer: clamped.buffer },
        [clamped.buffer]
      );
    } else if (data.type === 'zip_pack') {
      const { files, id } = data;
      const zipBytes = buildZipArchive(files);
      (self as unknown as Worker).postMessage(
        { type: 'zip_pack_done', id, buffer: zipBytes.buffer },
        [zipBytes.buffer]
      );
    }
  };
}
