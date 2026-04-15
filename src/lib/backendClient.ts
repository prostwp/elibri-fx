/**
 * Backend Client — connects frontend to Go backend.
 * Pattern: try backend first, fall back to local calculation.
 */

import { useAuthStore } from '../stores/useAuthStore';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? '';

async function backendFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  if (!BACKEND_URL) return null;

  const session = useAuthStore.getState().session;
  const token = session?.access_token;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Market Data ────────────────────────────────

export async function fetchQuotesFromBackend(
  symbols: string[],
  source: 'moex' | 'binance' = 'moex',
): Promise<Record<string, any> | null> {
  const data = await backendFetch<{ quotes: Record<string, any> }>(
    `/market/quotes?symbols=${symbols.join(',')}&source=${source}`
  );
  return data?.quotes ?? null;
}

export async function fetchCandlesFromBackend(
  symbol: string,
  source: 'moex' | 'binance' = 'moex',
  interval?: string,
  limit?: number,
): Promise<any[] | null> {
  const params = new URLSearchParams({ symbol, source });
  if (interval) params.set('interval', interval);
  if (limit) params.set('limit', String(limit));

  const data = await backendFetch<{ candles: any[] }>(
    `/market/candles?${params}`
  );
  return data?.candles ?? null;
}

// ─── ML Predictions ─────────────────────────────

export async function predictFromBackend(
  symbol: string,
  source: 'moex' | 'binance' = 'moex',
): Promise<{ prediction: any; features: any } | null> {
  return backendFetch(`/ml/predict`, {
    method: 'POST',
    body: JSON.stringify({ symbol, source }),
  });
}

// ─── Crypto Scanner ─────────────────────────────

export async function scanCryptoFromBackend(): Promise<{
  results: any[];
  count: number;
} | null> {
  return backendFetch(`/crypto/scan`);
}

export async function checkListingsFromBackend(): Promise<{
  new_listings: any[] | null;
  known_count: number;
} | null> {
  return backendFetch(`/crypto/listings`);
}

// ─── WebSocket ──────────────────────────────────

export function connectBackendWS(
  topics: string[],
  onMessage: (msg: any) => void,
): (() => void) | null {
  if (!BACKEND_URL) return null;

  const wsUrl = BACKEND_URL.replace('http', 'ws') + '/ws';
  const session = useAuthStore.getState().session;
  const token = session?.access_token ?? '';

  try {
    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', topics }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch {}
    };

    ws.onerror = () => {};

    // Return cleanup function
    return () => {
      ws.close();
    };
  } catch {
    return null;
  }
}

// ─── Health Check ───────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
  if (!BACKEND_URL) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
