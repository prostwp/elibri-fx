import { create } from 'zustand';
import type { MT5Account, MT5Position } from '../lib/mt5';
import type { OHLCVCandle } from '../types/nodes';

export interface MT5ConnectionConfig {
  token: string;
  accountId: string;
}

interface MT5State {
  // Connection
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  config: MT5ConnectionConfig | null;
  account: MT5Account | null;

  // Modal
  showConnectModal: boolean;
  setShowConnectModal: (show: boolean) => void;

  // Positions
  positions: MT5Position[];
  setPositions: (positions: MT5Position[]) => void;

  // Live candles per symbol
  candles: Record<string, OHLCVCandle[]>;
  setCandles: (symbol: string, candles: OHLCVCandle[]) => void;
  appendCandle: (symbol: string, candle: OHLCVCandle) => void;

  // Price ticks
  prices: Record<string, { bid: number; ask: number; time: number }>;
  setPrice: (symbol: string, bid: number, ask: number) => void;

  // Actions
  setStatus: (status: MT5State['status']) => void;
  setError: (error: string | null) => void;
  setConfig: (config: MT5ConnectionConfig | null) => void;
  setAccount: (account: MT5Account | null) => void;
  disconnect: () => void;
}

export const useMT5Store = create<MT5State>((set, get) => ({
  status: 'disconnected',
  error: null,
  config: null,
  account: null,

  showConnectModal: false,
  setShowConnectModal: (show) => set({ showConnectModal: show }),

  positions: [],
  setPositions: (positions) => set({ positions }),

  candles: {},
  setCandles: (symbol, candles) =>
    set({ candles: { ...get().candles, [symbol]: candles } }),
  appendCandle: (symbol, candle) => {
    const existing = get().candles[symbol] ?? [];
    const last = existing[existing.length - 1];
    // If same candle timestamp — update it, otherwise append
    if (last && last.time === candle.time) {
      const updated = [...existing.slice(0, -1), candle];
      set({ candles: { ...get().candles, [symbol]: updated } });
    } else {
      // Keep last 500 candles
      const updated = [...existing, candle].slice(-500);
      set({ candles: { ...get().candles, [symbol]: updated } });
    }
  },

  prices: {},
  setPrice: (symbol, bid, ask) =>
    set({ prices: { ...get().prices, [symbol]: { bid, ask, time: Date.now() } } }),

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setConfig: (config) => set({ config }),
  setAccount: (account) => set({ account }),

  disconnect: () =>
    set({
      status: 'disconnected',
      error: null,
      config: null,
      account: null,
      positions: [],
      candles: {},
      prices: {},
    }),
}));
