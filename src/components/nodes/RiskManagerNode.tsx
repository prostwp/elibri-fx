/**
 * Risk Manager — converts raw signal into position sizing + SL/TP.
 *
 * Behavior change: AI proposes defaults based on upstream TradingStyle
 * (scalp/day/swing/position) + pair volatility context. User starts with
 * suggested values and can toggle "Customize" to override.
 *
 * Suggested defaults per style:
 *   scalp:    risk 0.5%, SL 1.0×ATR, TP 1.5×ATR  (tight, frequent)
 *   day:      risk 0.75%, SL 1.2×ATR, TP 2.0×ATR
 *   swing:    risk 1.0%, SL 1.5×ATR, TP 2.5×ATR  (balanced)
 *   position: risk 1.5%, SL 2.0×ATR, TP 4.0×ATR  (wide stops)
 */
import { useEffect, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { TIER_CONFIG, type RiskTierKey } from '../../lib/graphEngine';
import type { NodeProps } from '@xyflow/react';
import type { RiskTier } from '../../types/nodes';

type TradingStyleKey = 'scalp' | 'day' | 'swing' | 'position';

interface SuggestedRisk {
  riskPct: number;
  slMult: number;
  tpMult: number;
  label: string;
}

const STYLE_DEFAULTS: Record<TradingStyleKey, SuggestedRisk> = {
  scalp:    { riskPct: 0.5,  slMult: 1.0, tpMult: 1.5, label: 'Scalping' },
  day:      { riskPct: 0.75, slMult: 1.2, tpMult: 2.0, label: 'Day trading' },
  swing:    { riskPct: 1.0,  slMult: 1.5, tpMult: 2.5, label: 'Swing' },
  position: { riskPct: 1.5,  slMult: 2.0, tpMult: 4.0, label: 'Position' },
};

// Patch 2E: descriptions no longer reference "min conf" — HC threshold
// (per-TF from the model) is the single confidence filter. Tier knobs
// only govern vol, allowed labels, rate limit, and sizing.
const TIER_META: Record<RiskTier, { label: string; description: string }> = {
  conservative: { label: 'Conservative', description: '0.25% risk/trade, strict vol-filter, trend-aligned only, up to 3 trades/day' },
  balanced:     { label: 'Balanced',     description: '0.5% risk/trade, standard vol-filter, trend + mean-reversion, up to 7 trades/day' },
  aggressive:   { label: 'Aggressive',   description: '1.0% risk/trade, soft vol-filter, any signal (except random), up to 20 trades/day' },
};

function tierCfg(tier: RiskTier) {
  const cfg = TIER_CONFIG[tier as RiskTierKey];
  const meta = TIER_META[tier];
  return { ...cfg, ...meta };
}

function resolveStyle(nodes: any[]): TradingStyleKey {
  const ts = nodes.find(n => n.type === 'tradingStyle');
  const v = ts?.data?.tradingStyle;
  if (v === 'scalp' || v === 'day' || v === 'swing' || v === 'position') return v;
  return 'swing';
}

export function RiskManagerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const edges = useFlowStore(s => s.edges);
  const weight = (data.weight as number) ?? 1.0;

  const style = resolveStyle(nodes);
  const suggested = STYLE_DEFAULTS[style];

  // Risk tier (Conservative / Balanced / Aggressive). Default: balanced.
  const riskTier = ((data.riskTier as RiskTier) ?? 'balanced') as RiskTier;
  const tier = tierCfg(riskTier);

  // ── Detect upstream backend block (CryptoML vol_gate / consensus.blocked) ──
  // Walk incoming edges, find any source node carrying a hard-block flag.
  const incomingSourceIds = edges
    .filter(e => e.target === id)
    .map(e => e.source);
  const blockedUpstream = nodes.find(n => {
    if (!incomingSourceIds.includes(n.id)) return false;
    const nd = n.data as Record<string, unknown> | undefined;
    if (!nd) return false;
    const consensus = nd.consensus as { blocked?: boolean } | undefined;
    const volGate = nd.vol_gate as string | undefined;
    return consensus?.blocked === true || volGate === 'blocked_low_vol';
  });
  const blockReason = (() => {
    if (!blockedUpstream) return null;
    const nd = blockedUpstream.data as Record<string, unknown>;
    const consensus = nd.consensus as { blocked?: boolean; label_reason?: string } | undefined;
    const volGate = nd.vol_gate as string | undefined;
    if (volGate === 'blocked_low_vol') return 'low volatility (blocked_low_vol)';
    if (consensus?.blocked) return consensus.label_reason ?? 'consensus blocked';
    return 'upstream block';
  })();

  // Position size suggestion. Requires atr + accountBalance in node data
  // (wired via Technical node / graph engine). Falls back to stored equity.
  const atr = (data.atr as number | undefined) ?? undefined;
  const accountBalance =
    (data.accountBalance as number | undefined) ??
    (data.equity as number | undefined);

  let positionLine = '—';
  if (atr && atr > 0 && accountBalance && accountBalance > 0) {
    // Tier-aware sizing: risk$ / (ATR × SL_mult).
    const riskPct = tier.riskPerTradePct;       // fraction (0.005 = 0.5%)
    const slMult = tier.slAtrMult;               // e.g. 1.5
    const riskUsd = accountBalance * riskPct;
    const slDistance = atr * slMult;
    const volumeUsd = slDistance > 0 ? riskUsd / slDistance : 0;
    positionLine = `Volume: $${volumeUsd.toFixed(2)} | SL: ${slMult}×ATR (${(riskPct * 100).toFixed(2)}% risk)`;
  }

  // Stored values (undefined = use AI suggestion).
  const equity = (data.equity as number) ?? 10000;
  const customized = (data.customized as boolean) ?? false;
  const effectiveRiskPct = customized
    ? ((data.maxRiskPct as number) ?? suggested.riskPct)
    : suggested.riskPct;
  const effectiveSlMult = customized
    ? ((data.slAtrMult as number) ?? suggested.slMult)
    : suggested.slMult;
  const effectiveTpMult = customized
    ? ((data.tpAtrMult as number) ?? suggested.tpMult)
    : suggested.tpMult;

  // Unused state kept for future collapse/expand UI.
  const [_showDetails, setShowDetails] = useState(false);
  void _showDetails;

  // Sync effective values into node data via useEffect (not useMemo —
  // side effects in memo break in React 19 StrictMode double-invoke).
  // graphEngine.buildTradeSetup reads these from node.data directly.
  useEffect(() => {
    updateNodeData(id, {
      maxRiskPct: effectiveRiskPct,
      slAtrMult: effectiveSlMult,
      tpAtrMult: effectiveTpMult,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRiskPct, effectiveSlMult, effectiveTpMult]);

  const enableCustomize = () => {
    updateNodeData(id, {
      customized: true,
      maxRiskPct: suggested.riskPct,
      slAtrMult: suggested.slMult,
      tpAtrMult: suggested.tpMult,
    });
    setShowDetails(true);
  };

  const resetToAI = () => {
    updateNodeData(id, { customized: false });
    setShowDetails(false);
  };

  const updateParam = (key: string, value: number) => {
    updateNodeData(id, { [key]: value });
  };

  return (
    <BaseNode
      id={id}
      icon="🛡️"
      label="Risk Manager"
      category="agent"
      glowClass="node-glow-ai"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5 w-[240px]">
        {/* Active indicator */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
          </span>
          <span className="text-purple-300 text-[10px]">Position Sizer Active</span>
        </div>

        {/* Risk Tier selector */}
        <div className="space-y-1 border-t border-white/5 pt-1.5">
          <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">
            Risk Tier
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['conservative', 'balanced', 'aggressive'] as RiskTier[]).map((t) => {
              const active = riskTier === t;
              const activeClass =
                t === 'conservative'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                  : t === 'balanced'
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                  : 'bg-red-500/20 text-red-200 border-red-400/40';
              return (
                <button
                  key={t}
                  onClick={() => updateNodeData(id, { riskTier: t })}
                  className={`text-[9px] py-0.5 rounded border transition ${
                    active
                      ? activeClass
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                  title={TIER_META[t].description}
                >
                  {TIER_META[t].label}
                </button>
              );
            })}
          </div>
          <div className="text-[9px] text-gray-500 leading-snug">
            {tier.description}
          </div>
        </div>

        {/* Position size suggestion OR upstream block notice */}
        {blockedUpstream ? (
          <div className="border-t border-white/5 pt-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                No Position
              </span>
              <span className="text-[9px] text-gray-400">waiting for setup</span>
            </div>
            <div className="text-[9px] text-gray-400 leading-snug">
              {blockReason}
            </div>
          </div>
        ) : (
          <div className="border-t border-white/5 pt-1.5">
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">
              Position Size Suggestion
            </div>
            <div className="text-[9px] font-mono text-purple-200 mt-0.5">
              {positionLine}
            </div>
          </div>
        )}

        {/* Role */}
        <div className="text-[10px] text-gray-400 leading-snug border-t border-white/5 pt-1.5">
          Tier-sized risk (risk$ / ATR × SL_mult). Respects backend vol gate + MTF consensus.
        </div>

        {/* AI Suggested panel (when not customized) */}
        {!customized && (
          <div className="border-t border-white/5 pt-1.5 space-y-1 bg-indigo-500/5 -mx-1 px-2 py-1.5 rounded">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-indigo-300 font-semibold uppercase">
                ✨ AI suggested
              </span>
              <span className="text-[8px] text-gray-500">
                {suggested.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[9px]">
              <div className="bg-white/3 rounded px-1 py-0.5 text-center">
                <div className="text-gray-500 text-[8px]">Risk</div>
                <div className="font-mono text-indigo-300">{suggested.riskPct}%</div>
              </div>
              <div className="bg-white/3 rounded px-1 py-0.5 text-center">
                <div className="text-gray-500 text-[8px]">SL</div>
                <div className="font-mono text-red-300">{suggested.slMult}×ATR</div>
              </div>
              <div className="bg-white/3 rounded px-1 py-0.5 text-center">
                <div className="text-gray-500 text-[8px]">TP</div>
                <div className="font-mono text-emerald-300">{suggested.tpMult}×ATR</div>
              </div>
            </div>
            <button
              onClick={enableCustomize}
              className="w-full text-[9px] text-purple-300 hover:text-purple-200 text-center py-0.5 rounded hover:bg-white/5 transition"
            >
              Customize →
            </button>
          </div>
        )}

        {/* Customized inputs */}
        {customized && (
          <div className="border-t border-white/5 pt-1.5 space-y-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-amber-300 font-semibold">Custom</span>
              <button
                onClick={resetToAI}
                className="text-[8px] text-gray-500 hover:text-indigo-300 underline"
              >
                reset to AI
              </button>
            </div>
            <label className="flex items-center justify-between text-[9px]">
              <span className="text-gray-400">Equity ($)</span>
              <input
                type="number"
                value={equity}
                onChange={e => updateParam('equity', Number(e.target.value))}
                className="w-20 px-1 py-0.5 bg-white/5 text-white text-[9px] rounded border border-white/10 focus:border-purple-500/40 outline-none"
              />
            </label>
            <label className="flex items-center justify-between text-[9px]">
              <span className="text-gray-400">Risk / trade (%)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={effectiveRiskPct}
                onChange={e => updateParam('maxRiskPct', Number(e.target.value))}
                className="w-16 px-1 py-0.5 bg-white/5 text-white text-[9px] rounded border border-white/10 focus:border-purple-500/40 outline-none"
              />
            </label>
            <label className="flex items-center justify-between text-[9px]">
              <span className="text-gray-400">SL / TP (× ATR)</span>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={effectiveSlMult}
                  onChange={e => updateParam('slAtrMult', Number(e.target.value))}
                  className="w-10 px-1 py-0.5 bg-white/5 text-white text-[9px] rounded border border-white/10"
                  title="Stop loss in ATR multiples"
                />
                <input
                  type="number"
                  step="0.1"
                  value={effectiveTpMult}
                  onChange={e => updateParam('tpAtrMult', Number(e.target.value))}
                  className="w-10 px-1 py-0.5 bg-white/5 text-white text-[9px] rounded border border-white/10"
                  title="Take profit in ATR multiples"
                />
              </div>
            </label>
          </div>
        )}

        {/* AI-mode: equity line as small input */}
        {!customized && (
          <label className="flex items-center justify-between text-[9px]">
            <span className="text-gray-400">Account equity ($)</span>
            <input
              type="number"
              value={equity}
              onChange={e => updateParam('equity', Number(e.target.value))}
              className="w-20 px-1 py-0.5 bg-white/5 text-white text-[9px] rounded border border-white/10 focus:border-purple-500/40 outline-none"
            />
          </label>
        )}

        <div className="text-[9px] text-gray-500 border-t border-white/5 pt-1">
          <span className="text-gray-400">Output →</span> Dashboard (size, SL, TP, $risk, R:R)
        </div>

      </div>
    </BaseNode>
  );
}
