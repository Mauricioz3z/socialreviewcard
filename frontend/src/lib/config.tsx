import type { CardStyleId, PlatformDisplay, RatioId } from '../types';

/** Built-in platforms used until /api/config loads (mirrors the backend seed). */
export const DEFAULT_PLATFORMS: PlatformDisplay[] = [
  { label: 'Etsy', color: '#F1641E', icon: 'fab:etsy' },
  { label: 'Shopify', color: '#5E8E3E', icon: 'fab:shopify' },
  { label: 'Amazon', color: '#E88A1A', icon: 'fab:amazon' },
  { label: 'Instagram', color: '#E1306C', icon: 'fab:instagram' },
  { label: 'Google', color: '#4285F4', icon: 'fab:google' },
];

/** Display config for the free-text "Custom" source. */
export const CUSTOM_PLATFORM: PlatformDisplay = { label: 'Custom', color: '#6d5efc', icon: 'fas:store' };

/** Resolves a stored platform label to its display config; unknown = custom (free text). */
export function resolvePlatform(label: string, platforms: PlatformDisplay[]): PlatformDisplay {
  const found = platforms.find((p) => p.label.toLowerCase() === (label || '').toLowerCase());
  if (found) return found;
  return { label: label || 'Custom', color: CUSTOM_PLATFORM.color, icon: CUSTOM_PLATFORM.icon };
}

export interface BackgroundConfig {
  id: string;
  name: string;
  type: 'gradient' | 'solid';
  css: string;
  tone: 'light' | 'dark';
}

export const BACKGROUNDS: BackgroundConfig[] = [
  { id: 'sunset', name: 'Pastel Sunset', type: 'gradient', css: 'linear-gradient(150deg,#ffdca8 0%,#ff9aa2 48%,#c8a2e0 100%)', tone: 'light' },
  { id: 'aurora', name: 'Aurora', type: 'gradient', css: 'linear-gradient(150deg,#13f1a8 0%,#19c8ff 52%,#8b6cff 100%)', tone: 'light' },
  { id: 'oceanic', name: 'Deep Oceanic', type: 'gradient', css: 'linear-gradient(160deg,#0e2a32 0%,#1c4b52 55%,#2c6e74 100%)', tone: 'dark' },
  { id: 'beige', name: 'Beige', type: 'solid', css: '#ece5d8', tone: 'light' },
  { id: 'obsidian', name: 'Obsidian', type: 'solid', css: '#0c0c12', tone: 'dark' },
];

export interface CardStyleConfig {
  id: CardStyleId;
  name: string;
  sub: string;
}

export const CARD_STYLES: CardStyleConfig[] = [
  { id: 'glass', name: 'Glassmorphism', sub: 'Frosted & airy' },
  { id: 'minimal', name: 'Stark White', sub: 'Clean minimal' },
  { id: 'dark', name: 'Dark Sleek', sub: 'Moody premium' },
  { id: 'brutal', name: 'Neo-Brutalism', sub: 'Bold & loud' },
];

export interface RatioConfig {
  id: RatioId;
  label: string;
  dims: string;
  w: number;
  h: number;
}

export const RATIOS: Record<RatioId, RatioConfig> = {
  story: { id: 'story', label: 'Story', dims: '9:16', w: 432, h: 768 },
  square: { id: 'square', label: 'Post', dims: '1:1', w: 600, h: 600 },
};

export const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
