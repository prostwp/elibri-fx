/**
 * ML Client — calls Go backend /api/v1/ml/predict. Falls back to local TF.js.
 */

import type { OHLCVCandle, MLPrediction } from '../types/nodes';
import { predict as localPredict, trainModel, isModelReady } from './mlPredictor';
import { predictFromBackend } from './backendClient';

export async function predictCrypto(
  candles: OHLCVCandle[],
  features: string[],
  symbol: string,
): Promise<MLPrediction> {
  void features; // reserved for future use

  // Try Go backend first
  const backendResult = await predictFromBackend(symbol, 'binance');
  if (backendResult?.prediction) {
    const p = backendResult.prediction as Partial<MLPrediction> & { score?: number };
    return {
      direction: p.direction ?? (p.score && p.score > 0.15 ? 'buy' : p.score && p.score < -0.15 ? 'sell' : 'neutral'),
      confidence: typeof p.confidence === 'number' ? p.confidence : 0,
      priceTarget: p.priceTarget ?? 0,
      timeframe: p.timeframe ?? '4-12h',
      features: p.features ?? {},
    };
  }

  // Fallback: local TF.js prediction
  return localPredictFallback(candles);
}

async function localPredictFallback(candles: OHLCVCandle[]): Promise<MLPrediction> {
  if (!isModelReady()) {
    await trainModel(candles);
  }

  const signal = await localPredict(candles);
  const lastPrice = candles[candles.length - 1]?.close ?? 0;
  const confidence = Math.round(Math.abs(signal) * 100);

  const atrApprox = lastPrice * 0.02;
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
      model: 0,
    },
  };
}

export function isEdgeAvailable(): boolean {
  return false;
}
