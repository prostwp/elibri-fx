import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Copy, Trash2, FolderOpen, Clock, Loader2,
  Play, Square, Activity,
} from 'lucide-react';
import { useFlowStore } from '../../stores/useFlowStore';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  fetchStrategies,
  createStrategy,
  deleteStrategy,
  duplicateStrategy,
  type Strategy,
} from '../../lib/strategies';
import { startScenario, stopScenario } from '../../lib/scenarios';
import type { SegmentMode } from '../../types/nodes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function StrategyListModal({ isOpen, onClose }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingActivate, setPendingActivate] = useState<string | null>(null);
  const [stopConfirmFor, setStopConfirmFor] = useState<Strategy | null>(null);
  const { user } = useAuthStore();
  const {
    setNodes, setEdges, setSelectedPair, setSegmentMode,
    setCurrentStrategy, nodes, edges, segmentMode, selectedPair,
    currentStrategyId,
  } = useFlowStore();

  useEffect(() => {
    if (!isOpen) return;
    if (!user) {
      setStrategies([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchStrategies().then((data) => {
      if (!cancelled) {
        setStrategies(data);
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Failed to load strategies:', err);
      if (!cancelled) {
        setStrategies([]);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [isOpen, user]);

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const strategy = await createStrategy(
        user.id,
        'New Strategy',
        nodes,
        edges,
        segmentMode,
        selectedPair,
      );
      setCurrentStrategy(strategy.id, strategy.name);
      onClose();
    } catch (err) {
      console.error('Failed to create strategy:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleLoad = (strategy: Strategy) => {
    setNodes(strategy.nodes_json);
    setEdges(strategy.edges_json);
    setSelectedPair(strategy.selected_pair);
    setSegmentMode(strategy.segment as SegmentMode);
    setCurrentStrategy(strategy.id, strategy.name);
    onClose();
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    try {
      const copy = await duplicateStrategy(id, user.id);
      setStrategies((prev) => [copy, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStrategy(id);
      if (currentStrategyId === id) {
        setCurrentStrategy(null, 'Untitled Strategy');
      }
      setStrategies((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleActivate = async (s: Strategy) => {
    setPendingActivate(s.id);
    // Optimistic update.
    setStrategies((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: true } : x));
    const res = await startScenario(s.id);
    setPendingActivate(null);
    if (res.status === 'error') {
      // Rollback.
      setStrategies((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: false } : x));
      console.error('Failed to activate scenario:', s.id);
    }
  };

  const handleStopConfirm = async () => {
    if (!stopConfirmFor) return;
    const s = stopConfirmFor;
    setStopConfirmFor(null);
    setPendingActivate(s.id);
    setStrategies((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: false } : x));
    const res = await stopScenario(s.id);
    setPendingActivate(null);
    if (res.status === 'error') {
      setStrategies((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: true } : x));
      console.error('Failed to stop scenario:', s.id);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const segmentColor = (segment: string) => {
    switch (segment) {
      case 'beginner': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'yolo': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  const tierColor = (tier?: string) => {
    switch (tier) {
      case 'conservative': return 'text-sky-300 bg-sky-500/10 border-sky-500/20';
      case 'aggressive': return 'text-rose-300 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-300 bg-slate-500/10 border-slate-500/20';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 9999 }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0d0d14] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">My Strategies</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Save Current
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[30rem] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : strategies.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-500">No saved strategies yet.</p>
              <p className="text-xs text-slate-600 mt-1">Build a strategy and click "Save Current".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {strategies.map((s) => {
                const isActive = !!s.is_active;
                const isPending = pendingActivate === s.id;
                return (
                  <div
                    key={s.id}
                    className={`group flex items-center justify-between rounded-xl border p-3 transition cursor-pointer hover:bg-slate-800/50 ${
                      currentStrategyId === s.id
                        ? 'border-indigo-500/30 bg-indigo-500/5'
                        : isActive
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-slate-800 bg-transparent'
                    }`}
                    onClick={() => handleLoad(s)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isActive && (
                          <span className="relative flex h-2 w-2" title="Running — paper trading live">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                        <span className="text-sm font-medium text-white truncate">{s.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${segmentColor(s.segment)}`}>
                          {s.segment}
                        </span>
                        {s.risk_tier && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${tierColor(s.risk_tier)}`}>
                            {s.risk_tier}
                          </span>
                        )}
                        {isActive && (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            <Activity className="h-2.5 w-2.5" />
                            Running
                          </span>
                        )}
                        {currentStrategyId === s.id && (
                          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                            loaded
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                        <span>{s.selected_pair}</span>
                        {s.interval && <span className="font-mono">{s.interval}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(s.updated_at)}
                        </span>
                        <span>{(s.nodes_json as unknown[]).length} nodes</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 transition" onClick={(e) => e.stopPropagation()}>
                      {/* Activate / Stop — always visible for active strategies */}
                      {isActive ? (
                        <button
                          onClick={() => setStopConfirmFor(s)}
                          disabled={isPending}
                          className="rounded-md p-1.5 text-emerald-400 hover:bg-red-500/10 hover:text-red-400 transition disabled:opacity-50"
                          title="Stop paper trading"
                        >
                          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-current" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(s)}
                          disabled={isPending}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition disabled:opacity-50"
                          title="Activate paper trading"
                        >
                          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleDuplicate(s.id)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white transition"
                          title="Duplicate"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={isActive}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isActive ? 'Stop first before deleting' : 'Delete'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stop confirmation */}
      {stopConfirmFor && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80"
          style={{ zIndex: 10000 }}
          onMouseDown={() => setStopConfirmFor(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-800 bg-[#0d0d14] p-5 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-white">Stop paper scenario?</h3>
            <p className="mb-4 text-xs text-slate-400">
              <span className="font-medium text-slate-200">{stopConfirmFor.name}</span> will stop
              generating alerts. You can re-activate it anytime. Paper-trading history is preserved.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStopConfirmFor(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleStopConfirm}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-2 text-xs font-medium text-white hover:bg-red-500 transition"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
