/**
 * Graph Engine — каждая нода = нейрон с весом.
 * Топологическая сортировка + взвешенная агрегация сигналов.
 */

import type { Node, Edge } from '@xyflow/react';
import type { OHLCVCandle, IndicatorResult, RiskTier } from '../types/nodes';
import {
  calcRSI, calcMACD, calcBollingerBands,
  calcEMAIndicator, calcSMA,
} from './indicators';
import { detectPatterns } from './chartPatterns';
import { STOCKS_FUNDAMENTAL, getStressScore, getSectorComparison } from './stockData';
import { calcVolumeSpike, calcPriceDip, getCryptoIndicatorSignals } from './cryptoIndicators';
import { useCryptoStore } from '../stores/useCryptoStore';
// Patch 2N+1 H4: single source of truth for per-ticker recent events.
import { EVENTS_DATA } from '../components/nodes/EventRepricingNode';

// ─────────────────────────────────────────────────────────────────────────
// Risk-tier config — mirrors backend elibri-backend/internal/ml/risk_tiers.go.
// Kept identical so frontend pre-filters behave the same way the Go server
// does in the vol-gate / label-gate checks.
//
// Patch 2E: removed minConfidence from the tier config and dropped the
// 'low_conf' block reason. HC threshold from best_thresholds.json is the
// single confidence filter — the tier knob was double-gating the same
// signal and producing 0 trades on Conservative/Balanced.
// ─────────────────────────────────────────────────────────────────────────

export type RiskTierKey = 'conservative' | 'balanced' | 'aggressive';

export type BlockReason = 'low_vol' | 'mtf' | 'label' | undefined;

export const TIER_CONFIG: Record<RiskTierKey, {
  minVolPctByTF: Record<string, number>;
  maxTradesPerDay: number;
  allowedLabels: Array<'trend_aligned' | 'mean_reversion' | 'random'>;
  riskPerTradePct: number;     // fraction, e.g. 0.005 = 0.5%
  slAtrMult: number;
  tpAtrMult: number;
}> = {
  conservative: {
    minVolPctByTF: { '5m': 0.008, '15m': 0.010, '1h': 0.015, '4h': 0.020, '1d': 0.025 },
    maxTradesPerDay: 3,
    allowedLabels: ['trend_aligned'],
    riskPerTradePct: 0.0025,
    slAtrMult: 1.5,
    tpAtrMult: 2.5,
  },
  balanced: {
    minVolPctByTF: { '5m': 0.005, '15m': 0.007, '1h': 0.010, '4h': 0.015, '1d': 0.020 },
    maxTradesPerDay: 7,
    allowedLabels: ['trend_aligned', 'mean_reversion'],
    riskPerTradePct: 0.005,
    slAtrMult: 1.5,
    tpAtrMult: 2.5,
  },
  aggressive: {
    minVolPctByTF: { '5m': 0.0025, '15m': 0.004, '1h': 0.006, '4h': 0.010, '1d': 0.015 },
    maxTradesPerDay: 20,
    allowedLabels: ['trend_aligned', 'mean_reversion'],
    riskPerTradePct: 0.01,
    slAtrMult: 1.2,
    tpAtrMult: 2.0,
  },
};

// Сигнал ноды: числовое значение -1 (sell) .. 0 (neutral) .. +1 (buy)
export interface NodeSignal {
  nodeId: string;
  nodeType: string;
  signal: number;       // -1..+1
  weight: number;       // 0..1
  label: string;
  indicators?: IndicatorResult[];
}

// Full trade setup from Risk Manager — rendered on Dashboard / PreviewPanel.
export interface TradeSetup {
  direction: 'buy' | 'sell' | 'hold';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  atr: number;
  positionSize: number;   // units of base asset (e.g. BTC count)
  positionValue: number;  // $ value of position
  riskDollars: number;    // $ at risk if SL hits
  rewardDollars: number;  // $ gained if TP hits
  riskRewardRatio: number; // reward / risk
  equity: number;
  riskPct: number;        // % of equity at risk
  hasConflict: boolean;   // legacy flag — UI still renders from mtf mismatch
  confidence: number;     // 0..100
  // Tier-aware decision envelope (set when backend/frontend rejects the trade).
  // direction='hold' + blocked=<reason> means "do not trade because X".
  blocked?: BlockReason;
  riskTier: string;       // echoes the tier that evaluated this setup
}

export interface GraphResult {
  signals: NodeSignal[];
  finalScore: number;   // -1..+1 взвешенный
  direction: 'buy' | 'sell' | 'neutral';
  confidence: number;   // 0..100
  totalWeight: number;
  tradeSetup?: TradeSetup;  // Computed when Risk Manager is in graph
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

    const weight = (node.data.weight as number) ?? 1.0;
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

      // Dividend Capture — high yield + growing + long streak = buy
      case 'dividendCapture': {
        const ticker6 = nodes.find(n => n.type === 'stockAnalysis')?.data?.ticker as string ?? 'SBER';
        const fund6 = STOCKS_FUNDAMENTAL[ticker6];
        if (fund6) {
          const yieldSignal = fund6.divYield > 10 ? 0.8 : fund6.divYield > 6 ? 0.4 : fund6.divYield > 0 ? 0.1 : -0.5;
          signal = yieldSignal;
          indicators = [{
            name: 'Dividend',
            value: fund6.divYield,
            signal: fund6.divYield > 8 ? 'buy' : fund6.divYield > 4 ? 'neutral' : 'sell',
            description: `Yield ${fund6.divYield}%`,
          }];
        }
        break;
      }

      // Event Repricing — positive events = buy, negative = sell
      case 'eventRepricing': {
        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;
        }
        // Patch 2N+1 H4: derive event boost from the SAME EVENTS_DATA table
        // the node renders. Previously graphEngine had an independent
        // hardcoded `eventScores` dict that silently drifted whenever the
        // UI table was edited — two sources of truth is one too many.
        //
        // Score: +1 per positive event, -1 per negative, 0 per neutral,
        // then normalized by count. Identical rule to the `eventScore`
        // computed for the badge inside EventRepricingNode.tsx so the UI
        // "Positive / Negative / Neutral" label always matches the graph.
        const ticker7 = nodes.find(n => n.type === 'stockAnalysis')?.data?.ticker as string ?? 'SBER';
        const events = EVENTS_DATA[ticker7]?.events ?? [];
        const rawScore = events.reduce(
          (s, e) => s + (e.impact === 'positive' ? 1 : e.impact === 'negative' ? -1 : 0),
          0,
        );
        const eventBoost = events.length > 0
          ? Math.max(-1, Math.min(1, rawScore / events.length))
          : 0;
        signal = Math.max(-1, Math.min(1, signal + eventBoost * 0.3));
        indicators = [{
          name: 'Event Score',
          value: Math.round(eventBoost * 100),
          signal: eventBoost > 0.2 ? 'buy' : eventBoost < -0.2 ? 'sell' : 'neutral',
          description: eventBoost > 0
            ? `Positive events (${rawScore}/${events.length})`
            : eventBoost < 0
              ? `Negative events (${rawScore}/${events.length})`
              : events.length > 0 ? 'Mixed events' : 'No recent events',
        }];
        break;
      }

      // Trading Style — adjusts signal based on investment horizon
      case 'tradingStyle': {
        const tradingStyle = (node.data.tradingStyle as string) ?? 'swing';
        // Long-term styles amplify fundamental signals, short-term dampen them
        const styleMultiplier: Record<string, number> = {
          scalping: 0.2,     // fundamentals barely matter for scalping
          daytrading: 0.4,   // some relevance
          swing: 0.7,        // moderate relevance
          position: 1.0,     // full relevance
          longterm: 1.2,     // amplified — fundamentals are everything
        };
        const mult = styleMultiplier[tradingStyle] ?? 0.7;

        if (incoming.length > 0) {
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? (incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW) * mult
            : 0;
          signal = Math.max(-1, Math.min(1, signal));
        }
        indicators = [{
          name: 'Trading Style',
          value: Math.round(mult * 100),
          signal: signal > 0.1 ? 'buy' : signal < -0.1 ? 'sell' : 'neutral',
          description: `${tradingStyle} — fundamental weight ${Math.round(mult * 100)}%`,
        }];
        break;
      }

      // ─── Crypto nodes ──────────────────────────────

      // Crypto Source / Crypto Asset — pass through, same as marketPair
      case 'cryptoSource':
      case 'cryptoAsset': {
        signal = 0;
        break;
      }

      // Crypto Technical — same computation as technicalIndicator but crypto-tailored
      case 'cryptoTechnical': {
        const selected = (node.data.indicators as string[]) ?? ['RSI', 'MACD', 'Bollinger Bands'];
        indicators = getCryptoIndicatorSignals(candles, selected);
        if (indicators.length > 0) {
          signal = indicators.reduce((sum, ind) => sum + signalToNumber(ind.signal), 0) / indicators.length;
        }
        break;
      }

      // Crypto Fundamental — news aggregate sentiment from store
      case 'cryptoFundamental': {
        const cryptoStore = useCryptoStore.getState();
        const pair = nodes.find(n => n.type === 'cryptoAsset')?.data?.pair as string
          ?? nodes.find(n => n.type === 'cryptoSource')?.data?.pair as string
          ?? 'BTCUSDT';
        const news = cryptoStore.newsAggregate?.[pair];
        if (news) {
          // Recompute filtered sentiment using node's enabled categories
          const enabledCats = (node.data.categories as string[]) ?? ['macro', 'geopolitics', 'regulation', 'social'];
          const filtered = news.items.filter(it =>
            enabledCats.includes(it.category) ||
            (enabledCats.includes('crypto') && (it.source === 'coindesk' || it.source === 'cointelegraph')) ||
            (enabledCats.includes('social') && typeof it.source === 'string' &&
              (it.source === 'reddit' || it.source.startsWith('lunarcrush-'))),
          );
          if (filtered.length > 0) {
            const now = Date.now();
            let weightedSum = 0;
            let weightTotal = 0;
            for (const it of filtered) {
              const hoursOld = (now - new Date(it.published_at).getTime()) / 3600000;
              const w = 1 / (1 + hoursOld / 6);
              weightedSum += it.sentiment * w;
              weightTotal += w;
            }
            signal = weightTotal > 0 ? weightedSum / weightTotal : 0;
            signal = Math.max(-1, Math.min(1, signal));

            const label = signal > 0.15 ? 'buy' : signal < -0.15 ? 'sell' : 'neutral';
            indicators = [{
              name: 'News Sentiment',
              value: Math.round(signal * 100),
              signal: label,
              description: `${filtered.length} news · ${filtered.filter(f => f.sentiment > 0.15).length} bull / ${filtered.filter(f => f.sentiment < -0.15).length} bear`,
            }];
          }
        }
        break;
      }

      // Crypto Scanner — volume spikes, RSI dips, price dips
      case 'cryptoScanner': {
        const scanModes = (node.data.scanMode as string[]) ?? ['volume_spike', 'rsi_dip'];
        const thresholds = (node.data.thresholds as Record<string, number>) ?? {};
        indicators = [];

        if (scanModes.includes('volume_spike')) {
          const vs = calcVolumeSpike(candles, 20);
          const minMult = thresholds.volumeMultiplier ?? 2.5;
          indicators.push({
            name: 'Volume Spike',
            value: vs.multiplier,
            signal: vs.multiplier > minMult ? vs.signal : 'neutral',
            description: vs.multiplier > minMult ? `${vs.multiplier}x avg volume` : 'Normal volume',
          });
        }

        if (scanModes.includes('rsi_dip')) {
          const rsi = calcRSI(candles);
          const oversold = thresholds.rsiOversold ?? 30;
          indicators.push({
            name: 'RSI Dip',
            value: rsi,
            signal: rsi < oversold ? 'buy' : rsi > (100 - oversold) ? 'sell' : 'neutral',
            description: rsi < oversold ? `RSI oversold (${rsi})` : 'RSI normal',
          });
        }

        if (scanModes.includes('price_dip')) {
          const pd = calcPriceDip(candles, 20);
          const minDip = thresholds.dipPercent ?? 5;
          indicators.push({
            name: 'Price Dip',
            value: pd.dipPercent,
            signal: pd.dipPercent < -minDip ? 'buy' : 'neutral',
            description: pd.dipPercent < -minDip ? `${pd.dipPercent}% from high` : 'Near highs',
          });
        }

        if (indicators.length > 0) {
          signal = indicators.reduce((sum, ind) => sum + signalToNumber(ind.signal), 0) / indicators.length;
        }
        break;
      }

      // On-Chain Metrics — seeded demo signals
      case 'onChainMetrics': {
        const selectedMetrics = (node.data.metrics as string[]) ?? ['whale_activity', 'exchange_inflow'];
        const seed = Math.floor(Date.now() / 300000);
        indicators = [];

        for (const metric of selectedMetrics) {
          let v: number;
          let s: 'buy' | 'sell' | 'neutral';
          let desc: string;

          switch (metric) {
            case 'whale_activity':
              v = ((seed * 7 + 13) % 100);
              s = v > 60 ? 'buy' : v < 30 ? 'sell' : 'neutral';
              desc = v > 60 ? 'Whales accumulating' : v < 30 ? 'Whales selling' : 'Normal';
              break;
            case 'exchange_inflow':
              v = ((seed * 11 + 5) % 100);
              s = v > 65 ? 'sell' : v < 30 ? 'buy' : 'neutral';
              desc = v > 65 ? 'High inflow — sell pressure' : 'Normal';
              break;
            case 'exchange_outflow':
              v = ((seed * 19 + 3) % 100);
              s = v > 60 ? 'buy' : v < 25 ? 'sell' : 'neutral';
              desc = v > 60 ? 'Coins leaving exchanges' : 'Normal';
              break;
            case 'active_addresses':
              v = ((seed * 23 + 17) % 100);
              s = v > 65 ? 'buy' : v < 30 ? 'sell' : 'neutral';
              desc = v > 65 ? 'Rising activity' : 'Steady';
              break;
            default:
              v = 50; s = 'neutral'; desc = 'Unknown';
          }

          indicators.push({ name: metric.replace(/_/g, ' '), value: v, signal: s, description: desc });
        }

        if (indicators.length > 0) {
          signal = indicators.reduce((sum, ind) => sum + signalToNumber(ind.signal), 0) / indicators.length;
        }
        break;
      }

      // ML Predictor — uses ML prediction from store
      case 'mlPredictor': {
        const cryptoStore = useCryptoStore.getState();
        const pair = nodes.find(n => n.type === 'cryptoSource')?.data?.pair as string
          ?? nodes.find(n => n.type === 'marketPair')?.data?.pair as string
          ?? 'BTCUSDT';
        const pred = cryptoStore.mlPredictions[pair];

        if (pred) {
          // ML prediction directly as signal
          signal = pred.direction === 'buy' ? Math.min(1, pred.confidence / 100)
            : pred.direction === 'sell' ? -Math.min(1, pred.confidence / 100)
            : 0;
          indicators = [{
            name: 'ML Prediction',
            value: pred.confidence,
            signal: pred.direction,
            description: `${pred.direction.toUpperCase()} ${pred.confidence}% — target $${pred.priceTarget}`,
          }];
        } else if (incoming.length > 0) {
          // Fallback: weighted average of incoming
          const totalW = incoming.reduce((s, i) => s + i.weight, 0);
          signal = totalW > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / totalW
            : 0;
        }
        break;
      }

      // Crypto ML — V2 ensemble. Node itself calls backend /ml/predict v2;
      // we read the last result from useCryptoStore and BLEND with incoming
      // signals from 3 upstream nodes (CryptoTechnical / CryptoFundamental /
      // TradingStyle). Model prob has 60% weight, upstream consensus 40%.
      case 'cryptoML': {
        const cryptoStore = useCryptoStore.getState();
        const pair = nodes.find(n => n.type === 'cryptoAsset')?.data?.pair as string
          ?? nodes.find(n => n.type === 'cryptoSource')?.data?.pair as string
          ?? nodes.find(n => n.type === 'marketPair')?.data?.pair as string
          ?? 'BTCUSDT';
        const pred = cryptoStore.mlPredictions[pair];

        // Upstream consensus.
        let upstream = 0;
        if (incoming.length > 0) {
          const tw = incoming.reduce((s, i) => s + i.weight, 0);
          upstream = tw > 0
            ? incoming.reduce((s, i) => s + i.signal * i.weight, 0) / tw
            : 0;
        }

        if (pred) {
          const modelSignal = pred.direction === 'buy'
            ? Math.min(1, pred.confidence / 100)
            : pred.direction === 'sell'
              ? -Math.min(1, pred.confidence / 100)
              : 0;
          // Blend: 0.6 model + 0.4 upstream consensus.
          signal = 0.6 * modelSignal + 0.4 * upstream;
          signal = Math.max(-1, Math.min(1, signal));
          indicators = [{
            name: 'ML Ensemble',
            value: pred.confidence,
            signal: pred.direction,
            description: `${pred.direction.toUpperCase()} ${pred.confidence}% · blended with ${incoming.length} upstream`,
          }];
        } else if (incoming.length > 0) {
          // No model yet → pass upstream through unchanged.
          signal = upstream;
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
    if (type !== 'marketPair' && type !== 'chartSource' && type !== 'cryptoSource' && type !== 'cryptoAsset') {
      allSignals.push(nodeSignal);
    }
  }

  // Final aggregation: weight-normalized sum. Previously divided by
  // activeSignals.length, which turned the weight slider into a magnitude
  // multiplier instead of a normalization factor — a single node at 50%
  // weight collapsed the score by 2× regardless of its signal strength.
  // Now: finalScore = Σ(signal_i × weight_i) / Σ(weight_i), which is a
  // proper weighted average in [-1, +1] irrespective of how many nodes
  // participate or what their absolute weights are.
  const activeSignals = allSignals.filter(n => n.weight > 0.05);
  const activeWeightSum = activeSignals.reduce((s, n) => s + n.weight, 0);
  const finalScore = activeWeightSum > 0
    ? activeSignals.reduce((s, n) => s + n.signal * n.weight, 0) / activeWeightSum
    : 0;
  const totalWeight = allSignals.reduce((s, n) => s + n.weight, 0);

  const confidence = Math.min(95, Math.round(
    Math.abs(finalScore) * 60 +
    (activeSignals.length / Math.max(1, allSignals.length)) * 25 +
    10
  ));

  // ── Compute trade setup from Risk Manager parameters ──────
  const tradeSetup = buildTradeSetup(
    nodes,
    edges,
    signalMap,
    candles,
    finalScore,
    confidence,
  );

  return {
    signals: allSignals,
    finalScore: Math.round(finalScore * 1000) / 1000,
    direction: finalScore > 0.1 ? 'buy' : finalScore < -0.1 ? 'sell' : 'neutral',
    confidence,
    totalWeight,
    tradeSetup,
  };
}

/**
 * Build TradeSetup from Risk Manager node params + candles ATR.
 * Returns undefined if no Risk Manager in graph.
 *
 * Tier-aware flow (mirrors backend risk_tiers.go):
 *   1. Resolve tier from RiskManagerNode data (default 'balanced').
 *   2. Check blocking gates in order: low_vol → mtf → label.
 *      Any trip sets direction='hold' + blocked=<reason>. Backend owns
 *      the real decision; this is the UI mirror so the preview doesn't
 *      contradict the server. Patch 2E: confidence gate removed — HC
 *      threshold on the backend is the single confidence filter.
 *   3. Position sizing = Turtle: (equity × riskPerTradePct) / (atr × slAtrMult).
 *      Shared formula with indicators.calcTradeSetup — do not re-invent.
 *   4. SL/TP use tier.slAtrMult / tier.tpAtrMult, not hardcoded 1.5/2.5.
 *
 * NOTE: legacy `hasConflict × 0.5` shrink was removed — tier gates handle
 * this cleanly via `blocked`. `hasConflict` is still emitted for backward
 * compatibility with PreviewPanel/tradeSummary until those callers migrate.
 */
function buildTradeSetup(
  nodes: Node[],
  edges: Edge[],
  signalMap: Map<string, NodeSignal>,
  candles: OHLCVCandle[],
  finalScore: number,
  confidence: number,
): TradeSetup | undefined {
  const rm = nodes.find(n => n.type === 'riskManager');
  if (!rm || candles.length < 15) return undefined;

  // ── Resolve tier ─────────────────────────────────────────────────
  const riskTier = ((rm.data.riskTier as RiskTier) ?? 'balanced') as RiskTierKey;
  const tier = TIER_CONFIG[riskTier] ?? TIER_CONFIG.balanced;

  // User-editable equity (sizing base).
  const equity = (rm.data.equity as number) ?? 10000;

  // ── Gather pipeline inputs ───────────────────────────────────────
  const atr = calcATR14(candles);
  const entry = candles[candles.length - 1].close;
  const atrNorm = entry > 0 ? atr / entry : 0;

  // Timeframe from CryptoTechnical node; fall back to '4h' like CryptoMLNode.
  const ct = nodes.find(n => n.type === 'cryptoTechnical');
  const timeframe = (ct?.data?.interval as string) ?? '4h';

  // CryptoML extras (set by CryptoMLNode.run after backend call).
  const cmlNode = nodes.find(n => n.type === 'cryptoML');
  const cmlConsensus = cmlNode?.data?.consensus as {
    direction?: string;
    alignment?: number;
    high_quality?: boolean;
    label?: 'trend_aligned' | 'mean_reversion' | 'random';
    blocked?: boolean;
  } | undefined;
  const cmlVolGate = cmlNode?.data?.vol_gate as string | undefined;

  // Legacy cross-signal conflict flag — still surfaced on the TradeSetup
  // for tradeSummary.ts / PreviewPanel.tsx until they switch to `blocked`.
  const rmIncoming = edges
    .filter(e => e.target === rm.id)
    .map(e => signalMap.get(e.source))
    .filter((s): s is NodeSignal => !!s);
  const hasConflict =
    (rmIncoming.some(s => s.signal > 0.1) && rmIncoming.some(s => s.signal < -0.1)) ||
    cmlConsensus?.direction === 'mixed';

  // ── Blocking gates (order matters: matches backend priority) ─────
  // Patch 2E: removed the confidence gate — HC threshold (backend) is
  // the single confidence filter. Frontend only mirrors vol / mtf /
  // label gates now.
  let blocked: BlockReason = undefined;

  // 1. Vol gate — frontend ATR check OR backend vol_gate echo.
  {
    const minVol = tier.minVolPctByTF[timeframe] ?? 0;
    if (atrNorm < minVol || cmlVolGate === 'blocked_low_vol') {
      blocked = 'low_vol';
    }
  }

  // 2. Multi-timeframe gate from CryptoML consensus.
  if (!blocked && cmlConsensus?.blocked === true) {
    blocked = 'mtf';
  }

  // 3. Label allow-list.
  if (!blocked && cmlConsensus?.label) {
    const allowed = tier.allowedLabels as readonly string[];
    if (!allowed.includes(cmlConsensus.label)) {
      blocked = 'label';
    }
  }

  // ── Direction ────────────────────────────────────────────────────
  let direction: 'buy' | 'sell' | 'hold' = 'hold';
  if (!blocked) {
    if (finalScore > 0.1) direction = 'buy';
    else if (finalScore < -0.1) direction = 'sell';
  }

  // ── SL/TP via tier multipliers ──────────────────────────────────
  let stopLoss = entry;
  let takeProfit = entry;
  if (direction === 'buy') {
    stopLoss = entry - tier.slAtrMult * atr;
    takeProfit = entry + tier.tpAtrMult * atr;
  } else if (direction === 'sell') {
    stopLoss = entry + tier.slAtrMult * atr;
    takeProfit = entry - tier.tpAtrMult * atr;
  }

  // ── Turtle position sizing ──────────────────────────────────────
  // Same formula as indicators.calcTradeSetup (Turtle rule):
  //   positionSize = (equity × riskPerTradePct) / (atr × slAtrMult)
  // riskPerTradePct is a fraction (tier.riskPerTradePct = 0.005 = 0.5%).
  const riskDollars = equity * tier.riskPerTradePct;
  const atrSlDistance = atr * tier.slAtrMult;
  let positionSize = 0;
  let positionValue = 0;
  let rewardDollars = 0;
  let riskRewardRatio = 0;

  if (atrSlDistance > 0 && direction !== 'hold') {
    positionSize = riskDollars / atrSlDistance;
    positionValue = positionSize * entry;
    rewardDollars = positionSize * Math.abs(takeProfit - entry);
    riskRewardRatio = riskDollars > 0 ? rewardDollars / riskDollars : 0;
  }

  return {
    direction,
    entry,
    stopLoss,
    takeProfit,
    atr,
    positionSize,
    positionValue,
    riskDollars,
    rewardDollars,
    riskRewardRatio,
    equity,
    riskPct: tier.riskPerTradePct * 100, // percent form for UI
    hasConflict,
    confidence,
    blocked,
    riskTier,
  };
}

/**
 * ATR(14) — simple implementation inline for graph-engine use.
 */
function calcATR14(candles: OHLCVCandle[]): number {
  const period = 14;
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    sum += tr;
  }
  return sum / period;
}
