import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { ReviewCard } from './ReviewCard';
import { NOISE, RATIOS, type BackgroundConfig } from '../lib/config';
import type { CardData } from '../types';

interface CanvasProps {
  data: CardData;
  bg: BackgroundConfig;
  grain: boolean;
}

/**
 * The full-resolution card canvas (background + blooms + grain + card) rendered
 * at its natural pixel dimensions with no transform — ideal for image export.
 */
export const CardCanvas = forwardRef<HTMLDivElement, CanvasProps>(({ data, bg, grain }, ref) => {
  const ratio = RATIOS[data.ratio];
  const inset = data.ratio === 'square' ? 30 : 28;

  return (
    <div
      ref={ref}
      className="relative overflow-hidden"
      style={{
        width: ratio.w,
        height: ratio.h,
        background: bg.css,
        borderRadius: 18,
        boxShadow: '0 40px 120px -30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* soft light blooms for gradient depth */}
      {bg.type === 'gradient' && (
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
      {grain && (
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
        <ReviewCard data={data} />
      </div>
    </div>
  );
});

CardCanvas.displayName = 'CardCanvas';

/** Scales the card canvas to fit the available preview area. */
export function Preview({ data, bg, grain }: CanvasProps) {
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
          <CardCanvas data={data} bg={bg} grain={grain} />
        </div>
      </div>
    </div>
  );
}
