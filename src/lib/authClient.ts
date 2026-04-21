/**
 * Auth client — talks to Go backend /api/v1/auth/* and /api/v1/admin/*.
 * Token stored in localStorage.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080';
const TOKEN_KEY = 'elibri_auth_token';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
  // Patch 2C + Patch 3 fields (optional — backend /auth/me populates them).
  risk_tier?: 'conservative' | 'balanced' | 'aggressive';
  telegram_chat_id?: number | null;
}

export interface AuthResult {
  success: boolean;
  error: string | null;
  user?: AuthUser;
  token?: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const errMsg = (body && typeof body === 'object' && 'error' in body) ? String((body as { error: unknown }).error) : res.statusText;
      return { data: null, error: errMsg, status: res.status };
    }
    return { data: body as T, error: null, status: res.status };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'network error', status: 0 };
  }
}

// ─── Public endpoints ───────────────────────────

export async function register(email: string, password: string, displayName: string): Promise<AuthResult> {
  const { data, error } = await request<{ token: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  if (error || !data) return { success: false, error: formatError(error) };
  setToken(data.token);
  return { success: true, error: null, user: data.user, token: data.token };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await request<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (error || !data) return { success: false, error: formatError(error) };
  setToken(data.token);
  return { success: true, error: null, user: data.user, token: data.token };
}

export function logout() {
  setToken(null);
}

// ─── Protected endpoints ────────────────────────

export async function fetchMe(): Promise<AuthUser | null> {
  const { data } = await request<AuthUser>('/auth/me', { method: 'GET' });
  return data;
}

export async function updateMe(displayName: string): Promise<AuthUser | null> {
  const { data } = await request<AuthUser>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ display_name: displayName }),
  });
  return data;
}

// ─── Admin endpoints ────────────────────────────

export async function adminListUsers(): Promise<AuthUser[]> {
  const { data } = await request<{ users: AuthUser[] }>('/admin/users', { method: 'GET' });
  return data?.users ?? [];
}

export async function adminResetPassword(userId: string, newPassword?: string): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  const { data, error } = await request<{ status: string; temp_password?: string }>(
    `/admin/users/${userId}/reset-password`,
    {
      method: 'POST',
      body: JSON.stringify(newPassword ? { new_password: newPassword } : {}),
    },
  );
  if (error || !data) return { success: false, error: error ?? 'unknown error' };
  return { success: true, tempPassword: data.temp_password };
}

function formatError(err: string | null): string {
  if (!err) return 'Unknown error';
  if (err === 'email already registered') return 'This email is already registered. Try signing in.';
  if (err === 'invalid credentials') return 'Wrong email or password.';
  if (err.includes('password')) return err;
  return err;
}
