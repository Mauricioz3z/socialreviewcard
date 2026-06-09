import type { ReelTheme } from './theme/schema';

/** A decorative asset placed by the user (positions are 0..1 of the 9:16 frame). */
export interface SceneAsset {
  url: string;
  xPct: number; // left edge
  yPct: number; // top edge
  widthPct: number; // width as fraction of frame width
  anim: 'sway' | 'float' | 'none';
  rotation?: number; // degrees, 0..360
  flipX?: boolean; // mirror horizontally
  layer?: 'front' | 'behind'; // relative to the card (default front)
}

/** Per-card animation scene the user composes and saves with their card. */
export interface UserScene {
  durationMs: number; // 4000..12000
  intensity: number; // 0..1 → sway/parallax/stagger
  palette: string[]; // gradient colors
  assets: SceneAsset[];
}

export const SCENE_PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Boho Cream', colors: ['#f4ebe1', '#e4d4c8', '#dfcdbe'] },
  { name: 'Sunset', colors: ['#ffdca8', '#ff9aa2', '#c8a2e0'] },
  { name: 'Aurora', colors: ['#13f1a8', '#19c8ff', '#8b6cff'] },
  { name: 'Oceanic', colors: ['#0e2a32', '#1c4b52', '#2c6e74'] },
  { name: 'Mono', colors: ['#1a1613', '#2a2420', '#3a322c'] },
];

export function defaultScene(): UserScene {
  return { durationMs: 8000, intensity: 0.6, palette: SCENE_PALETTES[0].colors, assets: [] };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Converts the user's composed scene into a full ReelTheme the engine can run. */
export function userSceneToTheme(scene: UserScene): ReelTheme {
  const i = clamp(scene.intensity, 0, 1);
  const W = 1080;
  const H = 1920;
  return {
    themeId: 'user-scene',
    name: 'Your scene',
    totalDurationMs: clamp(scene.durationMs, 4000, 12000),
    fps: 30,
    dimensions: { width: W, height: H },
    background: {
      type: 'ambient-gradient',
      colors: scene.palette.length ? scene.palette : SCENE_PALETTES[0].colors,
      shiftSpeedMs: 12000 + (1 - i) * 8000,
      angleDeg: 135,
      vignette: 0.16,
    },
    foregroundAssets: scene.assets.map((a, idx) => ({
      id: 'a' + idx,
      type: a.url.toLowerCase().endsWith('.svg') ? ('svg' as const) : ('png' as const),
      url: a.url,
      position: { left: Math.round(a.xPct * W), top: Math.round(a.yPct * H) },
      size: { width: Math.round(a.widthPct * W) },
      transformOrigin: 'center' as const,
      opacity: 0.95,
      rotationDeg: a.rotation ?? 0,
      flipX: a.flipX ?? false,
      animation:
        a.anim === 'sway'
          ? { type: 'sway' as const, maxRotationDeg: 1 + i * 3, frequencyHz: 0.18 + i * 0.12 }
          : a.anim === 'float'
            ? { type: 'float' as const, amplitudePx: 6 + i * 18, frequencyHz: 0.15 + i * 0.1 }
            : { type: 'none' as const },
      layer: (a.layer ?? 'front') === 'behind' ? ('behind-card' as const) : ('front-card' as const),
    })),
    cardContainer: {
      entranceDelayMs: 500,
      entranceDurationMs: 750,
      entranceAnimation: 'scale-up-bounce',
      fitScale: 0.78,
      shadow: true,
      continuousAnimation: { type: 'slow-parallax-zoom', maxScale: 1.03 + i * 0.05 },
    },
    contentTimeline: {
      starsReveal: { delayMs: 1200, staggerMs: 60 + (1 - i) * 160 },
      textReveal: { delayMs: 2000, type: 'fade-up-word', staggerMs: 40 + (1 - i) * 120 },
    },
  };
}
