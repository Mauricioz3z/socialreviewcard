export type RatioId = 'story' | 'square';
export type CardStyleId = 'glass' | 'minimal' | 'dark' | 'brutal';
export type FontId = 'serif' | 'sans';
export type AvatarMode = 'initials' | 'icon';
/** A selectable review source. `platform` on a card is its label (free-form). */
export interface PlatformDisplay {
  label: string;
  color: string;
  icon: string; // FontAwesome token, e.g. "fab:instagram"
}

/** The full set of values that define a card — review content + styling. */
export interface CardData {
  review: string;
  name: string;
  /** Platform label — a configured platform or a free-text custom source. */
  platform: string;
  rating: number;
  avatar: AvatarMode;
  cardStyle: CardStyleId;
  font: FontId;
  ratio: RatioId;
}

/** Styling-only subset persisted in `stylesJson` on the backend. */
export interface CardStyles {
  avatar: AvatarMode;
  cardStyle: CardStyleId;
  font: FontId;
  ratio: RatioId;
  background: string;
  grain: boolean;
}

/** Card as returned by the backend API. */
export interface SavedCard {
  id: string;
  reviewText: string;
  reviewerName: string;
  rating: number;
  platform: string;
  stylesJson: string;
  createdAt: string;
}

/** Authenticated session state held in the client. */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  email: string;
}
