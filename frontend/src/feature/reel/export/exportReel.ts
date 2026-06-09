import { recordCanvas } from './recordCanvas';

export type ReelPhase = 'recording' | 'transcoding';

export interface ExportReelOpts {
  canvas: HTMLCanvasElement;
  durationMs: number;
  fps?: number;
  drawFrame: (tMs: number) => void;
  onProgress?: (p: number) => void;
  onPhase?: (phase: ReelPhase) => void;
}

/**
 * Records the canvas and returns a downloadable video. Uses native MP4 when the
 * browser supports it (iOS Safari, Chrome); otherwise records WebM and transcodes
 * to MP4 with ffmpeg.wasm (lazy-loaded so it stays out of the main bundle).
 */
export async function exportReel(opts: ExportReelOpts): Promise<{ url: string; ext: 'mp4' | 'webm' }> {
  opts.onPhase?.('recording');
  const { blob, isMp4 } = await recordCanvas({
    canvas: opts.canvas,
    durationMs: opts.durationMs,
    fps: opts.fps,
    drawFrame: opts.drawFrame,
    onProgress: opts.onProgress,
  });

  if (isMp4) return { url: URL.createObjectURL(blob), ext: 'mp4' };

  // WebM path → transcode to MP4 for compatibility.
  try {
    opts.onPhase?.('transcoding');
    const { webmToMp4 } = await import('./transcodeToMp4');
    const mp4 = await webmToMp4(blob, opts.onProgress);
    return { url: URL.createObjectURL(mp4), ext: 'mp4' };
  } catch {
    // Transcode failed/unavailable — hand back the WebM so the user still gets a file.
    return { url: URL.createObjectURL(blob), ext: 'webm' };
  }
}
