/**
 * Crypto-specific indicators.
 * Reuses base calculations from indicators.ts, adds crypto-specific metrics.
 */

import type { OHLCVCandle, IndicatorResult } from '../types/nodes';
import { calcRSI, calcMACD, calcBollingerBands, calcATR, calcEMAIndicator } from './indicators';

// ─── Volume Spike ────────────────────────────────
// Compares latest volume to average of previous N candles

export function calcVolumeSpike(candles: OHLCVCandle[], period = 20): { multiplier: number; signal: 'buy' | 'sell' | 'neutral' } {
  if (candles.length < period + 1) return { multiplier: 1, signal: 'neutral' };

  const recent = candles.slice(-period - 1, -1);
  const avgVolume = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
  const lastVolume = candles[candles.length - 1].volume;
  const multiplier = avgVolume > 0 ? lastVolume / avgVolume : 1;

  // High volume + price up = bullish, high volume + price down = bearish
  const lastClose = candles[candles.length - 1].close;
  const prevClose = candles[candles.length - 2].close;
  const priceUp = lastClose > prevClose;

  let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
  if (multiplier > 2) {
    signal = priceUp ? 'buy' : 'sell';
  }

  return { multiplier: Math.round(multiplier * 10) / 10, signal };
}

// ─── Price Dip from Recent High ──────────────────

export function calcPriceDip(candles: OHLCVCandle[], period = 20): { dipPercent: number; signal: 'buy' | 'sell' | 'neutral' } {
  if (candles.length < period) return { dipPercent: 0, signal: 'neutral' };

  const recent = candles.slice(-period);
  const highestHigh = Math.max(...recent.map((c) => c.high));
  const currentClose = candles[candles.length - 1].close;
  const dipPercent = ((currentClose - highestHigh) / highestHigh) * 100;

  // >5% dip = potential buy (oversold bounce), moderate dip = neutral
  let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
  if (dipPercent < -8) signal = 'buy';      // deep dip = strong buy signal
  else if (dipPercent < -5) signal = 'buy';  // moderate dip
  else if (dipPercent > 0) signal = 'sell';  // at highs

  return { dipPercent: Math.round(dipPercent * 100) / 100, signal };
}

// ─── Momentum Score ──────────────────────────────
// Composite: Rate of Change + Volume Trend + RSI position

export function calcMomentumScore(candles: OHLCVCandle[]): { score: number; signal: 'buy' | 'sell' | 'neutral' } {
  if (candles.length < 20) return { score: 50, signal: 'neutral' };

  // Rate of change (5-period)
  const close = candles[candles.length - 1].close;
  const close5 = candles[candles.length - 6]?.close ?? close;
  const roc = ((close - close5) / close5) * 100;
  const rocScore = Math.max(0, Math.min(100, 50 + roc * 5));

  // Volume trend (rising = bullish)
  const vol5 = candles.slice(-5).reduce((s, c) => s + c.volume, 0) / 5;
  const vol20 = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  const volScore = vol20 > 0 ? Math.max(0, Math.min(100, (vol5 / vol20) * 50)) : 50;

  // RSI component
  const rsi = calcRSI(candles);
  const rsiScore = rsi; // 0-100 directly

  // Weighted composite
  const score = Math.round(rocScore * 0.4 + volScore * 0.3 + rsiScore * 0.3);

  let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
  if (score > 65) signal = 'buy';
  else if (score < 35) signal = 'sell';

  return { score, signal };
}

// ─── Funding Rate (demo/seeded) ──────────────────

export function calcFundingRate(): { rate: number; signal: 'buy' | 'sell' | 'neutral' } {
  const seed = Math.floor(Date.now() / 300000);
  const rate = ((seed * 13 + 7) % 200 - 100) / 10000; // -0.01 to +0.01

  // Positive funding = longs pay shorts → contrarian sell
  // Negative funding = shorts pay longs → contrarian buy
  const signal: 'buy' | 'sell' | 'neutral' = rate > 0.005 ? 'sell' : rate < -0.005 ? 'buy' : 'neutral';

  return { rate: Math.round(rate * 10000) / 10000, signal };
}

// ─── BTC Dominance (demo/seeded) ─────────────────

export function calcBTCDominance(): { dominance: number; signal: 'buy' | 'sell' | 'neutral' } {
  const seed = Math.floor(Date.now() / 300000);
  const dominance = 45 + ((seed * 17 + 3) % 20); // 45-65%

  // High BTC dominance = altcoins weak → sell alts
  // Low BTC dominance = alt season → buy alts
  const signal: 'buy' | 'sell' | 'neutral' = dominance > 55 ? 'sell' : dominance < 48 ? 'buy' : 'neutral';

  return { dominance, signal };
}

// ─── Main: Get all crypto signals ────────────────

export function getCryptoIndicatorSignals(
  candles: OHLCVCandle[],
  selectedMetrics: string[],
): IndicatorResult[] {
  const results: IndicatorResult[] = [];

  if (selectedMetrics.includes('RSI')) {
    const rsi = calcRSI(candles);
    results.push({
      name: 'RSI (14)',
      value: rsi,
      signal: rsi > 70 ? 'sell' : rsi < 30 ? 'buy' : 'neutral',
      description: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral zone',
    });
  }

  if (selectedMetrics.includes('MACD')) {
    const macd = calcMACD(candles);
    results.push({
      name: 'MACD',
      value: macd.histogram,
      signal: macd.histogram > 0 ? 'buy' : macd.histogram < 0 ? 'sell' : 'neutral',
      description: macd.histogram > 0 ? 'Bullish momentum' : 'Bearish momentum',
    });
  }

  if (selectedMetrics.includes('Bollinger Bands')) {
    const bb = calcBollingerBands(candles);
    const lastPrice = candles[candles.length - 1]?.close ?? 0;
    const pos = (lastPrice - bb.lower) / (bb.upper - bb.lower);
    results.push({
      name: 'BB Position',
      value: Math.round(pos * 100),
      signal: pos > 0.8 ? 'sell' : pos < 0.2 ? 'buy' : 'neutral',
      description: pos > 0.8 ? 'Near upper band' : pos < 0.2 ? 'Near lower band' : 'Mid range',
    });
  }

  if (selectedMetrics.includes('Volume Spike')) {
    const vs = calcVolumeSpike(candles);
    results.push({
      name: 'Volume Spike',
      value: vs.multiplier,
      signal: vs.signal,
      description: vs.multiplier > 2 ? `${vs.multiplier}x average volume` : 'Normal volume',
    });
  }

  if (selectedMetrics.includes('Price Dip')) {
    const pd = calcPriceDip(candles);
    results.push({
      name: 'Price Dip',
      value: pd.dipPercent,
      signal: pd.signal,
      description: pd.dipPercent < -5 ? `${pd.dipPercent}% from high` : 'Near highs',
    });
  }

  if (selectedMetrics.includes('Momentum')) {
    const mom = calcMomentumScore(candles);
    results.push({
      name: 'Momentum Score',
      value: mom.score,
      signal: mom.signal,
      description: mom.score > 65 ? 'Strong momentum' : mom.score < 35 ? 'Weak momentum' : 'Moderate',
    });
  }

  if (selectedMetrics.includes('Funding Rate')) {
    const fr = calcFundingRate();
    results.push({
      name: 'Funding Rate',
      value: fr.rate * 10000, // display as basis points
      signal: fr.signal,
      description: fr.rate > 0 ? `+${(fr.rate * 100).toFixed(3)}% (longs pay)` : `${(fr.rate * 100).toFixed(3)}% (shorts pay)`,
    });
  }

  if (selectedMetrics.includes('BTC Dominance')) {
    const dom = calcBTCDominance();
    results.push({
      name: 'BTC Dominance',
      value: dom.dominance,
      signal: dom.signal,
      description: dom.dominance > 55 ? 'BTC dominant — alts weak' : dom.dominance < 48 ? 'Alt season' : 'Balanced',
    });
  }

  if (selectedMetrics.includes('EMA')) {
    const ema20 = calcEMAIndicator(candles, 20);
    const ema50 = calcEMAIndicator(candles, 50);
    results.push({
      name: 'EMA (20/50)',
      value: Math.round((ema20 - ema50) * 100) / 100,
      signal: ema20 > ema50 ? 'buy' : 'sell',
      description: ema20 > ema50 ? 'Golden cross' : 'Death cross',
    });
  }

  if (selectedMetrics.includes('ATR')) {
    const atr = calcATR(candles);
    const lastPrice = candles[candles.length - 1]?.close ?? 1;
    const atrPercent = (atr / lastPrice) * 100;
    results.push({
      name: 'ATR Volatility',
      value: Math.round(atrPercent * 100) / 100,
      signal: atrPercent > 3 ? 'sell' : atrPercent < 1 ? 'buy' : 'neutral',
      description: atrPercent > 3 ? 'High volatility' : atrPercent < 1 ? 'Low volatility' : 'Normal volatility',
    });
  }

  return results;
}
