import { PaletteColors, PresetDef, SizeDef, TextureType, BlendMode } from './types';

export const FONT_FAMILY = '"Playfair Display", Georgia, serif';
export const STORAGE_KEY = 'tg_studio_v2_state';

export const FLOWERS: string[] = [
  'iris', 'fern', 'poppy', 'tulip', 'violet', 'clover',
  'daisy', 'lilac', 'aster', 'peony', 'sorrel', 'yarrow',
  'thistle', 'bluebell', 'foxglove', 'primrose'
];

export const TINTS: string[] = [
  '#FF8A00', '#E63CFF', '#7FD18B', '#9FB4FF',
  '#FFB7C5', '#FFE2B8', '#2FB8A6', '#FFD23F'
];

export const PRESETS: PresetDef[] = [
  { id: 'breathe', label: 'Breathe', sub: 'Slow sway · 3s', T: 3000 },
  { id: 'grow', label: 'Grow & wither', sub: 'Bloom, then back · 6s', T: 6000 },
  { id: 'typed', label: 'Typed', sub: 'Type, cut, repeat · 5s', T: 5000 },
  { id: 'wind', label: 'Gust', sub: 'Wind sweeps through · 4s', T: 4000 },
  { id: 'reach', label: 'Reach', sub: 'Stems follow a light · 6s', T: 6000 },
  { id: 'scatter', label: 'Scatter', sub: 'Random bloom, fade · 6s', T: 6000 },
  { id: 'visit', label: 'Visitor', sub: 'Butterfly drops by · 7s', T: 7000 }
];

export const SIZES: SizeDef[] = [
  { id: 'ig-sq', label: 'IG Square', sub: '1080 × 1080 · 1:1', w: 1080, h: 1080 },
  { id: 'ig-port', label: 'IG Portrait', sub: '1080 × 1350 · 4:5', w: 1080, h: 1350 },
  { id: 'story', label: 'Story / Reel / TikTok', sub: '1080 × 1920 · 9:16', w: 1080, h: 1920 },
  { id: 'yt-hd', label: 'YouTube / X / FHD', sub: '1920 × 1080 · 16:9', w: 1920, h: 1080 },
  { id: 'x-post', label: 'X / LinkedIn Post', sub: '1200 × 675 · 16:9', w: 1200, h: 675 },
  { id: 'pin', label: 'Pinterest Pin', sub: '1000 × 1500 · 2:3', w: 1000, h: 1500 },
  { id: 'phone-wp', label: 'iPhone / Android WP', sub: '1170 × 2532 · Mobile', w: 1170, h: 2532 },
  { id: 'ipad', label: 'iPad / Tablet', sub: '1668 × 2388 · 3:4', w: 1668, h: 2388 },
  { id: 'macbook', label: 'MacBook / Desktop', sub: '2560 × 1600 · 16:10', w: 2560, h: 1600 },
  { id: 'a4-print', label: 'Print Poster A4', sub: '2480 × 3508 · 300dpi', w: 2480, h: 3508 }
];

export const RAW_PALETTES: [string, string, string, string, string, string][] = [
  ['Rose noir', '#000000', '#FF1400', '#3257FF', '#FFB4A8', '#FFFFFF'],
  ['Paper', '#F3EEE4', '#FF3B1F', '#1C2B8F', '#FFD2C4', '#111111'],
  ['Midnight', '#0D1B4C', '#FF5A4E', '#9FB4FF', '#FFD6CF', '#FFFFFF'],
  ['Citrus', '#0E1A12', '#FF8A00', '#1FA463', '#FFE2B8', '#FFF6E8'],
  ['Orchid', '#140A1F', '#E63CFF', '#2FB8A6', '#F9D1FF', '#FFFFFF'],
  ['Moss', '#133A2A', '#FFB7C5', '#7FD18B', '#FFFFFF', '#F6F1E7'],
  ['Tomato', '#FF1400', '#FFF1E0', '#0B0B0B', '#FF1400', '#000000'],
  ['Butter', '#FFE9A8', '#E4002B', '#0F5132', '#FFC2C2', '#1A1A1A'],
  ['Blush', '#FAD4D8', '#C8102E', '#274690', '#FFE3E6', '#1A1A1A'],
  ['Mono', '#000000', '#F2F2F2', '#6E6E6E', '#000000', '#FFFFFF']
];

export function getPalette(idx: number): PaletteColors {
  const p = RAW_PALETTES[idx] || RAW_PALETTES[0];
  return {
    name: p[0],
    bg: p[1],
    C: {
      red: p[2],
      blue: p[3],
      line: p[4],
      text: p[5],
      vein: p[1]
    }
  };
}

export const TEX_TYPES: { id: TextureType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'grain', label: 'Film Grain' },
  { id: 'paper', label: 'Paper Weave' },
  { id: 'halftone', label: 'Halftone' },
  { id: 'riso', label: 'Riso Dust' },
  { id: 'scan', label: 'Scanlines' },
  { id: 'custom', label: 'Custom Pic' },
  { id: 'video', label: 'Video Loop' }
];

export const BLENDS: { id: BlendMode; label: string }[] = [
  { id: 'soft-light', label: 'Soft Light' },
  { id: 'hard-light', label: 'Hard Light' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'color-dodge', label: 'Color Dodge' },
  { id: 'difference', label: 'Difference' },
  { id: 'source-over', label: 'Normal' }
];
