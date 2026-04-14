// Binance Integration — REST + WebSocket
// Public endpoints work without API key, authenticated need HMAC-SHA256 signing

import type { OHLCVCandle } from '../types/nodes';

// ─── Module state ────────────────────────────────

let _apiKey: string | null = null;
let _wsConnections: Map<string, WebSocket> = new Map();
let _klineCallbacks: Map<string, (candle: OHLCVCandle) => void> = new Map();
let _tickerCallbacks: Map<string, (price: number, change24h: number, volume24h: number) => void> = new Map();

const BINANCE_REST = 'https://api.binance.com';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

// ─── HMAC-SHA256 signing (browser-native) ────────

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_apiKey) h['X-MBX-APIKEY'] = _apiKey;
  return h;
}

// ─── Connect (validate API key) ──────────────────

export async function connectBinance(apiKey?: string, apiSecret?: string): Promise<{ canTrade: boolean }> {
  if (apiKey && apiSecret) {
    _apiKey = apiKey;

    // Validate by calling account endpoint
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = await hmacSign(query, apiSecret);

    const res = await fetch(`${BINANCE_REST}/api/v3/account?${query}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': apiKey },
    });

    if (!res.ok) {
      _apiKey = null;
      const err = await res.text();
      throw new Error(`Binance auth failed: ${res.status} — ${err}`);
    }

    return { canTrade: true };
  }

  // Public mode — no auth needed for market data
  return { canTrade: false };
}

// ─── Disconnect ──────────────────────────────────

export function disconnectBinance(): void {
  for (const ws of _wsConnections.values()) {
    ws.close();
  }
  _wsConnections.clear();
  _klineCallbacks.clear();
  _tickerCallbacks.clear();
  _apiKey = null;
}

// ─── Get historical klines ───────────────────────

const INTERVAL_MAP: Record<string, string> = {
  M1: '1m', M5: '5m', M15: '15m', M30: '30m',
  H1: '1h', H4: '4h', D1: '1d',
};

export async function getKlines(
  symbol: string,
  interval: string = 'H1',
  limit: number = 200,
): Promise<OHLCVCandle[]> {
  const binanceInterval = INTERVAL_MAP[interval] ?? interval;

  const res = await fetch(
    `${BINANCE_REST}/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`,
    { headers: headers() },
  );

  if (!res.ok) return [];
  const data = await res.json();

  return data.map((k: any[]) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ─── Get 24h tickers ─────────────────────────────

export interface Ticker24h {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  lastPrice: number;
  volume: number;
  quoteVolume: number;
}

export async function get24hTickers(): Promise<Ticker24h[]> {
  const res = await fetch(`${BINANCE_REST}/api/v3/ticker/24hr`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();

  return data
    .filter((t: any) => t.symbol.endsWith('USDT'))
    .map((t: any) => ({
      symbol: t.symbol,
      priceChange: parseFloat(t.priceChange),
      priceChangePercent: parseFloat(t.priceChangePercent),
      lastPrice: parseFloat(t.lastPrice),
      volume: parseFloat(t.volume),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a: Ticker24h, b: Ticker24h) => b.quoteVolume - a.quoteVolume);
}

// ─── Get exchange info (for new listings) ────────

let _knownSymbols: Set<string> | null = null;

export async function getNewListings(): Promise<{ symbol: string; baseAsset: string; quoteAsset: string }[]> {
  const res = await fetch(`${BINANCE_REST}/api/v3/exchangeInfo`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();

  const currentSymbols = new Set<string>();
  const allPairs: { symbol: string; baseAsset: string; quoteAsset: string }[] = [];

  for (const s of data.symbols) {
    if (s.status === 'TRADING' && s.quoteAsset === 'USDT') {
      currentSymbols.add(s.symbol);
      allPairs.push({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
      });
    }
  }

  // First call — just cache the list
  if (!_knownSymbols) {
    _knownSymbols = currentSymbols;
    return [];
  }

  // Find new symbols
  const newListings = allPairs.filter((p) => !_knownSymbols!.has(p.symbol));
  _knownSymbols = currentSymbols;

  return newListings;
}

// ─── Subscribe to kline WebSocket ────────────────

export function subscribeKlines(
  symbol: string,
  interval: string,
  onKline: (candle: OHLCVCandle) => void,
): () => void {
  const binanceInterval = INTERVAL_MAP[interval] ?? interval;
  const stream = `${symbol.toLowerCase()}@kline_${binanceInterval}`;
  const key = `kline_${symbol}_${binanceInterval}`;

  _klineCallbacks.set(key, onKline);

  // Create WebSocket if not exists
  if (!_wsConnections.has(stream)) {
    const ws = new WebSocket(`${BINANCE_WS}/${stream}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === 'kline' && data.k) {
          const k = data.k;
          const candle: OHLCVCandle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          };
          const cb = _klineCallbacks.get(key);
          if (cb) cb(candle);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      _wsConnections.delete(stream);
      // Auto-reconnect after 5s if callback still active
      if (_klineCallbacks.has(key)) {
        setTimeout(() => subscribeKlines(symbol, interval, onKline), 5000);
      }
    };

    ws.onerror = () => ws.close();

    _wsConnections.set(stream, ws);
  }

  return () => {
    _klineCallbacks.delete(key);
    const ws = _wsConnections.get(stream);
    if (ws && !_klineCallbacks.has(key)) {
      ws.close();
      _wsConnections.delete(stream);
    }
  };
}

// ─── Subscribe to ticker WebSocket ───────────────

export function subscribeTicker(
  symbol: string,
  onTicker: (price: number, change24h: number, volume24h: number) => void,
): () => void {
  const stream = `${symbol.toLowerCase()}@ticker`;

  _tickerCallbacks.set(symbol, onTicker);

  if (!_wsConnections.has(stream)) {
    const ws = new WebSocket(`${BINANCE_WS}/${stream}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === '24hrTicker') {
          const cb = _tickerCallbacks.get(symbol);
          if (cb) {
            cb(
              parseFloat(data.c),  // last price
              parseFloat(data.P),  // price change percent
              parseFloat(data.v),  // volume
            );
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      _wsConnections.delete(stream);
      if (_tickerCallbacks.has(symbol)) {
        setTimeout(() => subscribeTicker(symbol, onTicker), 5000);
      }
    };

    ws.onerror = () => ws.close();

    _wsConnections.set(stream, ws);
  }

  return () => {
    _tickerCallbacks.delete(symbol);
    const ws = _wsConnections.get(stream);
    if (ws) {
      ws.close();
      _wsConnections.delete(stream);
    }
  };
}

// ─── Helpers ─────────────────────────────────────

export function isConnected(): boolean {
  return !!_apiKey;
}

export function isPublicMode(): boolean {
  return !_apiKey;
}
