import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { DEMO_PAIRS } from '../../lib/demoData';
import { getIndicatorSignals } from '../../lib/indicators';
import { generateMockAnalysis, generateBeginnerAnalysis, generateYOLOAnalysis } from '../../lib/mockAI';
import { evaluateGraph } from '../../lib/graphEngine';
import { analyzeStrategy, validateGraph } from '../../lib/analysisEngine';
import { GaugeWidget } from './GaugeWidget';
import { SignalTable } from './SignalTable';
import { TradingViewChart } from './TradingViewChart';
import { StockChart as StockChartComponent } from './StockChart';
import { STOCKS_FUNDAMENTAL, getStressScore, getSectorComparison, fetchStockQuote, recalcFundamentals, type StockQuote } from '../../lib/stockData';
import { runBacktest, type BacktestResult } from '../../lib/backtest';
import { BacktestChart } from './BacktestChart';
import type { SegmentMode, BeginnerAnalysis, YOLOAnalysis, AIAnalysis } from '../../types/nodes';

export function PreviewPanel() {
  const { nodes, edges, selectedPair, segmentMode, setSegmentMode } = useFlowStore();
  const { status: mt5Status, candles: liveCandles, account } = useMT5Store();
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Use live candles if MT5 connected and available, otherwise demo
  const demoPair = DEMO_PAIRS[selectedPair] ?? DEMO_PAIRS.EURUSD;
  const mt5CandlesForPair = liveCandles[selectedPair];
  const isLive = mt5Status === 'connected' && mt5CandlesForPair && mt5CandlesForPair.length > 0;

  const pairData = isLive
    ? { candles: mt5CandlesForPair, displayName: demoPair.displayName, pipSize: demoPair.pipSize }
    : demoPair;
  const lastPrice = pairData.candles[pairData.candles.length - 1]?.close ?? 0;

  // Graph engine: evaluate weighted signals through the node graph
  const graphResult = useMemo(
    () => evaluateGraph(nodes, edges, pairData.candles),
    [nodes, edges, pairData.candles]
  );

  const selectedIndicators = useMemo(() => {
    const techNodes = nodes.filter(n => n.type === 'technicalIndicator');
    const indicators: string[] = [];
    techNodes.forEach(n => {
      const inds = (n.data.indicators as string[]) ?? [];
      indicators.push(...inds);
    });
    return [...new Set(indicators.length > 0 ? indicators : ['RSI', 'MACD', 'Bollinger Bands'])];
  }, [nodes]);

  // Use graph engine indicators if available, fallback to basic calculation
  const indicatorResults = useMemo(() => {
    const graphIndicators = graphResult.signals
      .filter(s => s.indicators && s.indicators.length > 0)
      .flatMap(s => s.indicators!);
    return graphIndicators.length > 0 ? graphIndicators : getIndicatorSignals(pairData.candles, selectedIndicators);
  }, [graphResult, pairData.candles, selectedIndicators]);

  // Graph validation warnings
  const warnings = useMemo(() => validateGraph(nodes, edges), [nodes, edges]);

  // Use new analysis engine (graph-based) when we have nodes+edges, fallback to old mockAI
  const analysis = useMemo(() => {
    const hasGraph = nodes.length > 0 && edges.length > 0;

    if (hasGraph) {
      return analyzeStrategy(nodes, edges, pairData.candles, pairData.displayName, segmentMode);
    }

    // Fallback for when there's no connected graph
    switch (segmentMode) {
      case 'beginner':
        return generateBeginnerAnalysis(pairData.displayName, indicatorResults, lastPrice, pairData.candles, selectedIndicators);
      case 'yolo':
        return generateYOLOAnalysis(pairData.displayName, indicatorResults, lastPrice, pairData.candles, selectedIndicators);
      default:
        return generateMockAnalysis(pairData.displayName, indicatorResults, lastPrice, pairData.candles, selectedIndicators);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, pairData.displayName, indicatorResults, lastPrice, segmentMode, pairData.candles, selectedIndicators, refreshKey]);

  const hasNodes = nodes.length > 0;

  // Detect fundamental mode (has stockAnalysis node)
  const isFundamentalMode = nodes.some(n => n.type === 'stockAnalysis');
  const stockTicker = useMemo(() => {
    const sn = nodes.find(n => n.type === 'stockAnalysis');
    return (sn?.data?.ticker as string) ?? 'SBER';
  }, [nodes]);

  // Fetch live quote for stock (must be before fundData)
  const [stockQuote, setStockQuote] = useState<StockQuote | null>(null);
  useEffect(() => {
    if (isFundamentalMode) {
      fetchStockQuote(stockTicker).then(q => { if (q) setStockQuote(q); });
    }
  }, [stockTicker, isFundamentalMode, refreshKey]);

  // Use live market cap to recalculate P/E, P/S, EV/EBITDA dynamically
  const fundData = useMemo(() => {
    if (!isFundamentalMode) return null;
    if (stockQuote && stockQuote.marketCap > 0) {
      return recalcFundamentals(stockTicker, stockQuote.marketCap, stockQuote.price);
    }
    return STOCKS_FUNDAMENTAL[stockTicker] ?? null;
  }, [isFundamentalMode, stockTicker, stockQuote]);
  const stressData = fundData ? getStressScore(fundData) : null;
  const sectorData = fundData ? getSectorComparison(fundData.sector) : null;

  return (
    <div className="w-[340px] min-w-[340px] bg-[#0d0d14] border-l border-white/5 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {!hasNodes ? 'Elibri FX' : isFundamentalMode ? 'Fundamental Analysis' : 'AI-agent'}
            </div>
            <div className="text-sm font-bold text-white">
              {!hasNodes
                ? 'Strategy Builder'
                : isFundamentalMode
                ? 'T-Invest Analyzer'
                : segmentMode === 'beginner' ? 'Guided Trader' : segmentMode === 'yolo' ? 'YOLO Trader' : 'Trading Analyst'}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] text-emerald-400">Online</span>
            {isLive && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-[9px] font-bold text-indigo-400 uppercase">
                Live
              </span>
            )}
          </div>
        </div>

        {/* Segment Mode Switcher — hidden in fundamental mode and empty canvas */}
        {!isFundamentalMode && hasNodes && (
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {(['beginner', 'pro', 'yolo'] as SegmentMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setSegmentMode(mode)}
              className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all ${
                segmentMode === mode
                  ? mode === 'beginner' ? 'bg-emerald-500/20 text-emerald-400'
                    : mode === 'yolo' ? 'bg-red-500/20 text-red-400'
                    : 'bg-indigo-500/20 text-indigo-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {mode === 'beginner' ? '🎓 Beginner' : mode === 'yolo' ? '🔥 YOLO' : '📊 Pro'}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* MT5 Account Strip */}
      {mt5Status === 'connected' && account && (
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] text-gray-400">#{account.login}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[9px] text-gray-500">Balance </span>
              <span className="text-[10px] font-semibold text-white">{account.balance.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-gray-500">Equity </span>
              <span className={`text-[10px] font-semibold ${account.equity >= account.balance ? 'text-emerald-400' : 'text-red-400'}`}>
                {account.equity.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Graph Engine Score */}
      {hasNodes && graphResult.totalWeight > 0 && (
        <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Graph Score</span>
              <span className={`text-sm font-black ${
                graphResult.direction === 'buy' ? 'text-emerald-400' :
                graphResult.direction === 'sell' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {graphResult.direction === 'buy' ? '▲ BUY' :
                 graphResult.direction === 'sell' ? '▼ SELL' : '● NEUTRAL'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{Math.round(graphResult.confidence)}%</span>
              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    graphResult.direction === 'buy' ? 'bg-emerald-500' :
                    graphResult.direction === 'sell' ? 'bg-red-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${graphResult.confidence}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graph Warnings */}
      {warnings.length > 0 && hasNodes && (
        <div className="px-4 py-2 border-b border-white/5 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className={`flex items-center gap-1.5 text-[10px] ${
              w.type === 'error' ? 'text-red-400' : 'text-amber-400'
            }`}>
              <span>{w.type === 'error' ? '❌' : '⚠️'}</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {!hasNodes ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="text-3xl mb-3 opacity-30">📊</div>
            <p className="text-sm text-gray-500">Add nodes to see live analysis</p>
            <p className="text-[10px] text-gray-600 mt-1">Or try a template from the toolbar</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {isFundamentalMode && fundData ? (
            <FundamentalView
              fund={fundData}
              graphResult={graphResult}
              quote={stockQuote}
              stress={stressData}
              sector={sectorData}
              onRefresh={onRefresh}
              nodes={nodes}
              edges={edges}
            />
          ) : (
            <>
              {segmentMode === 'beginner' && <BeginnerView analysis={analysis as BeginnerAnalysis} symbol={selectedPair} onRefresh={onRefresh} />}
              {segmentMode === 'pro' && <ProView analysis={analysis as AIAnalysis} symbol={selectedPair} onRefresh={onRefresh} />}
              {segmentMode === 'yolo' && <YOLOView analysis={analysis as YOLOAnalysis} symbol={selectedPair} onRefresh={onRefresh} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Beginner View ──────────────────────────────

function BeginnerView({ analysis, symbol, onRefresh }: { analysis: BeginnerAnalysis; symbol: string; onRefresh: () => void }) {
  return (
    <>
      {/* Safe to Trade? */}
      <div className={`rounded-xl p-3 border ${
        analysis.safeToTrade
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-red-500/5 border-red-500/20'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{analysis.safeToTrade ? '✅' : '⚠️'}</span>
          <span className={`text-sm font-bold ${analysis.safeToTrade ? 'text-emerald-400' : 'text-red-400'}`}>
            {analysis.safeToTrade ? 'Safe to Trade' : 'Not Recommended'}
          </span>
        </div>
        <p className="text-[11px] text-gray-400">{analysis.safeToTrade ? 'Conditions look favorable for this trade.' : 'Mixed signals or high risk. Better to wait.'}</p>
      </div>

      {/* Gauge */}
      <Section title="Market Direction">
        <GaugeWidget verdict={analysis.verdict} confidence={analysis.confidence} />
      </Section>

      {/* WHY Explanation */}
      <Section title="Why This Trade?">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
          <p className="text-[11px] text-emerald-300 leading-relaxed">{analysis.whyExplanation}</p>
        </div>
      </Section>

      {/* Steps */}
      <Section title="Step by Step">
        <div className="space-y-1.5">
          {analysis.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] text-emerald-500 mt-0.5 font-bold">{i + 1}</span>
              <span className="text-[11px] text-gray-400">{step.replace(/^\d+\.\s*/, '')}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Chart */}
      <Section title="Chart">
        <TradingViewChart
          key={symbol}
          symbol={symbol}
          entry={analysis.entry}
          stopLoss={analysis.stopLoss}
          takeProfit={analysis.takeProfit}
        />
      </Section>

      {/* Trade Levels */}
      <Section title="Trade Setup">
        <div className="space-y-2">
          <LevelRow label="Entry" value={analysis.entry} color="text-indigo-400" />
          <LevelRow label="Stop Loss" value={analysis.stopLoss} color="text-red-400" />
          <LevelRow label="Take Profit" value={analysis.takeProfit} color="text-emerald-400" />
        </div>
      </Section>

      {/* Lesson Tip */}
      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
        <div className="text-[10px] text-indigo-400 font-semibold mb-1">💡 Trading Tip</div>
        <p className="text-[11px] text-gray-400 leading-relaxed">{analysis.lessonTip}</p>
      </div>

      <button
        onClick={onRefresh}
        className="w-full py-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition-all font-medium"
      >
        Refresh Analysis
      </button>
    </>
  );
}

// ─── Pro View ──────────────────────────────

function ProView({ analysis, symbol, onRefresh }: { analysis: AIAnalysis; symbol: string; onRefresh: () => void }) {
  return (
    <>
      <Section title="Market Signal">
        <GaugeWidget verdict={analysis.verdict} confidence={analysis.confidence} />
      </Section>

      <Section title="Chart Analysis">
        <TradingViewChart
          key={symbol}
          symbol={symbol}
          entry={analysis.entry}
          stopLoss={analysis.stopLoss}
          takeProfit={analysis.takeProfit}
        />
      </Section>

      <Section title="Signals">
        <SignalTable signals={analysis.signals} />
      </Section>

      <Section title="Trade Setup">
        <div className="space-y-2">
          <LevelRow label="Entry" value={analysis.entry} color="text-indigo-400" />
          <LevelRow label="Stop Loss" value={analysis.stopLoss} color="text-red-400" />
          <LevelRow label="Take Profit" value={analysis.takeProfit} color="text-emerald-400" />
          <div className="pt-1 border-t border-white/5">
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-500">Risk/Reward</span>
              <span className="text-[11px] font-semibold text-amber-400">
                1:{Math.abs(Math.round((analysis.takeProfit - analysis.entry) / (analysis.entry - analysis.stopLoss) * 10) / 10)}
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Risk Assessment">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500">Risk Level</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
              analysis.riskLevel === 'Low' ? 'bg-emerald-500/20 text-emerald-400' :
              analysis.riskLevel === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {analysis.riskLevel}
            </span>
          </div>
          {analysis.riskMismatch && (
            <div className="mt-2">
              <div className="text-[10px] text-gray-500 mb-1">Risk Mismatch</div>
              <div className="text-lg font-bold text-red-400">{analysis.riskMismatch}</div>
            </div>
          )}
        </div>
      </Section>

      <Section title="AI Summary">
        <p className="text-[11px] text-gray-400 leading-relaxed">{analysis.summary}</p>
      </Section>

      <button
        onClick={onRefresh}
        className="w-full py-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition-all font-medium"
      >
        Refresh Analysis
      </button>
    </>
  );
}

// ─── YOLO View ──────────────────────────────

function YOLOView({ analysis, symbol, onRefresh }: { analysis: YOLOAnalysis; symbol: string; onRefresh: () => void }) {
  const mt5Status = useMT5Store((s) => s.status);
  const isLong = analysis.verdict.includes('Buy');

  return (
    <>
      {/* Adrenaline Meter */}
      <div className="rounded-xl p-3 bg-gradient-to-r from-red-500/5 to-amber-500/5 border border-red-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-white">Adrenaline Meter</span>
          <span className={`text-lg font-black ${
            analysis.adrenalineMeter > 80 ? 'text-red-400' :
            analysis.adrenalineMeter > 50 ? 'text-amber-400' : 'text-emerald-400'
          }`}>{analysis.adrenalineMeter}</span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              analysis.adrenalineMeter > 80 ? 'bg-gradient-to-r from-amber-500 to-red-500' :
              analysis.adrenalineMeter > 50 ? 'bg-gradient-to-r from-emerald-500 to-amber-500' :
              'bg-emerald-500'
            }`}
            style={{ width: `${analysis.adrenalineMeter}%` }}
          />
        </div>
      </div>

      {/* Momentum Score */}
      <div className="flex items-center justify-between px-1">
        <div className="text-center">
          <div className="text-2xl font-black text-white">{analysis.momentumScore}</div>
          <div className="text-[9px] text-gray-500 uppercase">Momentum</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-black ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
            {analysis.verdict.replace('Strong ', '')}
          </div>
          <div className="text-[9px] text-gray-500 uppercase">Direction</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-white">{analysis.confidence}%</div>
          <div className="text-[9px] text-gray-500 uppercase">Confidence</div>
        </div>
      </div>

      {/* Risk Budget */}
      <Section title="Risk Budget">
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-gray-500">Daily Loss</span>
              <span className={`font-semibold ${
                analysis.riskBudgetUsed > 80 ? 'text-red-400' : analysis.riskBudgetUsed > 50 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                ${analysis.dailyLossUsed} / ${analysis.maxDailyLoss}
              </span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  analysis.riskBudgetUsed > 80 ? 'bg-red-500' : analysis.riskBudgetUsed > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${analysis.riskBudgetUsed}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">Trades Used</span>
            <span className="text-white font-bold">{analysis.tradesUsed} / {analysis.maxTrades}</span>
          </div>
        </div>
      </Section>

      {/* Chart */}
      <Section title="Chart">
        <TradingViewChart
          key={symbol}
          symbol={symbol}
          entry={analysis.entry}
          stopLoss={analysis.stopLoss}
          takeProfit={analysis.takeProfit}
        />
      </Section>

      {/* Trade Setup */}
      <Section title="Trade Setup">
        <div className="space-y-2">
          <LevelRow label="Entry" value={analysis.entry} color="text-indigo-400" />
          <LevelRow label="Stop Loss" value={analysis.stopLoss} color="text-red-400" />
          <LevelRow label="Take Profit" value={analysis.takeProfit} color="text-emerald-400" />
        </div>
      </Section>

      {/* Risk Warning */}
      {analysis.riskMismatch && (
        <div className="rounded-xl p-3 bg-red-500/5 border border-red-500/20">
          <div className="text-sm font-bold text-red-400">{analysis.riskMismatch}</div>
        </div>
      )}

      {/* Summary */}
      <Section title="Momentum Analysis">
        <p className="text-[11px] text-gray-400 leading-relaxed">{analysis.summary}</p>
      </Section>

      {/* SEND IT Button */}
      <button
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
          analysis.riskBudgetUsed > 80
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            : isLong
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/20'
            : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-500/20'
        }`}
        disabled={analysis.riskBudgetUsed > 80}
      >
        {analysis.riskBudgetUsed > 80
          ? '🚫 Budget Exceeded'
          : isLong
          ? '🚀 SEND IT LONG'
          : '📉 SEND IT SHORT'}
      </button>

      <button
        onClick={onRefresh}
        className="w-full py-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-white transition-all font-medium"
      >
        Refresh Analysis
      </button>

      <div className="text-center text-[9px] text-gray-600">
        {mt5Status === 'connected' ? 'MT5 Connected — trades will execute on your account' : 'Connect MT5 to execute trades'}
      </div>
    </>
  );
}

// ─── Fundamental View ──────────────────────

import type { GraphResult } from '../../lib/graphEngine';
import type { FundamentalData, SectorComparison } from '../../lib/stockData';

function FundamentalView({ fund, graphResult, quote, stress, sector, onRefresh, nodes, edges }: {
  fund: FundamentalData;
  graphResult: GraphResult;
  quote: StockQuote | null;
  stress: ReturnType<typeof getStressScore> | null;
  sector: SectorComparison | null;
  onRefresh: () => void;
  nodes: Node[];
  edges: Edge[];
}) {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Auto-run backtest when nodes/ticker change
  useEffect(() => {
    setBacktestLoading(true);
    runBacktest(nodes, edges, fund.ticker).then(result => {
      setBacktestResult(result);
      setBacktestLoading(false);
    });
  }, [nodes, edges, fund.ticker]);
  // Portfolio score derived from graph engine (weights affect this!)
  // finalScore is -1..+1, convert to 0..100
  const graphScore = graphResult.finalScore;
  const portfolioScore = Math.round(Math.max(0, Math.min(100, (graphScore + 1) * 50)));
  const verdict = portfolioScore >= 80 ? 'STRONG BUY' : portfolioScore >= 60 ? 'BUY' : portfolioScore >= 40 ? 'HOLD' : 'AVOID';
  const verdictColor = verdict === 'STRONG BUY' || verdict === 'BUY' ? 'text-emerald-400' : verdict === 'HOLD' ? 'text-amber-400' : 'text-red-400';

  return (
    <>
      {/* Company Header */}
      <Section title={`${fund.name} (${fund.ticker})`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {quote ? (
              <span className={`text-lg font-black ${(quote.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {quote.price.toFixed(2)} ₽
              </span>
            ) : (
              <span className="text-lg font-black text-white">{fund.currentPrice} ₽</span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
              fund.reportType === 'МСФО' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
            }`}>{fund.reportType}</span>
          </div>
          {quote && (
            <div className={`text-[10px] ${quote.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {quote.changePercent >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%) за день
            </div>
          )}
        </div>
      </Section>

      {/* Verdict */}
      <Section title="Portfolio Score">
        <div className="text-center py-3 rounded-xl bg-white/[0.03] border border-white/5">
          <div className={`text-4xl font-black ${portfolioScore >= 70 ? 'text-emerald-400' : portfolioScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {portfolioScore}
          </div>
          <div className="text-[9px] text-gray-500 mb-2">из 100</div>
          <div className={`text-sm font-black ${verdictColor}`}>{verdict}</div>
          <div className="text-[9px] text-gray-500 mt-1">Graph confidence: {graphResult.confidence}%</div>
        </div>
      </Section>

      {/* Real MOEX Chart */}
      <Section title="Chart">
        <StockChartComponent ticker={fund.ticker} fairValue={fund.fairValue} />
      </Section>

      {/* Price Levels */}
      <Section title="Ценовые уровни">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/5 rounded-full relative overflow-hidden">
              {(() => {
                const min = Math.min(fund.currentPrice * 0.85, quote?.low ?? fund.currentPrice);
                const max = Math.max(fund.fairValue * 1.05, quote?.high ?? fund.currentPrice);
                const range = max - min;
                const pricePos = ((quote?.price ?? fund.currentPrice) - min) / range * 100;
                const fairPos = (fund.fairValue - min) / range * 100;
                return (
                  <>
                    <div className="absolute h-full bg-indigo-500/30 rounded-full" style={{ left: `${Math.min(pricePos, fairPos)}%`, width: `${Math.abs(fairPos - pricePos)}%` }} />
                    <div className="absolute h-full w-1 bg-white rounded-full" style={{ left: `${pricePos}%` }} title="Current" />
                    <div className="absolute h-full w-1 bg-indigo-400 rounded-full" style={{ left: `${fairPos}%` }} title="Fair Value" />
                  </>
                );
              })()}
            </div>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">Цена: <strong className="text-white">{quote?.price.toFixed(2) ?? fund.currentPrice} ₽</strong></span>
            <span className="text-gray-500">Fair: <strong className="text-indigo-400">{fund.fairValue} ₽</strong></span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2 py-1.5 text-center">
              <div className="text-[8px] text-gray-500">Target</div>
              <div className="text-[11px] font-bold text-indigo-400">{fund.fairValue} ₽</div>
            </div>
            <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-center">
              <div className="text-[8px] text-gray-500">Stop Loss (-10%)</div>
              <div className="text-[11px] font-bold text-red-400">{((quote?.price ?? fund.currentPrice) * 0.9).toFixed(0)} ₽</div>
            </div>
            <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 text-center">
              <div className="text-[8px] text-gray-500">Upside</div>
              <div className="text-[11px] font-bold text-emerald-400">+{fund.upside}%</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Key Multipliers */}
      <Section title="Мультипликаторы">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'P/E', value: fund.pe.toFixed(1), good: fund.pe < 10 },
            { label: 'P/B', value: fund.pb.toFixed(1), good: fund.pb < 1.5 },
            { label: 'EV/EBITDA', value: fund.evEbitda.toFixed(1), good: fund.evEbitda < 6 },
            { label: 'P/S', value: fund.ps.toFixed(1), good: fund.ps < 1 },
            { label: 'Div Yield', value: `${fund.divYield}%`, good: fund.divYield > 8 },
            { label: 'FCF Yield', value: `${(fund.marketCap > 0 ? (fund.fcf / fund.marketCap * 100) : 0).toFixed(1)}%`, good: fund.fcf / fund.marketCap > 0.1 },
          ].map(m => (
            <div key={m.label} className={`rounded-lg px-2 py-1.5 text-center border ${m.good ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.03] border-white/5'}`}>
              <div className="text-[8px] text-gray-500">{m.label}</div>
              <div className={`text-[11px] font-bold ${m.good ? 'text-emerald-400' : 'text-white'}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Cash Flows */}
      <Section title="Денежные потоки">
        <div className="space-y-1.5">
          {[
            { label: 'Выручка', value: `${fund.revenue} млрд`, growth: fund.revenueGrowth },
            { label: 'EBITDA', value: fund.ebitda > 0 ? `${fund.ebitda} млрд` : 'N/A', growth: fund.ebitdaGrowth },
            { label: 'Чист. прибыль', value: `${fund.netIncome} млрд`, growth: 0 },
            { label: 'FCF', value: `${fund.fcf} млрд`, growth: fund.fcfGrowth },
            { label: 'CAPEX', value: `${fund.capex} млрд`, growth: 0 },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">{r.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white font-semibold">{r.value}</span>
                {r.growth !== 0 && (
                  <span className={`text-[9px] ${r.growth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.growth > 0 ? '↑' : '↓'}{Math.abs(r.growth)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Profitability */}
      <Section title="Рентабельность">
        <div className="space-y-1.5">
          {[
            { label: 'ROE', value: fund.roe, max: 40 },
            { label: 'ROA', value: fund.roa, max: 20 },
            { label: 'Net Margin', value: fund.netMargin, max: 40 },
            { label: 'Oper Margin', value: fund.operMargin, max: 50 },
          ].map(m => (
            <div key={m.label}>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-gray-400">{m.label}</span>
                <span className={`font-bold ${m.value > m.max * 0.5 ? 'text-emerald-400' : m.value > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {m.value.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full">
                <div className={`h-full rounded-full ${m.value > m.max * 0.5 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, (m.value / m.max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Debt & Stress Test */}
      <Section title="Долговая нагрузка">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Net Debt / EBITDA</span>
            <span className={`font-bold ${fund.netDebtEbitda < 1 ? 'text-emerald-400' : fund.netDebtEbitda < 2 ? 'text-amber-400' : 'text-red-400'}`}>
              {fund.netDebtEbitda.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Debt / Equity</span>
            <span className="text-white">{fund.debtEquity.toFixed(2)}</span>
          </div>
          {stress && (
            <div className={`mt-2 px-3 py-2 rounded-lg border ${
              stress.level === 'strong' ? 'bg-emerald-500/10 border-emerald-500/20' :
              stress.level === 'moderate' ? 'bg-amber-500/10 border-amber-500/20' :
              'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-gray-400">Стресс-тест</span>
                <span className={`font-bold ${stress.level === 'strong' ? 'text-emerald-400' : stress.level === 'moderate' ? 'text-amber-400' : 'text-red-400'}`}>
                  {stress.score}/100
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full">
                <div className={`h-full rounded-full ${stress.level === 'strong' ? 'bg-emerald-500' : stress.level === 'moderate' ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${stress.score}%` }} />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Sector Comparison */}
      {sector && sector.companies.length > 1 && (
        <Section title={`Сектор: ${fund.sector}`}>
          <div className="space-y-1">
            {sector.companies.map((c, i) => (
              <div key={c.ticker} className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] ${
                c.ticker === fund.ticker ? 'bg-indigo-500/15 border border-indigo-500/30' : 'bg-white/[0.03]'
              }`}>
                <span className={`font-bold w-3 ${i === 0 ? 'text-emerald-400' : 'text-gray-500'}`}>{i + 1}</span>
                <span className="text-white font-semibold flex-1">{c.ticker}</span>
                <span className="text-gray-500">P/E {c.pe.toFixed(1)}</span>
                <span className={`font-bold px-1 rounded ${c.score >= 70 ? 'text-emerald-400' : c.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {c.score}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Fair Value */}
      <Section title="Оценка">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Текущая цена</span>
            <span className="text-white font-bold">{quote?.price.toFixed(2) ?? fund.currentPrice} ₽</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Fair Value</span>
            <span className="text-indigo-400 font-bold">{fund.fairValue} ₽</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Потенциал</span>
            <span className={`font-bold ${fund.upside > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fund.upside > 0 ? '+' : ''}{fund.upside.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Market Cap</span>
            <span className="text-white">{fund.marketCap} млрд ₽</span>
          </div>
        </div>
      </Section>

      {/* Graph Signals */}
      <Section title="Signals">
        <SignalTable signals={graphResult.signals.map(s => ({
          name: s.label || s.nodeType,
          direction: s.signal > 0.1 ? 'long' as const : s.signal < -0.1 ? 'short' as const : 'neutral' as const,
          strength: Math.min(95, Math.round(50 + Math.abs(s.signal) * 45)),
        }))} />
      </Section>

      {/* Backtest — FOMO style */}
      <Section title="Что было бы если...">
        {backtestLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="ml-2 text-[10px] text-gray-500">Анализирую историю...</span>
          </div>
        ) : backtestResult ? (
          <div className="space-y-3">
            {/* FOMO header */}
            <div className="text-center">
              <div className="text-[10px] text-gray-500 mb-1">Если бы вы вложили 6 месяцев назад</div>
              <div className="text-[22px] font-black text-white">1 000 000 ₽</div>
            </div>

            {/* Equity curve */}
            <BacktestChart equityCurve={backtestResult.equityCurve} initialValue={1000000} />

            {/* Result — big number */}
            <div className={`text-center py-3 rounded-xl border ${
              backtestResult.totalReturn > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="text-[10px] text-gray-500 mb-1">Сегодня у вас было бы</div>
              <div className={`text-[26px] font-black ${backtestResult.totalReturn > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(1000000 + 1000000 * backtestResult.totalReturn / 100).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
              </div>
              <div className={`text-[14px] font-bold mt-1 ${backtestResult.totalReturn > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {backtestResult.totalReturn > 0 ? '+' : ''}{backtestResult.totalReturn}% за 6 мес
              </div>
              {backtestResult.totalReturn > 0 && (
                <div className="text-[10px] text-emerald-400/60 mt-1">
                  +{(1000000 * backtestResult.totalReturn / 100).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽ чистой прибыли
                </div>
              )}
            </div>

            {/* vs Buy & Hold */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
              <div className="text-[9px] text-gray-500 mb-1.5 text-center">Сравнение с простой покупкой</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <div className="text-[8px] text-gray-500">Стратегия Elibri</div>
                  <div className={`text-[14px] font-black ${backtestResult.totalReturn > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {backtestResult.totalReturn > 0 ? '+' : ''}{backtestResult.totalReturn}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] text-gray-500">Просто купить {fund.ticker}</div>
                  <div className={`text-[14px] font-black ${backtestResult.buyHoldReturn > 0 ? 'text-white' : 'text-red-400'}`}>
                    {backtestResult.buyHoldReturn > 0 ? '+' : ''}{backtestResult.buyHoldReturn}%
                  </div>
                </div>
              </div>
            </div>

            {/* Risk metrics */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-gray-500">Sharpe Ratio</span>
                <span className={`font-bold ${backtestResult.sharpeRatio > 1 ? 'text-emerald-400' : backtestResult.sharpeRatio > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                  {backtestResult.sharpeRatio}
                </span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-gray-500">Макс. просадка</span>
                <span className="text-red-400 font-bold">-{backtestResult.maxDrawdown}%</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-gray-500">Сделок</span>
                <span className="text-white font-bold">{backtestResult.totalTrades} (Win: {backtestResult.winRate}%)</span>
              </div>
            </div>

            <div className="text-[7px] text-gray-600 text-center leading-relaxed">
              Результаты на исторических данных MOEX за период {backtestResult.period}. Прошлые результаты не гарантируют будущую доходность.
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-gray-500 text-center py-4">Нет данных для бэктеста</div>
        )}
      </Section>

      <button onClick={onRefresh} className="w-full py-2 text-[10px] bg-white/[0.03] rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition">
        Refresh Analysis
      </button>
    </>
  );
}

// ─── Shared Components ──────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-300">{title}</span>
        <span className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-[9px] text-gray-600 cursor-help">?</span>
      </div>
      {children}
    </div>
  );
}

function LevelRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${color}`}>{value.toFixed(5)}</span>
    </div>
  );
}
