import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAuth } from '../../hooks/useAuth';
import { useReactFlow } from '@xyflow/react';
import { TEMPLATES } from '../../lib/templates';
import { StrategyListModal } from '../strategies/StrategyListModal';
import { toast } from '../ui/Toast';

export function Toolbar() {
  const {
    setNodes, setEdges, clear, setSelectedPair, setSegmentMode,
    currentStrategyId, currentStrategyName, dirty, saving, saveCurrentStrategy,
  } = useFlowStore();
  const { status: mt5Status, setShowConnectModal, account } = useMT5Store();
  const [strategiesOpen, setStrategiesOpen] = useState(false);
  const { profile, user } = useAuthStore();
  const { signOut } = useAuth();
  const { fitView } = useReactFlow();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const initials = (profile?.display_name ?? user?.email ?? 'U')
    .slice(0, 2).toUpperCase();

  const loadTemplate = (index: number) => {
    const template = TEMPLATES[index];
    if (!template) return;
    clear();
    setSegmentMode(template.segment);
    const mpNode = template.nodes.find(n => n.type === 'marketPair');
    if (mpNode?.data?.pair) {
      setSelectedPair(mpNode.data.pair as string);
    }
    setTimeout(() => {
      setNodes(template.nodes);
      setEdges(template.edges);
      // Auto fit view after nodes are placed
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
    }, 50);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-[#111118]/90 backdrop-blur-sm rounded-lg border border-white/5 px-2 py-1.5">
        {/* Strategies */}
        <button
          onClick={() => setStrategiesOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 transition-all h-9"
        >
          <span className="text-sm">📂</span>
          <span className="text-[10px] font-semibold text-indigo-300 whitespace-nowrap max-w-24 truncate">
            {currentStrategyId ? currentStrategyName : 'Strategies'}
          </span>
        </button>

        {/* Save button */}
        {currentStrategyId && (
          <button
            onClick={() => saveCurrentStrategy().then(() => toast.success('Strategy saved'))}
            disabled={saving || !dirty}
            className={`flex items-center gap-1 px-2 py-2 rounded-md border transition-all h-9 text-[10px] font-semibold ${
              saving
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 cursor-wait'
                : dirty
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400'
                : 'bg-white/[0.02] border-white/5 text-gray-600 cursor-default'
            }`}
            title={saving ? 'Saving...' : dirty ? 'Save changes' : 'All saved'}
          >
            {saving ? '⏳' : dirty ? '💾' : '✓'}
          </button>
        )}

        <div className="w-px h-5 bg-white/10 mx-1" />

        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mr-1">Templates:</span>
        {TEMPLATES.map((t, i) => (
          <button
            key={i}
            onClick={() => loadTemplate(i)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all h-9
              ${t.segment === 'beginner'
                ? 'bg-emerald-500/5 hover:bg-emerald-500/15 border-emerald-500/10 hover:border-emerald-500/30'
                : t.segment === 'yolo'
                ? 'bg-red-500/5 hover:bg-red-500/15 border-red-500/10 hover:border-red-500/30'
                : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5 hover:border-white/15'
              }
            `}
          >
            <span className="text-sm">{t.icon}</span>
            <span className="text-[10px] font-semibold text-gray-300 hover:text-white transition-colors whitespace-nowrap">{t.name}</span>
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* MT5 Button */}
        <button
          data-testid="mt5-btn"
          onClick={() => setShowConnectModal(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all h-9 ${
            mt5Status === 'connected'
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 hover:border-emerald-500/40'
              : mt5Status === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/20 cursor-wait'
              : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5 hover:border-white/15'
          }`}
          title={mt5Status === 'connected' ? `Connected: #${account?.login}` : 'Connect your MT5 account'}
        >
          {mt5Status === 'connected' ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          ) : mt5Status === 'connecting' ? (
            <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          ) : (
            <span className="text-sm">📡</span>
          )}
          <span className={`text-[10px] font-semibold whitespace-nowrap ${
            mt5Status === 'connected' ? 'text-emerald-400' :
            mt5Status === 'connecting' ? 'text-amber-400' : 'text-gray-300'
          }`}>
            {mt5Status === 'connected' ? 'MT5 Live' : mt5Status === 'connecting' ? 'Connecting...' : 'MT5'}
          </span>
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={clear}
          className="px-3 py-2 rounded-md bg-white/[0.03] hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all text-[10px] text-gray-500 hover:text-red-400 h-9"
        >
          Clear
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white transition hover:opacity-80"
          >
            {initials}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-slate-700 bg-[#0d0d14] py-1 shadow-xl">
              <div className="border-b border-slate-700 px-3 py-2">
                <p className="text-xs font-medium text-white truncate">
                  {profile?.display_name ?? 'Trader'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                👤 Profile
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
      <StrategyListModal isOpen={strategiesOpen} onClose={() => setStrategiesOpen(false)} />
    </div>
  );
}
