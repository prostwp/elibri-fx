import { useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { DEMO_PAIRS } from '../../lib/demoData';
import { evaluateGraph } from '../../lib/graphEngine';
import type { NodeProps } from '@xyflow/react';

export function TradingAnalystNode({ id, data }: NodeProps) {
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

  return (
    <BaseNode icon="🤖" label="Trading Analyst" category="agent" glowClass="node-glow-ai" weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
          </span>
          <span className="text-purple-300 text-[10px]">AI Agent Active</span>
        </div>

        {/* Live signal output */}
        {mySignal && (
          <div className={`flex items-center justify-between px-2 py-1 rounded border ${
            mySignal.signal > 0.1 ? 'bg-emerald-500/10 border-emerald-500/20' :
            mySignal.signal < -0.1 ? 'bg-red-500/10 border-red-500/20' :
            'bg-white/5 border-white/10'
          }`}>
            <span className="text-[9px] text-gray-400">Output</span>
            <span className={`text-[10px] font-bold ${
              mySignal.signal > 0.1 ? 'text-emerald-400' :
              mySignal.signal < -0.1 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {mySignal.signal > 0.1 ? '▲ BUY' : mySignal.signal < -0.1 ? '▼ SELL' : '● NEUTRAL'}
              {' '}{Math.round(Math.abs(mySignal.signal) * 100)}%
            </span>
          </div>
        )}

        <div className="text-[10px] text-gray-500 leading-tight">
          Aggregates all inputs with agreement boost. Strong confluence amplifies signal.
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">Technical</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">Patterns</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded">Sentiment</span>
        </div>
      </div>
    </BaseNode>
  );
}
