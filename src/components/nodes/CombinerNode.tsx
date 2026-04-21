import { Handle, Position } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

export function CombinerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const logic = (data.logic as string) || 'AND';

  return (
    <div className="relative">
      <BaseNode icon="🔗" label="Combiner" category="logic" inputs={0} weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
        <div className="flex gap-1">
          {['AND', 'OR'].map(l => (
            <button
              key={l}
              onClick={() => updateNodeData(id, { logic: l })}
              className={`flex-1 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                logic === l
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </BaseNode>
      <Handle
        type="target"
        position={Position.Left}
        id="input1"
        style={{ top: '35%', background: '#f59e0b', borderColor: '#0a0a0f', width: 10, height: 10, borderWidth: 2, borderRadius: 999 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input2"
        style={{ top: '65%', background: '#f59e0b', borderColor: '#0a0a0f', width: 10, height: 10, borderWidth: 2, borderRadius: 999 }}
      />
    </div>
  );
}
