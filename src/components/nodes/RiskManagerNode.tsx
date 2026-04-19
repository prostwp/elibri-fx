/**
 * Risk Manager — converts raw signal into position sizing + SL/TP.
 *
 * This node reads equity + max_risk_pct + ATR from upstream, and emits a
 * full trade setup (size, entry, SL, TP, dollar risk, R:R). All numbers
 * render on Dashboard / PreviewPanel; the node card shows only role.
 *
 * Exposed controls:
 *   equity         — account equity (default $10,000)
 *   maxRiskPct     — % of equity at risk per trade (default 1%)
 *   slAtrMult      — SL distance in ATR (default 1.5)
 *   tpAtrMult      — TP distance in ATR (default 2.5)
 */
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

export function RiskManagerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 0.5;
  const equity = (data.equity as number) ?? 10000;
  const maxRiskPct = (data.maxRiskPct as number) ?? 1.0;
  const slMult = (data.slAtrMult as number) ?? 1.5;
  const tpMult = (data.tpAtrMult as number) ?? 2.5;

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

        {/* Role description */}
        <div className="text-[10px] text-gray-400 leading-snug">
          Считает реальный размер позиции, SL и TP через ATR. Душит сигналы при конфликте upstream.
        </div>

        {/* Configurable params */}
        <div className="border-t border-white/5 pt-1.5 space-y-1">
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
            <span className="text-gray-400">Max risk / trade (%)</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={maxRiskPct}
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
                value={slMult}
                onChange={e => updateParam('slAtrMult', Number(e.target.value))}
                className="w-10 px-1 py-0.5 bg-white/5 text-white text-[9px] rounded border border-white/10"
                title="Stop loss in ATR multiples"
              />
              <input
                type="number"
                step="0.1"
                value={tpMult}
                onChange={e => updateParam('tpAtrMult', Number(e.target.value))}
                className="w-10 px-1 py-0.5 bg-white/5 text-white text-[9px] rounded border border-white/10"
                title="Take profit in ATR multiples"
              />
            </div>
          </label>
        </div>

        <div className="text-[9px] text-gray-500 border-t border-white/5 pt-1">
          <span className="text-gray-400">Output →</span> Dashboard (position, SL, TP, $risk, R:R)
        </div>
      </div>
    </BaseNode>
  );
}
