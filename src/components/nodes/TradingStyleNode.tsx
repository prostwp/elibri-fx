import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

const STYLES = {
  scalping: {
    label: 'Scalping',
    icon: '⚡',
    horizon: '1-30 min',
    stopLoss: '0.1-0.3%',
    takeProfit: '0.2-0.5%',
    riskReward: '1:1.5',
    focus: 'Volume, order book, tick data',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
  },
  daytrading: {
    label: 'Day trading',
    icon: '📊',
    horizon: '1h–1 day',
    stopLoss: '0.5-1.5%',
    takeProfit: '1-3%',
    riskReward: '1:2',
    focus: 'Technical analysis, news, levels',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  swing: {
    label: 'Swing',
    icon: '🌊',
    horizon: '2-14 days',
    stopLoss: '2-5%',
    takeProfit: '5-15%',
    riskReward: '1:3',
    focus: 'Trends, patterns, multipliers',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  position: {
    label: 'Position',
    icon: '🏔️',
    horizon: '1-6 months',
    stopLoss: '5-10%',
    takeProfit: '15-50%',
    riskReward: '1:3-5',
    focus: 'Fundamentals, macro, dividends',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  longterm: {
    label: 'Long-term',
    icon: '🏦',
    horizon: '6+ months',
    stopLoss: '10-20%',
    takeProfit: '30-100%+',
    riskReward: '1:5+',
    focus: 'DCF, FCF, dividends, business growth',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
} as const;

type StyleKey = keyof typeof STYLES;

export function TradingStyleNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const style = (data.tradingStyle as StyleKey) ?? 'swing';

  const s = STYLES[style];

  return (
    <BaseNode
      icon="🎯" label="Trading Style" category="agent"
      glowClass="node-glow-ai"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-2 min-w-[210px]">
        <select
          value={style}
          onChange={(e) => updateNodeData(id, { tradingStyle: e.target.value })}
          className="nodrag nopan w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-[10px] outline-none"
        >
          {(Object.keys(STYLES) as StyleKey[]).map(key => (
            <option key={key} value={key} className="bg-gray-900">
              {STYLES[key].icon} {STYLES[key].label} ({STYLES[key].horizon})
            </option>
          ))}
        </select>

        {/* Selected style details */}
        <div className={`rounded-lg border px-3 py-2 ${s.bg}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-base">{s.icon}</span>
            <span className={`text-[11px] font-bold ${s.color}`}>{s.label}</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[9px] text-gray-500">Horizon</span>
              <span className="text-[9px] text-white font-semibold">{s.horizon}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-gray-500">Stop Loss</span>
              <span className="text-[9px] text-red-400 font-semibold">{s.stopLoss}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-gray-500">Take Profit</span>
              <span className="text-[9px] text-emerald-400 font-semibold">{s.takeProfit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-gray-500">Risk:Reward</span>
              <span className="text-[9px] text-white font-semibold">{s.riskReward}</span>
            </div>
          </div>
        </div>

        <div className="text-[8px] text-gray-500 leading-relaxed px-1">
          <span className="text-gray-400 font-semibold">Focus:</span> {s.focus}
        </div>
      </div>
    </BaseNode>
  );
}

// Export style config for use in graph engine
export const TRADING_STYLES = STYLES;
