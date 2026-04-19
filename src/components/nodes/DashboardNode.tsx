import { BaseNode } from './BaseNode';
import type { NodeProps } from '@xyflow/react';

export function DashboardNode(_: NodeProps) {
  return (
    <BaseNode icon="📋" label="Dashboard" category="output" outputs={0}>
      <div className="space-y-1.5">
        <div className="text-[10px] text-gray-500 leading-tight">
          Displays analysis results in the Preview Panel →
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">Gauge</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">Signals</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">Chart</span>
        </div>
      </div>
    </BaseNode>
  );
}
