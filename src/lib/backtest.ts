/**
 * Backtest Engine — прогоняет стратегию по историческим данным MOEX.
 * Берёт дневные свечи, на каждый день считает сигнал graph engine,
 * симулирует сделки и считает P&L.
 */

import type { Node, Edge } from '@xyflow/react';
import { STOCKS_FUNDAMENTAL } from './stockData';

export interface BacktestResult {
  ticker: string;
  period: string;
  totalReturn: number;       // %
  annualizedReturn: number;  // %
  maxDrawdown: number;       // %
  sharpeRatio: number;
  winRate: number;           // %
  totalTrades: number;
  profitableTrades: number;
  avgWin: number;            // %
  avgLoss: number;           // %
  equityCurve: { date: string; value: number }[];
  buyHoldReturn: number;     // % for comparison
}

interface DayCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Fetch historical candles from MOEX
async function fetchHistoricalCandles(ticker: string, days: number): Promise<DayCandle[]> {
  try {
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const res = await fetch(
      `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}/candles.json?iss.meta=off&iss.only=candles&candles.columns=begin,open,high,low,close,volume&interval=24&from=${from}`
    );
    if (!res.ok) return [];
    const raw = await res.json();
    const rows = raw?.candles?.data ?? [];
    return rows.map((r: [string, number, number, number, number, number]) => ({
      date: r[0].split(' ')[0],
      open: r[1],
      high: r[2],
      low: r[3],
      close: r[4],
    }));
  } catch {
    return [];
  }
}

// Calculate signal for a given day based on node weights and fundamental data
function calcDaySignal(
  nodes: Node[],
  ticker: string,
  dayClose: number,
  prevClose: number,
): number {
  const fund = STOCKS_FUNDAMENTAL[ticker];
  if (!fund) return 0;

  let totalSignal = 0;
  let totalWeight = 0;
  let activeNodes = 0;

  for (const node of nodes) {
    const weight = (node.data.weight as number) ?? 0.5;
    if (weight < 0.05) continue;

    let signal = 0;
    const type = node.type ?? '';

    switch (type) {
      case 'stockAnalysis': {
        // Dynamic P/E based on current price
        const dynamicPE = (dayClose * 21.587e9) / (fund.netIncome * 1e9); // approx shares for SBER
        const peSignal = dynamicPE < 4 ? 0.8 : dynamicPE < 8 ? 0.4 : dynamicPE < 15 ? 0 : -0.3;
        // Momentum: price vs previous day
        const momentum = prevClose > 0 ? (dayClose - prevClose) / prevClose : 0;
        const momSignal = momentum > 0.01 ? 0.3 : momentum < -0.01 ? -0.3 : 0;
        signal = (peSignal + momSignal) / 2;
        break;
      }
      case 'cashFlow': {
        const fcfSignal = fund.fcf > 0 ? 0.4 : -0.5;
        const growthSignal = fund.fcfGrowth > 10 ? 0.5 : fund.fcfGrowth > 0 ? 0.2 : -0.3;
        signal = (fcfSignal + growthSignal) / 2;
        break;
      }
      case 'debtAnalysis': {
        signal = fund.netDebtEbitda < 1 ? 0.5 : fund.netDebtEbitda < 2 ? 0.1 : -0.4;
        break;
      }
      case 'profitability': {
        const roeS = fund.roe > 20 ? 0.7 : fund.roe > 10 ? 0.3 : -0.2;
        const marginS = fund.netMargin > 15 ? 0.5 : fund.netMargin > 5 ? 0.2 : -0.2;
        signal = (roeS + marginS) / 2;
        break;
      }
      case 'sectorCompare': {
        signal = 0.3; // simplified — sector position doesn't change daily
        break;
      }
      case 'dividendCapture': {
        signal = fund.divYield > 10 ? 0.8 : fund.divYield > 6 ? 0.4 : fund.divYield > 0 ? 0.1 : -0.5;
        break;
      }
      case 'eventRepricing': {
        const eventScores: Record<string, number> = {
          SBER: 0.6, GAZP: -0.5, LKOH: 0.5, YNDX: 0.7, GMKN: -0.3, NLMK: 0.2, ROSN: 0.4, MTSS: 0.2,
        };
        signal = (eventScores[ticker] ?? 0) * 0.5;
        break;
      }
      case 'tradingStyle': {
        // Multiplier applied after the loop
        signal = 0;
        break;
      }
      case 'reportSelector':
      case 'portfolioScore': {
        signal = 0; // pass-through nodes
        break;
      }
      default:
        signal = 0;
    }

    if (signal !== 0 || type === 'stockAnalysis') {
      totalSignal += signal * weight;
      totalWeight += weight;
      activeNodes++;
    }
  }

  // Apply trading style multiplier
  const styleNode = nodes.find(n => n.type === 'tradingStyle');
  if (styleNode) {
    const style = (styleNode.data.tradingStyle as string) ?? 'swing';
    const mult: Record<string, number> = { scalping: 0.2, daytrading: 0.4, swing: 0.7, position: 1.0, longterm: 1.2 };
    totalSignal *= (mult[style] ?? 0.7);
  }

  return activeNodes > 0 ? totalSignal / activeNodes : 0;
}

// Main backtest function
export async function runBacktest(
  nodes: Node[],
  _edges: Edge[],
  ticker: string,
): Promise<BacktestResult | null> {
  const candles = await fetchHistoricalCandles(ticker, 180); // 6 months
  if (candles.length < 20) return null;

  const initialCapital = 1000000; // 1M rubles
  let capital = initialCapital;
  let position = 0; // shares held
  let entryPrice = 0;
  let trades = 0;
  let wins = 0;
  let totalWinPct = 0;
  let totalLossPct = 0;
  let losses = 0;
  let maxCapital = initialCapital;
  let maxDrawdown = 0;

  const equityCurve: { date: string; value: number }[] = [];
  const dailyReturns: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const day = candles[i];
    const signal = calcDaySignal(nodes, ticker, day.close, prev.close);

    // Portfolio value
    const portfolioValue = position > 0
      ? capital + position * day.close
      : capital;

    // Track drawdown
    if (portfolioValue > maxCapital) maxCapital = portfolioValue;
    const dd = (maxCapital - portfolioValue) / maxCapital * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    // Daily return
    if (equityCurve.length > 0) {
      const prevVal = equityCurve[equityCurve.length - 1].value;
      dailyReturns.push((portfolioValue - prevVal) / prevVal);
    }

    equityCurve.push({ date: day.date, value: Math.round(portfolioValue) });

    // Trading logic based on signal
    const threshold = 0.15;

    if (signal > threshold && position === 0) {
      // BUY
      const shares = Math.floor(capital / day.close);
      if (shares > 0) {
        position = shares;
        entryPrice = day.close;
        capital -= shares * day.close;
      }
    } else if (signal < -threshold && position > 0) {
      // SELL
      const proceeds = position * day.close;
      const tradePnl = (day.close - entryPrice) / entryPrice * 100;
      capital += proceeds;
      position = 0;
      trades++;
      if (tradePnl > 0) { wins++; totalWinPct += tradePnl; }
      else { losses++; totalLossPct += Math.abs(tradePnl); }
    }
    // Hold: if signal between -threshold and threshold, do nothing
  }

  // Close any open position at last price
  if (position > 0) {
    const lastPrice = candles[candles.length - 1].close;
    const proceeds = position * lastPrice;
    const tradePnl = (lastPrice - entryPrice) / entryPrice * 100;
    capital += proceeds;
    position = 0;
    trades++;
    if (tradePnl > 0) { wins++; totalWinPct += tradePnl; }
    else { losses++; totalLossPct += Math.abs(tradePnl); }
  }

  const finalValue = capital;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

  // Buy & hold comparison
  const buyHoldReturn = ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100;

  // Annualized return (approx 6 months)
  const annualizedReturn = totalReturn * 2;

  // Sharpe ratio (annualized)
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdReturn = Math.sqrt(
    dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (dailyReturns.length || 1)
  );
  const sharpeRatio = stdReturn > 0 ? Math.round((avgReturn / stdReturn) * Math.sqrt(252) * 100) / 100 : 0;

  return {
    ticker,
    period: `${candles[0].date} — ${candles[candles.length - 1].date}`,
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio,
    winRate: trades > 0 ? Math.round((wins / trades) * 100) : 0,
    totalTrades: trades,
    profitableTrades: wins,
    avgWin: wins > 0 ? Math.round((totalWinPct / wins) * 100) / 100 : 0,
    avgLoss: losses > 0 ? Math.round((totalLossPct / losses) * 100) / 100 : 0,
    equityCurve,
    buyHoldReturn: Math.round(buyHoldReturn * 100) / 100,
  };
}
