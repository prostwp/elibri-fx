/**
 * DashboardNode — rich trade output card on the canvas.
 *
 * Reads the graph result + Crypto ML MTF consensus and renders everything
 * a trader needs to decide to pull the trigger:
 *   - Final verdict (LONG / SHORT / BLOCKED) + confidence vs tier threshold
 *   - Position sizing (units, $ value, $ risk, R:R) — all from tradeSetup
 *   - Entry / Stop / Target prices
 *   - MTF regime label badge (trend_aligned / mean_reversion / random / blocked)
 *   - Top contributing signals
 *   - Plain-English 1-2 sentence rationale (regime-aware)
 *   - Tier + model footer
 *
 * Patch 2C: reads new tradeSetup shape with `direction: 'hold'` + `blocked`
 * signal from graphEngine, and cryptoML.consensus label/reason fields.
 */

import { useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { DEMO_PAIRS, DEMO_CRYPTO, CRYPTO_PAIRS } from '../../lib/demoData';
import { evaluateGraph } from '../../lib/graphEngine';
import { prettyNodeName } from '../../lib/tradeSummary';
import type { NodeProps } from '@xyflow/react';

function isCryptoPair(pair: string): boolean {
  return pair.endsWith('USDT') || (CRYPTO_PAIRS as readonly string[]).includes(pair);
}

// Friendly messages when no setup (graphEngine.buildTradeSetup blocks).
// Framed as "waiting" rather than "error" — this is normal market state.
// Patch 2E: removed `low_conf` — HC threshold (backend) is the single
// confidence filter and produces `hc_threshold` rejection upstream.
const NO_SETUP_COPY: Record<string, { title: string; hint: string }> = {
  low_vol: {
    title: 'Market is flat',
    hint: 'Low volatility — trading now would be noise. Waiting for breakout.',
  },
  mtf: {
    title: 'Timeframes diverge',
    hint: 'Higher TF opposes entry. Waiting for alignment (or switch pair / TF).',
  },
  label: {
    title: 'Setup not matched',
    hint: 'Current pattern is outside your risk profile. Adjust tier for more permissive filters.',
  },
};

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

  // CryptoML consensus — canonical source for label/blocked/label_reason.
  const consensus = useMemo(() => {
    const cml = nodes.find(n => n.type === 'cryptoML');
    return cml?.data?.consensus as {
      direction?: string;
      alignment?: number;
      high_quality?: boolean;
      avg_confidence?: number;
      label?: 'trend_aligned' | 'mean_reversion' | 'random';
      label_reason?: string;
      blocked?: boolean;
      risk_tier?: string;
    } | undefined;
  }, [nodes]);

  // CryptoML features — may carry modelVersion for footer.
  const cryptoMLData = useMemo(() => {
    const cml = nodes.find(n => n.type === 'cryptoML');
    return cml?.data as {
      features?: Record<string, unknown>;
      timeframe?: string;
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

  // Derived flags & thresholds.
  // Patch 2E: tier-level min-confidence display is gone — HC threshold
  // (per-TF, owned by the model) is the authoritative confidence gate.
  const isBlocked = ts?.direction === 'hold' && !!ts?.blocked;
  const tierKey = ts?.riskTier ?? 'balanced';
  const confPct = Math.round(graph.confidence);

  // Arithmetic invariant check: rewardDollars / riskDollars ≈ riskRewardRatio.
  const arithmeticMismatch = useMemo(() => {
    if (!ts || ts.riskDollars <= 0 || ts.riskRewardRatio <= 0) return false;
    const computedRR = ts.rewardDollars / ts.riskDollars;
    return Math.abs(computedRR - ts.riskRewardRatio) > 0.05;
  }, [ts]);

  const dirLabel =
    ts?.direction === 'buy' ? 'LONG' :
    ts?.direction === 'sell' ? 'SHORT' :
    graph.direction.toUpperCase();

  // Regime-aware summary copy.
  const summaryText = useMemo(() => {
    if (isBlocked) {
      return NO_SETUP_COPY[ts!.blocked!]?.hint ?? 'Waiting for a matching setup.';
    }
    if (consensus?.label === 'mean_reversion') {
      return 'Counter-trend bounce setup. Tighter SL recommended.';
    }
    if (consensus?.label === 'trend_aligned') {
      return 'Aligned with higher timeframe trend. High-conviction setup.';
    }
    if (ts?.direction === 'hold') {
      return 'No setup — model is neutral. Waiting for movement.';
    }
    return `${dirLabel} bias at ${confPct}% confidence. R:R 1:${ts?.riskRewardRatio?.toFixed(2) ?? '—'}.`;
  }, [isBlocked, ts, consensus, dirLabel, confPct]);

  return (
    <BaseNode icon="📋" label="Dashboard" category="output" outputs={0}>
      <div className="space-y-2 w-[320px]">
        {!hasEdge ? (
          <div className="text-[10px] text-gray-500 text-center py-3">
            Connect nodes to see trade setup
          </div>
        ) : (
          <>
            {/* Verdict bar — NO SETUP (waiting) / LONG / SHORT */}
            {isBlocked ? (
              <div className="rounded-md px-3 py-2 border bg-white/3 border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-300">
                    {NO_SETUP_COPY[ts!.blocked!]?.title ?? 'No matching setup'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono uppercase">
                    {tierKey}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-gray-400 leading-snug">
                  {NO_SETUP_COPY[ts!.blocked!]?.hint ?? 'Waiting for market movement.'}
                </div>
                <div className="mt-1 text-[9px] text-gray-500 flex items-center justify-between">
                  <span>confidence {confPct}%</span>
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-40" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gray-400" />
                    </span>
                    monitoring
                  </span>
                </div>
              </div>
            ) : (
              <div className={`rounded-md px-3 py-2 border ${
                ts?.direction === 'buy' ? 'bg-emerald-500/10 border-emerald-500/30' :
                ts?.direction === 'sell' ? 'bg-red-500/10 border-red-500/30' :
                'bg-white/3 border-white/10'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-black ${
                    ts?.direction === 'buy' ? 'text-emerald-400' :
                    ts?.direction === 'sell' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {ts?.direction === 'buy' ? '▲' : ts?.direction === 'sell' ? '▼' : '—'} {dirLabel}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">conf</span>
                    <span className={`text-sm font-bold ${
                      confPct > 70 ? 'text-emerald-400' :
                      confPct > 50 ? 'text-amber-400' : 'text-gray-400'
                    }`}>
                      {confPct}%
                    </span>
                  </div>
                </div>
                {/* Confidence bar — decorative, no tier threshold marker.
                    HC threshold lives per-TF on the backend and filters
                    before the signal reaches the dashboard. */}
                <div className="mt-1.5 relative h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      ts?.direction === 'buy' ? 'bg-emerald-500' :
                      ts?.direction === 'sell' ? 'bg-red-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${Math.max(5, confPct)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Regime label badge (replaces legacy "TFs neutral" banner) */}
            {consensus && (consensus.label || consensus.blocked) && (
              <div className="space-y-0.5">
                {consensus.blocked ? (
                  <div className="flex items-center justify-between text-[10px] rounded px-2 py-1 bg-white/5 text-gray-400">
                    <span className="font-semibold">— No MTF consensus</span>
                    {consensus.risk_tier && (
                      <span className="font-mono text-[9px]">{consensus.risk_tier}</span>
                    )}
                  </div>
                ) : consensus.label === 'trend_aligned' ? (
                  <div className="flex items-center justify-between text-[10px] rounded px-2 py-1 bg-emerald-500/10 text-emerald-300">
                    <span className="font-semibold">⚡ Trend-Aligned</span>
                    <span className="font-mono text-[9px]">
                      {Math.round((consensus.alignment ?? 0) * 100)}% agree
                    </span>
                  </div>
                ) : consensus.label === 'mean_reversion' ? (
                  <div className="flex items-center justify-between text-[10px] rounded px-2 py-1 bg-blue-500/10 text-blue-300">
                    <span className="font-semibold">↻ Mean Reversion</span>
                    <span className="font-mono text-[9px]">
                      {Math.round((consensus.alignment ?? 0) * 100)}% agree
                    </span>
                  </div>
                ) : consensus.label === 'random' ? (
                  <div className="flex items-center justify-between text-[10px] rounded px-2 py-1 bg-amber-500/10 text-amber-300">
                    <span className="font-semibold">? Random (filtered by tier)</span>
                    <span className="font-mono text-[9px]">
                      {Math.round((consensus.alignment ?? 0) * 100)}%
                    </span>
                  </div>
                ) : null}
                {consensus.label_reason && (
                  <div className="text-[9px] text-gray-500 px-1 leading-tight">
                    {consensus.label_reason}
                  </div>
                )}
              </div>
            )}

            {/* Trade setup — compact grid (only when not blocked) */}
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
                {/* Risk/Reward/R:R — all sourced from tradeSetup, no client-side math */}
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-gray-500">
                    Risk <span className="text-red-400 font-mono">-${ts.riskDollars.toFixed(0)}</span>
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
                {/* Tier risk% annotation */}
                <div className="text-[8px] text-gray-500">
                  tier: <span className="text-white/60 font-mono">{tierKey}</span>
                  <span className="text-gray-600"> · {ts.riskPct.toFixed(2)}% per trade</span>
                </div>
                {arithmeticMismatch && (
                  <div className="text-[9px] text-amber-300 bg-amber-500/10 rounded px-1.5 py-0.5 text-center">
                    ⚠ arithmetic mismatch: reward/risk ≠ R:R
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

            {/* Plain-English summary (regime-aware) */}
            <div className="border-t border-white/5 pt-1.5">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                Summary
              </div>
              <div className="text-[10px] text-white/80 leading-snug">
                {summaryText}
              </div>
            </div>

            {/* Footer: ATR, equity, tier, model */}
            {ts && (
              <div className="text-[8px] text-gray-600 font-mono text-right border-t border-white/5 pt-1 space-y-0.5">
                <div>
                  ATR ${ts.atr.toFixed(2)} · equity ${ts.equity.toLocaleString()}
                </div>
                <div>
                  tier: {tierKey}
                  {(cryptoMLData?.features?.modelVersion as string | undefined) && (
                    <span> · model: {String(cryptoMLData!.features!.modelVersion)}</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </BaseNode>
  );
}
