import type { BackgroundSpec, ForegroundAsset, ReelTheme, TransformOrigin } from './schema';

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
  card: ImageBitmap,
  assets: Record<string, HTMLImageElement>,
) {
  const W = theme.dimensions.width;
  const H = theme.dimensions.height;
  const fit = (theme.cardContainer.fitScale ?? 0.82);
  const baseFit = Math.min((W * fit) / card.width, (H * fit) / card.height);
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
      const cw = card.width * scale;
      const ch = card.height * scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, H / 2 + offsetY);
      if (cc.shadow !== false) {
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = 60;
        ctx.shadowOffsetY = 28;
      }
      ctx.drawImage(card, -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    }

    for (const a of front) if (assets[a.id]) paintAsset(ctx, W, H, a, assets[a.id], tMs);
  };
}
