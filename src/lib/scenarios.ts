/**
 * Scenarios + alerts + telegram API client.
 *
 * Talks to Go backend /api/v1/scenarios/*, /api/v1/alerts, /api/v1/telegram/*.
 * All endpoints require a JWT (Authorization header from authClient).
 */

import { authHeaders } from './authClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080';

// ─── Types ────────────────────────────────────────────────────────

export interface ActiveScenario {
  id: string;
  name: string;
  symbol: string;
  interval: string;
  risk_tier: 'conservative' | 'balanced' | 'aggressive';
  is_active: boolean;
  running: boolean;              // true = goroutine is live; false = in DB but runner not started
  paused_until?: string | null;
  last_signal_bar_time: number;  // 0 = never fired
  last_signal_direction?: 'buy' | 'sell' | '';
}

export interface Alert {
  id: string;
  user_id: string;
  strategy_id: string;
  symbol: string;
  interval: string;
  direction: 'buy' | 'sell';
  label: 'trend_aligned' | 'mean_reversion' | 'random';
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  position_size_usd: number;
  bar_time: number;
  created_at: string;
  telegram_sent_at: string | null;
  telegram_message_id: number | null;
  meta?: Record<string, unknown>;
}

export interface TelegramLinkResponse {
  code: string;
  deeplink?: string;        // absent if backend has no TELEGRAM_BOT_USERNAME configured
  bot_username?: string;
  expires_at: string;
}

export interface StartResponse {
  status: 'started' | 'active_in_db' | 'error';
  id?: string;
  runner_error?: string;
}

export interface StopResponse {
  status: 'stopped' | 'error';
  id?: string;
}

// ─── Low-level fetch helper ───────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(init.headers ?? {}),
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ─── Scenarios ────────────────────────────────────────────────────

export async function startScenario(id: string): Promise<StartResponse> {
  const data = await request<StartResponse>(`/scenarios/${id}/start`, { method: 'POST' });
  return data ?? { status: 'error' };
}

export async function stopScenario(id: string): Promise<StopResponse> {
  const data = await request<StopResponse>(`/scenarios/${id}/stop`, { method: 'POST' });
  return data ?? { status: 'error' };
}

export async function listActiveScenarios(): Promise<ActiveScenario[]> {
  const data = await request<{ scenarios: ActiveScenario[] }>('/scenarios/active', { method: 'GET' });
  return data?.scenarios ?? [];
}

// ─── Alerts ───────────────────────────────────────────────────────

export async function listAlerts(opts: {
  strategyId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Alert[]> {
  const p = new URLSearchParams();
  if (opts.strategyId) p.set('strategy_id', opts.strategyId);
  p.set('limit', String(opts.limit ?? 50));
  p.set('offset', String(opts.offset ?? 0));
  const data = await request<{ alerts: Alert[] }>(`/alerts?${p.toString()}`, { method: 'GET' });
  return data?.alerts ?? [];
}

// ─── Telegram linking ─────────────────────────────────────────────

export async function linkTelegram(): Promise<TelegramLinkResponse | null> {
  return request<TelegramLinkResponse>('/telegram/link', { method: 'POST' });
}

export async function unlinkTelegram(): Promise<boolean> {
  const data = await request<{ status: string }>('/telegram/link', { method: 'DELETE' });
  return !!data;
}
