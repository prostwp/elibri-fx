/**
 * Trading Analyst — aggregates signals from all upstream analysis nodes.
 *
 * This card intentionally shows only WHAT THE NODE DOES, not its output.
 * Concrete signal value + its blend into the final verdict is displayed
 * on Dashboard / PreviewPanel where the user sees trade setup.
 */
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

export function TradingAnalystNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 0.5;

  return (
    <BaseNode
      id={id}
      icon="🤖"
      label="Trading Analyst"
      category="agent"
      glowClass="node-glow-ai"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5 w-[220px]">
        {/* Active indicator */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
          </span>
          <span className="text-purple-300 text-[10px]">AI Agent Active</span>
        </div>

        {/* Role description */}
        <div className="text-[10px] text-gray-400 leading-snug">
          Aggregates signals from all analysis nodes · ×1.2 boost when all agree.
        </div>

        {/* What it consumes */}
        <div className="text-[9px] text-gray-500">
          <span className="text-gray-400">Inputs:</span> Technical · Fundamental · TradingStyle
        </div>

        {/* What it produces (conceptual, no numbers) */}
        <div className="text-[9px] text-gray-500">
          <span className="text-gray-400">Output:</span> weighted consensus →{' '}
          <span className="text-purple-300">Dashboard</span>
        </div>
      </div>
    </BaseNode>
  );
}
