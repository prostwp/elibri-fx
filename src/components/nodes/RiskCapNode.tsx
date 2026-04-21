import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

export function RiskCapNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const maxDailyLoss = (data.maxDailyLoss as number) || 500;
  const maxTrades = (data.maxTradesPerDay as number) || 10;
  const maxLotSize = (data.maxPositionSize as number) || 0.5;

  // Wired to tier.maxTradesPerDay in future scenario_runner; demo defaults for now
  const usedLoss = (data.usedLoss as number) ?? 0;
  const usedTrades = (data.usedTrades as number) ?? 0;
  const lossPercent = Math.round((usedLoss / maxDailyLoss) * 100);
  const isWarning = lossPercent > 80;

  return (
    <BaseNode
      icon="🔥"
      label="Risk Cap"
      category="agent"
      glowClass={isWarning ? 'node-glow-danger' : 'node-glow-ai'}
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isWarning ? 'bg-red-400' : 'bg-amber-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isWarning ? 'bg-red-500' : 'bg-amber-500'}`} />
          </span>
          <span className={`text-[10px] ${isWarning ? 'text-red-300' : 'text-amber-300'}`}>
            {isWarning ? 'RISK LIMIT WARNING' : 'Controlled Risk Mode'}
          </span>
        </div>

        {/* Daily Loss Budget */}
        <div>
          <div className="flex justify-between text-[9px] mb-1">
            <span className="text-gray-500">Daily Loss Budget</span>
            <span className={`font-semibold ${isWarning ? 'text-red-400' : 'text-amber-400'}`}>
              ${usedLoss} / ${maxDailyLoss}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                lossPercent > 80 ? 'bg-red-500' : lossPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${lossPercent}%` }}
            />
          </div>
        </div>

        {/* Trades Counter */}
        <div className="flex justify-between text-[9px]">
          <span className="text-gray-500">Trades Today</span>
          <span className="text-white font-semibold">{usedTrades} / {maxTrades}</span>
        </div>

        {/* Max Lot */}
        <div className="flex justify-between text-[9px]">
          <span className="text-gray-500">Max Lot Size</span>
          <span className="text-white font-semibold">{maxLotSize} lots</span>
        </div>

        {/* Settings */}
        <div className="pt-1 border-t border-white/5 space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-gray-500 w-16">Max Loss $</label>
            <input
              type="number"
              value={maxDailyLoss}
              onChange={(e) => updateNodeData(id, { maxDailyLoss: Number(e.target.value) })}
              className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] outline-none focus:border-amber-500/50 w-12"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-gray-500 w-16">Max Trades</label>
            <input
              type="number"
              value={maxTrades}
              onChange={(e) => updateNodeData(id, { maxTradesPerDay: Number(e.target.value) })}
              className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] outline-none focus:border-amber-500/50 w-12"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">Loss Limit</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">Trade Cap</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">Lot Limit</span>
        </div>
      </div>
    </BaseNode>
  );
}
