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
import { useMemo, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

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

function resolveStyle(nodes: any[]): TradingStyleKey {
  const ts = nodes.find(n => n.type === 'tradingStyle');
  const v = ts?.data?.tradingStyle;
  if (v === 'scalp' || v === 'day' || v === 'swing' || v === 'position') return v;
  return 'swing';
}

export function RiskManagerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;

  const style = resolveStyle(nodes);
  const suggested = STYLE_DEFAULTS[style];

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

  const [showDetails, setShowDetails] = useState(false);

  // Sync effective values into node data whenever style/suggestion changes
  // — so graphEngine always reads the actual computed defaults.
  useMemo(() => {
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

        {/* Role */}
        <div className="text-[10px] text-gray-400 leading-snug">
          Computes position size, SL and TP via ATR. Dampens signals on upstream conflict.
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

        {showDetails && <div className="hidden" />}
      </div>
    </BaseNode>
  );
}
