/**
 * Chart Pattern Detection — алгоритмическое распознавание паттернов.
 * Работает на OHLCV свечах, без ML.
 */

import type { OHLCVCandle } from '../types/nodes';

export interface PatternResult {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  description: string;
}

/**
 * Find local highs and lows (pivot points)
 */
function findPivots(candles: OHLCVCandle[], lookback = 5) {
  const highs: { index: number; price: number }[] = [];
  const lows: { index: number; price: number }[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: candles[i].high });
    if (isLow) lows.push({ index: i, price: candles[i].low });
  }
  return { highs, lows };
}

/**
 * Double Top — два пика на примерно одном уровне
 */
function detectDoubleTop(candles: OHLCVCandle[]): PatternResult | null {
  const { highs } = findPivots(candles.slice(-60));
  if (highs.length < 2) return null;

  const last2 = highs.slice(-2);
  const priceDiff = Math.abs(last2[0].price - last2[1].price) / last2[0].price;
  const indexDiff = last2[1].index - last2[0].index;

  if (priceDiff < 0.005 && indexDiff > 5 && indexDiff < 40) {
    return {
      name: 'Double Top',
      type: 'bearish',
      confidence: Math.round(80 - priceDiff * 10000),
      description: `Two peaks at ~${last2[0].price.toFixed(4)} — bearish reversal signal`,
    };
  }
  return null;
}

/**
 * Double Bottom — два дна на примерно одном уровне
 */
function detectDoubleBottom(candles: OHLCVCandle[]): PatternResult | null {
  const { lows } = findPivots(candles.slice(-60));
  if (lows.length < 2) return null;

  const last2 = lows.slice(-2);
  const priceDiff = Math.abs(last2[0].price - last2[1].price) / last2[0].price;
  const indexDiff = last2[1].index - last2[0].index;

  if (priceDiff < 0.005 && indexDiff > 5 && indexDiff < 40) {
    return {
      name: 'Double Bottom',
      type: 'bullish',
      confidence: Math.round(80 - priceDiff * 10000),
      description: `Two troughs at ~${last2[0].price.toFixed(4)} — bullish reversal signal`,
    };
  }
  return null;
}

/**
 * Head & Shoulders — три пика, средний выше
 */
function detectHeadAndShoulders(candles: OHLCVCandle[]): PatternResult | null {
  const { highs } = findPivots(candles.slice(-80));
  if (highs.length < 3) return null;

  const last3 = highs.slice(-3);
  const [left, head, right] = last3;

  // Head must be highest
  if (head.price > left.price && head.price > right.price) {
    // Shoulders should be at similar level
    const shoulderDiff = Math.abs(left.price - right.price) / left.price;
    if (shoulderDiff < 0.01) {
      return {
        name: 'Head & Shoulders',
        type: 'bearish',
        confidence: Math.round(75 - shoulderDiff * 5000),
        description: `H&S pattern: head at ${head.price.toFixed(4)} — bearish reversal`,
      };
    }
  }
  return null;
}

/**
 * Inverse Head & Shoulders
 */
function detectInverseHS(candles: OHLCVCandle[]): PatternResult | null {
  const { lows } = findPivots(candles.slice(-80));
  if (lows.length < 3) return null;

  const last3 = lows.slice(-3);
  const [left, head, right] = last3;

  if (head.price < left.price && head.price < right.price) {
    const shoulderDiff = Math.abs(left.price - right.price) / left.price;
    if (shoulderDiff < 0.01) {
      return {
        name: 'Inverse H&S',
        type: 'bullish',
        confidence: Math.round(75 - shoulderDiff * 5000),
        description: `Inverse H&S: head at ${head.price.toFixed(4)} — bullish reversal`,
      };
    }
  }
  return null;
}

/**
 * Triangle (converging trendlines)
 */
function detectTriangle(candles: OHLCVCandle[]): PatternResult | null {
  const recent = candles.slice(-30);
  if (recent.length < 20) return null;

  const firstHalf = recent.slice(0, 15);
  const secondHalf = recent.slice(15);

  const firstRange = Math.max(...firstHalf.map(c => c.high)) - Math.min(...firstHalf.map(c => c.low));
  const secondRange = Math.max(...secondHalf.map(c => c.high)) - Math.min(...secondHalf.map(c => c.low));

  if (secondRange < firstRange * 0.6) {
    // Tightening range — triangle
    const lastClose = candles[candles.length - 1].close;
    const midFirst = (Math.max(...firstHalf.map(c => c.high)) + Math.min(...firstHalf.map(c => c.low))) / 2;
    const bias = lastClose > midFirst ? 'bullish' : 'bearish';

    return {
      name: 'Triangle',
      type: bias === 'bullish' ? 'bullish' : 'bearish',
      confidence: Math.round(60 + (1 - secondRange / firstRange) * 30),
      description: `Converging price action — ${bias} breakout likely`,
    };
  }
  return null;
}

/**
 * Main: detect all patterns
 */
export function detectPatterns(candles: OHLCVCandle[]): PatternResult[] {
  if (candles.length < 30) return [];

  const results: PatternResult[] = [];

  const dt = detectDoubleTop(candles);
  if (dt) results.push(dt);

  const db = detectDoubleBottom(candles);
  if (db) results.push(db);

  const hs = detectHeadAndShoulders(candles);
  if (hs) results.push(hs);

  const ihs = detectInverseHS(candles);
  if (ihs) results.push(ihs);

  const tri = detectTriangle(candles);
  if (tri) results.push(tri);

  // If no patterns found, return "No clear pattern"
  if (results.length === 0) {
    results.push({
      name: 'No Pattern',
      type: 'neutral',
      confidence: 0,
      description: 'No recognizable chart pattern detected',
    });
  }

  return results;
}
