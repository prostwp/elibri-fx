import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';

interface BaseNodeProps {
  id?: string;
  icon: string;
  label: string;
  category: string;
  premium?: boolean;
  locked?: boolean;
  glowClass?: string;
  inputs?: number;
  outputs?: number;
  weight?: number;
  onWeightChange?: (weight: number) => void;
  children?: ReactNode;
}

const categoryColors: Record<string, string> = {
  source: 'border-blue-500/30 bg-blue-500/5',
  analysis: 'border-emerald-500/30 bg-emerald-500/5',
  logic: 'border-amber-500/30 bg-amber-500/5',
  agent: 'border-purple-500/30 bg-purple-500/5',
  output: 'border-red-500/30 bg-red-500/5',
};

const categoryAccent: Record<string, string> = {
  source: '#3b82f6',
  analysis: '#10b981',
  logic: '#f59e0b',
  agent: '#a855f7',
  output: '#ef4444',
};

const weightColor = (w: number) => {
  if (w >= 0.7) return 'text-emerald-400';
  if (w >= 0.4) return 'text-amber-400';
  return 'text-red-400';
};

export function BaseNode({
  icon,
  label,
  category,
  premium = false,
  locked = false,
  glowClass = 'node-glow',
  inputs = 1,
  outputs = 1,
  weight,
  onWeightChange,
  children,
}: BaseNodeProps) {
  const color = categoryAccent[category] ?? '#6366f1';
  const showWeight = weight !== undefined && onWeightChange && !locked;

  return (
    <div
      className={`
        relative rounded-xl border backdrop-blur-sm
        ${categoryColors[category] ?? 'border-gray-700 bg-gray-900/50'}
        ${locked ? 'opacity-60' : ''}
        ${premium && !locked ? 'node-glow-premium' : glowClass}
        min-w-[200px] transition-all duration-200
      `}
      style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold text-white/90 flex-1">{label}</span>
        {premium && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-wider">
            Pro
          </span>
        )}
        {locked && (
          <span className="text-sm">🔒</span>
        )}
      </div>

      {/* Content */}
      {!locked && children && (
        <div className="px-3 py-2 text-[11px] text-gray-400">
          {children}
        </div>
      )}

      {locked && (
        <div className="px-3 py-3 text-center">
          <p className="text-[10px] text-gray-500">Upgrade to unlock</p>
          <button className="mt-1 text-[10px] px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
            Upgrade to Pro
          </button>
        </div>
      )}

      {/* Weight Slider */}
      {showWeight && (
        <div className="nodrag nopan px-3 py-1.5 border-t border-white/5" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold w-8">W</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(weight * 100)}
              onChange={(e) => onWeightChange(Number(e.target.value) / 100)}
              className="nodrag nopan flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${color} ${weight * 100}%, rgba(255,255,255,0.1) ${weight * 100}%)`,
              }}
            />
            <span className={`text-[10px] font-bold w-8 text-right ${weightColor(weight)}`}>
              {Math.round(weight * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Handles */}
      {inputs > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !border-2 !rounded-full"
          style={{ background: color, borderColor: '#0a0a0f' }}
        />
      )}
      {outputs > 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !border-2 !rounded-full"
          style={{ background: color, borderColor: '#0a0a0f' }}
        />
      )}
    </div>
  );
}
