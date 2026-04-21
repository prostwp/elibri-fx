// MT5 Integration via MetaApi Cloud
// https://metaapi.cloud — WebSocket bridge to MetaTrader 5

import type { OHLCVCandle } from '../types/nodes';

export interface MT5Account {
  login: number;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  connected: boolean;
  name?: string;
  broker?: string;
  platform?: string;
}

export interface MT5Order {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  stopLoss: number;
  takeProfit: number;
  comment: string;
}

export interface MT5Position {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss: number;
  takeProfit: number;
  time?: string;
}

export interface MT5Config {
  apiKey?: string;
  accountId?: string;
  server?: string;
}

// ─── MetaApi REST client ──────────────────────────

const META_API_BASE = 'https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai';
const META_API_PROVISIONING = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';

let _token: string | null = null;
let _accountId: string | null = null;
let _wsConnection: WebSocket | null = null;
const _priceCallbacks: Map<string, (bid: number, ask: number) => void> = new Map();
const _candleCallbacks: Map<string, (candle: OHLCVCandle) => void> = new Map();
let _keepAliveInterval: ReturnType<typeof setInterval> | null = null;
// Guard against the "reconnect storm" pattern: WebSocket.onclose used to
// unconditionally schedule ensureWebSocket() via setTimeout, so after
// disconnectMT5() closed the socket, the pending timer fired and opened
// a new zombie connection (with _token=null → spams auth errors forever).
// Set to false in disconnectMT5(); onclose respects it.
let _shouldReconnect = false;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function headers() {
  return {
    'Content-Type': 'application/json',
    'auth-token': _token ?? '',
  };
}

// ─── Deploy account if needed ─────────────────────

async function ensureAccountDeployed(): Promise<void> {
  const res = await fetch(
    `${META_API_PROVISIONING}/users/current/accounts/${_accountId}`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Account not found: ${res.status}`);
  const account = await res.json();

  if (account.state !== 'DEPLOYED') {
    const deployRes = await fetch(
      `${META_API_PROVISIONING}/users/current/accounts/${_accountId}/deploy`,
      { method: 'POST', headers: headers() }
    );
    if (!deployRes.ok) throw new Error(`Failed to deploy account: ${deployRes.status}`);

    // Wait for deployment
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const checkRes = await fetch(
        `${META_API_PROVISIONING}/users/current/accounts/${_accountId}`,
        { headers: headers() }
      );
      const checkData = await checkRes.json();
      if (checkData.state === 'DEPLOYED' && checkData.connectionStatus === 'CONNECTED') {
        return;
      }
    }
    throw new Error('Account deployment timed out');
  }
}

// ─── Connect ──────────────────────────────────────

export async function connectMT5(token: string, accountId: string): Promise<MT5Account> {
  _token = token;
  _accountId = accountId;

  // 1. Deploy account if needed
  await ensureAccountDeployed();

  // 2. Get account info
  const infoRes = await fetch(
    `${META_API_BASE}/users/current/accounts/${accountId}/account-information`,
    { headers: headers() }
  );

  if (!infoRes.ok) {
    const err = await infoRes.text();
    throw new Error(`Failed to get account info: ${infoRes.status} — ${err}`);
  }

  const info = await infoRes.json();

  return {
    login: info.login,
    server: info.server,
    balance: info.balance,
    equity: info.equity,
    margin: info.margin,
    freeMargin: info.freeMargin,
    leverage: info.leverage,
    currency: info.currency,
    connected: true,
    name: info.name,
    broker: info.broker,
    platform: info.platform,
  };
}

// ─── Disconnect ───────────────────────────────────

export function disconnectMT5(): void {
  // Kill any pending reconnect FIRST so a fired onclose from our own .close()
  // below cannot schedule a new socket.
  _shouldReconnect = false;
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  if (_wsConnection) {
    _wsConnection.close();
    _wsConnection = null;
  }
  if (_keepAliveInterval) {
    clearInterval(_keepAliveInterval);
    _keepAliveInterval = null;
  }
  _priceCallbacks.clear();
  _candleCallbacks.clear();
  _token = null;
  _accountId = null;
}

// ─── Get positions ────────────────────────────────

export async function getPositions(): Promise<MT5Position[]> {
  if (!_token || !_accountId) return [];

  const res = await fetch(
    `${META_API_BASE}/users/current/accounts/${_accountId}/positions`,
    { headers: headers() }
  );

  if (!res.ok) return [];
  const positions = await res.json();

  return positions.map((p: any) => ({
    ticket: p.id,
    symbol: p.symbol,
    type: p.type === 'POSITION_TYPE_BUY' ? 'buy' : 'sell',
    volume: p.volume,
    openPrice: p.openPrice,
    currentPrice: p.currentPrice,
    profit: p.profit ?? p.unrealizedProfit ?? 0,
    stopLoss: p.stopLoss ?? 0,
    takeProfit: p.takeProfit ?? 0,
    time: p.time,
  }));
}

// ─── Get account info ─────────────────────────────

export async function getAccountInfo(): Promise<MT5Account | null> {
  if (!_token || !_accountId) return null;

  const res = await fetch(
    `${META_API_BASE}/users/current/accounts/${_accountId}/account-information`,
    { headers: headers() }
  );

  if (!res.ok) return null;
  const info = await res.json();

  return {
    login: info.login,
    server: info.server,
    balance: info.balance,
    equity: info.equity,
    margin: info.margin,
    freeMargin: info.freeMargin,
    leverage: info.leverage,
    currency: info.currency,
    connected: true,
    name: info.name,
    broker: info.broker,
    platform: info.platform,
  };
}

// ─── Place trade ──────────────────────────────────

export async function placeTrade(order: {
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}): Promise<MT5Order | null> {
  if (!_token || !_accountId) throw new Error('Not connected to MT5');

  const body = {
    actionType: order.type === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    symbol: order.symbol,
    volume: order.volume,
    ...(order.stopLoss && { stopLoss: order.stopLoss }),
    ...(order.takeProfit && { takeProfit: order.takeProfit }),
    ...(order.comment && { comment: order.comment }),
  };

  const res = await fetch(
    `${META_API_BASE}/users/current/accounts/${_accountId}/trade`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Trade failed: ${res.status} — ${err}`);
  }

  const result = await res.json();
  return {
    ticket: result.orderId ?? result.positionId ?? 0,
    symbol: order.symbol,
    type: order.type,
    volume: order.volume,
    openPrice: result.openPrice ?? 0,
    stopLoss: order.stopLoss ?? 0,
    takeProfit: order.takeProfit ?? 0,
    comment: order.comment ?? '',
  };
}

// ─── Get historical candles ───────────────────────

export async function getCandles(
  symbol: string,
  timeframe: string,
  count: number = 200
): Promise<OHLCVCandle[]> {
  if (!_token || !_accountId) return [];

  // Map our timeframes to MetaApi format
  const tfMap: Record<string, string> = {
    M1: '1m', M5: '5m', M15: '15m', M30: '30m',
    H1: '1h', H4: '4h', D1: '1d',
  };
  const tf = tfMap[timeframe] ?? '1h';

  const startTime = new Date(Date.now() - count * getTimeframeMs(timeframe)).toISOString();

  const res = await fetch(
    `${META_API_BASE}/users/current/accounts/${_accountId}/historical-market-data/symbols/${symbol}/timeframes/${tf}/candles?startTime=${startTime}`,
    { headers: headers() }
  );

  if (!res.ok) return [];
  const data = await res.json();

  return (data ?? []).map((c: any) => ({
    time: Math.floor(new Date(c.time).getTime() / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.tickVolume ?? c.volume ?? 0,
  }));
}

// ─── Subscribe to price updates via WebSocket ─────

export function subscribePriceUpdates(
  symbol: string,
  onPrice: (bid: number, ask: number) => void,
  onCandle?: (candle: OHLCVCandle) => void
): () => void {
  _priceCallbacks.set(symbol, onPrice);
  if (onCandle) _candleCallbacks.set(symbol, onCandle);

  // Enable reconnect only while the user is actively subscribed. Paired
  // with disconnectMT5() which flips this back to false.
  _shouldReconnect = true;
  ensureWebSocket();
  sendWsSubscribe(symbol);

  // Return unsubscribe function. If no callbacks remain, close the socket
  // and stop the reconnect loop — otherwise a single mounted node that
  // unsubscribes leaves the WebSocket alive forever for other nodes.
  return () => {
    _priceCallbacks.delete(symbol);
    _candleCallbacks.delete(symbol);
    if (_priceCallbacks.size === 0 && _candleCallbacks.size === 0) {
      _shouldReconnect = false;
      if (_reconnectTimer) {
        clearTimeout(_reconnectTimer);
        _reconnectTimer = null;
      }
      if (_wsConnection) {
        _wsConnection.close();
        _wsConnection = null;
      }
    }
  };
}

function ensureWebSocket() {
  if (_wsConnection && _wsConnection.readyState === WebSocket.OPEN) return;
  if (!_token || !_accountId) return;

  const wsUrl = `wss://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/ws`;

  _wsConnection = new WebSocket(wsUrl);

  _wsConnection.onopen = () => {
    // Authenticate
    _wsConnection?.send(JSON.stringify({
      type: 'authenticate',
      accountId: _accountId,
      token: _token,
    }));

    // Re-subscribe to all symbols
    for (const symbol of _priceCallbacks.keys()) {
      sendWsSubscribe(symbol);
    }

    // Keep alive
    if (_keepAliveInterval) clearInterval(_keepAliveInterval);
    _keepAliveInterval = setInterval(() => {
      if (_wsConnection?.readyState === WebSocket.OPEN) {
        _wsConnection.send(JSON.stringify({ type: 'keepalive' }));
      }
    }, 30000);
  };

  _wsConnection.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'prices' && data.prices) {
        for (const price of data.prices) {
          const cb = _priceCallbacks.get(price.symbol);
          if (cb) cb(price.bid, price.ask);
        }
      }

      if (data.type === 'candle' && data.candle) {
        const cb = _candleCallbacks.get(data.symbol);
        if (cb) {
          cb({
            time: Math.floor(new Date(data.candle.time).getTime() / 1000),
            open: data.candle.open,
            high: data.candle.high,
            low: data.candle.low,
            close: data.candle.close,
            volume: data.candle.tickVolume ?? 0,
          });
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  _wsConnection.onclose = () => {
    // Only reconnect if the user is still connected (token present AND
    // disconnectMT5 hasn't been called). Previously this fired
    // unconditionally, producing a zombie reconnect loop after logout.
    if (!_shouldReconnect || !_token || !_accountId) return;
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      if (_shouldReconnect) ensureWebSocket();
    }, 5000);
  };

  _wsConnection.onerror = () => {
    _wsConnection?.close();
  };
}

function sendWsSubscribe(symbol: string) {
  if (_wsConnection?.readyState === WebSocket.OPEN) {
    _wsConnection.send(JSON.stringify({
      type: 'subscribe',
      subscriptions: [
        { type: 'quotes', symbol },
        { type: 'candles', symbol, timeframe: '1h' },
      ],
    }));
  }
}

// ─── Helpers ──────────────────────────────────────

function getTimeframeMs(tf: string): number {
  const map: Record<string, number> = {
    M1: 60_000, M5: 300_000, M15: 900_000, M30: 1_800_000,
    H1: 3_600_000, H4: 14_400_000, D1: 86_400_000,
  };
  return map[tf] ?? 3_600_000;
}

export function isConnected(): boolean {
  return !!_token && !!_accountId;
}
