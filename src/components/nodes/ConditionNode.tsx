import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

export function ConditionNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 0.5;
  const indicator = (data.indicator as string) || 'RSI';
  const operator = (data.operator as string) || '>';
  const value = (data.value as number) ?? 70;

  return (
    <BaseNode icon="⚡" label="Condition" category="logic" weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="flex items-center gap-1.5">
        <select
          value={indicator}
          onChange={(e) => updateNodeData(id, { indicator: e.target.value })}
          className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-white text-[10px] outline-none flex-1"
        >
          {['RSI', 'MACD', 'Price', 'Volume'].map(i => (
            <option key={i} value={i} className="bg-gray-900">{i}</option>
          ))}
        </select>
        <select
          value={operator}
          onChange={(e) => updateNodeData(id, { operator: e.target.value })}
          className="bg-white/5 border border-white/10 rounded px-1 py-1 text-white text-[10px] outline-none w-10"
        >
          {['>', '<', '>=', '<=', '='].map(o => (
            <option key={o} value={o} className="bg-gray-900">{o}</option>
          ))}
        </select>
        <input
          type="number"
          value={value}
          onChange={(e) => updateNodeData(id, { value: Number(e.target.value) })}
          className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-white text-[10px] outline-none w-14"
        />
      </div>
    </BaseNode>
  );
}
