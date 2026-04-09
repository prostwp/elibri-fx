/**
 * Graph Engine — каждая нода = нейрон с весом.
 * Топологическая сортировка + взвешенная агрегация сигналов.
 */

import type { Node, Edge } from '@xyflow/react';
import type { OHLCVCandle, IndicatorResult } from '../types/nodes';
import {
  calcRSI, calcMACD, calcBollingerBands,
  calcEMAIndicator, calcSMA,
} from './indicators';
import { detectPatterns } from './chartPatterns';
import { STOCKS_FUNDAMENTAL, getStressScore, getSectorComparison } from './stockData';

// Сигнал ноды: числовое значение -1 (sell) .. 0 (neutral) .. +1 (buy)
export interface NodeSignal {
  nodeId: string;
  nodeType: string;
  signal: number;       // -1..+1
  weight: number;       // 0..1
  label: string;
  indicators?: IndicatorResult[];
}

export interface GraphResult {
  signals: NodeSignal[];
  finalScore: number;   // -1..+1 взвешенный
  direction: 'buy' | 'sell' | 'neutral';
  confidence: number;   // 0..100
  totalWeight: number;
}

/**
 * Топологическая сортировка (Kahn's algorithm)
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sorted.push(curr);
    for (const next of adj.get(curr) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  return sorted;
}

/**
 * Получить входящие сигналы для ноды
 */
function getIncomingSignals(
  nodeId: string,
  edges: Edge[],
  signalMap: Map<string, NodeSignal>,
): NodeSignal[] {
  return edges
    .filter((e) => e.target === nodeId)
    .map((e) => signalMap.get(e.source))
    .filter(Boolean) as NodeSignal[];
}

/**
 * Вычислить сигнал для одного индикатора
 */
function calcIndicatorSignal(
  name: string,
  candles: OHLCVCandle[],
  params: Record<string, number>,
): IndicatorResult | null {
  const lastPrice = candles[candles.length - 1]?.close ?? 0;

  switch (name) {
    case 'RSI': {
      const period = params.rsiPeriod ?? 14;
      const rsi = calcRSI(candles, period);
      const overbought = params.rsiOverbought ?? 70;
      const oversold = params.rsiOversold ?? 30;
      return {
        name: `RSI (${period})`,
        value: rsi,
        signal: rsi > overbought ? 'sell' : rsi < oversold ? 'buy' : 'neutral',
        description: rsi > overbought ? 'Overbought' : rsi < oversold ? 'Oversold' : 'Neutral zone',
      };
    }
    case 'MACD': {
      const macd = calcMACD(candles);
      return {
        name: 'MACD',
        value: macd.histogram,
        signal: macd.histogram > 0 ? 'buy' : macd.histogram < 0 ? 'sell' : 'neutral',
        description: macd.histogram > 0 ? 'Bullish momentum' : 'Bearish momentum',
      };
    }
    case 'Bollinger Bands': {
      const period = params.bbPeriod ?? 20;
      const bb = calcBollingerBands(candles, period);
      const pos = (lastPrice - bb.lower) / (bb.upper - bb.lower);
      return {
        name: `BB (${period})`,
        value: Math.round(pos * 100),
        signal: pos > 0.8 ? 'sell' : pos < 0.2 ? 'buy' : 'neutral',
        description: pos > 0.8 ? 'Near upper band' : pos < 0.2 ? 'Near lower band' : 'Mid range',
      };
    }
    case 'EMA': {
      const fast = params.emaFast ?? 20;
      const slow = params.emaSlow ?? 50;
      const emaFast = calcEMAIndicator(candles, fast);
      const emaSlow = calcEMAIndicator(candles, slow);
      return {
        name: `EMA (${fast}/${slow})`,
        value: Math.round((emaFast - emaSlow) * 100) / 100,
        signal: emaFast > emaSlow ? 'buy' : 'sell',
        description: emaFast > emaSlow ? 'Golden cross' : 'Death cross',
      };
    }
    case 'SMA': {
      const period = params.smaPeriod ?? 50;
      const sma = calcSMA(candles, period);
      return {
        name: `SMA (${period})`,
        value: sma,
        signal: lastPrice > sma ? 'buy' : 'sell',
        description: lastPrice > sma ? 'Above SMA' : 'Below SMA',
      };
    }
    default:
      return null;
  }
}

/**
 * Сигнал в число: buy=+1, sell=-1, neutral=0
 */
function signalToNumber(s: 'buy' | 'sell' | 'neutral'): number {
  return s === 'buy' ? 1 : s === 'sell' ? -1 : 0;
}

/**
 * Главная функция: обход графа и взвешенная агрегация
 */
export function evaluateGraph(
  nodes: Node[],
  edges: Edge[],
  candles: OHLCVCandle[],
): GraphResult {
  const sorted = topologicalSort(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const signalMap = new Map<string, NodeSignal>();
  const allSignals: NodeSignal[] = [];

  for (const nodeId of sorted) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const weight = (node.data.weight as number) ?? 0.5;
    const type = node.type ?? '';
    const incoming = getIncomingSignals(nodeId, edges, signalMap);

    let signal = 0;
    let indicators: IndicatorResult[] | undefined;

    switch (type) {
      // Source nodes — pass through, no signal
      case 'marketPair':
      case 'chartSource':
      case 'newsFeed':
      case 'economicCalendar': {
        signal = 0;
        break;
      }

      // Technical Indicator — calculate real signals
      case 'technicalIndicator': {
        const selected = (node.data.indicators as string[]) ?? ['RSI', 'MACD', 'Bollinger Bands'];
        const params = (node.data.params as Record<string, number>) ?? {};
        indicators = [];
        for (const name of selected) {
          const result = calcIndicatorSignal(name, candles, params);
          if (result) indicators.push(result);
        }
        // Average of all indicator signals
        if (indicators.length > 0) {
          signal = indicators.reduce((sum, ind) => sum + signalToNumber(ind.signal), 0) / indicators.length;
        }
        break;
      }

      // Chart Patterns — algorithmic pattern detection
      case 'chartPattern': {
        const patterns = detectPatterns(candles);
        indicators = patterns.map(p => ({
          name: p.name,
          value: p.confidence,
          signal: p.type === 'bullish' ? 'buy' as const : p.type === 'bearish' ? 'sell' as const : 'neutral' as const,
          description: p.description,
        }));
        if (indicators.length > 0) {
          const meaningful = indicators.filter(i => i.signal !== 'neutral');
          if (meaningful.length > 0) {
            signal = meaningful.reduce((sum, ind) => sum + signalToNumber(ind.signal) * (ind.value / 100), 0) / meaningful.length;
          }
        }
        break;
      }

      // Sentiment — Fear & Greed based
      case 'sentiment': {
        const seed = Math.floor(Date.now() / 300000);
        const fearGreed = ((seed * 7 + 13) % 100);
        const sensitivity = (node.data.sensitivity as string) ?? 'balanced';
        const threshold = sensitivity === 'conservative' ? 25 : sensitivity === 'aggressive' ? 10 : 15;

        // Fear → buy (contrarian), Greed → sell (contrarian)
        if (fearGreed < 50 - threshold) {
          signal = (50 - fearGreed) / 50; // 0..1 buy
        } else if (fearGreed > 50 + threshold) {
          signal = -(fearGreed - 50) / 50; // -1..0 sell
        } else {
          signal = 0;
        }
        indicators = [{
          name: 'Fear & Greed',
          value: fearGreed,
          signal: signal > 0.1 ? 'buy' : signal < -0.1 ? 'sell' : 'neutral',
          description: fearGreed > 70 ? 'Extreme Greed' : fearGreed < 30 ? 'Extreme Fear' : 'Neutral',
        }];
        break;
      }

      // Fundamental — interest rate differential
      case 'fundamental': {
        const rateMap: Record<string, number> = {
          USD: 5.25, EUR: 4.50, GBP: 5.25, JPY: 0.10, CHF: 1.75, XAU: 0,
        };
        const pair = nodes.find(n => n.type === 'marketPair')?.data?.pair as string ?? 'EURUSD';
        const base = pair.slice(0, 3);
        const quote = pair.slice(3, 6);
        const baseFund = rateMap[base] ?? 3;
        const quoteFund = rateMap[quote] ?? 3;
        const diff = baseFund - quoteFund;

        // Higher base rate → currency strengthens → buy
        signal = Math.max(-1, Math.min(1, diff / 5));
        indicators = [{
          name: 'Rate Differential',
          value: Math.round(diff * 100) / 100,
          signal: diff > 0.5 ? 'buy' : diff < -0.5 ? 'sell' : 'neutral',
          description: `${base} ${baseFund}% vs ${quote} ${quoteFund}%`,
        }];
        break;
      }

      // Risk Profile — adjusts signal based on risk tolerance
      case 'psychProfile': {
        const profile = (node.data.profile as string) ?? 'moderate';
        const dampMap: Record<string, number> = { conservative: 0.6, moderate: 1.0, aggressive: 1.4 };
        const damp = dampMap[profile] ?? 1.0;

        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? (incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW) * damp
            : 0;
          signal = Math.max(-1, Math.min(1, signal));
        }
        break;
      }

      // ─── Fundamental nodes ──────────────────────────

      // Stock Analyzer — valuation signal from P/E + upside
      case 'stockAnalysis': {
        const ticker = (node.data.ticker as string) ?? 'SBER';
        const fund = STOCKS_FUNDAMENTAL[ticker];
        if (fund) {
          // Low P/E + high upside = buy, high P/E + low upside = neutral/sell
          const peSignal = fund.pe < 6 ? 0.8 : fund.pe < 12 ? 0.3 : fund.pe < 20 ? 0 : -0.3;
          const upsideSignal = fund.upside > 15 ? 0.6 : fund.upside > 5 ? 0.3 : 0;
          signal = Math.max(-1, Math.min(1, (peSignal + upsideSignal) / 2));
          indicators = [{
            name: `${ticker} Valuation`,
            value: fund.pe,
            signal: signal > 0.2 ? 'buy' : signal < -0.2 ? 'sell' : 'neutral',
            description: `P/E ${fund.pe}, upside ${fund.upside}%`,
          }];
        }
        break;
      }

      // Cash Flow — FCF positive + growing = buy
      case 'cashFlow': {
        const ticker2 = nodes.find(n => n.type === 'stockAnalysis')?.data?.ticker as string ?? 'SBER';
        const fund2 = STOCKS_FUNDAMENTAL[ticker2];
        if (fund2) {
          const fcfSignal = fund2.fcf > 0 ? 0.4 : -0.5;
          const growthSignal = fund2.fcfGrowth > 10 ? 0.5 : fund2.fcfGrowth > 0 ? 0.2 : -0.3;
          signal = Math.max(-1, Math.min(1, (fcfSignal + growthSignal) / 2));
          indicators = [{
            name: 'FCF Analysis',
            value: fund2.fcf,
            signal: signal > 0.1 ? 'buy' : signal < -0.1 ? 'sell' : 'neutral',
            description: `FCF ${fund2.fcf}B, growth ${fund2.fcfGrowth}%`,
          }];
        }
        break;
      }

      // Debt Analysis — low debt = buy, high debt = sell
      case 'debtAnalysis': {
        const ticker3 = nodes.find(n => n.type === 'stockAnalysis')?.data?.ticker as string ?? 'SBER';
        const fund3 = STOCKS_FUNDAMENTAL[ticker3];
        if (fund3) {
          const stress = getStressScore(fund3);
          signal = (stress.score - 50) / 50; // 0-100 → -1..+1
          indicators = [{
            name: 'Debt Stress',
            value: stress.score,
            signal: stress.level === 'strong' ? 'buy' : stress.level === 'weak' ? 'sell' : 'neutral',
            description: `Score ${stress.score}/100, ${stress.level}`,
          }];
        }
        break;
      }

      // Report Selector — informational, slight signal from report type
      case 'reportSelector': {
        signal = incoming.length > 0
          ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / Math.max(1, incoming.reduce((s, i) => s + i.weight, 0))
          : 0;
        break;
      }

      // Profitability — high ROE + high margins = buy
      case 'profitability': {
        const ticker4 = nodes.find(n => n.type === 'stockAnalysis')?.data?.ticker as string ?? 'SBER';
        const fund4 = STOCKS_FUNDAMENTAL[ticker4];
        if (fund4) {
          const roeSignal = fund4.roe > 20 ? 0.7 : fund4.roe > 10 ? 0.3 : -0.2;
          const marginSignal = fund4.netMargin > 15 ? 0.5 : fund4.netMargin > 5 ? 0.2 : -0.2;
          signal = Math.max(-1, Math.min(1, (roeSignal + marginSignal) / 2));
          indicators = [{
            name: 'Profitability',
            value: fund4.roe,
            signal: signal > 0.2 ? 'buy' : signal < -0.2 ? 'sell' : 'neutral',
            description: `ROE ${fund4.roe}%, Margin ${fund4.netMargin}%`,
          }];
        }
        break;
      }

      // Sector Compare — is this the best in sector?
      case 'sectorCompare': {
        const ticker5 = nodes.find(n => n.type === 'stockAnalysis')?.data?.ticker as string ?? 'SBER';
        const fund5 = STOCKS_FUNDAMENTAL[ticker5];
        if (fund5) {
          const comp = getSectorComparison(fund5.sector);
          const rank = comp.companies.findIndex(c => c.ticker === ticker5);
          signal = rank === 0 ? 0.8 : rank === 1 ? 0.4 : rank >= 0 ? 0 : -0.3;
          indicators = [{
            name: 'Sector Rank',
            value: rank + 1,
            signal: rank === 0 ? 'buy' : rank <= 1 ? 'neutral' : 'sell',
            description: `#${rank + 1} in ${fund5.sector}`,
          }];
        }
        break;
      }

      // Portfolio Score — final aggregation
      case 'portfolioScore': {
        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;
        }
        break;
      }

      // Condition — filter: pass or block signal
      case 'condition': {
        const indicator = (node.data.indicator as string) ?? 'RSI';
        const operator = (node.data.operator as string) ?? '>';
        const threshold = (node.data.value as number) ?? 70;
        const params = (node.data.params as Record<string, number>) ?? {};

        // Evaluate the condition
        const result = calcIndicatorSignal(indicator, candles, params);
        if (result) {
          const val = typeof result.value === 'number' ? result.value : 0;
          let passes = false;
          switch (operator) {
            case '>':  passes = val > threshold; break;
            case '<':  passes = val < threshold; break;
            case '>=': passes = val >= threshold; break;
            case '<=': passes = val <= threshold; break;
            case '=':  passes = Math.abs(val - threshold) < 0.01; break;
          }
          // If condition passes — forward incoming signal. If not — zero it out.
          if (passes && incoming.length > 0) {
            signal = incoming.reduce((s, i) => s + i.signal * i.weight, 0) / Math.max(1, incoming.reduce((s, i) => s + i.weight, 0));
          } else {
            signal = 0;
          }
        }
        break;
      }

      // Combiner — AND/OR gate
      case 'combiner': {
        const logic = (node.data.logic as string) ?? 'AND';
        if (incoming.length === 0) {
          signal = 0;
        } else if (logic === 'AND') {
          // AND: all must agree on direction, weighted average
          const allBuy = incoming.every((i) => i.signal > 0);
          const allSell = incoming.every((i) => i.signal < 0);
          if (allBuy || allSell) {
            const totalW = incoming.reduce((s, i) => s + i.weight, 0);
            signal = totalW > 0
              ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
              : 0;
          } else {
            signal = 0; // Disagreement → neutral
          }
        } else {
          // OR: weighted average of all, any signal passes
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;
        }
        break;
      }

      // Trading Analyst — weighted aggregate + confidence boost for agreement
      case 'tradingAnalyst': {
        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          const rawSignal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;

          // Boost signal if all inputs agree on direction
          const allAgree = incoming.every(i => i.signal > 0) || incoming.every(i => i.signal < 0);
          signal = allAgree ? rawSignal * 1.2 : rawSignal;
          signal = Math.max(-1, Math.min(1, signal));
        }
        break;
      }

      // Risk Manager — dampens aggressive signals, amplifies conservative ones
      case 'riskManager': {
        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          const rawSignal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;

          // Risk manager is conservative: dampen extreme signals
          const riskFactor = 0.8; // reduce signal by 20%
          signal = rawSignal * riskFactor;

          // If any incoming signal conflicts → extra dampening
          const hasConflict = incoming.some(i => i.signal > 0) && incoming.some(i => i.signal < 0);
          if (hasConflict) {
            signal *= 0.5;
          }
        }
        break;
      }

      // Guided Trader — similar to analyst but filters out weak signals
      case 'guidedTrader': {
        if (incoming.length > 0) {
          const level = (node.data.level as string) ?? 'beginner';
          const threshold = level === 'beginner' ? 0.3 : 0.15;

          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          const rawSignal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;

          // Only pass strong signals for beginners
          signal = Math.abs(rawSignal) >= threshold ? rawSignal : 0;
        }
        break;
      }

      // RiskCap — can dampen signal
      case 'riskCap': {
        const maxLoss = (node.data.maxDailyLoss as number) ?? 500;
        const usedLoss = (node.data.usedLoss as number) ?? 0;
        const remaining = maxLoss - usedLoss;
        const dampFactor = remaining > 0 ? Math.min(1, remaining / maxLoss) : 0;

        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? (incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW) * dampFactor
            : 0;
        }
        break;
      }

      // Dashboard — final aggregation
      case 'dashboard': {
        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;
        }
        break;
      }

      // Premium / Custom / Unknown — pass through incoming
      default: {
        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;
        }
        break;
      }
    }

    const nodeSignal: NodeSignal = {
      nodeId,
      nodeType: type,
      signal,
      weight,
      label: (node.data.label as string) ?? type,
      indicators,
    };

    signalMap.set(nodeId, nodeSignal);

    // Only count signal-producing nodes (not source/pass-through)
    if (type !== 'marketPair' && type !== 'chartSource') {
      allSignals.push(nodeSignal);
    }
  }

  // Final weighted aggregation across all signal-producing nodes
  const totalWeight = allSignals.reduce((s, n) => s + n.weight, 0);
  const finalScore = totalWeight > 0
    ? allSignals.reduce((s, n) => s + n.signal * n.weight, 0) / totalWeight
    : 0;

  const confidence = Math.min(95, Math.round(Math.abs(finalScore) * 80 + 15));

  return {
    signals: allSignals,
    finalScore: Math.round(finalScore * 1000) / 1000,
    direction: finalScore > 0.1 ? 'buy' : finalScore < -0.1 ? 'sell' : 'neutral',
    confidence,
    totalWeight,
  };
}
