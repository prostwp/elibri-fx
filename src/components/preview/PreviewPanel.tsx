import { useMemo, useState, useCallback } from 'react';
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

  return (
    <div className="w-[340px] min-w-[340px] bg-[#0d0d14] border-l border-white/5 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI-agent</div>
            <div className="text-sm font-bold text-white">
              {segmentMode === 'beginner' ? 'Guided Trader' : segmentMode === 'yolo' ? 'YOLO Trader' : 'Trading Analyst'}
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

        {/* Segment Mode Switcher */}
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
          {segmentMode === 'beginner' && <BeginnerView analysis={analysis as BeginnerAnalysis} symbol={selectedPair} onRefresh={onRefresh} />}
          {segmentMode === 'pro' && <ProView analysis={analysis as AIAnalysis} symbol={selectedPair} onRefresh={onRefresh} />}
          {segmentMode === 'yolo' && <YOLOView analysis={analysis as YOLOAnalysis} symbol={selectedPair} onRefresh={onRefresh} />}
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
