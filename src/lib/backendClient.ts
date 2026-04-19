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
  return backendFetch(`/ml/predict/legacy`, {
    method: 'POST',
    body: JSON.stringify({ symbol, source }),
  });
}

export interface MLPredictionV2 {
  symbol: string;
  interval: string;
  direction: 'buy' | 'sell' | 'neutral';
  confidence: number;            // 0-100
  probability: number;           // 0-1 raw P(up)
  price_target: number;
  timeframe: string;
  horizon_bars: number;
  model_version: string;
  predicted_at: number;
  feature_importance: { name: string; importance: number }[];
  similar_situations: {
    date: string;
    distance: number;
    outcome_5: number;
    outcome_10: number;
    outcome_20: number;
    description: string;
  }[];
  metrics: {
    accuracy: number;
    sharpe: number;
    f1: number;
    n_folds: number;
    hc_precision: number;       // precision on high-confidence signals (>0.80 prob)
    hc_signal_rate: number;     // fraction of bars that pass filter
    hc_signals_total: number;
    n_test_total: number;
    avg_outcome_5: number;
    avg_outcome_10: number;
    avg_outcome_20: number;
    high_confidence: boolean;   // true if THIS prediction passes the filter
  };
  features?: Record<string, number>;
  fallback_reason?: string;
}

export async function predictMLv2(
  symbol: string,
  interval: string,
  tradingStyle: 'scalp' | 'day' | 'swing' | 'position' = 'swing',
  source: 'binance' | 'moex' = 'binance',
): Promise<MLPredictionV2 | null> {
  return backendFetch<MLPredictionV2>(`/ml/predict`, {
    method: 'POST',
    body: JSON.stringify({
      symbol,
      interval,
      trading_style: tradingStyle,
      source,
    }),
  });
}

export async function listMLModels(): Promise<{
  health: { loaded_at: string; n_models: number; models: string[] };
  models: {
    key: string; symbol: string; interval: string;
    horizon: number; accuracy: number; sharpe: number; f1: number;
    n_folds: number; trained_at: string; n_features: number; n_trees: number;
  }[];
  thresholds?: {
    symbol: string; interval: string; key: string;
    threshold_high: number; threshold_low: number;
    precision: number; n_signals: number; fraction: number;
  }[];
} | null> {
  return backendFetch(`/ml/models`);
}

export interface BacktestStrategyRow {
  symbol: string;
  interval: string;
  n_trades: number;
  win_rate: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe: number;
  profit_factor: number;
}

export async function fetchBacktestSummary(): Promise<{
  total_strategies?: number;
  avg_total_return_pct?: number;
  avg_win_rate?: number;
  avg_sharpe?: number;
  best?: [string, string, number];
  worst?: [string, string, number];
  results?: BacktestStrategyRow[];
  error?: string;
} | null> {
  return backendFetch(`/ml/backtest`);
}

export async function fetchPaperTrades(): Promise<{
  started_at?: string;
  lookback_days?: number;
  n_strategies?: number;
  total_initial_equity?: number;
  total_final_equity?: number;
  total_return_pct?: number;
  n_trades_total?: number;
  win_rate_overall?: number;
  per_strategy?: any[];
  error?: string;
} | null> {
  return backendFetch(`/ml/paper-trades`);
}

export async function reloadMLModels(): Promise<{ loaded: number } | null> {
  return backendFetch(`/ml/reload`, { method: 'POST' });
}

// ─── Fundamental News ───────────────────────────

export interface NewsItem {
  source: 'finnhub' | 'coindesk' | 'cointelegraph' | 'alphavantage' | string;
  category: 'macro' | 'geopolitics' | 'regulation' | 'adoption' | 'crypto' | 'general' | string;
  headline: string;
  summary?: string;
  url: string;
  published_at: string;
  sentiment: number;
  mentions_coin?: boolean;
}

export interface NewsAggregate {
  items: NewsItem[];
  overall_sentiment: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  fetched_at: string;
}

export async function fetchFundamentalNews(
  symbol: string,
  hours = 24,
): Promise<NewsAggregate | null> {
  return backendFetch<NewsAggregate>(
    `/news/fundamental?symbol=${encodeURIComponent(symbol)}&hours=${hours}`,
  );
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
