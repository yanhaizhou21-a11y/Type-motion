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

// URL Hash State Compression via lz-string
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
    const json = JSON.stringify(state);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return `#g=${compressed}`;
  } catch {
    return '';
  }
}

export function decodeGardenStateFromUrl(hashString?: string): ShareableGardenState | null {
  try {
    const raw = hashString || window.location.hash;
    if (!raw || !raw.startsWith('#g=')) return null;
    const compressed = raw.slice(3);
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    if (!decompressed) return null;
    const parsed = JSON.parse(decompressed);
    if (parsed && typeof parsed === 'object') {
      return parsed as ShareableGardenState;
    }
    return null;
  } catch {
    return null;
  }
}
