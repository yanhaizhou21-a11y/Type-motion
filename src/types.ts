export type Mode = 'type' | 'poster';
export type PosterVersion = 'loop' | 'pic';
export type PicFormat = 'png' | 'jpeg' | 'webp';
export type LoopFps = 24 | 30 | 60;

export type TextureType =
  | 'none'
  | 'grain'
  | 'paper'
  | 'halftone'
  | 'riso'
  | 'scan'
  | 'custom'
  | 'video';

export type BlendMode =
  | 'soft-light'
  | 'hard-light'
  | 'overlay'
  | 'multiply'
  | 'screen'
  | 'color-dodge'
  | 'difference'
  | 'source-over';

export interface AppState {
  mode: Mode;
  posterVersion: PosterVersion;
  picScrub: number;
  picFormat: PicFormat;
  loopDur: number;
  loopFps: LoopFps;
  preset: string;
  palette: number;
  text: string;
  seed: number;
  sizeId: string;
  pw: number;
  ph: number;
  status: string;
  busy: boolean;
}

export interface SpriteSlot {
  key: 'flower' | 'leaf' | 'stalk';
  title: string;
  hint: string;
}

export interface SpriteData {
  img: HTMLImageElement | null;
  rawUrl: string | null;
  cleanUrl: string | null;
  removeBg: boolean;
  tol: number;
  scale: number;
  name: string;
}

export type SpriteRecord = Record<'flower' | 'leaf' | 'stalk', SpriteData>;

export interface TextureConfig {
  type: TextureType;
  blend: BlendMode;
  opacity: number;
  scale: number;
  vignette: number;
  animate: boolean;
  customUrl: string | null;
  customImg: HTMLImageElement | null;
  customName: string;
  videoUrl: string | null;
  videoEl: HTMLVideoElement | null;
  videoName: string;
}

export interface PaletteColors {
  name: string;
  bg: string;
  C: {
    red: string;
    blue: string;
    line: string;
    text: string;
    vein: string;
  };
}

export interface PresetDef {
  id: string;
  label: string;
  sub: string;
  T: number;
}

export interface SizeDef {
  id: string;
  label: string;
  sub: string;
  w: number;
  h: number;
}

export interface WeaveSegment {
  u0: number;
  u1: number;
  layer: number;
}

export interface Thorn {
  u: number;
  s: number;
}

export interface BotanicalElement {
  t: 'stem' | 'leaf' | 'rose';
  id: number;
  pts?: [number, number][];
  segs?: WeaveSegment[];
  d0: number;
  dur?: number;
  w?: number;
  thorns?: Thorn[];
  x?: number;
  y?: number;
  a?: number;
  L?: number;
  bend?: number;
  layer?: number;
  R?: number;
  rot?: number;
  ph1?: number;
  ph2?: number;
  turns?: number;
}

export interface Letter {
  ch: string;
  id: number;
  birth?: number;
  tb?: number;
  ws: number;
  wi: number;
  prev: Letter | null;
  els?: BotanicalElement[];
  endEls?: BotanicalElement[] | null;
  tend?: BotanicalElement[];
  tx?: number;
  ty?: number;
  tw?: number;
  x?: number;
  y?: number;
  line?: number;
  dead?: number | null;
  cut?: number | null;
  cutRel?: number | null;
  b?: number;
  d?: number;
  lean?: [number, number];
}

export interface Butterfly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  st: 'fly' | 'wander' | 'sit' | 'leave';
  pid: number | null;
  hx: number;
  hy: number;
  t0: number;
  ph: number;
  sz: number;
  seed: number;
  ang: number;
  open?: number;
  ex?: number;
  ey?: number;
}

export interface PerchPoint {
  id: number;
  x: number;
  y: number;
  R: number;
}

export interface GiftRose {
  x: number;
  y: number;
  t0: number;
  rot: number;
  e: { ph1: number; ph2: number; turns: number };
}

export interface PeerGardener {
  id: string;
  el: HTMLElement;
  x: number | null;
  y: number | null;
  tx: number;
  ty: number;
  t: number;
  h: boolean;
  op: number;
  n?: string;
  c?: string;
}

export interface PosterEngineData {
  letters: Letter[];
  S: number;
  T: number;
  preset: string;
  W: number;
  H: number;
}
