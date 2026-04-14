import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { nodeTypes } from '../nodes';
import { NODE_DEFINITIONS } from '../../lib/nodeDefinitions';
import { DEMO_PAIRS, DEMO_CRYPTO, CRYPTO_PAIRS } from '../../lib/demoData';
import { evaluateGraph } from '../../lib/graphEngine';

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectedPair } = useFlowStore();
  const liveCandles = useMT5Store((s) => s.candles);
  const mt5Status = useMT5Store((s) => s.status);
  const cryptoCandles = useCryptoStore((s) => s.candles);
  const cryptoStatus = useCryptoStore((s) => s.status);

  // Evaluate graph to color edges — resolve candles (crypto vs forex)
  const isCryptoPair = (CRYPTO_PAIRS as readonly string[]).includes(selectedPair);
  const candles = useMemo(() => {
    if (isCryptoPair) {
      const live = cryptoCandles[selectedPair];
      if ((cryptoStatus === 'connected' || cryptoStatus === 'public') && live?.length > 0) return live;
      return DEMO_CRYPTO[selectedPair]?.candles ?? DEMO_PAIRS.EURUSD.candles;
    }
    const mt5 = liveCandles[selectedPair];
    if (mt5Status === 'connected' && mt5?.length > 0) return mt5;
    return DEMO_PAIRS[selectedPair]?.candles ?? DEMO_PAIRS.EURUSD.candles;
  }, [isCryptoPair, selectedPair, cryptoCandles, cryptoStatus, liveCandles, mt5Status]);

  const graphResult = useMemo(
    () => evaluateGraph(nodes, edges, candles),
    [nodes, edges, candles]
  );

  const signalMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of graphResult.signals) {
      map.set(s.nodeId, s.signal);
    }
    return map;
  }, [graphResult]);

  // Color edges based on source node signal
  const coloredEdges = useMemo(() => {
    return edges.map(e => {
      const sig = signalMap.get(e.source) ?? 0;
      let stroke = '#6366f1'; // default indigo
      if (sig > 0.1) stroke = '#10b981'; // green for buy
      else if (sig < -0.1) stroke = '#ef4444'; // red for sell
      return { ...e, style: { ...e.style, stroke, strokeWidth: 2 } };
    });
  }, [edges, signalMap]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/reactflow');
      if (!data) return;

      const def = JSON.parse(data);
      const reactFlowBounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: e.clientX - reactFlowBounds.left - 100,
        y: e.clientY - reactFlowBounds.top - 30,
      };

      addNode({
        id: `${def.type}-${Date.now()}`,
        type: def.type,
        position,
        data: { ...def.defaultData },
      });
    },
    [addNode]
  );

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={coloredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0a0f]"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a2e" />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const def = NODE_DEFINITIONS.find(d => d.type === n.type);
            if (!def) return '#6366f1';
            const colors: Record<string, string> = {
              source: '#3b82f6',
              analysis: '#10b981',
              logic: '#f59e0b',
              agent: '#a855f7',
              output: '#ef4444',
            };
            return colors[def.category] ?? '#6366f1';
          }}
          style={{
            width: 160,
            height: 90,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(13,13,20,0.9)',
            backdropFilter: 'blur(8px)',
          }}
          className="!bottom-4 !right-[350px]"
          maskColor="rgba(10,10,15,0.7)"
        />
      </ReactFlow>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-4 opacity-20">🔗</div>
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Build Your Strategy</h3>
            <p className="text-sm text-gray-600 max-w-xs">
              Drag nodes from the sidebar or use a template to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
