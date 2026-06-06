import { ApiError } from './api';

/** Same base-URL convention as the main client (empty = same-origin via nginx). */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
const ADMIN_SESSION_KEY = 'src.admin.session';

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  email: string;
}

export function loadAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession | null) {
  if (session) localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(ADMIN_SESSION_KEY);
}

async function adminRequest<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText || 'Request failed';
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
      else if (data?.detail) msg = data.detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ----------------------------- Types ----------------------------- */

export interface AdminMetrics {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  totalCards: number;
  totalExports: number;
  freeExportsUsed: number;
}

export interface AdminUser {
  id: string;
  email: string | null;
  subscriptionStatus: string;
  isPro: boolean;
  subscriptionEndDate: string | null;
  freeExportsUsed: number;
  totalExports: number;
  stripeCustomerId: string | null;
  createdAt: string;
  isAdmin: boolean;
}

export interface AdminUserList {
  total: number;
  items: AdminUser[];
}

export interface AdminUserPatch {
  subscriptionStatus?: string;
  freeExportsUsed?: number;
  subscriptionEndDate?: string | null;
}

export interface AdminSettings {
  freeExportLimit: number;
  proPriceLabel: string;
  proFeatures: string[];
  upgradeTitle: string;
  upgradeSubtitle: string;
  watermarkEnabled: boolean;
  watermarkText: string;
  headScripts: string;
  bodyScripts: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  timestampUtc: string;
  actorEmail: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
}

export interface AuditLogList {
  total: number;
  items: AuditLogItem[];
}

export interface FeedbackItem {
  id: string;
  createdAt: string;
  type: string;
  message: string;
  email: string | null;
  handled: boolean;
  ipAddress: string | null;
}

export interface FeedbackList {
  total: number;
  unhandled: number;
  items: FeedbackItem[];
}

export interface AdminPlatform {
  id: number;
  label: string;
  color: string;
  icon: string;
  sortOrder: number;
  enabled: boolean;
}

export type PlatformUpsert = Omit<AdminPlatform, 'id'>;

/* ----------------------------- Auth ----------------------------- */

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  const data = await adminRequest<TokenResponse>('/api/admin/login', null, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, email };
}

export async function adminRefresh(refreshToken: string, email: string): Promise<AdminSession> {
  const data = await adminRequest<TokenResponse>('/api/auth/refresh', null, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, email };
}

/* ----------------------------- Endpoints ----------------------------- */

export const adminMe = (token: string) =>
  adminRequest<{ email: string }>('/api/admin/me', token);

export const adminGetMetrics = (token: string) =>
  adminRequest<AdminMetrics>('/api/admin/metrics', token);

export const adminListUsers = (token: string, search: string, skip: number, take: number) =>
  adminRequest<AdminUserList>(
    `/api/admin/users?search=${encodeURIComponent(search)}&skip=${skip}&take=${take}`,
    token,
  );

export const adminUpdateUser = (token: string, id: string, patch: AdminUserPatch) =>
  adminRequest<AdminUser>(`/api/admin/users/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const adminDeleteUser = (token: string, id: string) =>
  adminRequest<void>(`/api/admin/users/${id}`, token, { method: 'DELETE' });

export const adminGetSettings = (token: string) =>
  adminRequest<AdminSettings>('/api/admin/settings', token);

export const adminPutSettings = (token: string, settings: AdminSettings) =>
  adminRequest<AdminSettings>('/api/admin/settings', token, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

export const adminGetAudit = (token: string, skip: number, take: number) =>
  adminRequest<AuditLogList>(`/api/admin/audit?skip=${skip}&take=${take}`, token);

export const adminGetFeedback = (token: string, skip: number, take: number) =>
  adminRequest<FeedbackList>(`/api/admin/feedback?skip=${skip}&take=${take}`, token);

export const adminMarkFeedback = (token: string, id: string, handled: boolean) =>
  adminRequest<{ ok: boolean }>(`/api/admin/feedback/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ handled }),
  });

export const adminListPlatforms = (token: string) =>
  adminRequest<AdminPlatform[]>('/api/admin/platforms', token);

export const adminCreatePlatform = (token: string, body: PlatformUpsert) =>
  adminRequest<AdminPlatform>('/api/admin/platforms', token, { method: 'POST', body: JSON.stringify(body) });

export const adminUpdatePlatform = (token: string, id: number, body: PlatformUpsert) =>
  adminRequest<AdminPlatform>(`/api/admin/platforms/${id}`, token, { method: 'PUT', body: JSON.stringify(body) });

export const adminDeletePlatform = (token: string, id: number) =>
  adminRequest<void>(`/api/admin/platforms/${id}`, token, { method: 'DELETE' });
