import type { BackgroundSpec, ForegroundAsset, ReelTheme, TransformOrigin } from './schema';

/** Rectangle normalized to 0..1 of the card bitmap. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The card rasterized into independently-animatable layers. */
export interface CardLayers {
  base: ImageBitmap; // container + platform + footer (no stars/text)
  stars?: ImageBitmap | null;
  text?: ImageBitmap | null;
  /** Centroid of the stars (in base-bitmap px) — fallback group pop. */
  starsCenter?: { x: number; y: number } | null;
  /** Per-star boxes for staggered pop (segmented from the stars layer). */
  starRects?: NormRect[] | null;
  /** Per-word boxes for staggered text reveal (measured from the DOM). */
  wordRects?: NormRect[] | null;
}

/* ----------------------------- timing primitives ----------------------------- */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
/** Overshooting ease for "scale-up-bounce". */
const backOut = (x: number, s = 1.70158) => {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
};
const TAU = Math.PI * 2;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Progress (0..1) of a step that starts at delayMs and lasts durationMs. */
const stepProgress = (tMs: number, delayMs: number, durationMs = 700) =>
  clamp01((tMs - delayMs) / durationMs);

/* ----------------------------- asset loading ----------------------------- */
/** Loads foreground assets as decoded <img> (cross-browser, incl. SVG). */
export async function loadThemeAssets(theme: ReelTheme): Promise<Record<string, HTMLImageElement>> {
  const out: Record<string, HTMLImageElement> = {};
  await Promise.all(
    (theme.foregroundAssets ?? []).map(async (a) => {
      try {
        const img = new Image();
        img.src = a.url;
        await img.decode();
        out[a.id] = img;
      } catch {
        /* asset missing — skip it, the scene still renders */
      }
    }),
  );
  return out;
}

/* ----------------------------- drawing helpers ----------------------------- */
function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: BackgroundSpec, tMs: number) {
  if (bg.type === 'solid' || bg.colors.length === 1) {
    ctx.fillStyle = bg.colors[0] ?? '#000';
    ctx.fillRect(0, 0, w, h);
  } else {
    // Drift the gradient endpoints along a slow circular path.
    const phase = bg.shiftSpeedMs ? (tMs % bg.shiftSpeedMs) / bg.shiftSpeedMs : 0;
    const a = rad((bg.angleDeg ?? 135) + phase * 360);
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.hypot(w, h) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    bg.colors.forEach((c, i) => g.addColorStop(i / (bg.colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (bg.vignette) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${bg.vignette})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}

function originPoint(x: number, y: number, w: number, h: number, o: TransformOrigin = 'center') {
  const map: Record<TransformOrigin, [number, number]> = {
    center: [x + w / 2, y + h / 2],
    'top-left': [x, y],
    'top-right': [x + w, y],
    'bottom-left': [x, y + h],
    'bottom-right': [x + w, y + h],
  };
  return map[o];
}

function paintAsset(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spec: ForegroundAsset,
  img: HTMLImageElement,
  tMs: number,
) {
  const t = tMs / 1000;
  // resolve size (preserve aspect when one dimension is given)
  let w = spec.size?.width ?? img.naturalWidth;
  let h = spec.size?.height ?? img.naturalHeight;
  if (spec.size?.width && !spec.size?.height) h = (img.naturalHeight / img.naturalWidth) * w;
  if (spec.size?.height && !spec.size?.width) w = (img.naturalWidth / img.naturalHeight) * h;

  const x = spec.position.left != null ? spec.position.left : W - (spec.position.right ?? 0) - w;
  const y = spec.position.top != null ? spec.position.top : H - (spec.position.bottom ?? 0) - h;

  const [px, py] = originPoint(x, y, w, h, spec.transformOrigin);

  ctx.save();
  ctx.globalAlpha = spec.opacity ?? 1;
  ctx.translate(px, py);
  // static base transform
  if (spec.rotationDeg) ctx.rotate(rad(spec.rotationDeg));
  if (spec.flipX) ctx.scale(-1, 1);
  // continuous animation
  const an = spec.animation;
  if (an?.type === 'sway') {
    ctx.rotate(rad(an.maxRotationDeg) * Math.sin(TAU * an.frequencyHz * t + (an.phase ?? 0)));
  } else if (an?.type === 'float') {
    ctx.translate(0, an.amplitudePx * Math.sin(TAU * an.frequencyHz * t + (an.phase ?? 0)));
  }
  ctx.translate(-px, -py);
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

/* ----------------------------- the engine ----------------------------- */
/**
 * Builds a drawFrame(tMs) closure from a ReelTheme + the rasterized card + loaded
 * assets. The same closure powers the live preview and the recorder, so what you
 * see is exactly what you export.
 */
export function createThemeScene(
  ctx: CanvasRenderingContext2D,
  theme: ReelTheme,
  layers: CardLayers,
  assets: Record<string, HTMLImageElement>,
) {
  const W = theme.dimensions.width;
  const H = theme.dimensions.height;
  const fit = (theme.cardContainer.fitScale ?? 0.82);
  const baseFit = Math.min((W * fit) / layers.base.width, (H * fit) / layers.base.height);
  const behind = (theme.foregroundAssets ?? []).filter((a) => (a.layer ?? 'behind-card') === 'behind-card');
  const front = (theme.foregroundAssets ?? []).filter((a) => a.layer === 'front-card');
  const cc = theme.cardContainer;

  return (tMs: number) => {
    paintBackground(ctx, W, H, theme.background, tMs);
    for (const a of behind) if (assets[a.id]) paintAsset(ctx, W, H, a, assets[a.id], tMs);

    // ---- card container ----
    const p = stepProgress(tMs, cc.entranceDelayMs, cc.entranceDurationMs ?? 700);
    let entranceScale = 1;
    let alpha = 1;
    let offsetY = 0;
    switch (cc.entranceAnimation) {
      case 'scale-up-bounce':
        entranceScale = p <= 0 ? 0 : backOut(p);
        alpha = easeOutCubic(p);
        break;
      case 'fade-up':
        alpha = easeOutCubic(p);
        offsetY = (1 - easeOutCubic(p)) * 80;
        break;
      case 'fade':
        alpha = easeOutCubic(p);
        break;
    }
    const parallax =
      cc.continuousAnimation && cc.continuousAnimation.type === 'slow-parallax-zoom'
        ? 1 + (cc.continuousAnimation.maxScale - 1) * easeOutCubic(clamp01(tMs / theme.totalDurationMs))
        : 1;

    const scale = baseFit * entranceScale * parallax;
    if (scale > 0.0001 && alpha > 0.001) {
      const bw = layers.base.width;
      const bh = layers.base.height;
      ctx.save();
      ctx.translate(W / 2, H / 2 + offsetY);
      ctx.scale(scale, scale); // work in card-local pixels so layers stay aligned

      // base (with shadow)
      ctx.save();
      ctx.globalAlpha = alpha;
      if (cc.shadow !== false) {
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = 60 / scale;
        ctx.shadowOffsetY = 28 / scale;
      }
      ctx.drawImage(layers.base, -bw / 2, -bh / 2);
      ctx.restore();

      // stars — per-star staggered pop (falls back to a group pop)
      const sr = theme.contentTimeline?.starsReveal;
      if (layers.stars) {
        const stars = layers.stars;
        if (sr && layers.starRects && layers.starRects.length > 1) {
          const stagger = sr.staggerMs ?? 120;
          const dur = sr.durationMs ?? 360;
          layers.starRects.forEach((r, i) => {
            const sp = stepProgress(tMs, sr.delayMs + i * stagger, dur);
            if (sp <= 0) return;
            const pop = backOut(sp);
            const sx = r.x * bw;
            const sy = r.y * bh;
            const sw = r.w * bw;
            const sh = r.h * bh;
            const cxp = sx + sw / 2 - bw / 2;
            const cyp = sy + sh / 2 - bh / 2;
            ctx.save();
            ctx.globalAlpha = alpha * clamp01(sp * 1.6);
            ctx.translate(cxp, cyp);
            ctx.scale(pop, pop);
            ctx.translate(-cxp, -cyp);
            ctx.drawImage(stars, sx, sy, sw, sh, sx - bw / 2, sy - bh / 2, sw, sh);
            ctx.restore();
          });
        } else {
          const sp = sr ? stepProgress(tMs, sr.delayMs, sr.durationMs ?? 450) : 1;
          if (sp > 0) {
            const pop = sr ? backOut(sp) : 1;
            const cx = (layers.starsCenter?.x ?? bw / 2) - bw / 2;
            const cy = (layers.starsCenter?.y ?? bh / 2) - bh / 2;
            ctx.save();
            ctx.globalAlpha = alpha * clamp01(sp * 1.6);
            ctx.translate(cx, cy);
            ctx.scale(pop, pop);
            ctx.translate(-cx, -cy);
            ctx.drawImage(stars, -bw / 2, -bh / 2);
            ctx.restore();
          }
        }
      }

      // text — per-word staggered fade-up (falls back to a block reveal)
      const tr = theme.contentTimeline?.textReveal;
      if (layers.text) {
        const text = layers.text;
        if (tr && layers.wordRects && layers.wordRects.length > 0) {
          const stagger = tr.staggerMs ?? 60;
          const dur = tr.durationMs ?? 420;
          const padX = bw * 0.005;
          const padY = bh * 0.004;
          layers.wordRects.forEach((r, i) => {
            const wp = easeOutCubic(stepProgress(tMs, tr.delayMs + i * stagger, dur));
            if (wp <= 0) return;
            const sx = Math.max(0, r.x * bw - padX);
            const sy = Math.max(0, r.y * bh - padY);
            const sw = r.w * bw + padX * 2;
            const sh = r.h * bh + padY * 2;
            ctx.save();
            ctx.globalAlpha = alpha * wp;
            ctx.translate(0, (1 - wp) * 30);
            ctx.drawImage(text, sx, sy, sw, sh, sx - bw / 2, sy - bh / 2, sw, sh);
            ctx.restore();
          });
        } else {
          const tp = tr ? easeOutCubic(stepProgress(tMs, tr.delayMs, tr.durationMs ?? 700)) : 1;
          if (tp > 0) {
            ctx.save();
            ctx.globalAlpha = alpha * tp;
            ctx.translate(0, (1 - tp) * 46);
            ctx.drawImage(text, -bw / 2, -bh / 2);
            ctx.restore();
          }
        }
      }

      ctx.restore();
    }

    for (const a of front) if (assets[a.id]) paintAsset(ctx, W, H, a, assets[a.id], tMs);
  };
}
