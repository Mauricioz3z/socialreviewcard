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

/**
 * Normalizes a recorded clip into a widely-compatible MP4 that WhatsApp,
 * Instagram and iOS accept: progressive (+faststart), H.264 yuv420p, and a
 * silent AAC audio track (players reject video-only/fragmented MP4s).
 * Native MP4 input is remuxed (-c:v copy, fast); WebM is re-encoded to H.264.
 */
export async function finalizeMp4(
  input: Blob,
  isMp4: boolean,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const ff = await getFfmpeg(onProgress);
  const inName = isMp4 ? 'in.mp4' : 'in.webm';
  await ff.writeFile(inName, await fetchFile(input));

  const videoArgs = isMp4
    ? ['-c:v', 'copy']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p'];

  await ff.exec([
    '-i', inName,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map', '0:v:0', '-map', '1:a:0',
    ...videoArgs,
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    'out.mp4',
  ]);

  const data = await ff.readFile('out.mp4');
  return new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });
}
