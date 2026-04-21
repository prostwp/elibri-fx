/**
 * ML Lab — model overview, backtest results, paper-trading portfolio view.
 * Surfaces data from /api/v1/ml/models + static JSON from backtest.py / paper_trade.py.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listMLModels,
  fetchBacktestSummary,
  fetchPaperTrades,
  reloadMLModels,
} from '../../lib/backendClient';
import { ArrowLeft } from 'lucide-react';

interface ModelInfo {
  key: string;
  symbol: string;
  interval: string;
  horizon: number;
  accuracy: number;
  sharpe: number;
  f1: number;
  n_folds: number;
  trained_at: string;
  n_features: number;
  n_trees: number;
}

interface ThresholdInfo {
  symbol: string;
  interval: string;
  key: string;
  threshold_high: number;
  threshold_low: number;
  precision: number;
  n_signals: number;
  fraction: number;
}

export function MLLabPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdInfo[]>([]);
  const [loadedAt, setLoadedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [backtest, setBacktest] = useState<any>(null);
  const [paperTrades, setPaperTrades] = useState<any>(null);
  const [reloading, setReloading] = useState(false);

  // Manual reload (event-handler context — safe to call setState sync here).
  const refresh = async () => {
    setLoading(true);
    const [m, b, p] = await Promise.all([
      listMLModels(),
      fetchBacktestSummary(),
      fetchPaperTrades(),
    ]);
    if (m) {
      setModels(m.models as ModelInfo[]);
      setThresholds((m as any).thresholds ?? []);
      setLoadedAt(m.health?.loaded_at ?? '');
    }
    setBacktest(b);
    setPaperTrades(p);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    // Inlined fetch so no setState runs synchronously inside the effect body.
    // `loading` already defaults to true, so UI shows the spinner on first render.
    const doFetch = () => {
      Promise.all([listMLModels(), fetchBacktestSummary(), fetchPaperTrades()])
        .then(([m, b, p]) => {
          if (cancelled) return;
          if (m) {
            setModels(m.models as ModelInfo[]);
            setThresholds((m as any).thresholds ?? []);
            setLoadedAt(m.health?.loaded_at ?? '');
          }
          setBacktest(b);
          setPaperTrades(p);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    };

    doFetch();
    // Poll every 30s so the page reflects fresh training/backtest output
    // without manual reload.
    const id = setInterval(doFetch, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleReload = async () => {
    setReloading(true);
    await reloadMLModels();
    await refresh();
    setReloading(false);
  };

  const avgAcc = models.length ? models.reduce((s, m) => s + m.accuracy, 0) / models.length : 0;
  const avgSharpe = models.length ? models.reduce((s, m) => s + m.sharpe, 0) / models.length : 0;
  const thresholdByKey = new Map(thresholds.map(t => [`${t.symbol}_${t.interval}`, t]));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-gray-400 hover:text-white transition">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-semibold">🧠 ML Lab</h1>
            <span className="text-xs text-gray-500">
              {loadedAt && `loaded ${new Date(loadedAt).toLocaleString()}`}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReload}
              disabled={reloading}
              className="text-[11px] px-3 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
            >
              {reloading ? 'Reloading…' : 'Reload models'}
            </button>
          </div>
        </header>

        {/* Summary */}
        <section className="grid grid-cols-4 gap-3">
          <StatCard label="Models" value={models.length} sub="pair × timeframe" />
          <StatCard label="Avg Accuracy" value={`${(avgAcc * 100).toFixed(1)}%`}
                    tone={avgAcc > 0.53 ? 'good' : avgAcc > 0.51 ? 'mid' : 'bad'} />
          <StatCard label="Avg Sharpe" value={avgSharpe.toFixed(2)}
                    tone={avgSharpe > 1 ? 'good' : avgSharpe > 0 ? 'mid' : 'bad'} />
          <StatCard label="Total Features" value="31" sub="RSI, MACD, BB, ATR, ADX, …" />
        </section>

        {/* Model table */}
        <section className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Trained Models</h2>
            <span className="text-[10px] text-gray-500">Walk-forward cross-validation metrics</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-white/3 text-gray-400">
              <tr>
                <th className="px-3 py-1.5 text-left">Symbol</th>
                <th className="px-3 py-1.5 text-left">TF</th>
                <th className="px-3 py-1.5 text-right">Horizon</th>
                <th className="px-3 py-1.5 text-right">Accuracy</th>
                <th className="px-3 py-1.5 text-right">Sharpe</th>
                <th className="px-3 py-1.5 text-right">F1</th>
                <th className="px-3 py-1.5 text-right">Folds</th>
                <th className="px-3 py-1.5 text-right">Trees</th>
                <th className="px-3 py-1.5 text-left">HC Threshold</th>
                <th className="px-3 py-1.5 text-right">HC Precision</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="text-center text-gray-500 py-4">Loading…</td></tr>
              )}
              {!loading && models.length === 0 && (
                <tr><td colSpan={10} className="text-center text-gray-500 py-4">No models loaded</td></tr>
              )}
              {models.map(m => {
                const thr = thresholdByKey.get(m.key);
                return (
                  <tr key={m.key} className="border-t border-white/3 hover:bg-white/3">
                    <td className="px-3 py-1.5 font-mono">{m.symbol}</td>
                    <td className="px-3 py-1.5 font-mono">{m.interval}</td>
                    <td className="px-3 py-1.5 text-right">{m.horizon} bars</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${
                      m.accuracy > 0.55 ? 'text-emerald-400'
                      : m.accuracy > 0.52 ? 'text-amber-400' : 'text-white/70'
                    }`}>{(m.accuracy * 100).toFixed(1)}%</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${
                      m.sharpe > 1 ? 'text-emerald-400'
                      : m.sharpe > 0 ? 'text-white/70' : 'text-red-400/80'
                    }`}>{m.sharpe >= 0 ? '+' : ''}{m.sharpe.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-white/70">{m.f1.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{m.n_folds}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{m.n_trees}</td>
                    <td className="px-3 py-1.5 text-[10px] text-gray-500">
                      {thr ? thr.key : 'default_0.80'}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${
                      thr && thr.precision > 0.65 ? 'text-emerald-400'
                      : thr && thr.precision > 0.55 ? 'text-amber-400' : 'text-white/70'
                    }`}>
                      {thr ? `${(thr.precision * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Backtest */}
        <section className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Backtest (Out-of-Sample, walk-forward)</h2>
            <span className="text-[10px] text-gray-500">ATR-based SL/TP · 5% risk per trade</span>
          </div>
          {!backtest || (backtest as any)?.error ? (
            <div className="p-3 text-[11px] text-gray-500">
              {(backtest as any)?.error || 'No backtest data yet. Run `backtest.py` after training.'}
            </div>
          ) : (
            <>
              <div className="px-4 py-2 bg-white/3 grid grid-cols-4 gap-3 text-[11px]">
                <div><span className="text-gray-500">Strategies:</span> <span className="text-white font-mono">{backtest.total_strategies}</span></div>
                <div>
                  <span className="text-gray-500">Avg Return:</span>{' '}
                  <span className={`font-mono font-semibold ${(backtest.avg_total_return_pct ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(backtest.avg_total_return_pct ?? 0) >= 0 ? '+' : ''}{(backtest.avg_total_return_pct ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div><span className="text-gray-500">Avg Win Rate:</span> <span className="font-mono">{((backtest.avg_win_rate ?? 0) * 100).toFixed(1)}%</span></div>
                <div>
                  <span className="text-gray-500">Avg Sharpe:</span>{' '}
                  <span className={`font-mono ${(backtest.avg_sharpe ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(backtest.avg_sharpe ?? 0) >= 0 ? '+' : ''}{(backtest.avg_sharpe ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-white/3 text-gray-400">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Symbol</th>
                    <th className="px-3 py-1.5 text-left">TF</th>
                    <th className="px-3 py-1.5 text-right">Trades</th>
                    <th className="px-3 py-1.5 text-right">Win Rate</th>
                    <th className="px-3 py-1.5 text-right">Return</th>
                    <th className="px-3 py-1.5 text-right">Max DD</th>
                    <th className="px-3 py-1.5 text-right">Sharpe</th>
                    <th className="px-3 py-1.5 text-right">Profit Factor</th>
                  </tr>
                </thead>
                <tbody>
                  {(backtest.results ?? []).map((r: any, i: number) => (
                    <tr key={i} className="border-t border-white/3 hover:bg-white/3">
                      <td className="px-3 py-1.5 font-mono">{r.symbol}</td>
                      <td className="px-3 py-1.5 font-mono">{r.interval}</td>
                      <td className="px-3 py-1.5 text-right">{r.n_trades}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{(r.win_rate * 100).toFixed(1)}%</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${r.total_return_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.total_return_pct >= 0 ? '+' : ''}{r.total_return_pct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-red-400/70">
                        -{r.max_drawdown_pct.toFixed(1)}%
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono ${r.sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.sharpe >= 0 ? '+' : ''}{r.sharpe.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.profit_factor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* Paper Trading */}
        <section className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Paper Trading (last {paperTrades?.lookback_days ?? 90}d)</h2>
            <span className="text-[10px] text-gray-500">Virtual portfolio simulation</span>
          </div>
          {!paperTrades || (paperTrades as any)?.error ? (
            <div className="p-3 text-[11px] text-gray-500">
              {(paperTrades as any)?.error || 'No paper-trading data yet. Run `paper_trade.py`.'}
            </div>
          ) : (
            <div className="px-4 py-3 grid grid-cols-4 gap-3 text-[11px]">
              <div>
                <div className="text-gray-500 text-[10px]">Total Equity</div>
                <div className="font-mono text-lg">
                  ${(paperTrades.total_final_equity ?? 0).toFixed(0)}
                  <span className="text-[10px] text-gray-500"> / ${(paperTrades.total_initial_equity ?? 0).toFixed(0)}</span>
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px]">Total Return</div>
                <div className={`font-mono text-lg ${(paperTrades.total_return_pct ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(paperTrades.total_return_pct ?? 0) >= 0 ? '+' : ''}{(paperTrades.total_return_pct ?? 0).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px]">Trades</div>
                <div className="font-mono text-lg">{paperTrades.n_trades_total}</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px]">Win Rate</div>
                <div className="font-mono text-lg">{((paperTrades.win_rate_overall ?? 0) * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'good' | 'mid' | 'bad';
}) {
  const valueClass =
    tone === 'good' ? 'text-emerald-400'
    : tone === 'mid' ? 'text-amber-400'
    : tone === 'bad' ? 'text-red-400'
    : 'text-white';
  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="text-[9px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}
