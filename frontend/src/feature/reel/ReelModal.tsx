import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, X } from 'lucide-react';
import { exportReel } from './export/exportReel';
import { bohoBotanicalV1 } from './theme/presets';
import { createThemeScene, loadThemeAssets, type CardLayers } from './theme/themeScene';
import type { ReelTheme } from './theme/schema';

type Status = 'loading' | 'idle' | 'recording' | 'transcoding' | 'done' | 'error';

async function bmpFromUrl(url: string): Promise<ImageBitmap> {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob);
}

/** Bounding-box centroid of the opaque pixels (used to pop the stars in place). */
function alphaCentroid(bmp: ImageBitmap): { x: number; y: number } | null {
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const cx = c.getContext('2d');
  if (!cx) return null;
  cx.drawImage(bmp, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = cx.getImageData(0, 0, c.width, c.height).data;
  } catch {
    return null;
  }
  let minX = c.width;
  let minY = c.height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      if (data[(y * c.width + x) * 4 + 3] > 12) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return found ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : null;
}

/** Segments the stars row into per-star boxes by detecting column gaps. */
function starRectsFromBitmap(bmp: ImageBitmap): { x: number; y: number; w: number; h: number }[] {
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const cx = c.getContext('2d');
  if (!cx) return [];
  cx.drawImage(bmp, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = cx.getImageData(0, 0, c.width, c.height).data;
  } catch {
    return [];
  }
  const W = c.width;
  const H = c.height;
  const colOpaque: boolean[] = new Array(W).fill(false);
  let minY = H;
  let maxY = 0;
  for (let x = 0; x < W; x++) {
    let op = false;
    for (let y = 0; y < H; y += 2) {
      if (data[(y * W + x) * 4 + 3] > 16) {
        op = true;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    colOpaque[x] = op;
  }
  const gapThresh = Math.max(3, Math.floor(W * 0.004));
  const runs: [number, number][] = [];
  let runStart = -1;
  let empty = 0;
  for (let x = 0; x < W; x++) {
    if (colOpaque[x]) {
      if (runStart < 0) runStart = x;
      empty = 0;
    } else if (runStart >= 0) {
      empty++;
      if (empty >= gapThresh) {
        runs.push([runStart, x - empty]);
        runStart = -1;
        empty = 0;
      }
    }
  }
  if (runStart >= 0) runs.push([runStart, W - 1]);
  const bandH = Math.max(1, maxY - minY);
  return runs
    .filter(([a, b]) => b - a > 2)
    .map(([a, b]) => ({ x: a / W, y: minY / H, w: (b - a) / W, h: bandH / H }));
}

export function ReelModal({
  layers,
  onClose,
  theme = bohoBotanicalV1,
}: {
  layers: { base: string; stars: string; text: string; wordRects: { x: number; y: number; w: number; h: number }[] };
  onClose: () => void;
  theme?: ReelTheme;
}) {
  const W = theme.dimensions.width;
  const H = theme.dimensions.height;
  const DURATION = theme.totalDurationMs;
  const FPS = theme.fps ?? 30;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<CardLayers | null>(null);
  const assetsRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; ext: string } | null>(null);

  const stopPreview = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  // Load the rasterized card, then run a looping live preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [assets, base, stars, text] = await Promise.all([
          loadThemeAssets(theme),
          bmpFromUrl(layers.base),
          bmpFromUrl(layers.stars),
          bmpFromUrl(layers.text),
        ]);
        if (cancelled) return;
        const card: CardLayers = {
          base,
          stars,
          text,
          starsCenter: alphaCentroid(stars),
          starRects: starRectsFromBitmap(stars),
          wordRects: layers.wordRects,
        };
        cardRef.current = card;
        assetsRef.current = assets;
        setStatus('idle');

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const scene = createThemeScene(ctx, theme, card, assets);
        const start = performance.now();
        const loop = (now: number) => {
          scene((now - start) % DURATION);
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      stopPreview();
    };
  }, [layers, theme]);

  const onExport = async () => {
    const canvas = canvasRef.current;
    const card = cardRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !card || !ctx) return;

    stopPreview();
    setProgress(0);
    setStatus('recording');
    const scene = createThemeScene(ctx, theme, card, assetsRef.current);
    try {
      const out = await exportReel({
        canvas,
        durationMs: DURATION,
        fps: FPS,
        drawFrame: scene,
        onProgress: setProgress,
        onPhase: (p) => setStatus(p),
      });
      setResult(out);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const busy = status === 'recording' || status === 'transcoding';

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-sm p-4 font-ui">
      <div className="w-full max-w-[920px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
        {/* preview / result */}
        <div className="bg-zinc-950 grid place-items-center p-5 md:w-[58%]">
          {result ? (
            <video
              src={result.url}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[70vh] rounded-xl"
              style={{ aspectRatio: '9 / 16' }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="max-h-[70vh] rounded-xl"
              style={{ width: 'auto', aspectRatio: '9 / 16' }}
            />
          )}
        </div>

        {/* controls */}
        <div className="p-6 md:w-[42%] flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent text-white">
                <Clapperboard size={16} strokeWidth={2.2} />
              </span>
              <h2 className="font-bold text-[16px]">Animate to video</h2>
            </div>
            <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
              <X size={18} />
            </button>
          </div>
          <p className="text-[13px] text-zinc-500 mb-5">
            A 6-second vertical clip (1080×1920) ready for Reels and Stories — rendered on your device.
          </p>

          {status === 'loading' && (
            <div className="flex items-center gap-2 text-[13px] text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Preparing preview…
            </div>
          )}

          {status === 'error' && (
            <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Something went wrong rendering the video. Try again.
            </div>
          )}

          {busy && (
            <div>
              <div className="flex items-center justify-between text-[12.5px] text-zinc-500 mb-1.5">
                <span>{status === 'recording' ? 'Recording…' : 'Encoding MP4…'}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="mt-3 text-[12px] text-zinc-400">Keep this tab in the foreground while it renders.</p>
            </div>
          )}

          <div className="mt-auto pt-6 space-y-2">
            {result ? (
              <>
                <a
                  href={result.url}
                  download={`socialreviewcard-reel.${result.ext}`}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-900 text-white text-[14.5px] font-semibold hover:bg-zinc-800 transition"
                >
                  <Download size={18} /> Download .{result.ext}
                </a>
                <p className="text-center text-[11.5px] text-zinc-400">
                  On iPhone: tap the video → share/save to Photos.
                </p>
                <button
                  onClick={() => {
                    setResult(null);
                    setStatus('idle');
                  }}
                  className="w-full h-10 text-[13px] text-zinc-500 hover:text-zinc-700"
                >
                  Render again
                </button>
              </>
            ) : (
              <button
                onClick={onExport}
                disabled={status !== 'idle'}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-white text-[14.5px] font-semibold hover:bg-accent-hover transition disabled:opacity-60"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Clapperboard size={18} />} Export video
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
