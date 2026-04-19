/**
 * CryptoMLNode — V2 ensemble prediction with feature importance + similar
 * historical situations + model metrics. Backend: POST /api/v1/ml/predict.
 *
 * Integrates with 3 upstream nodes:
 * - CryptoTechnical → provides indicators context (influences display)
 * - CryptoFundamental → news sentiment blends into final verdict
 * - TradingStyle → picks ensemble horizon (scalp/day/swing/position)
 *
 * The node's own `signal` value (consumed by downstream) is the graphEngine
 * output in [-1, +1] derived from probability.
 */

import { useEffect, useMemo, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { predictMLv2, predictMLv2Multi, type MLPredictionV2, type MLPredictMultiResponse } from '../../lib/backendClient';
import type { NodeProps } from '@xyflow/react';

const SHORT_FEATURE_LABEL: Record<string, string> = {
  rsi_7: 'RSI 7',
  rsi_14: 'RSI 14',
  rsi_21: 'RSI 21',
  macd_hist: 'MACD',
  macd_signal: 'MACD sig',
  bb_position: 'BB pos',
  stoch_k_14: 'Stoch',
  ema_cross_20_50: 'EMA 20/50',
  ema_cross_50_200: 'EMA 50/200',
  adx_14: 'ADX',
  price_vs_ema_50: 'Price/EMA50',
  price_vs_ema_200: 'Price/EMA200',
  atr_norm_14: 'ATR',
  bb_width: 'BB width',
  vol_regime: 'Vol regime',
  vol_ratio_5: 'Vol 5',
  vol_ratio_20: 'Vol 20',
  taker_buy_ratio: 'Taker buy',
  return_1: 'Ret 1',
  return_5: 'Ret 5',
  return_20: 'Ret 20',
  higher_highs_10: 'HH 10',
  lower_lows_10: 'LL 10',
  doji_last: 'Doji',
  engulfing_last: 'Engulf',
  hammer_last: 'Hammer',
  btc_corr_30: 'BTC corr',
  btc_beta_30: 'BTC beta',
  rsi_14_lag_4: 'RSI lag',
  return_5_lag_4: 'Ret5 lag',
  vol_ratio_20_lag_4: 'Vol lag',
};

function isCryptoPair(pair: string): boolean {
  return pair.endsWith('USDT') || pair.endsWith('BUSD') || pair.endsWith('USDC');
}

// TradingStyle string comes from upstream node; default is swing.
function resolveTradingStyle(nodes: any[]): 'scalp' | 'day' | 'swing' | 'position' {
  const ts = nodes.find(n => n.type === 'tradingStyle');
  const v = ts?.data?.tradingStyle;
  if (v === 'scalp' || v === 'day' || v === 'swing' || v === 'position') return v;
  return 'swing';
}

// Interval should come from upstream CryptoTechnical; fall back to 4h.
function resolveInterval(nodes: any[]): string {
  const ct = nodes.find(n => n.type === 'cryptoTechnical');
  return (ct?.data?.interval as string) || '4h';
}

export function CryptoMLNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const selectedPair = useFlowStore(s => s.selectedPair);
  const nodes = useFlowStore(s => s.nodes);
  const setMLPrediction = useCryptoStore(s => s.setMLPrediction);

  const pair = isCryptoPair(selectedPair) ? selectedPair : 'BTCUSDT';
  const weight = (data.weight as number) ?? 0.7;
  const interval = resolveInterval(nodes);
  const tradingStyle = resolveTradingStyle(nodes);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<MLPredictionV2 | null>(null);
  const [mtf, setMtf] = useState<MLPredictMultiResponse | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      // Multi-timeframe analysis: query 1h + 4h + 1d simultaneously so
      // trader sees if lower-TF signal aligns with higher-TF trend.
      const multi = await predictMLv2Multi(pair, ['1h', '4h', '1d'], tradingStyle);
      if (multi) {
        setMtf(multi);
        // Primary prediction = the interval user selected (from CryptoTechnical).
        const primary = multi.predictions[interval] ?? multi.predictions[multi.primary_interval];
        if (primary) {
          setResult(primary);
          setMLPrediction(pair, {
            direction: primary.direction,
            confidence: Math.round(primary.confidence),
            priceTarget: primary.price_target,
            timeframe: primary.timeframe,
            features: primary.features ?? {},
          });
          updateNodeData(id, { lastPredictedAt: primary.predicted_at, mtfConsensus: multi.consensus });
        }
      } else {
        // Fallback: single-TF.
        const r = await predictMLv2(pair, interval, tradingStyle);
        if (!r) throw new Error('empty response');
        setResult(r);
        setMLPrediction(pair, {
          direction: r.direction,
          confidence: Math.round(r.confidence),
          priceTarget: r.price_target,
          timeframe: r.timeframe,
          features: r.features ?? {},
        });
        updateNodeData(id, { lastPredictedAt: r.predicted_at });
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on mount / when pair or style changes.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, interval, tradingStyle]);

  const topFeatures = useMemo(() => {
    const top = result?.feature_importance?.slice(0, 5) ?? [];
    const max = top.reduce((m, f) => Math.max(m, f.importance), 0.0001);
    return top.map(f => ({ ...f, pct: (f.importance / max) * 100 }));
  }, [result]);

  const similar = result?.similar_situations?.slice(0, 3) ?? [];

  const verdictColor =
    result?.direction === 'buy'
      ? 'text-emerald-400'
      : result?.direction === 'sell'
        ? 'text-red-400'
        : 'text-gray-400';
  const verdictIcon = result?.direction === 'buy' ? '▲' : result?.direction === 'sell' ? '▼' : '—';

  return (
    <BaseNode
      id={id}
      icon="🧠"
      label="Crypto ML"
      category="agent"
      glowClass="node-glow-ai"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5 w-[260px]">
        {/* Header: pair + interval + tradingStyle hint */}
        <div className="flex items-center justify-between text-[9px] text-gray-500">
          <span>
            <span className="text-white/70">{pair}</span> · {interval} · {tradingStyle}
          </span>
          <button
            onClick={run}
            disabled={loading}
            className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
          >
            {loading ? '…' : '↻'}
          </button>
        </div>

        {/* Verdict */}
        <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
          <span className={`text-sm font-bold ${verdictColor}`}>
            {verdictIcon} {result?.direction?.toUpperCase() ?? '—'}
          </span>
          <span className="text-[10px] text-white/70">
            {result ? `${Math.round(result.confidence)}%` : '—'}
          </span>
        </div>

        {/* Price target + horizon */}
        {result && (
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-gray-500">
              Target: <span className="text-white/70">${result.price_target.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">{result.horizon_bars} bars</span>
          </div>
        )}

        {/* Multi-TimeFrame consensus */}
        {mtf && Object.keys(mtf.predictions).length > 1 && (
          <div className="border-t border-white/5 pt-1.5 space-y-0.5">
            <div className="flex items-center justify-between text-[8px]">
              <span className="text-gray-500 uppercase">Multi-TF</span>
              <span className={`font-bold px-1.5 py-0 rounded ${
                mtf.consensus.high_quality ? 'bg-emerald-500/20 text-emerald-300' :
                mtf.consensus.direction === 'mixed' ? 'bg-amber-500/15 text-amber-300' :
                'bg-white/5 text-gray-400'
              }`}>
                {mtf.consensus.direction.toUpperCase()} · {Math.round(mtf.consensus.alignment * 100)}%
              </span>
            </div>
            {(['1h', '4h', '1d'] as const).map(iv => {
              const p = mtf.predictions[iv];
              if (!p) return (
                <div key={iv} className="flex items-center justify-between text-[9px]">
                  <span className="text-gray-600 font-mono">{iv}</span>
                  <span className="text-gray-600">—</span>
                </div>
              );
              const tone = p.direction === 'buy' ? 'text-emerald-400'
                : p.direction === 'sell' ? 'text-red-400' : 'text-gray-400';
              const icon = p.direction === 'buy' ? '▲' : p.direction === 'sell' ? '▼' : '—';
              return (
                <div key={iv} className="flex items-center justify-between text-[9px]">
                  <span className="text-gray-500 font-mono">{iv}</span>
                  <span className="flex items-center gap-1">
                    <span className={tone}>{icon} {p.direction}</span>
                    <span className="text-gray-500">{Math.round(p.confidence)}%</span>
                    {p.metrics.high_confidence && (
                      <span className="text-emerald-400" title="High-confidence">⚡</span>
                    )}
                  </span>
                </div>
              );
            })}
            {mtf.consensus.high_quality && (
              <div className="text-[8px] text-emerald-300 text-center bg-emerald-500/10 rounded px-1.5 py-0.5 mt-1">
                ⚡ MTF ALIGNED · все ТФ согласны
              </div>
            )}
            {mtf.consensus.direction === 'mixed' && (
              <div className="text-[8px] text-amber-300 text-center bg-amber-500/10 rounded px-1.5 py-0.5 mt-1">
                ⚠ ТФ противоречат · не торговать
              </div>
            )}
          </div>
        )}

        {/* Model metrics (transparency) */}
        {result?.metrics && result.metrics.n_folds > 0 && (
          <>
            <div className="flex items-center justify-between text-[9px] bg-white/3 rounded px-1.5 py-0.5">
              <span className="text-gray-500">
                acc <span className="text-white/80">{(result.metrics.accuracy * 100).toFixed(0)}%</span>
              </span>
              <span className="text-gray-500">
                sh <span className={result.metrics.sharpe > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>
                  {result.metrics.sharpe >= 0 ? '+' : ''}{result.metrics.sharpe.toFixed(2)}
                </span>
              </span>
              <span className="text-gray-500">
                f1 <span className="text-white/80">{result.metrics.f1.toFixed(2)}</span>
              </span>
            </div>
            {/* High-confidence precision — the "real" accuracy on filtered trades */}
            {result.metrics.hc_signals_total > 0 && (
              <div className={`flex items-center justify-between text-[9px] rounded px-1.5 py-0.5 ${
                result.metrics.high_confidence
                  ? 'bg-emerald-500/15 border border-emerald-500/30'
                  : 'bg-white/3'
              }`}>
                <span className={result.metrics.high_confidence ? 'text-emerald-300 font-semibold' : 'text-gray-500'}>
                  HC precision
                </span>
                <span className={`font-bold ${
                  result.metrics.hc_precision >= 0.75 ? 'text-emerald-400'
                  : result.metrics.hc_precision >= 0.60 ? 'text-amber-400'
                  : 'text-red-400/80'
                }`}>
                  {(result.metrics.hc_precision * 100).toFixed(1)}%
                </span>
                <span className="text-gray-500 text-[8px]">
                  {result.metrics.hc_signals_total}/{result.metrics.n_test_total} ({(result.metrics.hc_signal_rate * 100).toFixed(0)}%)
                </span>
              </div>
            )}
            {result.metrics.high_confidence && (
              <div className="text-[8px] text-emerald-400 font-semibold text-center bg-emerald-500/10 rounded px-1.5 py-0.5">
                ⚡ HIGH-CONFIDENCE SIGNAL
              </div>
            )}
          </>
        )}

        {/* Feature importance bars */}
        {topFeatures.length > 0 && (
          <div className="space-y-0.5 pt-1 border-t border-white/5">
            <div className="text-[8px] text-gray-500 uppercase">Top features</div>
            {topFeatures.map(f => (
              <div key={f.name} className="flex items-center gap-1.5">
                <span className="text-[9px] text-white/70 w-14 shrink-0">
                  {SHORT_FEATURE_LABEL[f.name] ?? f.name}
                </span>
                <div className="flex-1 h-1 bg-white/5 rounded overflow-hidden">
                  <div className="h-full bg-purple-500/60" style={{ width: `${f.pct}%` }} />
                </div>
                <span className="text-[8px] text-gray-500 w-7 text-right">{(f.importance * 100).toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Similar situations */}
        {similar.length > 0 && (
          <div className="space-y-0.5 pt-1 border-t border-white/5">
            <div className="text-[8px] text-gray-500 uppercase">Похожие случаи</div>
            {similar.map((s, i) => {
              const out10 = s.outcome_10 * 100;
              const sign = out10 > 0 ? '+' : '';
              const tone =
                out10 > 2 ? 'text-emerald-400/80' : out10 < -2 ? 'text-red-400/80' : 'text-gray-400';
              const shortDate = s.date.slice(0, 10);
              return (
                <div key={i} className="flex items-center justify-between text-[9px]">
                  <span className="text-white/70 truncate">{shortDate}</span>
                  <span className={tone}>
                    {sign}{out10.toFixed(1)}% / 10b
                  </span>
                </div>
              );
            })}
            {result?.metrics && result.metrics.avg_outcome_10 !== 0 && (
              <div className="flex items-center justify-between text-[9px] bg-purple-500/5 rounded px-1.5 py-0.5 mt-1">
                <span className="text-purple-300/80">Ср. исход</span>
                <span className={result.metrics.avg_outcome_10 > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>
                  {result.metrics.avg_outcome_10 > 0 ? '+' : ''}
                  {(result.metrics.avg_outcome_10 * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fallback / error badge */}
        {result?.fallback_reason && (
          <div className="text-[8px] text-amber-400/70 bg-amber-500/5 rounded px-1.5 py-0.5">
            fallback: {result.fallback_reason}
          </div>
        )}
        {err && (
          <div className="text-[8px] text-red-400 bg-red-500/5 rounded px-1.5 py-0.5">
            {err}
          </div>
        )}

        {/* Version footer */}
        <div className="text-[7px] text-gray-600 font-mono text-right">
          {result?.model_version ?? 'not loaded'}
        </div>
      </div>
    </BaseNode>
  );
}
