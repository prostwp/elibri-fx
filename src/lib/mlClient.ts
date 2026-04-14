/**
 * ML Client — calls Supabase Edge Functions for heavy ML predictions.
 * Falls back to browser TF.js if Edge Functions unavailable.
 */

import type { OHLCVCandle, MLPrediction } from '../types/nodes';
import { createClient } from '@supabase/supabase-js';
import { predict as localPredict, trainModel, isModelReady } from './mlPredictor';

// Supabase client (reuse existing project config)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ─── Predict via Supabase Edge Function ──────────

export async function predictCrypto(
  candles: OHLCVCandle[],
  features: string[],
  symbol: string,
): Promise<MLPrediction> {
  const supabase = getSupabase();

  // Try Edge Function first
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('crypto-predict', {
        body: {
          candles: candles.slice(-200), // last 200 candles
          features,
          symbol,
        },
      });

      if (!error && data) {
        return data as MLPrediction;
      }
    } catch {
      // Fall through to local prediction
    }
  }

  // Fallback: local TF.js prediction
  return localPredictFallback(candles, symbol);
}

// ─── Local TF.js Fallback ────────────────────────

async function localPredictFallback(
  candles: OHLCVCandle[],
  _symbol: string,
): Promise<MLPrediction> {
  // Train if not ready
  if (!isModelReady()) {
    await trainModel(candles);
  }

  const signal = await localPredict(candles);
  const lastPrice = candles[candles.length - 1]?.close ?? 0;
  const confidence = Math.round(Math.abs(signal) * 100);

  // Estimate price target based on signal strength and ATR
  const atrApprox = lastPrice * 0.02; // rough 2% ATR
  const priceTarget = signal > 0
    ? lastPrice + atrApprox * signal * 2.5
    : lastPrice + atrApprox * signal * 2.5;

  return {
    direction: signal > 0.15 ? 'buy' : signal < -0.15 ? 'sell' : 'neutral',
    confidence,
    priceTarget: Math.round(priceTarget * 100) / 100,
    timeframe: '4-12h',
    features: {
      signal_strength: Math.round(signal * 100) / 100,
      model: 0, // 0 = local, 1 = edge
    },
  };
}

// ─── Check if Edge Functions are available ───────

export function isEdgeAvailable(): boolean {
  return !!getSupabase();
}
