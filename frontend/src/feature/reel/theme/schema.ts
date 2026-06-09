/* ===================================================================
   ReelTheme — data-driven animation schema.
   The render engine ingests this object and drives every animation from it,
   so art direction can be tuned (or managed in the admin) without touching
   the rendering lifecycle. Stored/served as JSON.
=================================================================== */

export type EdgeAnchor = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

export type TransformOrigin = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type AssetAnimation =
  | { type: 'sway'; maxRotationDeg: number; frequencyHz: number; phase?: number }
  | { type: 'float'; amplitudePx: number; frequencyHz: number; phase?: number }
  | { type: 'none' };

export interface ForegroundAsset {
  id: string;
  type: 'svg' | 'png';
  url: string;
  position: EdgeAnchor; // px offsets from the named edges
  size?: { width?: number; height?: number }; // px; missing dim preserves aspect
  opacity?: number; // 0..1
  rotationDeg?: number; // static base rotation
  flipX?: boolean; // mirror horizontally
  transformOrigin?: TransformOrigin;
  animation?: AssetAnimation;
  layer?: 'behind-card' | 'front-card'; // default behind-card
}

export interface BackgroundSpec {
  type: 'ambient-gradient' | 'solid';
  colors: string[];
  shiftSpeedMs?: number; // full drift cycle (ambient-gradient)
  angleDeg?: number; // base gradient angle
  vignette?: number; // 0..1 darkening at edges
}

export type EntranceAnimation = 'scale-up-bounce' | 'fade-up' | 'fade' | 'none';

export interface CardContainerSpec {
  entranceDelayMs: number;
  entranceDurationMs?: number; // default 700
  entranceAnimation: EntranceAnimation;
  fitScale?: number; // fraction of frame the card spans (default 0.82)
  shadow?: boolean;
  continuousAnimation?: { type: 'slow-parallax-zoom' | 'none'; maxScale: number };
}

export interface RevealStep {
  delayMs: number;
  durationMs?: number;
  staggerMs?: number;
  type?: string;
}

export interface ContentTimeline {
  starsReveal?: RevealStep;
  textReveal?: (RevealStep & { type?: 'fade-up-word' | 'fade-up' | 'typewriter' }) | undefined;
}

export interface ReelTheme {
  themeId: string;
  name?: string;
  totalDurationMs: number;
  fps?: number; // default 30
  dimensions: { width: number; height: number };
  background: BackgroundSpec;
  foregroundAssets?: ForegroundAsset[];
  cardContainer: CardContainerSpec;
  contentTimeline?: ContentTimeline;
}
