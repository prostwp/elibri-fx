import { BaseNode } from './BaseNode';
import type { NodeProps } from '@xyflow/react';

export function CustomNode({ data }: NodeProps) {
  const name = (data.name as string) || 'Custom Node';
  const icon = (data.icon as string) || '⚡';
  const category = (data.category as string) || 'logic';
  const rules = (data.rules as { id: string; label: string; type: string }[]) || [];
  const description = (data.description as string) || '';

  return (
    <BaseNode icon={icon} label={name} category={category}>
      <div className="space-y-1.5">
        {description && (
          <p className="text-[9px] text-gray-500">{description}</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded uppercase font-bold">{rule.type}</span>
            <span className="text-[10px] text-gray-400">{rule.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 pt-0.5">
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">CUSTOM</span>
        </div>
      </div>
    </BaseNode>
  );
}
