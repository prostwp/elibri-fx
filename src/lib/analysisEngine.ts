/**
 * Analysis Engine — единый движок для всех трёх режимов (Beginner/Pro/YOLO).
 * Использует GraphResult из graphEngine.ts для взвешенного анализа.
 */

import type { Node, Edge } from '@xyflow/react';
import type {
  AIAnalysis, BeginnerAnalysis, YOLOAnalysis,
  OHLCVCandle, IndicatorResult,
} from '../types/nodes';
import { evaluateGraph, type GraphResult } from './graphEngine';
import { calcATR, findSupportResistance, calcBollingerBands } from './indicators';

// ─── Verdict from graph score ───────────────────
function scoreToVerdict(score: number): string {
  if (score > 0.5)  return 'Strong Buy';
  if (score > 0.15) return 'Buy';
  if (score < -0.5) return 'Strong Sell';
  if (score < -0.15) return 'Sell';
  return 'Neutral';
}

// ─── Confidence from signal agreement ───────────
function calcConfidence(graph: GraphResult): number {
  if (graph.signals.length === 0) return 50;

  // How much do signals agree? Variance-based.
  const signalValues = graph.signals.map(s => s.signal);
  const mean = signalValues.reduce((a, b) => a + b, 0) / signalValues.length;
  const variance = signalValues.reduce((s, v) => s + (v - mean) ** 2, 0) / signalValues.length;

  // Low variance = high agreement = high confidence
  // Max variance for [-1,1] range is ~1.0
  const agreement = Math.max(0, 1 - variance);

  // Confidence = base (from signal strength) + bonus (from agreement)
  const strengthBase = Math.abs(graph.finalScore) * 60;
  const agreementBonus = agreement * 25;

  return Math.min(95, Math.round(15 + strengthBase + agreementBonus));
}

// ─── Risk level from graph ──────────────────────
function calcRiskLevel(graph: GraphResult, nodes: Node[]): {
  riskLevel: string;
  riskMismatch: string | null;
} {
  const riskNodes = graph.signals.filter(
    s => s.nodeType === 'riskManager' || s.nodeType === 'riskCap'
  );

  // Check if risk nodes are dampening the signal
  const riskDampening = riskNodes.some(r => Math.abs(r.signal) < 0.1);

  // Check RiskCap limits
  const riskCapNode = nodes.find(n => n.type === 'riskCap');
  let budgetWarning: string | null = null;
  if (riskCapNode) {
    const maxLoss = (riskCapNode.data.maxDailyLoss as number) ?? 500;
    const usedLoss = (riskCapNode.data.usedLoss as number) ?? 0;
    if (usedLoss / maxLoss > 0.8) {
      budgetWarning = 'Daily loss limit nearly reached — reduce position size';
    }
  }

  const absScore = Math.abs(graph.finalScore);
  let riskLevel: string;
  if (absScore > 0.5 && !riskDampening) {
    riskLevel = 'Low';
  } else if (absScore > 0.2) {
    riskLevel = 'Medium';
  } else {
    riskLevel = 'High';
  }

  const mismatch = riskLevel === 'High'
    ? 'Conflicting signals — reduce position size'
    : budgetWarning;

  return { riskLevel, riskMismatch: mismatch };
}

// ─── Entry/SL/TP with weight-adjusted aggressiveness ──
function calcWeightedTradeSetup(
  candles: OHLCVCandle[],
  graph: GraphResult,
  nodes: Node[],
): { entry: number; stopLoss: number; takeProfit: number; riskReward: number } {
  const lastPrice = candles[candles.length - 1]?.close ?? 0;
  if (lastPrice === 0 || candles.length < 20) {
    return { entry: 0, stopLoss: 0, takeProfit: 0, riskReward: 0 };
  }

  const atr = calcATR(candles);
  const { support, resistance } = findSupportResistance(candles);
  const isLong = graph.finalScore > 0;

  const entry = lastPrice;

  // Aggressiveness from risk node weights (higher weight = more conservative)
  const riskNodes = nodes.filter(n => n.type === 'riskManager' || n.type === 'riskCap');
  const avgRiskWeight = riskNodes.length > 0
    ? riskNodes.reduce((s, n) => s + ((n.data.weight as number) ?? 0.5), 0) / riskNodes.length
    : 0.5;

  // Conservative multiplier: high risk weight → wider SL, tighter TP
  // Aggressive multiplier: low risk weight → tighter SL, wider TP
  const slMultiplier = 1.0 + avgRiskWeight; // 1.0 - 2.0
  const tpMultiplier = 3.0 - avgRiskWeight; // 2.0 - 3.0

  let stopLoss: number;
  let takeProfit: number;

  if (isLong) {
    const slFromATR = entry - atr * slMultiplier;
    const slFromSupport = support - atr * 0.2;
    stopLoss = Math.max(slFromATR, slFromSupport);

    const tpFromATR = entry + atr * tpMultiplier;
    const tpFromResistance = resistance + atr * 0.1;
    takeProfit = Math.min(tpFromATR, tpFromResistance);

    // BB refinement if technical indicators node exists
    const hasBB = nodes.some(n =>
      (n.type === 'technicalIndicator' || n.type === 'cryptoTechnical') &&
      ((n.data.indicators as string[]) ?? []).includes('Bollinger Bands')
    );
    if (hasBB) {
      const bb = calcBollingerBands(candles);
      if (lastPrice < bb.middle) {
        takeProfit = Math.max(takeProfit, bb.upper);
      }
    }
  } else {
    const slFromATR = entry + atr * slMultiplier;
    const slFromResistance = resistance + atr * 0.2;
    stopLoss = Math.min(slFromATR, slFromResistance);

    const tpFromATR = entry - atr * tpMultiplier;
    const tpFromSupport = support - atr * 0.1;
    takeProfit = Math.max(tpFromATR, tpFromSupport);

    const hasBB = nodes.some(n =>
      (n.type === 'technicalIndicator' || n.type === 'cryptoTechnical') &&
      ((n.data.indicators as string[]) ?? []).includes('Bollinger Bands')
    );
    if (hasBB) {
      const bb = calcBollingerBands(candles);
      if (lastPrice > bb.middle) {
        takeProfit = Math.min(takeProfit, bb.lower);
      }
    }
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  const riskReward = risk > 0 ? Math.round((reward / risk) * 10) / 10 : 0;

  const decimals = lastPrice > 100 ? 2 : 5;
  const factor = Math.pow(10, decimals);

  return {
    entry: Math.round(entry * factor) / factor,
    stopLoss: Math.round(stopLoss * factor) / factor,
    takeProfit: Math.round(takeProfit * factor) / factor,
    riskReward,
  };
}

// ─── Build indicator results from graph ─────────
function collectIndicators(graph: GraphResult): IndicatorResult[] {
  const indicators: IndicatorResult[] = [];
  for (const sig of graph.signals) {
    if (sig.indicators) {
      indicators.push(...sig.indicators);
    }
  }
  return indicators;
}

// ─── Build signal rows for table ────────────────
function buildSignalRows(graph: GraphResult) {
  return graph.signals
    .filter(s => s.nodeType !== 'marketPair' && s.nodeType !== 'chartSource' && s.nodeType !== 'cryptoSource' && s.nodeType !== 'cryptoAsset')
    .map(s => ({
      name: s.label || s.nodeType,
      direction: s.signal > 0.1 ? 'long' as const : s.signal < -0.1 ? 'short' as const : 'neutral' as const,
      strength: Math.min(95, Math.round(50 + Math.abs(s.signal) * 45)),
    }));
}

// ─── Graph validation ───────────────────────────
export interface GraphWarning {
  type: 'error' | 'warning';
  message: string;
}

export function validateGraph(nodes: Node[], edges: Edge[]): GraphWarning[] {
  const warnings: GraphWarning[] = [];

  if (nodes.length === 0) return warnings;

  // Detect mode: fundamental (has stockAnalysis) vs crypto vs forex
  const isFundamental = nodes.some(n => n.type === 'stockAnalysis');
  const isCrypto = nodes.some(n =>
    n.type === 'cryptoSource' || n.type === 'cryptoAsset' ||
    n.type === 'cryptoTechnical' || n.type === 'cryptoScanner' ||
    n.type === 'cryptoML' || n.type === 'mlPredictor' || n.type === 'onChainMetrics',
  );

  if (isFundamental) {
    // Fundamental mode — check for stock-specific nodes
    const hasOutput = nodes.some(n => n.type === 'portfolioScore' || n.type === 'dashboard');
    if (!hasOutput) {
      warnings.push({ type: 'warning', message: 'Add a Portfolio Score node for final verdict' });
    }
  } else if (isCrypto) {
    // Crypto mode
    const hasOutput = nodes.some(n => n.type === 'dashboard');
    const hasAnalysis = nodes.some(n =>
      n.type === 'technicalIndicator' || n.type === 'cryptoTechnical' ||
      n.type === 'cryptoScanner' || n.type === 'mlPredictor' || n.type === 'cryptoML' ||
      n.type === 'tradingAnalyst'
    );
    if (!hasOutput) {
      warnings.push({ type: 'warning', message: 'Add a Dashboard node to see results' });
    }
    if (!hasAnalysis) {
      warnings.push({ type: 'warning', message: 'Add Technical Indicators, Crypto Scanner, or ML Predictor' });
    }
  } else {
    // Forex mode
    const hasSource = nodes.some(n => n.type === 'marketPair' || n.type === 'chartSource');
    const hasOutput = nodes.some(n => n.type === 'dashboard');
    const hasAnalysis = nodes.some(n =>
      n.type === 'technicalIndicator' || n.type === 'tradingAnalyst' || n.type === 'guidedTrader'
    );

    if (!hasSource) {
      warnings.push({ type: 'warning', message: 'Add a Market Pair or Chart Source node' });
    }
    if (!hasOutput) {
      warnings.push({ type: 'warning', message: 'Add a Dashboard node to see results' });
    }
    if (!hasAnalysis) {
      warnings.push({ type: 'warning', message: 'Add Technical Indicators or an AI Agent' });
    }
  }

  // Check for disconnected nodes
  const connectedNodes = new Set<string>();
  for (const e of edges) {
    connectedNodes.add(e.source);
    connectedNodes.add(e.target);
  }
  const disconnected = nodes.filter(n => !connectedNodes.has(n.id));
  if (disconnected.length > 0 && nodes.length > 1) {
    warnings.push({
      type: 'warning',
      message: `${disconnected.length} disconnected node${disconnected.length > 1 ? 's' : ''} — connect them to include in analysis`,
    });
  }

  return warnings;
}

// ═══════════════════════════════════════════════════
// PUBLIC API — единый движок, три формата вывода
// ═══════════════════════════════════════════════════

export function analyzeStrategy(
  nodes: Node[],
  edges: Edge[],
  candles: OHLCVCandle[],
  pair: string,
  mode: 'beginner' | 'pro' | 'yolo',
): AIAnalysis | BeginnerAnalysis | YOLOAnalysis {
  const graph = evaluateGraph(nodes, edges, candles);
  const lastPrice = candles[candles.length - 1]?.close ?? 0;

  const verdict = scoreToVerdict(graph.finalScore);
  const confidence = calcConfidence(graph);
  const { riskLevel, riskMismatch } = calcRiskLevel(graph, nodes);
  const setup = calcWeightedTradeSetup(candles, graph, nodes);
  const indicators = collectIndicators(graph);
  const signals = buildSignalRows(graph);

  // Pad signals if too few
  if (signals.length < 2) {
    const score = graph.finalScore;
    signals.push(
      { name: 'Market Structure', direction: score > 0 ? 'long' : score < 0 ? 'short' : 'neutral', strength: 55 },
      { name: 'Order Flow', direction: 'neutral', strength: 45 },
    );
  }

  // Summary from indicator data
  const indDetails = indicators.map(i => {
    const dir = i.signal === 'buy' ? 'bullish' : i.signal === 'sell' ? 'bearish' : 'neutral';
    return `${i.name}: ${dir}`;
  }).join('. ');

  const summary = verdict.includes('Buy')
    ? `Bullish confluence on ${pair}. ${indDetails}. R:R ${setup.riskReward}:1.`
    : verdict.includes('Sell')
    ? `Bearish pressure on ${pair}. ${indDetails}. R:R ${setup.riskReward}:1.`
    : `Mixed signals on ${pair}. ${indDetails}. No clear edge — consider waiting.`;

  const base: AIAnalysis = {
    verdict: verdict as AIAnalysis['verdict'],
    confidence,
    summary,
    signals,
    riskLevel: riskLevel as AIAnalysis['riskLevel'],
    riskMismatch,
    entry: setup.entry,
    stopLoss: setup.stopLoss,
    takeProfit: setup.takeProfit,
  };

  switch (mode) {
    case 'beginner':
      return buildBeginnerAnalysis(base, indicators, pair);
    case 'yolo':
      return buildYOLOAnalysis(base, graph, nodes, lastPrice, pair);
    default:
      return base;
  }
}

// ─── Beginner formatting ────────────────────────
function buildBeginnerAnalysis(
  base: AIAnalysis,
  indicators: IndicatorResult[],
  pair: string,
): BeginnerAnalysis {
  const rsiInd = indicators.find(i => i.name.includes('RSI'));
  const macdInd = indicators.find(i => i.name.includes('MACD'));

  const whyParts: string[] = [];
  if (rsiInd) {
    if (rsiInd.signal === 'buy') whyParts.push(`RSI is at ${rsiInd.value} (oversold below 30) — the pair looks undervalued`);
    else if (rsiInd.signal === 'sell') whyParts.push(`RSI is at ${rsiInd.value} (overbought above 70) — the pair may be overextended`);
    else whyParts.push(`RSI is at ${rsiInd.value} — in neutral territory, no strong signal yet`);
  }
  if (macdInd) {
    if (macdInd.signal === 'buy') whyParts.push('MACD shows upward momentum building');
    else if (macdInd.signal === 'sell') whyParts.push('MACD shows downward momentum');
  }

  const safeToTrade = base.riskLevel !== 'High' && base.confidence > 55;

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
    lessonTip: tips[Math.floor(Date.now() / 60000) % tips.length], // Rotate tips per minute, not random
  };
}

// ─── YOLO formatting ────────────────────────────
function buildYOLOAnalysis(
  base: AIAnalysis,
  graph: GraphResult,
  nodes: Node[],
  lastPrice: number,
  pair: string,
): YOLOAnalysis {
  // Momentum from graph signal strength
  const momentumScore = Math.min(100, Math.round(Math.abs(graph.finalScore) * 100 + 20));
  const adrenalineMeter = Math.min(100, Math.round(momentumScore * 1.1 + base.confidence * 0.2));

  // Risk budget from RiskCap node
  const riskCapNode = nodes.find(n => n.type === 'riskCap');
  const maxDailyLoss = (riskCapNode?.data.maxDailyLoss as number) ?? 500;
  const maxTrades = (riskCapNode?.data.maxTradesPerDay as number) ?? 10;
  const dailyLossUsed = (riskCapNode?.data.usedLoss as number) ?? 0;
  const tradesUsed = (riskCapNode?.data.usedTrades as number) ?? 0;
  const riskBudgetUsed = Math.round((dailyLossUsed / maxDailyLoss) * 100);

  // Override neutral verdict if momentum is high
  let verdict = base.verdict;
  if (verdict === 'Neutral' && momentumScore > 60) {
    verdict = graph.finalScore >= 0 ? 'Buy' : 'Sell';
  }

  // YOLO: tighter SL (70%), wider TP (150%)
  const isLong = verdict.includes('Buy');
  const risk = Math.abs(base.entry - base.stopLoss);
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
      'Low momentum. Maybe sit this one out... or not.'
    }`,
    adrenalineMeter,
    momentumScore,
    riskBudgetUsed,
    tradesUsed,
    maxTrades,
    dailyLossUsed,
    maxDailyLoss,
    stopLoss: Math.round(yoloSL * factor) / factor,
    takeProfit: Math.round(yoloTP * factor) / factor,
    riskMismatch: riskBudgetUsed > 80 ? 'SLOW DOWN — Budget almost gone!' :
                  adrenalineMeter > 90 ? 'Maximum adrenaline — trade with caution!' : null,
  };
}
