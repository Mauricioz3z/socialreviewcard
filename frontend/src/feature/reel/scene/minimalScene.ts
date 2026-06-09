/**
 * Phase-1 minimal scene: an animated pastel gradient background + the rasterized
 * review card with an intro reveal and a slow continuous zoom-in. Returns a
 * drawFrame(tMs) closure consumed by both the live preview and the recorder.
 */
export function createMinimalScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  card: ImageBitmap,
  durationMs: number,
) {
  const fit = Math.min((w * 0.82) / card.width, (h * 0.82) / card.height);
  const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

  return (tMs: number) => {
    const t = tMs / 1000;

    // Layer 1 — drifting gradient.
    const drift = Math.sin(t * 0.5) * 0.5 + 0.5;
    const g = ctx.createLinearGradient(0, h * (0.08 + drift * 0.12), w, h * (0.92 - drift * 0.12));
    g.addColorStop(0, '#ffdca8');
    g.addColorStop(0.5, '#ff9aa2');
    g.addColorStop(1, '#c8a2e0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // soft vignette for depth
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // Layer 2 — card: intro reveal (fade + slide) then continuous zoom.
    const intro = easeOutCubic(Math.min(tMs / 650, 1));
    const zoom = 1 + 0.09 * easeOutCubic(Math.min(tMs / durationMs, 1));
    const scale = fit * zoom;
    const cw = card.width * scale;
    const ch = card.height * scale;

    ctx.save();
    ctx.globalAlpha = intro;
    ctx.translate(w / 2, h / 2 + (1 - intro) * 60);
    // drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;
    ctx.drawImage(card, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  };
}
