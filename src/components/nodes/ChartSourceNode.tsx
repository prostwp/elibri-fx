import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

export function ChartSourceNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 0.5;
  const tf = (data.timeframe as string) || 'H1';

  return (
    <BaseNode icon="📊" label="Chart Source" category="source" weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Timeframe</div>
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => updateNodeData(id, { timeframe: t })}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                tf === t
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </BaseNode>
  );
}
