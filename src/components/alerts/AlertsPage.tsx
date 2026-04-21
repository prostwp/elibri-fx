import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellOff, ArrowLeft, RefreshCw, ArrowUpRight, ArrowDownRight,
  Check, Loader2, Filter,
} from 'lucide-react';
import { listAlerts, type Alert } from '../../lib/scenarios';
import { fetchStrategies, type Strategy } from '../../lib/strategies';
import { useAuthStore } from '../../stores/useAuthStore';

type DirFilter = 'all' | 'buy' | 'sell';
type RangeFilter = '24h' | '7d' | '30d';

const RANGE_HOURS: Record<RangeFilter, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

const PAGE_SIZE = 50;
const POLL_MS = 60_000;

export function AlertsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [strategyFilter, setStrategyFilter] = useState('');
  const [dirFilter, setDirFilter] = useState<DirFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('7d');

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load strategies once for filter dropdown.
  useEffect(() => {
    if (!user) return;
    fetchStrategies().then(setStrategies).catch(() => setStrategies([]));
  }, [user]);

  // Core fetcher — used by mount, manual refresh, and poll.
  const load = useCallback(async (appending = false) => {
    if (!user) return;
    if (appending) setLoading(true); else setRefreshing(true);
    const nextOffset = appending ? offset : 0;
    const fresh = await listAlerts({
      strategyId: strategyFilter || undefined,
      limit: PAGE_SIZE,
      offset: nextOffset,
    });
    if (appending) {
      setAlerts((prev) => [...prev, ...fresh]);
    } else {
      setAlerts(fresh);
      setOffset(0);
    }
    setHasMore(fresh.length === PAGE_SIZE);
    if (appending) setLoading(false); else setRefreshing(false);
  }, [user, strategyFilter, offset]);

  // Re-fetch on mount + whenever strategy filter changes.
  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, strategyFilter]);

  // 60s polling — refresh the first page only.
  useEffect(() => {
    if (!user) return;
    pollTimerRef.current = setInterval(() => {
      void load(false);
    }, POLL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, strategyFilter]);

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE);
    // Trigger fetch with new offset on next tick.
    setTimeout(() => void load(true), 0);
  };

  // Client-side filters applied to what we have.
  const visibleAlerts = useMemo(() => {
    const cutoff = Date.now() - RANGE_HOURS[rangeFilter] * 3600_000;
    return alerts.filter((a) => {
      if (dirFilter !== 'all' && a.direction !== dirFilter) return false;
      if (new Date(a.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [alerts, dirFilter, rangeFilter]);

  // ─── formatting helpers ────────────────────────

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  const fmtPrice = (p: number) => {
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(5);
  };

  const fmtUSD = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

  const confClass = (c: number) => {
    if (c >= 75) return 'text-emerald-300';
    if (c >= 60) return 'text-amber-300';
    return 'text-slate-400';
  };

  const labelBadge = (l: Alert['label']) => {
    switch (l) {
      case 'trend_aligned':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'mean_reversion':
        return 'bg-violet-500/10 text-violet-300 border-violet-500/20';
      default:
        return 'bg-slate-600/10 text-slate-400 border-slate-600/20';
    }
  };

  const labelText = (l: Alert['label']) => {
    switch (l) {
      case 'trend_aligned': return 'Trend';
      case 'mean_reversion': return 'Mean-rev';
      default: return 'Random';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/app')}
              className="mb-2 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Strategy Builder
            </button>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
              <Bell className="h-5 w-5 text-amber-400" />
              Alerts
              <span className="text-sm font-normal text-slate-500">
                ({visibleAlerts.length} of {alerts.length} loaded)
              </span>
            </h1>
          </div>
          <button
            onClick={() => void load(false)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-[#0d0d14] p-3">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
          >
            <option value="">All strategies</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.selected_pair} {s.interval ?? ''})
              </option>
            ))}
          </select>
          <select
            value={dirFilter}
            onChange={(e) => setDirFilter(e.target.value as DirFilter)}
            className="rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
          >
            <option value="all">All directions</option>
            <option value="buy">Long only</option>
            <option value="sell">Short only</option>
          </select>
          <select
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value as RangeFilter)}
            className="rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-800 bg-[#0d0d14] overflow-hidden">
          {alerts.length === 0 && !refreshing ? (
            <div className="py-16 text-center">
              <Bell className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm font-medium text-slate-300">No alerts yet</p>
              <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
                Your paper scenarios are analysing the market. Typical BTC 4h Conservative generates
                1–2 alerts per week. Try leaving the system running for a few days.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/40 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Time</th>
                    <th className="px-3 py-2 text-left font-semibold">Symbol</th>
                    <th className="px-3 py-2 text-left font-semibold">TF</th>
                    <th className="px-3 py-2 text-left font-semibold">Direction</th>
                    <th className="px-3 py-2 text-right font-semibold">Conf.</th>
                    <th className="px-3 py-2 text-right font-semibold">Entry</th>
                    <th className="px-3 py-2 text-right font-semibold">SL</th>
                    <th className="px-3 py-2 text-right font-semibold">TP</th>
                    <th className="px-3 py-2 text-right font-semibold">Size</th>
                    <th className="px-3 py-2 text-left font-semibold">Label</th>
                    <th className="px-3 py-2 text-center font-semibold">TG</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAlerts.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-slate-800/50 text-slate-300 transition hover:bg-slate-800/30"
                    >
                      <td className="px-3 py-2.5" title={new Date(a.created_at).toLocaleString()}>
                        <span className="text-slate-400">{timeAgo(a.created_at)}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-white">{a.symbol}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-400">{a.interval}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          a.direction === 'buy'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}>
                          {a.direction === 'buy'
                            ? <><ArrowUpRight className="h-3 w-3" />LONG</>
                            : <><ArrowDownRight className="h-3 w-3" />SHORT</>}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold ${confClass(a.confidence)}`}>
                        {a.confidence.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmtPrice(a.entry_price)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-300">{fmtPrice(a.stop_loss)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-300">{fmtPrice(a.take_profit)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmtUSD(a.position_size_usd)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${labelBadge(a.label)}`}>
                          {labelText(a.label)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {a.telegram_sent_at ? (
                          <Check
                            className="mx-auto h-3.5 w-3.5 text-emerald-400"
                            aria-label="Delivered to Telegram"
                          />
                        ) : (
                          <BellOff
                            className="mx-auto h-3.5 w-3.5 text-slate-600"
                            aria-label="Not delivered (no Telegram linked)"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {alerts.length > 0 && (
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={handleLoadMore}
              disabled={!hasMore || loading}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {hasMore ? 'Load more' : 'Nothing older to load'}
            </button>
          </div>
        )}

        {visibleAlerts.length === 0 && alerts.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-[#0d0d14] p-6 text-center">
            <p className="text-xs text-slate-500">
              No alerts match current filters. Try widening the time range or switching to "All directions".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
