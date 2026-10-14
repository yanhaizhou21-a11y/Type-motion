import { TextureConfig, TextureType } from '../types';
import { rng, h } from './math';

export class TextureCompositor {
  private tiles: Partial<Record<TextureType, HTMLCanvasElement>> = {};

  public getTexTile(type: TextureType): HTMLCanvasElement | null {
    if (type === 'none' || type === 'custom' || type === 'video') return null;
    if (this.tiles[type]) return this.tiles[type]!;

    const sz = 256;
    let c: HTMLCanvasElement;
    if (typeof document !== 'undefined') {
      c = document.createElement('canvas');
    } else {
      c = {
        width: sz,
        height: sz,
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(sz * sz * 4) }),
          putImageData: () => {},
          fillRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {}
        }),
        toDataURL: () => 'data:image/png;base64,mock'
      } as unknown as HTMLCanvasElement;
    }
    c.width = sz;
    c.height = sz;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    const id = ctx.createImageData(sz, sz);
    const d = id.data;
    const r = rng(type.charCodeAt(0) * 1337 + 99);

    if (type === 'grain') {
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.floor(r() * 255);
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
    } else if (type === 'paper') {
      for (let y = 0; y < sz; y++) {
        for (let x = 0; x < sz; x++) {
          const i = (y * sz + x) * 4;
          const weave = Math.sin(x * 0.45) * 18 + Math.cos(y * 0.45) * 18;
          const fiber = (r() - 0.5) * 68;
          const v = Math.max(0, Math.min(255, Math.round(128 + weave + fiber)));
          d[i] = v;
          d[i + 1] = Math.max(0, v - 3);
          d[i + 2] = Math.max(0, v - 8);
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
    } else if (type === 'halftone') {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, sz, sz);
      const step = 8;
      for (let y = 0; y < sz; y += step) {
        for (let x = 0; x < sz; x += step) {
          const off = ((y / step) % 2) * (step / 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc((x + off) % sz, y, 2.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#181818';
          ctx.beginPath();
          ctx.arc((x + off + step / 2) % sz, (y + step / 2) % sz, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'riso') {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, sz, sz);
      for (let i = 0; i < 2400; i++) {
        const x = r() * sz;
        const y = r() * sz;
        const rad = 0.4 + r() * 1.9;
        ctx.fillStyle = r() > 0.35 ? 'rgba(255,255,255,0.85)' : 'rgba(15,15,15,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 45; i++) {
        const x = r() * sz;
        const y = r() * sz;
        const a = r() * Math.PI * 2;
        const len = 4 + r() * 14;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
    } else if (type === 'scan') {
      for (let y = 0; y < sz; y++) {
        const band = y % 4 === 0 ? 215 : y % 4 === 2 ? 45 : 128;
        for (let x = 0; x < sz; x++) {
          const i = (y * sz + x) * 4;
          const n = (r() - 0.5) * 26;
          const v = Math.max(0, Math.min(255, Math.round(band + n)));
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
    }

    this.tiles[type] = c;
    return c;
  }

  public applyTextureOverlay(
    g: CanvasRenderingContext2D,
    W: number,
    H: number,
    now: number,
    tx: TextureConfig,
    isStillPic = false
  ): void {
    if (!tx) return;

    if (tx.type !== 'none' && tx.opacity > 0.005) {
      let src: CanvasImageSource | null = null;
      if (tx.type === 'custom') {
        src = tx.customImg;
      } else if (tx.type === 'video') {
        src = tx.videoEl && tx.videoEl.readyState >= 2 ? tx.videoEl : null;
      } else {
        src = this.getTexTile(tx.type);
      }

      if (src) {
        g.save();
        g.globalCompositeOperation = tx.blend || 'soft-light';
        g.globalAlpha = Math.max(0, Math.min(1, tx.opacity));

        const sc = Math.max(0.25, tx.scale || 1);
        const animOn = tx.animate && !isStillPic;
        const f = animOn ? Math.floor((now || 0) / 90) : 0;
        const ox = animOn ? h(f * 3.17) * 180 : 0;
        const oy = animOn ? h(f * 7.91) * 180 : 0;

        if (tx.type === 'video' || (tx.type === 'custom' && sc >= 1.8)) {
          const sw = (src as HTMLVideoElement).videoWidth || (src as HTMLImageElement).width || W;
          const sh = (src as HTMLVideoElement).videoHeight || (src as HTMLImageElement).height || H;
          const cov = Math.max(W / sw, H / sh) * (tx.type === 'video' ? sc : 1);
          const dw = sw * cov;
          const dh = sh * cov;
          g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
        } else {
          const pat = g.createPattern(src, 'repeat');
          if (pat) {
            if (pat.setTransform && typeof DOMMatrix !== 'undefined') {
              const m = new DOMMatrix();
              m.translateSelf(ox, oy);
              m.scaleSelf(sc, sc);
              pat.setTransform(m);
              g.fillStyle = pat;
              g.fillRect(0, 0, W, H);
            } else {
              g.translate(ox, oy);
              g.scale(sc, sc);
              g.fillStyle = pat;
              g.fillRect(-ox / sc, -oy / sc, W / sc + 256, H / sc + 256);
            }
          }
        }
        g.restore();
      }
    }

    if (tx.vignette > 0.01) {
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = Math.min(1, tx.vignette);
      const cx = W / 2;
      const cy = H / 2;
      const r0 = Math.min(W, H) * 0.28;
      const r1 = Math.hypot(cx, cy);
      const grad = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0.22)');
      grad.addColorStop(1, 'rgba(0,0,0,0.88)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  }

  public getTextureSvgElements(
    tx: TextureConfig,
    W: number,
    H: number
  ): { defs: string; rects: string } {
    let defs = '';
    let rects = '';
    if (!tx || tx.type === 'none' || tx.opacity <= 0.005 || tx.type === 'video') {
      return { defs, rects };
    }

    const src = tx.type === 'custom' ? tx.customImg : this.getTexTile(tx.type);
    const dataUrl =
      tx.type === 'custom'
        ? tx.customUrl
        : typeof (src as HTMLCanvasElement).toDataURL === 'function'
        ? (src as HTMLCanvasElement).toDataURL('image/png')
        : '';
    if (!dataUrl) return { defs, rects };

    const sc = Math.max(0.25, tx.scale || 1);
    const sw = Math.round(((src as HTMLCanvasElement).width || 256) * sc);
    const sh = Math.round(((src as HTMLCanvasElement).height || 256) * sc);

    defs = `<pattern id="tg-tex-pat" patternUnits="userSpaceOnUse" width="${sw}" height="${sh}"><image href="${dataUrl}" width="${sw}" height="${sh}"/></pattern>`;
    rects = `<rect width="${W}" height="${H}" fill="url(#tg-tex-pat)" opacity="${tx.opacity.toFixed(2)}" style="mix-blend-mode:${tx.blend || 'soft-light'}"/>`;

    if (tx.vignette > 0.01) {
      defs += `<radialGradient id="tg-vig-grad" cx="50%" cy="50%" r="70%"><stop offset="28%" stop-color="#fff" stop-opacity="0"/><stop offset="65%" stop-color="#000" stop-opacity="0.22"/><stop offset="100%" stop-color="#000" stop-opacity="0.88"/></radialGradient>`;
      rects += `<rect width="${W}" height="${H}" fill="url(#tg-vig-grad)" opacity="${tx.vignette.toFixed(2)}" style="mix-blend-mode:multiply"/>`;
    }

    return { defs, rects };
  }
}
