import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { ReviewCard, type CardLayer } from './ReviewCard';
import { NOISE, RATIOS, type BackgroundConfig } from '../lib/config';
import type { CardData, PlatformDisplay } from '../types';

interface CanvasProps {
  data: CardData;
  bg: BackgroundConfig;
  grain: boolean;
  /** Resolved display config for the card's platform. */
  platform: PlatformDisplay;
  /** When set, stamps a repeating diagonal watermark (free plan). */
  watermark?: string | null;
  /** Renders a single layer (transparent for stars/text) for video animation. */
  layer?: CardLayer;
}

/**
 * Repeating diagonal watermark covering the whole canvas. The tile is horizontal
 * text; the oversized layer is rotated so it reads as diagonal rows, and the
 * card's overflow:hidden clips it — making it hard to crop out cleanly.
 */
function Watermark({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* footer credit only — the free card stays clean enough to actually post */}
      <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <span
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: 'rgba(255,255,255,0.95)',
            background: 'rgba(0,0,0,0.36)',
            padding: '4px 11px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          Made with {text}
        </span>
      </div>
    </div>
  );
}

/**
 * The full-resolution card canvas (background + blooms + grain + card) rendered
 * at its natural pixel dimensions with no transform — ideal for image export.
 */
export const CardCanvas = forwardRef<HTMLDivElement, CanvasProps>(({ data, bg, grain, platform, watermark, layer }, ref) => {
  const ratio = RATIOS[data.ratio];
  const inset = data.ratio === 'square' ? 30 : 28;
  // Stars/text layers render fully transparent so they stack over the base.
  const transparent = layer === 'stars' || layer === 'text';

  return (
    <div
      ref={ref}
      className="relative overflow-hidden"
      style={{
        width: ratio.w,
        height: ratio.h,
        background: transparent ? 'transparent' : bg.css,
        borderRadius: 18,
        boxShadow: transparent ? 'none' : '0 40px 120px -30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* soft light blooms for gradient depth */}
      {!transparent && bg.type === 'gradient' && (
        <>
          <div
            className="absolute rounded-full"
            style={{
              width: 320,
              height: 320,
              top: -80,
              right: -60,
              background: 'radial-gradient(circle, rgba(255,255,255,0.32), transparent 70%)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 260,
              height: 260,
              bottom: -70,
              left: -50,
              background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)',
            }}
          />
        </>
      )}
      {!transparent && grain && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: NOISE,
            backgroundSize: '180px',
            opacity: 0.22,
            mixBlendMode: bg.tone === 'dark' ? 'screen' : 'multiply',
          }}
        />
      )}
      <div className="absolute" style={{ inset }}>
        <ReviewCard data={data} platform={platform} layer={layer} />
      </div>
      {!transparent && watermark && <Watermark text={watermark} />}
    </div>
  );
});

CardCanvas.displayName = 'CardCanvas';

/** Scales the card canvas to fit the available preview area. */
export function Preview({ data, bg, grain, platform, watermark }: CanvasProps) {
  const ratio = RATIOS[data.ratio];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const padX = 96;
      const padY = 96;
      const aw = el.clientWidth - padX;
      const ah = el.clientHeight - padY;
      const s = Math.min(aw / ratio.w, ah / ratio.h);
      setScale(Math.max(0.1, Math.min(s, 1.3)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio.w, ratio.h]);

  return (
    <div ref={wrapRef} className="relative flex-1 grid place-items-center overflow-hidden">
      <div style={{ width: ratio.w * scale, height: ratio.h * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <CardCanvas data={data} bg={bg} grain={grain} platform={platform} watermark={watermark} />
        </div>
      </div>
    </div>
  );
}
