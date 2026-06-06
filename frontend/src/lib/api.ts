import type { AuthSession, CardData, CardStyles, SavedCard } from '../types';

/**
 * Base URL of the .NET backend. In dev, Vite proxies /api to localhost:5080
 * (see vite.config.ts); in production set VITE_API_BASE to the API origin.
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

const SESSION_KEY = 'src.session';

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data === 'string') return data;
    if (data?.detail) return data.detail;
    if (data?.title) return data.title;
    if (data?.errors) {
      // ASP.NET Identity returns { errors: { Code: [msg], ... } }
      const first = Object.values(data.errors).flat()[0];
      if (typeof first === 'string') return first;
    }
    return res.statusText || 'Request failed';
  } catch {
    return res.statusText || 'Request failed';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ----------------------------- Auth ----------------------------- */

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Decodes the (unverified) email claim from a Google ID token for display only. */
function decodeJwtEmail(idToken: string): string {
  try {
    const payload = idToken.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.email === 'string' ? json.email : '';
  } catch {
    return '';
  }
}

/** Exchanges a Google ID token for an app bearer session. */
export async function googleLogin(idToken: string): Promise<AuthSession> {
  const data = await request<TokenResponse>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, email: decodeJwtEmail(idToken) };
}

export async function refresh(refreshToken: string, email: string): Promise<AuthSession> {
  const data = await request<TokenResponse>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, email };
}

/* ----------------------------- Public config ----------------------------- */

export interface PublicPlatform {
  id: number;
  label: string;
  color: string;
  icon: string;
  sortOrder: number;
  enabled: boolean;
}

export interface PublicConfig {
  freeExportLimit: number;
  proPriceLabel: string;
  proFeatures: string[];
  upgradeTitle: string;
  upgradeSubtitle: string;
  watermarkEnabled: boolean;
  watermarkText: string;
  headScripts: string;
  bodyScripts: string;
  platforms: PublicPlatform[];
}

/** Anonymous runtime config (scripts, watermark, monetization copy). */
export function getConfig(): Promise<PublicConfig> {
  return request<PublicConfig>('/api/config', { method: 'GET' });
}

export type FeedbackType = 'suggestion' | 'criticism' | 'support';

/** Submits an in-app feedback/support message. Token is optional (captured if signed in). */
export function submitFeedback(
  body: { type: FeedbackType; message: string; email?: string },
  token?: string | null,
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/feedback', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

/* ----------------------------- Cards ----------------------------- */

export function getCards(token: string): Promise<SavedCard[]> {
  return request<SavedCard[]>('/api/cards', { method: 'GET', token });
}

export function saveCard(
  token: string,
  data: CardData,
  styles: CardStyles,
  id?: string,
): Promise<SavedCard> {
  return request<SavedCard>('/api/cards', {
    method: 'POST',
    token,
    body: JSON.stringify({
      id: id ?? null,
      reviewText: data.review,
      reviewerName: data.name,
      rating: data.rating,
      platform: data.platform,
      stylesJson: JSON.stringify(styles),
    }),
  });
}

export function deleteCard(token: string, id: string): Promise<void> {
  return request<void>(`/api/cards/${id}`, { method: 'DELETE', token });
}

/* ----------------------------- Billing ----------------------------- */

export async function startCheckout(token: string): Promise<string> {
  const data = await request<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    token,
  });
  return data.url;
}

export interface BillingStatus {
  status: 'free' | 'active' | 'canceled' | 'past_due';
  subscriptionEndDate: string | null;
  isPro: boolean;
}

export function getBillingStatus(token: string): Promise<BillingStatus> {
  return request<BillingStatus>('/api/billing/status', { method: 'GET', token });
}

/* ----------------------------- Usage / quota ----------------------------- */

export interface UsageInfo {
  isPro: boolean;
  freeLimit: number;
  exportsUsed: number;
  remaining: number | null;
  allowed: boolean;
}

export function getUsage(token: string): Promise<UsageInfo> {
  return request<UsageInfo>('/api/usage', { method: 'GET', token });
}

/**
 * Claims one export slot. Resolves with ok=false (HTTP 402) when the free quota
 * is exhausted; throws ApiError(401) so callers can transparently refresh.
 */
export async function claimExport(token: string): Promise<{ ok: boolean; usage: UsageInfo }> {
  const res = await fetch(`${API_BASE}/api/usage/export`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new ApiError('Unauthorized', 401);
  const usage = (await res.json()) as UsageInfo;
  return { ok: res.ok, usage };
}
