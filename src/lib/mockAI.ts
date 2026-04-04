import type { AIAnalysis, BeginnerAnalysis, YOLOAnalysis, IndicatorResult, OHLCVCandle } from '../types/nodes';
import { calcTradeSetup } from './indicators';

export function generateMockAnalysis(
  pair: string,
  indicators: IndicatorResult[],
  lastPrice: number,
  candles?: OHLCVCandle[],
  selectedIndicators?: string[],
): AIAnalysis {
  const buySignals = indicators.filter(i => i.signal === 'buy').length;
  const sellSignals = indicators.filter(i => i.signal === 'sell').length;
  const totalSignals = indicators.length || 1;

  const score = (buySignals - sellSignals) / totalSignals;

  let verdict: AIAnalysis['verdict'];
  if (score > 0.5) verdict = 'Strong Buy';
  else if (score > 0.15) verdict = 'Buy';
  else if (score < -0.5) verdict = 'Strong Sell';
  else if (score < -0.15) verdict = 'Sell';
  else verdict = 'Neutral';

  const confidence = Math.min(95, Math.round(50 + Math.abs(score) * 45));

  // Smart trade setup from actual analysis
  let entry = lastPrice;
  let stopLoss: number;
  let takeProfit: number;
  let riskReward = 0;

  if (candles && candles.length > 20) {
    const setup = calcTradeSetup(candles, indicators, selectedIndicators ?? []);
    entry = setup.entry;
    stopLoss = setup.stopLoss;
    takeProfit = setup.takeProfit;
    riskReward = setup.riskReward;
  } else {
    // Fallback for when no candles available
    const volatility = lastPrice * 0.02;
    stopLoss = Math.round((lastPrice - (score > 0 ? volatility : -volatility * 0.5)) * 100000) / 100000;
    takeProfit = Math.round((lastPrice + (score > 0 ? volatility * 2 : -volatility * 2)) * 100000) / 100000;
  }

  // Build summary from actual indicator data
  const indDetails = indicators.map(i => {
    const dir = i.signal === 'buy' ? 'bullish' : i.signal === 'sell' ? 'bearish' : 'neutral';
    return `${i.name}: ${dir} (${i.description})`;
  }).join('. ');

  const summaries: Record<string, string> = {
    'Strong Buy': `Strong bullish confluence on ${pair}. ${indDetails}. R:R ${riskReward}:1.`,
    'Buy': `Moderate bullish bias on ${pair}. ${indDetails}. Entry at ${entry}, targeting R:R ${riskReward}:1.`,
    'Neutral': `Mixed signals on ${pair}. ${indDetails}. No clear edge — consider waiting.`,
    'Sell': `Bearish pressure on ${pair}. ${indDetails}. R:R ${riskReward}:1.`,
    'Strong Sell': `Strong bearish confluence on ${pair}. ${indDetails}. R:R ${riskReward}:1.`,
  };

  const signals = indicators.map(ind => ({
    name: ind.name,
    direction: ind.signal === 'buy' ? 'long' as const : ind.signal === 'sell' ? 'short' as const : 'neutral' as const,
    strength: ind.signal === 'neutral' ? 50 : Math.min(95, 55 + Math.abs(ind.value) * 0.5),
  }));

  // Only add synthetic signals if we have few real ones
  if (signals.length < 3) {
    signals.push(
      { name: 'Volume Profile', direction: score > 0 ? 'long' : 'short', strength: 55 + Math.random() * 30 },
      { name: 'Market Structure', direction: score > 0 ? 'long' : score < 0 ? 'short' : 'neutral', strength: 60 + Math.random() * 25 },
      { name: 'Order Flow', direction: 'neutral', strength: 45 + Math.random() * 20 },
    );
  }

  const riskLevel = Math.abs(score) > 0.5 ? 'Low' : Math.abs(score) > 0.2 ? 'Medium' : 'High';

  return {
    verdict,
    confidence,
    summary: summaries[verdict],
    signals,
    riskLevel,
    riskMismatch: riskLevel === 'High' ? 'Conflicting signals — reduce position size' : null,
    stopLoss,
    takeProfit,
    entry,
  };
}

export function generateBeginnerAnalysis(
  pair: string,
  indicators: IndicatorResult[],
  lastPrice: number,
  candles?: OHLCVCandle[],
  selectedIndicators?: string[],
): BeginnerAnalysis {
  const base = generateMockAnalysis(pair, indicators, lastPrice, candles, selectedIndicators);

  const rsiInd = indicators.find(i => i.name.includes('RSI'));
  const macdInd = indicators.find(i => i.name.includes('MACD'));

  const whyParts: string[] = [];
  if (rsiInd) {
    if (rsiInd.signal === 'buy') whyParts.push(`RSI is at ${rsiInd.value} (oversold below 30) — the pair looks undervalued right now`);
    else if (rsiInd.signal === 'sell') whyParts.push(`RSI is at ${rsiInd.value} (overbought above 70) — the pair may be overextended`);
    else whyParts.push(`RSI is at ${rsiInd.value} — in neutral territory, no strong signal yet`);
  }
  if (macdInd) {
    if (macdInd.signal === 'buy') whyParts.push('MACD shows upward momentum building');
    else if (macdInd.signal === 'sell') whyParts.push('MACD shows downward momentum');
  }

  const safeToTrade = base.riskLevel !== 'High' && base.riskLevel !== 'Extreme' && base.confidence > 55;

  const steps = [
    `1. Check ${pair} chart on H4 timeframe`,
    base.verdict.includes('Buy')
      ? '2. Look for a pullback to support before entering long'
      : base.verdict.includes('Sell')
      ? '2. Wait for a retest of resistance before entering short'
      : '2. Wait for a clearer signal before taking any action',
    `3. Set Stop Loss at ${base.stopLoss.toFixed(5)}`,
    `4. Set Take Profit at ${base.takeProfit.toFixed(5)}`,
    '5. Risk no more than 1-2% of your account on this trade',
  ];

  const tips = [
    'Never risk more than 2% of your account on a single trade.',
    'Always set a Stop Loss before entering. No exceptions.',
    'RSI below 30 means oversold — it might bounce up. Above 70 means overbought.',
    'MACD crossing above signal line = bullish momentum. Below = bearish.',
    'News events (NFP, FOMC) can cause wild moves. Avoid trading 30 min before/after.',
    'Bollinger Bands squeezing? A big move is coming — wait for direction.',
    'Don\'t trade when you\'re emotional. Walk away and come back fresh.',
    'Paper trade first. Real money amplifies emotions 10x.',
  ];

  return {
    ...base,
    whyExplanation: whyParts.join('. ') || 'Analyzing market conditions for you...',
    safeToTrade,
    steps,
    lessonTip: tips[Math.floor(Math.random() * tips.length)],
  };
}

export function generateYOLOAnalysis(
  pair: string,
  indicators: IndicatorResult[],
  lastPrice: number,
  candles?: OHLCVCandle[],
  selectedIndicators?: string[],
): YOLOAnalysis {
  const base = generateMockAnalysis(pair, indicators, lastPrice, candles, selectedIndicators);

  const momentumScore = Math.round(30 + Math.random() * 70);
  const adrenalineMeter = Math.min(100, Math.round(momentumScore * 1.2 + Math.random() * 20));

  // Mock risk cap usage
  const tradesUsed = Math.floor(Math.random() * 6) + 1;
  const maxTrades = 10;
  const dailyLossUsed = Math.round(50 + Math.random() * 300);
  const maxDailyLoss = 500;

  // Override verdict to be more aggressive
  let verdict = base.verdict;
  if (verdict === 'Neutral' && momentumScore > 60) {
    verdict = Math.random() > 0.5 ? 'Buy' : 'Sell';
  }

  // YOLO: tighter SL, wider TP based on base analysis
  const isLong = verdict.includes('Buy');
  const risk = Math.abs(base.entry - base.stopLoss);

  // Tighter SL (70% of normal), wider TP (150% of normal)
  const yoloSL = isLong
    ? base.entry - risk * 0.7
    : base.entry + risk * 0.7;
  const yoloTP = isLong
    ? base.entry + Math.abs(base.takeProfit - base.entry) * 1.5
    : base.entry - Math.abs(base.entry - base.takeProfit) * 1.5;

  const decimals = lastPrice > 100 ? 2 : 5;
  const factor = Math.pow(10, decimals);

  return {
    ...base,
    verdict,
    summary: `${pair} momentum score: ${momentumScore}/100. ${
      momentumScore > 70 ? 'HIGH MOMENTUM — conditions favor aggressive entry.' :
      momentumScore > 40 ? 'Moderate momentum. Position size accordingly.' :
      'Low momentum. Maybe sit this one out... or not. Your call.'
    }`,
    adrenalineMeter,
    momentumScore,
    riskBudgetUsed: Math.round((dailyLossUsed / maxDailyLoss) * 100),
    tradesUsed,
    maxTrades,
    dailyLossUsed,
    maxDailyLoss,
    stopLoss: Math.round(yoloSL * factor) / factor,
    takeProfit: Math.round(yoloTP * factor) / factor,
    riskMismatch: dailyLossUsed / maxDailyLoss > 0.8 ? 'SLOW DOWN — Budget almost gone!' :
                  adrenalineMeter > 90 ? 'Maximum adrenaline — trade with caution!' : null,
  };
}
