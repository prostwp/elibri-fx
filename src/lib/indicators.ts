import type { OHLCVCandle, IndicatorResult } from '../types/nodes';

export function calcRSI(candles: OHLCVCandle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  const closes = candles.slice(-period - 1).map(c => c.close);
  let gains = 0, losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

export function calcMACD(candles: OHLCVCandle[]): { macd: number; signal: number; histogram: number } {
  const closes = candles.map(c => c.close);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const macdValues: number[] = [];
  for (let i = 26; i < closes.length; i++) {
    macdValues.push(calcEMA(closes.slice(0, i + 1), 12) - calcEMA(closes.slice(0, i + 1), 26));
  }
  const signalLine = macdValues.length >= 9 ? calcEMAFromArray(macdValues, 9) : macdLine;
  return {
    macd: Math.round(macdLine * 10000) / 10000,
    signal: Math.round(signalLine * 10000) / 10000,
    histogram: Math.round((macdLine - signalLine) * 10000) / 10000,
  };
}

function calcEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcEMAFromArray(values: number[], period: number): number {
  return calcEMA(values, period);
}

export function calcBollingerBands(candles: OHLCVCandle[], period = 20): { upper: number; middle: number; lower: number } {
  const closes = candles.slice(-period).map(c => c.close);
  const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((sum, v) => sum + (v - sma) ** 2, 0) / closes.length;
  const stddev = Math.sqrt(variance);
  return {
    upper: Math.round((sma + 2 * stddev) * 100) / 100,
    middle: Math.round(sma * 100) / 100,
    lower: Math.round((sma - 2 * stddev) * 100) / 100,
  };
}

export function calcSMA(candles: OHLCVCandle[], period = 20): number {
  const closes = candles.slice(-period).map(c => c.close);
  return Math.round((closes.reduce((a, b) => a + b, 0) / closes.length) * 100) / 100;
}

export function calcEMAIndicator(candles: OHLCVCandle[], period = 20): number {
  return Math.round(calcEMA(candles.map(c => c.close), period) * 100) / 100;
}

// ATR — Average True Range (for dynamic SL/TP)
export function calcATR(candles: OHLCVCandle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1]?.close ?? candles[i].open;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// Find recent support/resistance levels from candle data
export function findSupportResistance(candles: OHLCVCandle[], lookback = 50): { support: number; resistance: number } {
  const recent = candles.slice(-lookback);
  if (recent.length === 0) return { support: 0, resistance: 0 };

  const lows = recent.map(c => c.low);
  const highs = recent.map(c => c.high);

  // Find clusters of similar lows (support) and highs (resistance)
  lows.sort((a, b) => a - b);
  highs.sort((a, b) => b - a);

  // Support = average of bottom 20% lows
  const supportSlice = lows.slice(0, Math.max(3, Math.floor(lows.length * 0.2)));
  const support = supportSlice.reduce((a, b) => a + b, 0) / supportSlice.length;

  // Resistance = average of top 20% highs
  const resistanceSlice = highs.slice(0, Math.max(3, Math.floor(highs.length * 0.2)));
  const resistance = resistanceSlice.reduce((a, b) => a + b, 0) / resistanceSlice.length;

  return { support, resistance };
}

// Calculate smart trade setup based on actual node analysis
export function calcTradeSetup(
  candles: OHLCVCandle[],
  indicators: IndicatorResult[],
  selectedIndicators: string[],
  riskPct: number = 0.005,
  accountBalance: number = 10000,
): { entry: number; stopLoss: number; takeProfit: number; riskReward: number; suggestedVolume: number } {
  const lastPrice = candles[candles.length - 1]?.close ?? 0;
  if (lastPrice === 0) return { entry: 0, stopLoss: 0, takeProfit: 0, riskReward: 0, suggestedVolume: 0 };

  const atr = calcATR(candles);
  const { support, resistance } = findSupportResistance(candles);

  // Direction from indicators
  const buySignals = indicators.filter(i => i.signal === 'buy').length;
  const sellSignals = indicators.filter(i => i.signal === 'sell').length;
  const isLong = buySignals >= sellSignals;

  // Entry: current price (market entry)
  const entry = lastPrice;

  // SL/TP based on ATR + S/R levels
  let stopLoss: number;
  let takeProfit: number;

  if (isLong) {
    // SL below support or 1.5 ATR below entry, whichever is tighter
    const slFromATR = entry - atr * 1.5;
    const slFromSupport = support - atr * 0.2; // just below support
    stopLoss = Math.max(slFromATR, slFromSupport); // tighter SL = higher value for long

    // TP at resistance or 2.5 ATR above entry
    const tpFromATR = entry + atr * 2.5;
    const tpFromResistance = resistance + atr * 0.1;
    takeProfit = Math.min(tpFromATR, tpFromResistance);

    // If BB available, refine
    if (selectedIndicators.includes('Bollinger Bands')) {
      const bb = calcBollingerBands(candles);
      // If price near lower band → stronger long signal, TP at upper band
      if (lastPrice < bb.middle) {
        takeProfit = Math.max(takeProfit, bb.upper);
      }
    }
  } else {
    // Short: SL above resistance or 1.5 ATR above
    const slFromATR = entry + atr * 1.5;
    const slFromResistance = resistance + atr * 0.2;
    stopLoss = Math.min(slFromATR, slFromResistance);

    // TP at support or 2.5 ATR below
    const tpFromATR = entry - atr * 2.5;
    const tpFromSupport = support - atr * 0.1;
    takeProfit = Math.max(tpFromATR, tpFromSupport);

    if (selectedIndicators.includes('Bollinger Bands')) {
      const bb = calcBollingerBands(candles);
      if (lastPrice > bb.middle) {
        takeProfit = Math.min(takeProfit, bb.lower);
      }
    }
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  const riskReward = risk > 0 ? Math.round((reward / risk) * 10) / 10 : 0;

  // Position sizing: risk_usd / (atr × sl_multiplier)
  const slMultiplier = 1.5;
  const riskUsd = accountBalance * riskPct;
  const atrSlDistance = atr * slMultiplier;
  const suggestedVolume = atrSlDistance > 0
    ? Math.round((riskUsd / atrSlDistance) * 100) / 100
    : 0;

  // Round based on price magnitude
  const decimals = lastPrice > 100 ? 2 : 5;
  const factor = Math.pow(10, decimals);

  return {
    entry: Math.round(entry * factor) / factor,
    stopLoss: Math.round(stopLoss * factor) / factor,
    takeProfit: Math.round(takeProfit * factor) / factor,
    riskReward,
    suggestedVolume,
  };
}

export function getIndicatorSignals(candles: OHLCVCandle[], selectedIndicators: string[]): IndicatorResult[] {
  const results: IndicatorResult[] = [];
  const lastPrice = candles[candles.length - 1]?.close ?? 0;

  if (selectedIndicators.includes('RSI')) {
    const rsi = calcRSI(candles);
    results.push({
      name: 'RSI (14)',
      value: rsi,
      signal: rsi > 70 ? 'sell' : rsi < 30 ? 'buy' : 'neutral',
      description: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral zone',
    });
  }

  if (selectedIndicators.includes('MACD')) {
    const macd = calcMACD(candles);
    results.push({
      name: 'MACD',
      value: macd.histogram,
      signal: macd.histogram > 0 ? 'buy' : macd.histogram < 0 ? 'sell' : 'neutral',
      description: macd.histogram > 0 ? 'Bullish momentum' : 'Bearish momentum',
    });
  }

  if (selectedIndicators.includes('Bollinger Bands')) {
    const bb = calcBollingerBands(candles);
    const pos = (lastPrice - bb.lower) / (bb.upper - bb.lower);
    results.push({
      name: 'Bollinger Bands',
      value: Math.round(pos * 100),
      signal: pos > 0.8 ? 'sell' : pos < 0.2 ? 'buy' : 'neutral',
      description: pos > 0.8 ? 'Near upper band' : pos < 0.2 ? 'Near lower band' : 'Mid range',
    });
  }

  if (selectedIndicators.includes('EMA')) {
    const ema20 = calcEMAIndicator(candles, 20);
    const ema50 = calcEMAIndicator(candles, 50);
    results.push({
      name: 'EMA Cross (20/50)',
      value: Math.round((ema20 - ema50) * 100) / 100,
      signal: ema20 > ema50 ? 'buy' : 'sell',
      description: ema20 > ema50 ? 'Golden cross' : 'Death cross',
    });
  }

  if (selectedIndicators.includes('SMA')) {
    const sma = calcSMA(candles, 50);
    results.push({
      name: 'SMA (50)',
      value: sma,
      signal: lastPrice > sma ? 'buy' : 'sell',
      description: lastPrice > sma ? 'Price above SMA' : 'Price below SMA',
    });
  }

  return results;
}
