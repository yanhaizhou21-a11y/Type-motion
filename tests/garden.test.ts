import { describe, it, expect } from 'vitest';
import {
  spr,
  eo,
  rng,
  bez,
  at,
  jit,
  buildSmoothPath,
  computeCrc32,
  clampDimension,
  swapDimensions,
  calculateAspectRatio,
  PathReceiver
} from '../src/engine/math';
import { encodeGardenStateToUrl, decodeGardenStateFromUrl } from '../src/storage/localStore';
import { processPixelsFloodFill, buildZipArchive } from '../src/engine/worker';
import { createZipArchive } from '../src/engine/exporter';
import { wordParams, vine, curl, weave, layerAt } from '../src/engine/botanical';
import { TextureCompositor } from '../src/engine/textures';
import { layoutCore, buildPoster, exportPosterSvgString } from '../src/engine/poster';
import { PRESETS, SIZES, RAW_PALETTES, TEX_TYPES, BLENDS, getPalette } from '../src/constants';
import { SpriteRecord, TextureConfig } from '../src/types';
import { computeSeoMetadata } from '../src/engine/seo';

describe('Constants & Configuration', () => {
  it('loads all 10 raw palettes and formats them correctly', () => {
    expect(RAW_PALETTES.length).toBe(10);
    const pal0 = getPalette(0);
    expect(pal0.name).toBe('Rose noir');
    expect(pal0.bg).toBe('#000000');
    expect(pal0.C.red).toBe('#FF1400');
    expect(pal0.C.blue).toBe('#3257FF');
  });

  it('includes all 7 motion presets and 10 aspect ratio sizes', () => {
    expect(PRESETS.length).toBe(7);
    expect(SIZES.length).toBe(10);
    expect(SIZES.some((s) => s.id === 'ig-sq')).toBe(true);
    expect(SIZES.some((s) => s.id === 'story')).toBe(true);
    expect(SIZES.some((s) => s.id === 'a4-print')).toBe(true);
  });

  it('defines 8 texture types and 8 blend modes', () => {
    expect(TEX_TYPES.length).toBe(8);
    expect(BLENDS.length).toBe(8);
  });
});

describe('Math Engine', () => {
  it('spring physics spr() behaves stably across time', () => {
    expect(spr(0)).toBe(0);
    expect(spr(-1)).toBe(0);
    const mid = spr(0.2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(2);
    const settled = spr(5);
    expect(Math.abs(settled - 1)).toBeLessThan(0.001);
  });

  it('cubic ease-out eo() clamps boundary conditions', () => {
    expect(eo(0)).toBe(0);
    expect(eo(-1)).toBe(0);
    expect(eo(1)).toBe(1);
    expect(eo(2)).toBe(1);
    expect(eo(0.5)).toBeCloseTo(0.875, 4);
  });

  it('RNG is deterministic for a given seed', () => {
    const r1 = rng(12345);
    const r2 = rng(12345);
    const v1 = [r1(), r1(), r1()];
    const v2 = [r2(), r2(), r2()];
    expect(v1).toEqual(v2);
    v1.forEach((val) => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });
  });

  it('cubic Bezier bez() evaluates n segments correctly', () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 10];
    const c: [number, number] = [10, 10];
    const d: [number, number] = [10, 0];
    const pts = bez(a, b, c, d, 10);
    expect(pts.length).toBe(11);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10]).toEqual([10, 0]);
  });

  it('tangent evaluation at() returns point and angle', () => {
    const pts: [number, number][] = [
      [0, 0],
      [10, 0],
      [20, 0]
    ];
    const [pt, angle] = at(pts, 0.5);
    expect(pt).toEqual([10, 0]);
    expect(angle).toBeCloseTo(0, 4);
  });

  it('jit() returns zero amplitude when amp is 0', () => {
    expect(jit(1, 0, 0)).toEqual([0, 0, 0]);
  });

  it('buildSmoothPath connects points through quadratic curves', () => {
    const calls: string[] = [];
    const mockReceiver: PathReceiver = {
      moveTo: (x, y) => calls.push(`move(${x},${y})`),
      lineTo: (x, y) => calls.push(`line(${x},${y})`),
      quadraticCurveTo: (cpx, cpy, x, y) => calls.push(`quad(${cpx},${cpy},${x},${y})`),
      closePath: () => calls.push('close')
    };

    buildSmoothPath(mockReceiver, [[0, 0], [10, 10], [20, 0]], false);
    expect(calls[0]).toContain('move');
    expect(calls[calls.length - 1]).toContain('line');
  });

  it('clamps dimensions and calculates aspect ratios', () => {
    expect(clampDimension(100)).toBe(200);
    expect(clampDimension(5000)).toBe(4096);
    expect(clampDimension(1080)).toBe(1080);
    expect(swapDimensions(1920, 1080)).toEqual({ w: 1080, h: 1920 });
    expect(calculateAspectRatio(1080, 1080)).toBe('1080 / 1080');
  });
});

describe('URL State Compression (Zero DB Cost)', () => {
  it('compresses and decompresses garden state via URL hash', () => {
    const original = {
      text: 'wildflower',
      palette: 3,
      seed: 88214,
      preset: 'wind',
      sizeId: 'story',
      pw: 1080,
      ph: 1920
    };

    const hash = encodeGardenStateToUrl(original);
    expect(hash.startsWith('#g=')).toBe(true);

    const restored = decodeGardenStateFromUrl(hash);
    expect(restored).not.toBeNull();
    expect(restored?.text).toBe(original.text);
    expect(restored?.palette).toBe(original.palette);
    expect(restored?.seed).toBe(original.seed);
    expect(restored?.preset).toBe(original.preset);
    expect(restored?.sizeId).toBe(original.sizeId);
    expect(restored?.pw).toBe(original.pw);
    expect(restored?.ph).toBe(original.ph);
  });

  it('gracefully handles empty or invalid hash', () => {
    expect(decodeGardenStateFromUrl('')).toBeNull();
    expect(decodeGardenStateFromUrl('#random-anchor')).toBeNull();
    expect(decodeGardenStateFromUrl('#g=INVALID_LZ_CONTENT_XYZ')).toBeNull();
  });
});

describe('ZIP Exporter & CRC32', () => {
  it('computes IEEE 802.3 CRC32 correctly', () => {
    const enc = new TextEncoder();
    const data = enc.encode('123456789');
    const crc = computeCrc32(data);
    expect(crc).toBe(0xcbf43926);
  });

  it('generates a valid ZIP archive Blob with local headers and central directory', async () => {
    const enc = new TextEncoder();
    const zipBlob = createZipArchive([
      { name: 'test.txt', data: enc.encode('Hello Type Garden') },
      { name: 'frame_0001.png', data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) }
    ]);

    expect(zipBlob).toBeDefined();
    expect(zipBlob.type).toBe('application/zip');
    expect(zipBlob.size).toBeGreaterThan(100);

    const buffer = await zipBlob.arrayBuffer();
    const view = new DataView(buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
  });

  it('correctly handles subarray with non-zero byteOffset without buffer over-read', async () => {
    const parent = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const sliced = parent.subarray(2, 6);
    const zipBlob = createZipArchive([{ name: 'slice.bin', data: sliced }]);
    const buffer = await zipBlob.arrayBuffer();
    const view = new DataView(buffer);
    expect(view.getUint32(22, true)).toBe(4);
    expect(view.getUint32(18, true)).toBe(4);
    expect(zipBlob.size).toBe(120);
  });
});

describe('Corner Flood-Fill Background Removal & Worker Engine', () => {
  it('flood-fills background while protecting interior matching pixels', () => {
    const w = 5;
    const h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = 255;
    }
    const ring = [
      [1, 1], [2, 1], [3, 1],
      [1, 2],         [3, 2],
      [1, 3], [2, 3], [3, 3]
    ];
    ring.forEach(([x, y]) => {
      const idx = (y * w + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    });

    const result = processPixelsFloodFill(data, w, h, 30, 0, 'flood');
    expect(result.br).toBe(255);
    expect(result.bg).toBe(255);
    expect(result.bb).toBe(255);

    expect(data[3]).toBe(0);
    const ringIdx = (1 * w + 1) * 4;
    expect(data[ringIdx + 3]).toBe(255);
    const centerIdx = (2 * w + 2) * 4;
    expect(data[centerIdx + 3]).toBe(255);
  });
});

describe('Botanical Generator', () => {
  it('generates word parameters with valid ranges', () => {
    const p = wordParams(42, 1);
    expect(p.roseP).toBeGreaterThan(0);
    expect(p.leafy).toBeGreaterThan(0);
    expect(p.dens).toBe(1);
    expect(p.curvy).toBeGreaterThan(0);
  });

  it('generates vine paths with requested segment count', () => {
    const v = vine([0, 0], 0, 100, 10, 2, 0, 0, 40);
    expect(v.length).toBe(41);
    expect(v[0]).toEqual([0, 0]);
  });

  it('generates curls without NaN', () => {
    const basePts: [number, number][] = [[0, 0], [10, 10]];
    const curled = curl(basePts, 1, 5);
    expect(curled.length).toBe(16);
    curled.forEach(([x, y]) => {
      expect(Number.isNaN(x)).toBe(false);
      expect(Number.isNaN(y)).toBe(false);
    });
  });

  it('weaves layers alternating between 0 and 1', () => {
    const r = rng(777);
    const segs = weave(r, 0);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0].u0).toBe(0);
    expect(segs[segs.length - 1].u1).toBe(1);
    expect([0, 1]).toContain(layerAt(segs, 0.5));
  });
});

describe('Graphic Design Textures & Poster SVG Export', () => {
  it('creates texture tiles and compiles SVG overlay defs', () => {
    const comp = new TextureCompositor();
    const grainTile = comp.getTexTile('grain');
    expect(grainTile).not.toBeNull();
    expect(grainTile?.width).toBe(256);
    expect(grainTile?.height).toBe(256);

    const paperTile = comp.getTexTile('paper');
    expect(paperTile).not.toBeNull();

    const texConfig: TextureConfig = {
      type: 'grain',
      blend: 'overlay',
      opacity: 0.35,
      scale: 1.2,
      vignette: 0.3,
      animate: true,
      customUrl: null,
      customImg: null,
      customName: '',
      videoUrl: null,
      videoEl: null,
      videoName: ''
    };

    const svgDef = comp.getTextureSvgElements(texConfig, 1080, 1080);
    expect(svgDef.defs).toContain('pattern id="tg-tex-pat"');
    expect(svgDef.rects).toContain('mix-blend-mode:overlay');
    expect(svgDef.defs).toContain('radialGradient id="tg-vig-grad"');
  });

  it('exports poster SVG with full dimensions and embedded styles', () => {
    const sprites: SpriteRecord = {
      flower: { img: null, rawUrl: null, cleanUrl: null, removeBg: false, tol: 38, scale: 1.0, name: '' },
      leaf: { img: null, rawUrl: null, cleanUrl: null, removeBg: false, tol: 38, scale: 1.0, name: '' },
      stalk: { img: null, rawUrl: null, cleanUrl: null, removeBg: false, tol: 38, scale: 1.0, name: '' }
    };
    const texConfig: TextureConfig = {
      type: 'none',
      blend: 'soft-light',
      opacity: 0,
      scale: 1,
      vignette: 0,
      animate: false,
      customUrl: null,
      customImg: null,
      customName: '',
      videoUrl: null,
      videoEl: null,
      videoName: ''
    };
    const comp = new TextureCompositor();
    const pData = buildPoster('in bloom', 12345, 'breathe', 1080, 1920, 3000, () => 0.6);

    const svg = exportPosterSvgString(pData, 1000, getPalette(0), sprites, texConfig, comp);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 1080 1920"');
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
    expect(svg).toContain('</svg>');
  });
});

describe('SEO & Dynamic URL Metadata Engine', () => {
  it('generates rich default SEO metadata for homepage', () => {
    const meta = computeSeoMetadata();
    expect(meta.title).toContain('Type Garden Studio');
    expect(meta.description).toContain('procedural vector botanical vines');
    expect(meta.ogTitle).toContain('Type Garden Studio');
    expect(meta.imageUrl).toMatch(/og\.(jpg|png)/);
    expect(meta.keywords).toContain('botanical typography');
  });

  it('generates dynamic personalized metadata when text and palette are provided', () => {
    const meta = computeSeoMetadata('BLOOM', 1, 'reach');
    expect(meta.title).toBe('Type Garden: "BLOOM" · Botanical Typography');
    expect(meta.ogTitle).toBe('Type Garden: "BLOOM"');
    expect(meta.description).toContain('Paper');
    expect(meta.description).toContain('Reach');
    expect(meta.ogDescription).toContain('"BLOOM"');
    expect(meta.keywords).toContain('BLOOM');
    expect(meta.keywords).toContain('Paper');
  });

  it('handles multi-line text cleanly without breaking meta tags', () => {
    const meta = computeSeoMetadata('WILD\nFLOWERS\tFOREVER', 0, 'breathe');
    expect(meta.title).toBe('Type Garden: "WILD FLOWERS FOREVER" · Botanical Typography');
    expect(meta.description).not.toContain('\n');
    expect(meta.description).not.toContain('\t');
  });
});

