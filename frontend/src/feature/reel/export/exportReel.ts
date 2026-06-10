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

  // Always finalize through ffmpeg: even native MP4 from MediaRecorder is a
  // fragmented, audio-less file that WhatsApp/Instagram reject. finalizeMp4
  // remuxes (or re-encodes WebM) to a faststart H.264 MP4 with silent audio.
  try {
    opts.onPhase?.('transcoding');
    const { finalizeMp4 } = await import('./transcodeToMp4');
    const mp4 = await finalizeMp4(blob, isMp4, opts.onProgress);
    return { url: URL.createObjectURL(mp4), ext: 'mp4' };
  } catch {
    // ffmpeg unavailable/failed — hand back the raw recording so there's still a file.
    return { url: URL.createObjectURL(blob), ext: isMp4 ? 'mp4' : 'webm' };
  }
}
