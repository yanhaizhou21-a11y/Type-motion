import { get, set, del } from 'idb-keyval';
import LZString from 'lz-string';
import { AppState, SpriteRecord, TextureConfig } from '../types';
import { STORAGE_KEY } from '../constants';

export interface PersistentConfig {
  palette: number;
  preset: string;
  sizeId: string;
  pw: number;
  ph: number;
  text: string;
  posterVersion: 'loop' | 'pic';
  picScrub: number;
  picFormat: 'png' | 'jpeg' | 'webp';
  loopDur: number;
  loopFps: 24 | 30 | 60;
  sprites: {
    [key in 'flower' | 'leaf' | 'stalk']?: {
      rawUrl: string | null;
      removeBg: boolean;
      tol: number;
      scale: number;
      name: string;
    };
  };
  tex: {
    type: TextureConfig['type'];
    blend: TextureConfig['blend'];
    opacity: number;
    scale: number;
    vignette: number;
    animate: boolean;
    customUrl: string | null;
    customName: string;
  };
}

export function saveSettingsToLocal(
  state: AppState,
  sprites: SpriteRecord,
  tex: TextureConfig
): void {
  try {
    const config: PersistentConfig = {
      palette: state.palette,
      preset: state.preset,
      sizeId: state.sizeId,
      pw: state.pw,
      ph: state.ph,
      text: state.text,
      posterVersion: state.posterVersion,
      picScrub: state.picScrub,
      picFormat: state.picFormat,
      loopDur: state.loopDur,
      loopFps: state.loopFps,
      sprites: {
        flower: {
          rawUrl: sprites.flower.rawUrl,
          removeBg: sprites.flower.removeBg,
          tol: sprites.flower.tol,
          scale: sprites.flower.scale,
          name: sprites.flower.name
        },
        leaf: {
          rawUrl: sprites.leaf.rawUrl,
          removeBg: sprites.leaf.removeBg,
          tol: sprites.leaf.tol,
          scale: sprites.leaf.scale,
          name: sprites.leaf.name
        },
        stalk: {
          rawUrl: sprites.stalk.rawUrl,
          removeBg: sprites.stalk.removeBg,
          tol: sprites.stalk.tol,
          scale: sprites.stalk.scale,
          name: sprites.stalk.name
        }
      },
      tex: {
        type: tex.type === 'video' ? 'grain' : tex.type,
        blend: tex.blend,
        opacity: tex.opacity,
        scale: tex.scale,
        vignette: tex.vignette,
        animate: tex.animate,
        customUrl: tex.customUrl,
        customName: tex.customName
      }
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Gracefully handle storage quota errors
  }
}

export function loadSettingsFromLocal(): Partial<PersistentConfig> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistentConfig>;
  } catch {
    return null;
  }
}

// IndexedDB asset storage for high-res sprites and texture blobs
export async function saveAssetBlob(key: string, blob: Blob): Promise<void> {
  await set(`tg_asset_${key}`, blob);
}

export async function loadAssetBlob(key: string): Promise<Blob | undefined> {
  return await get<Blob>(`tg_asset_${key}`);
}

export async function deleteAssetBlob(key: string): Promise<void> {
  await del(`tg_asset_${key}`);
}

// Human-readable URL State Encoding with LZ-String legacy fallback
export interface ShareableGardenState {
  text: string;
  palette: number;
  seed: number;
  preset: string;
  sizeId: string;
  pw: number;
  ph: number;
}

export function encodeGardenStateToUrl(state: ShareableGardenState): string {
  try {
    const params = new URLSearchParams();
    if (state.text && state.text.trim()) {
      params.set('t', state.text.trim());
    }
    if (typeof state.palette === 'number' && state.palette !== 0) {
      params.set('pal', String(state.palette));
    }
    if (state.preset && state.preset !== 'breathe') {
      params.set('pr', state.preset);
    }
    if (typeof state.seed === 'number' && state.seed !== 0) {
      params.set('s', String(state.seed));
    }
    if (state.sizeId && state.sizeId !== 'ig-sq') {
      params.set('sz', state.sizeId);
    }
    if (state.pw && state.ph && (state.pw !== 1080 || state.ph !== 1080)) {
      params.set('w', String(state.pw));
      params.set('h', String(state.ph));
    }
    const q = params.toString();
    return q ? `?${q}` : '';
  } catch {
    return '';
  }
}

export function decodeGardenStateFromUrl(urlOrParamString?: string): ShareableGardenState | null {
  try {
    let raw = urlOrParamString;
    if (!raw && typeof window !== 'undefined') {
      raw = (window.location.search || '') + (window.location.hash || '');
    }
    if (!raw || !raw.trim()) return null;

    // 1. Check for legacy compressed format (#g=... or g=...)
    const gIndex = raw.indexOf('g=');
    if (gIndex !== -1 && (gIndex === 0 || raw[gIndex - 1] === '#' || raw[gIndex - 1] === '?' || raw[gIndex - 1] === '&')) {
      const remainder = raw.slice(gIndex + 2).split('&')[0].split('#')[0];
      if (remainder) {
        const decompressed = LZString.decompressFromEncodedURIComponent(remainder);
        if (decompressed) {
          const parsed = JSON.parse(decompressed);
          if (parsed && typeof parsed === 'object') {
            return parsed as ShareableGardenState;
          }
        }
      }
    }

    // 2. Parse human-readable parameters (?t=... or #t=...)
    let queryString = raw;
    if (queryString.includes('?')) {
      queryString = queryString.slice(queryString.indexOf('?') + 1);
    } else if (queryString.includes('#')) {
      queryString = queryString.slice(queryString.indexOf('#') + 1);
    }

    const sp = new URLSearchParams(queryString);
    const text = sp.get('t') ?? sp.get('text');
    const palStr = sp.get('pal') ?? sp.get('palette') ?? sp.get('p');
    const preset = sp.get('pr') ?? sp.get('preset');
    const seedStr = sp.get('s') ?? sp.get('seed');
    const sizeId = sp.get('sz') ?? sp.get('sizeId') ?? sp.get('size');
    const wStr = sp.get('w') ?? sp.get('pw');
    const hStr = sp.get('h') ?? sp.get('ph');

    // If no relevant parameters exist, return null
    if (
      text === null &&
      palStr === null &&
      preset === null &&
      seedStr === null &&
      sizeId === null &&
      wStr === null &&
      hStr === null
    ) {
      return null;
    }

    const palette = palStr !== null ? parseInt(palStr, 10) : 0;
    const seed = seedStr !== null ? parseInt(seedStr, 10) : 0;
    const pw = wStr !== null ? parseInt(wStr, 10) : 1080;
    const ph = hStr !== null ? parseInt(hStr, 10) : 1080;

    return {
      text: text || '',
      palette: isNaN(palette) ? 0 : palette,
      seed: isNaN(seed) ? 0 : seed,
      preset: preset || 'breathe',
      sizeId: sizeId || 'ig-sq',
      pw: isNaN(pw) ? 1080 : pw,
      ph: isNaN(ph) ? 1080 : ph
    };
  } catch {
    return null;
  }
}
