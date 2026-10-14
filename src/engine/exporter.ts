import { computeCrc32 } from './math';
import { buildZipArchive } from './worker';

export { computeCrc32 };

export function triggerDownload(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function detectSupportedVideoMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm'
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

export function createZipArchive(files: { name: string; data: Uint8Array }[]): Blob {
  const normalized = files.map((f) => {
    if (f.data.byteOffset === 0 && f.data.byteLength === f.data.buffer.byteLength) {
      return f;
    }
    return {
      name: f.name,
      data: new Uint8Array(f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength))
    };
  });
  const zipBytes = buildZipArchive(normalized);
  return new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
}

export async function exportCanvasVideo(
  renderFrameAtTime: (timeMs: number) => void,
  width: number,
  height: number,
  durationMs: number,
  fps: number,
  mimeType: string,
  onProgress?: (pct: number) => void
): Promise<{ blob: Blob; ext: string }> {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const stream = (c as unknown as { captureStream?(fps: number): MediaStream }).captureStream
    ? (c as unknown as { captureStream(fps: number): MediaStream }).captureStream(fps)
    : null;

  if (!stream) {
    throw new Error('Canvas captureStream is not supported in this browser.');
  }

  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 16e6
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);

  const donePromise = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });

  renderFrameAtTime(0);
  rec.start();

  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const t0 = performance.now();

  for (let i = 0; i < totalFrames; i++) {
    const timeMs = (i * 1000) / fps;
    renderFrameAtTime(timeMs);
    if (track && (track as unknown as { requestFrame?(): void }).requestFrame) {
      (track as unknown as { requestFrame(): void }).requestFrame();
    }
    if (i % 10 === 0 && onProgress) {
      onProgress(Math.round((i / totalFrames) * 100));
    }
    const target = t0 + ((i + 1) * 1000) / fps;
    await wait(Math.max(0, target - performance.now()));
  }

  rec.stop();
  await donePromise;

  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const cleanMime = mimeType.split(';')[0];
  return {
    blob: new Blob(chunks, { type: cleanMime }),
    ext
  };
}

export async function exportCanvasFramesZip(
  renderFrameAtTime: (timeMs: number) => void,
  width: number,
  height: number,
  durationMs: number,
  fps: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;

  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const files: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const timeMs = (i * 1000) / fps;
    renderFrameAtTime(timeMs);
    const b = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
    if (b) {
      const arr = new Uint8Array(await b.arrayBuffer());
      const frameName = `frame_${String(i + 1).padStart(4, '0')}.png`;
      files.push({ name: frameName, data: arr });
    }
    if (i % 8 === 0 && onProgress) {
      onProgress(Math.round((i / totalFrames) * 100));
    }
  }

  return createZipArchive(files);
}
