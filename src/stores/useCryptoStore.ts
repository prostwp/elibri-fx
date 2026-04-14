import { create } from 'zustand';
import type { OHLCVCandle, CryptoScanResult, MLPrediction } from '../types/nodes';

export interface CryptoPrice {
  price: number;
  change24h: number;
  volume24h: number;
  time: number;
}

interface CryptoState {
  // Connection
  status: 'disconnected' | 'public' | 'connected' | 'error';
  error: string | null;
  config: { apiKey: string; apiSecret: string } | null;

  // Modal
  showConnectModal: boolean;
  setShowConnectModal: (show: boolean) => void;

  // Live candles per symbol (max 500)
  candles: Record<string, OHLCVCandle[]>;
  setCandles: (symbol: string, candles: OHLCVCandle[]) => void;
  appendCandle: (symbol: string, candle: OHLCVCandle) => void;

  // Price ticks
  prices: Record<string, CryptoPrice>;
  setPrice: (symbol: string, price: number, change24h: number, volume24h: number) => void;

  // Scanner results
  scanResults: CryptoScanResult[];
  setScanResults: (results: CryptoScanResult[]) => void;

  // ML predictions per symbol
  mlPredictions: Record<string, MLPrediction>;
  setMLPrediction: (symbol: string, prediction: MLPrediction) => void;
  mlStatus: 'idle' | 'predicting' | 'error';
  setMLStatus: (status: CryptoState['mlStatus']) => void;

  // Actions
  setStatus: (status: CryptoState['status']) => void;
  setError: (error: string | null) => void;
  setConfig: (config: CryptoState['config']) => void;
  disconnect: () => void;
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  status: 'disconnected',
  error: null,
  config: null,

  showConnectModal: false,
  setShowConnectModal: (show) => set({ showConnectModal: show }),

  candles: {},
  setCandles: (symbol, candles) =>
    set({ candles: { ...get().candles, [symbol]: candles } }),
  appendCandle: (symbol, candle) => {
    const existing = get().candles[symbol] ?? [];
    const last = existing[existing.length - 1];
    // Same timestamp → update, otherwise append (max 500)
    if (last && last.time === candle.time) {
      const updated = [...existing.slice(0, -1), candle];
      set({ candles: { ...get().candles, [symbol]: updated } });
    } else {
      const updated = [...existing, candle].slice(-500);
      set({ candles: { ...get().candles, [symbol]: updated } });
    }
  },

  prices: {},
  setPrice: (symbol, price, change24h, volume24h) =>
    set({
      prices: {
        ...get().prices,
        [symbol]: { price, change24h, volume24h, time: Date.now() },
      },
    }),

  scanResults: [],
  setScanResults: (results) => set({ scanResults: results }),

  mlPredictions: {},
  setMLPrediction: (symbol, prediction) =>
    set({ mlPredictions: { ...get().mlPredictions, [symbol]: prediction } }),
  mlStatus: 'idle',
  setMLStatus: (mlStatus) => set({ mlStatus }),

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setConfig: (config) => set({ config }),

  disconnect: () =>
    set({
      status: 'disconnected',
      error: null,
      config: null,
      candles: {},
      prices: {},
      scanResults: [],
      mlPredictions: {},
      mlStatus: 'idle',
    }),
}));
