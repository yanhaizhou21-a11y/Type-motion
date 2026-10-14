import { processPixelsFloodFill } from './worker';

let bgWorker: Worker | null = null;
let msgId = 0;
const callbacks = new Map<number, (buf: ArrayBuffer) => void>();

function getBgWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!bgWorker) {
    try {
      bgWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      bgWorker.onmessage = (e: MessageEvent) => {
        const { type, id, buffer } = e.data;
        if (type === 'remove_bg_done') {
          const cb = callbacks.get(id);
          if (cb) {
            callbacks.delete(id);
            cb(buffer);
          }
        }
      };
    } catch {
      bgWorker = null;
    }
  }
  return bgWorker;
}

export async function removeBackgroundOffscreen(
  rawImg: HTMLImageElement,
  tol = 38,
  maxDim = 512
): Promise<string> {
  const sc = Math.min(1, maxDim / Math.max(rawImg.width || 256, rawImg.height || 256));
  const w = Math.max(1, Math.round((rawImg.width || 256) * sc));
  const h = Math.max(1, Math.round((rawImg.height || 256) * sc));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawImg.src;

  ctx.drawImage(rawImg, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);

  const worker = getBgWorker();
  if (worker) {
    const id = ++msgId;
    const buffer = imgData.data.buffer.slice(0);
    const processedBuffer = await new Promise<ArrayBuffer>((resolve) => {
      callbacks.set(id, resolve);
      worker.postMessage(
        { type: 'remove_bg', id, buffer, w, h, tol, feather: 18 },
        [buffer]
      );
    });
    const clamped = new Uint8ClampedArray(processedBuffer);
    const finalData = new ImageData(clamped, w, h);
    ctx.putImageData(finalData, 0, 0);
  } else {
    processPixelsFloodFill(imgData.data, w, h, tol, 18, 'flood');
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toDataURL('image/png');
}
