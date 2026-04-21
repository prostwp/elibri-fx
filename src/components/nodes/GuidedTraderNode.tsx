import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

export function GuidedTraderNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const level = (data.level as string) || 'beginner';

  return (
    <BaseNode icon="🎓" label="Guided AI" category="agent" glowClass="node-glow-ai" weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-300 text-[10px]">Beginner-Friendly AI</span>
        </div>

        <select
          value={level}
          onChange={(e) => updateNodeData(id, { level: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white text-[10px] outline-none focus:border-emerald-500/50 cursor-pointer"
        >
          <option value="beginner" className="bg-gray-900">Beginner</option>
          <option value="intermediate" className="bg-gray-900">Intermediate</option>
        </select>

        <div className="text-[10px] text-gray-500 leading-tight">
          Explains <span className="text-emerald-400">WHY</span> each trade is recommended. Perfect for learning.
        </div>

        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">Why Trade</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">Safe Check</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">Lesson Tips</span>
        </div>
      </div>
    </BaseNode>
  );
}
