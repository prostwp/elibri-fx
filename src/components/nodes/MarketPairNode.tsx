import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { FOREX_PAIRS } from '../../lib/demoData';
import type { NodeProps } from '@xyflow/react';

export function MarketPairNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const setSelectedPair = useFlowStore(s => s.setSelectedPair);
  const weight = (data.weight as number) ?? 0.5;
  const pair = (data.pair as string) || 'EURUSD';

  return (
    <BaseNode icon="💱" label="Market Pair" category="source" inputs={0} weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <select
        value={pair}
        onChange={(e) => {
          updateNodeData(id, { pair: e.target.value });
          setSelectedPair(e.target.value);
        }}
        className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-white text-[11px] outline-none focus:border-blue-500/50 cursor-pointer"
      >
        {FOREX_PAIRS.map(p => <option key={p} value={p} className="bg-gray-900">{p}</option>)}
      </select>
      <div className="mt-1 text-[9px] text-gray-600">MT5 Forex</div>
    </BaseNode>
  );
}
