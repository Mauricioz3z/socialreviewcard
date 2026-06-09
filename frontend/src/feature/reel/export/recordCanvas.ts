export interface RecordOpts {
  canvas: HTMLCanvasElement;
  durationMs: number;
  fps?: number;
  drawFrame: (tMs: number) => void;
  onProgress?: (p: number) => void;
}

/** Prefers native MP4/H.264 (Safari 17+/iOS, Chrome 130+); falls back to WebM. */
export function pickMimeType(): { mime: string; isMp4: boolean } {
  const candidates = [
    'video/mp4;codecs=avc1.640028',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return { mime, isMp4: mime.startsWith('video/mp4') };
    }
  }
  return { mime: '', isMp4: false };
}

/**
 * Records a canvas to a video blob in real time. The animation is driven by rAF
 * and captured via captureStream(fps) — the most cross-browser approach (works
 * on iOS Safari, which lacks reliable manual frame-stepping).
 */
export async function recordCanvas(opts: RecordOpts): Promise<{ blob: Blob; isMp4: boolean }> {
  const fps = opts.fps ?? 30;
  const { mime, isMp4 } = pickMimeType();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream: MediaStream = (opts.canvas as any).captureStream(fps);
  const rec = new MediaRecorder(stream, {
    mimeType: mime || undefined,
    videoBitsPerSecond: 12_000_000,
  });

  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
  });

  rec.start();

  await new Promise<void>((resolve) => {
    const start = performance.now();
    const loop = (now: number) => {
      const t = now - start;
      opts.drawFrame(Math.min(t, opts.durationMs));
      opts.onProgress?.(Math.min(t / opts.durationMs, 1));
      if (t < opts.durationMs) requestAnimationFrame(loop);
      else resolve();
    };
    requestAnimationFrame(loop);
  });

  // Give the encoder a beat to flush the last frames before stopping.
  await new Promise((r) => setTimeout(r, 120));
  rec.stop();
  return { blob: await stopped, isMp4 };
}
