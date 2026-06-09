import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, X } from 'lucide-react';
import { exportReel } from './export/exportReel';
import { bohoBotanicalV1 } from './theme/presets';
import { createThemeScene, loadThemeAssets } from './theme/themeScene';
import type { ReelTheme } from './theme/schema';

type Status = 'loading' | 'idle' | 'recording' | 'transcoding' | 'done' | 'error';

export function ReelModal({
  cardImageUrl,
  onClose,
  theme = bohoBotanicalV1,
}: {
  cardImageUrl: string;
  onClose: () => void;
  theme?: ReelTheme;
}) {
  const W = theme.dimensions.width;
  const H = theme.dimensions.height;
  const DURATION = theme.totalDurationMs;
  const FPS = theme.fps ?? 30;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
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
        const [blob, assets] = await Promise.all([
          fetch(cardImageUrl).then((r) => r.blob()),
          loadThemeAssets(theme),
        ]);
        const bmp = await createImageBitmap(blob);
        if (cancelled) return;
        bitmapRef.current = bmp;
        assetsRef.current = assets;
        setStatus('idle');

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const scene = createThemeScene(ctx, theme, bmp, assets);
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
  }, [cardImageUrl, theme]);

  const onExport = async () => {
    const canvas = canvasRef.current;
    const bmp = bitmapRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !bmp || !ctx) return;

    stopPreview();
    setProgress(0);
    setStatus('recording');
    const scene = createThemeScene(ctx, theme, bmp, assetsRef.current);
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
