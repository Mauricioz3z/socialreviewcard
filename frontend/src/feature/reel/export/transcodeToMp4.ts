import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

async function getFfmpeg(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  const ff = new FFmpeg();
  if (onProgress) ff.on('progress', ({ progress }) => onProgress(progress));
  // Single-threaded core: no SharedArrayBuffer, so NO COOP/COEP headers needed
  // (those would break Google sign-in / Stripe / fonts on the rest of the site).
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  await ff.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpeg = ff;
  return ff;
}

/** Transcodes a (WebM) blob to a widely-compatible H.264 MP4, entirely client-side. */
export async function webmToMp4(input: Blob, onProgress?: (p: number) => void): Promise<Blob> {
  const ff = await getFfmpeg(onProgress);
  await ff.writeFile('in.webm', await fetchFile(input));
  await ff.exec([
    '-i', 'in.webm',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p', // required for iOS / Instagram playback
    '-movflags', '+faststart',
    'out.mp4',
  ]);
  const data = await ff.readFile('out.mp4');
  // Copy into a fresh ArrayBuffer-backed view (readFile may return a SharedArrayBuffer view).
  const bytes = new Uint8Array(data as Uint8Array);
  return new Blob([bytes], { type: 'video/mp4' });
}
