import { useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { DEMO_PAIRS } from '../../lib/demoData';
import { evaluateGraph } from '../../lib/graphEngine';
import type { NodeProps } from '@xyflow/react';

export function RiskManagerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const edges = useFlowStore(s => s.edges);
  const selectedPair = useFlowStore(s => s.selectedPair);
  const weight = (data.weight as number) ?? 0.5;

  const liveCandles = useMT5Store(s => s.candles);
  const mt5Status = useMT5Store(s => s.status);
  const demoPair = DEMO_PAIRS[selectedPair] ?? DEMO_PAIRS.EURUSD;
  const candles = (mt5Status === 'connected' && liveCandles[selectedPair]?.length > 0)
    ? liveCandles[selectedPair] : demoPair.candles;

  const result = useMemo(() => evaluateGraph(nodes, edges, candles), [nodes, edges, candles]);
  const mySignal = result.signals.find(s => s.nodeId === id);

  // Detect conflict in inputs
  const incoming = edges.filter(e => e.target === id).map(e => result.signals.find(s => s.nodeId === e.source)).filter(Boolean);
  const hasConflict = incoming.some(i => i!.signal > 0) && incoming.some(i => i!.signal < 0);

  return (
    <BaseNode icon="🛡️" label="Risk Manager" category="agent" glowClass="node-glow-ai" weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
          </span>
          <span className="text-purple-300 text-[10px]">Risk Filter Active</span>
        </div>

        {hasConflict && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px]">⚠️</span>
            <span className="text-[9px] text-amber-400">Conflicting signals detected — dampened</span>
          </div>
        )}

        {mySignal && (
          <div className={`flex items-center justify-between px-2 py-1 rounded border ${
            mySignal.signal > 0.1 ? 'bg-emerald-500/10 border-emerald-500/20' :
            mySignal.signal < -0.1 ? 'bg-red-500/10 border-red-500/20' :
            'bg-white/5 border-white/10'
          }`}>
            <span className="text-[9px] text-gray-400">Risk-Adjusted</span>
            <span className={`text-[10px] font-bold ${
              mySignal.signal > 0.1 ? 'text-emerald-400' :
              mySignal.signal < -0.1 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {Math.round(Math.abs(mySignal.signal) * 100)}% {mySignal.signal > 0.1 ? 'BUY' : mySignal.signal < -0.1 ? 'SELL' : 'HOLD'}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">Stop Loss</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">Take Profit</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">Position Size</span>
        </div>
      </div>
    </BaseNode>
  );
}
