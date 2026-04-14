/**
 * ML Predictor — TensorFlow.js in-browser model.
 * Lazy-loads TF.js to avoid bundle bloat.
 * Used as fallback when Supabase Edge Functions are unavailable.
 */

import type { OHLCVCandle } from '../types/nodes';
import { calcRSI, calcMACD, calcBollingerBands, calcATR } from './indicators';

// Lazy TF.js reference
let tf: typeof import('@tensorflow/tfjs') | null = null;
let _model: any = null; // tf.Sequential

async function ensureTF() {
  if (!tf) {
    tf = await import('@tensorflow/tfjs');
  }
  return tf;
}

// ─── Feature Extraction ─────────────────────────

export function extractFeatures(candles: OHLCVCandle[]): number[] {
  if (candles.length < 30) return [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

  // 1. Normalized RSI (0-1)
  const rsi = calcRSI(candles) / 100;

  // 2. MACD histogram sign (-1, 0, 1 → normalized to 0-1)
  const macd = calcMACD(candles);
  const macdNorm = (Math.tanh(macd.histogram * 100) + 1) / 2;

  // 3. Volume change ratio (last vs avg of prev 20)
  const avgVol = candles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20;
  const lastVol = candles[candles.length - 1].volume;
  const volRatio = avgVol > 0 ? Math.min(lastVol / avgVol / 5, 1) : 0.5; // normalize 0-5x to 0-1

  // 4. ATR-based volatility (normalized)
  const atr = calcATR(candles);
  const lastPrice = candles[candles.length - 1].close;
  const atrPct = lastPrice > 0 ? atr / lastPrice : 0;
  const volNorm = Math.min(atrPct * 20, 1); // normalize ~5% ATR to 1

  // 5. Price momentum (5-period rate of change, normalized)
  const close = candles[candles.length - 1].close;
  const close5 = candles[candles.length - 6]?.close ?? close;
  const roc = close5 > 0 ? (close - close5) / close5 : 0;
  const momNorm = (Math.tanh(roc * 10) + 1) / 2;

  // 6. BB position (0-1)
  const bb = calcBollingerBands(candles);
  const bbRange = bb.upper - bb.lower;
  const bbPos = bbRange > 0 ? (close - bb.lower) / bbRange : 0.5;

  return [rsi, macdNorm, volRatio, volNorm, momNorm, Math.max(0, Math.min(1, bbPos))];
}

// ─── Label Generation (for training) ────────────

function generateLabels(candles: OHLCVCandle[], horizon = 5): number[] {
  const labels: number[] = [];
  const atr = calcATR(candles);
  const threshold = atr * 0.5;

  for (let i = 0; i < candles.length - horizon; i++) {
    const current = candles[i].close;
    const future = candles[i + horizon].close;
    const diff = future - current;

    if (diff > threshold) labels.push(1);        // price went up
    else if (diff < -threshold) labels.push(0);  // price went down
    else labels.push(0.5);                        // neutral
  }

  return labels;
}

// ─── Train Model ─────────────────────────────────

export async function trainModel(
  candles: OHLCVCandle[],
  config?: { epochs?: number; batchSize?: number },
): Promise<boolean> {
  const tfLib = await ensureTF();
  const epochs = config?.epochs ?? 50;
  const batchSize = config?.batchSize ?? 8;

  if (candles.length < 50) return false;

  // Generate training data
  const horizon = 5;
  const features: number[][] = [];
  const labels = generateLabels(candles, horizon);

  for (let i = 30; i < candles.length - horizon; i++) {
    features.push(extractFeatures(candles.slice(0, i + 1)));
  }

  // Align features and labels
  const minLen = Math.min(features.length, labels.length);
  const trainFeatures = features.slice(features.length - minLen);
  const trainLabels = labels.slice(labels.length - minLen);

  if (trainFeatures.length < 20) return false;

  // Dispose old model
  if (_model) {
    _model.dispose();
    _model = null;
  }

  // Build model: input(6) → dense(32,relu) → dense(16,relu) → dense(1,sigmoid)
  _model = tfLib.sequential();
  _model.add(tfLib.layers.dense({ units: 32, activation: 'relu', inputShape: [6] }));
  _model.add(tfLib.layers.dense({ units: 16, activation: 'relu' }));
  _model.add(tfLib.layers.dense({ units: 1, activation: 'sigmoid' }));

  _model.compile({
    optimizer: tfLib.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  // Train
  const xs = tfLib.tensor2d(trainFeatures);
  const ys = tfLib.tensor2d(trainLabels.map((l) => [l]));

  await _model.fit(xs, ys, {
    epochs,
    batchSize,
    validationSplit: 0.2,
    shuffle: true,
  });

  xs.dispose();
  ys.dispose();

  return true;
}

// ─── Predict ─────────────────────────────────────

export async function predict(candles: OHLCVCandle[]): Promise<number> {
  if (!_model || candles.length < 30) return 0;

  const tfLib = await ensureTF();
  const features = extractFeatures(candles);
  const input = tfLib.tensor2d([features]);
  const output = _model.predict(input) as any;
  const value = (await output.data())[0] as number;

  input.dispose();
  output.dispose();

  // Map sigmoid (0-1) to signal (-1..+1)
  return (value - 0.5) * 2;
}

// ─── Cleanup ─────────────────────────────────────

export function disposeModel(): void {
  if (_model) {
    _model.dispose();
    _model = null;
  }
}

export function isModelReady(): boolean {
  return _model !== null;
}
