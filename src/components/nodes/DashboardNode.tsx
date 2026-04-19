/**
 * DashboardNode — rich trade output card on the canvas.
 *
 * Reads the graph result + Crypto ML MTF consensus and renders everything
 * a trader needs to decide to pull the trigger:
 *   - Final verdict (LONG / SHORT / HOLD) + confidence
 *   - Position sizing (units, $ value, $ risk, R:R)
 *   - Entry / Stop / Target prices
 *   - MTF alignment badge (from cryptoML.mtfConsensus)
 *   - Top contributing signals
 *   - Plain-English 1-2 sentence rationale
 *   - Warnings (conflict, low confidence)
 *
 * Duplicates PreviewPanel for the canvas — so the trader can scan the
 * decision directly from the graph without scrolling the right panel.
 */

import { useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { DEMO_PAIRS, DEMO_CRYPTO, CRYPTO_PAIRS } from '../../lib/demoData';
import { evaluateGraph } from '../../lib/graphEngine';
import { buildTradeSummary, prettyNodeName } from '../../lib/tradeSummary';
import type { NodeProps } from '@xyflow/react';

function isCryptoPair(pair: string): boolean {
  return pair.endsWith('USDT') || (CRYPTO_PAIRS as readonly string[]).includes(pair);
}

export function DashboardNode(_: NodeProps) {
  const nodes = useFlowStore(s => s.nodes);
  const edges = useFlowStore(s => s.edges);
  const selectedPair = useFlowStore(s => s.selectedPair);

  const mt5Candles = useMT5Store(s => s.candles);
  const mt5Status = useMT5Store(s => s.status);
  const cryptoCandles = useCryptoStore(s => s.candles);
  const mlPredictions = useCryptoStore(s => s.mlPredictions);
  const newsAggregate = useCryptoStore(s => s.newsAggregate);

  // Resolve candles same way PreviewPanel does (so results match).
  const candles = useMemo(() => {
    if (isCryptoPair(selectedPair)) {
      const live = cryptoCandles[selectedPair];
      if (live && live.length > 0) return live;
      const demo = DEMO_CRYPTO[selectedPair];
      return demo?.candles ?? DEMO_CRYPTO.BTCUSDT?.candles ?? [];
    }
    const demoPair = DEMO_PAIRS[selectedPair] ?? DEMO_PAIRS.EURUSD;
    const live = mt5Candles[selectedPair];
    if (mt5Status === 'connected' && live && live.length > 0) return live;
    return demoPair.candles;
  }, [selectedPair, cryptoCandles, mt5Candles, mt5Status]);

  const graph = useMemo(
    () => evaluateGraph(nodes, edges, candles),
    // Re-eval on fresh ML or news data
    [nodes, edges, candles, mlPredictions, newsAggregate],
  );

  const ts = graph.tradeSetup;
  const hasEdge = graph.totalWeight > 0;

  const mtf = useMemo(() => {
    const cml = nodes.find(n => n.type === 'cryptoML');
    return cml?.data?.mtfConsensus as {
      direction?: string;
      alignment?: number;
      high_quality?: boolean;
      avg_confidence?: number;
    } | undefined;
  }, [nodes]);

  // Top 3 contributing signals by |signal × weight|.
  const topContributors = useMemo(() => {
    return graph.signals
      .filter(s => Math.abs(s.signal) > 0.05 && s.weight > 0.05)
      .sort((a, b) => Math.abs(b.signal * b.weight) - Math.abs(a.signal * a.weight))
      .slice(0, 3)
      .map(s => ({
        name: prettyNodeName(s.nodeType) || s.nodeType,
        signal: s.signal,
        weight: s.weight,
      }));
  }, [graph.signals]);

  const summary = useMemo(() => buildTradeSummary(nodes, graph), [nodes, graph]);

  // Visual tone per direction
  const dirTone =
    graph.direction === 'buy' ? 'emerald' :
    graph.direction === 'sell' ? 'red' :
    'gray';

  const dirIcon = graph.direction === 'buy' ? '▲' : graph.direction === 'sell' ? '▼' : '—';
  const dirLabel =
    ts?.direction === 'buy' ? 'LONG' :
    ts?.direction === 'sell' ? 'SHORT' :
    ts?.direction === 'hold' ? 'HOLD' :
    graph.direction.toUpperCase();

  return (
    <BaseNode icon="📋" label="Dashboard" category="output" outputs={0}>
      <div className="space-y-2 w-[320px]">
        {!hasEdge ? (
          <div className="text-[10px] text-gray-500 text-center py-3">
            Connect nodes to see trade setup
          </div>
        ) : (
          <>
            {/* Verdict bar — large */}
            <div className={`rounded-md px-3 py-2 border ${
              dirTone === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30' :
              dirTone === 'red' ? 'bg-red-500/10 border-red-500/30' :
              'bg-white/3 border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-black ${
                    dirTone === 'emerald' ? 'text-emerald-400' :
                    dirTone === 'red' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {dirIcon} {dirLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">conf</span>
                  <span className={`text-sm font-bold ${
                    graph.confidence > 70 ? 'text-emerald-400' :
                    graph.confidence > 50 ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    {Math.round(graph.confidence)}%
                  </span>
                </div>
              </div>
              {/* Confidence bar */}
              <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    dirTone === 'emerald' ? 'bg-emerald-500' :
                    dirTone === 'red' ? 'bg-red-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.max(5, Math.round(graph.confidence))}%` }}
                />
              </div>
            </div>

            {/* MTF alignment badge */}
            {mtf && mtf.direction && (
              <div className={`flex items-center justify-between text-[10px] rounded px-2 py-1 ${
                mtf.high_quality ? 'bg-emerald-500/10 text-emerald-300' :
                mtf.direction === 'mixed' ? 'bg-amber-500/10 text-amber-300' :
                'bg-white/3 text-gray-400'
              }`}>
                <span className="font-semibold">
                  {mtf.high_quality ? '⚡ MTF aligned' :
                   mtf.direction === 'mixed' ? '⚠ TFs conflict' :
                   `TFs ${mtf.direction}`}
                </span>
                <span className="font-mono">
                  {Math.round((mtf.alignment ?? 0) * 100)}% agreement
                </span>
              </div>
            )}

            {/* Trade setup — compact grid */}
            {ts && ts.direction !== 'hold' && (
              <div className="border-t border-white/5 pt-1.5 space-y-1">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                  Position
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-mono text-white">
                    {ts.positionSize < 1 ? ts.positionSize.toFixed(4) : ts.positionSize.toFixed(2)}
                    <span className="text-[9px] text-gray-500 ml-1">units</span>
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    ≈ ${ts.positionValue.toFixed(0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[9px]">
                  <div className="bg-white/3 rounded px-1.5 py-1">
                    <div className="text-gray-500 text-[8px] uppercase">Entry</div>
                    <div className="text-indigo-400 font-mono">${ts.entry.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/3 rounded px-1.5 py-1">
                    <div className="text-gray-500 text-[8px] uppercase">Stop</div>
                    <div className="text-red-400 font-mono">${ts.stopLoss.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/3 rounded px-1.5 py-1">
                    <div className="text-gray-500 text-[8px] uppercase">Target</div>
                    <div className="text-emerald-400 font-mono">${ts.takeProfit.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-gray-500">
                    Risk <span className="text-red-400 font-mono">-${ts.riskDollars.toFixed(0)}</span>
                    <span className="text-gray-600"> ({ts.riskPct.toFixed(1)}%)</span>
                  </span>
                  <span className="text-gray-500">
                    Reward <span className="text-emerald-400 font-mono">+${ts.rewardDollars.toFixed(0)}</span>
                  </span>
                  <span className="text-gray-500">
                    R:R{' '}
                    <span className={`font-mono font-semibold ${
                      ts.riskRewardRatio >= 2 ? 'text-emerald-400' :
                      ts.riskRewardRatio >= 1 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      1:{ts.riskRewardRatio.toFixed(2)}
                    </span>
                  </span>
                </div>
                {ts.hasConflict && (
                  <div className="text-[9px] text-amber-300 bg-amber-500/10 rounded px-1.5 py-0.5 text-center">
                    ⚠ Conflict · size cut ×0.5
                  </div>
                )}
              </div>
            )}

            {/* Top contributing signals */}
            {topContributors.length > 0 && (
              <div className="border-t border-white/5 pt-1.5 space-y-0.5">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                  Top signals
                </div>
                {topContributors.map((c, i) => {
                  const tone = c.signal > 0 ? 'text-emerald-400' : c.signal < 0 ? 'text-red-400' : 'text-gray-400';
                  const icon = c.signal > 0.1 ? '▲' : c.signal < -0.1 ? '▼' : '—';
                  return (
                    <div key={i} className="flex items-center justify-between text-[9px]">
                      <span className="text-white/70">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={tone}>{icon} {(c.signal * 100).toFixed(0)}%</span>
                        <span className="text-gray-500 text-[8px] font-mono w-10 text-right">
                          w{Math.round(c.weight * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Plain-English summary */}
            <div className="border-t border-white/5 pt-1.5">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                Summary
              </div>
              <div className="text-[10px] text-white/80 leading-snug">
                {summary}
              </div>
            </div>

            {/* ATR + equity footer */}
            {ts && (
              <div className="text-[8px] text-gray-600 font-mono text-right border-t border-white/5 pt-1">
                ATR ${ts.atr.toFixed(2)} · equity ${ts.equity.toLocaleString()}
              </div>
            )}
          </>
        )}
      </div>
    </BaseNode>
  );
}
