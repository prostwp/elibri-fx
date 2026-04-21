import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

const INDICATORS = ['RSI', 'MACD', 'Bollinger Bands', 'EMA', 'SMA'];

export function TechnicalIndicatorNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const selected = (data.indicators as string[]) || ['RSI', 'MACD', 'Bollinger Bands'];
  const weight = (data.weight as number) ?? 1.0;
  const params = (data.params as Record<string, number>) ?? {};

  const toggle = (ind: string) => {
    const next = selected.includes(ind)
      ? selected.filter(i => i !== ind)
      : [...selected, ind];
    updateNodeData(id, { indicators: next });
  };

  const setParam = (key: string, val: number) => {
    updateNodeData(id, { params: { ...params, [key]: val } });
  };

  return (
    <BaseNode
      id={id}
      icon="📈"
      label="Technical Indicators"
      category="analysis"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5">
        {INDICATORS.map(ind => (
          <div key={ind}>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white/70 transition-colors">
              <input
                type="checkbox"
                checked={selected.includes(ind)}
                onChange={() => toggle(ind)}
                className="rounded border-gray-600 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 w-3 h-3"
              />
              <span>{ind}</span>
            </label>
            {/* Inline params for selected indicators */}
            {selected.includes(ind) && ind === 'RSI' && (
              <div className="ml-5 mt-0.5 flex items-center gap-1">
                <span className="text-[9px] text-gray-500">Period:</span>
                <input
                  type="number"
                  value={params.rsiPeriod ?? 14}
                  onChange={(e) => setParam('rsiPeriod', Number(e.target.value))}
                  className="w-10 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none"
                  min={2} max={50}
                />
              </div>
            )}
            {selected.includes(ind) && ind === 'Bollinger Bands' && (
              <div className="ml-5 mt-0.5 flex items-center gap-1">
                <span className="text-[9px] text-gray-500">Period:</span>
                <input
                  type="number"
                  value={params.bbPeriod ?? 20}
                  onChange={(e) => setParam('bbPeriod', Number(e.target.value))}
                  className="w-10 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none"
                  min={5} max={50}
                />
              </div>
            )}
            {selected.includes(ind) && ind === 'EMA' && (
              <div className="ml-5 mt-0.5 flex items-center gap-1">
                <span className="text-[9px] text-gray-500">Fast:</span>
                <input
                  type="number"
                  value={params.emaFast ?? 20}
                  onChange={(e) => setParam('emaFast', Number(e.target.value))}
                  className="w-10 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none"
                  min={2} max={100}
                />
                <span className="text-[9px] text-gray-500">Slow:</span>
                <input
                  type="number"
                  value={params.emaSlow ?? 50}
                  onChange={(e) => setParam('emaSlow', Number(e.target.value))}
                  className="w-10 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none"
                  min={2} max={200}
                />
              </div>
            )}
            {selected.includes(ind) && ind === 'SMA' && (
              <div className="ml-5 mt-0.5 flex items-center gap-1">
                <span className="text-[9px] text-gray-500">Period:</span>
                <input
                  type="number"
                  value={params.smaPeriod ?? 50}
                  onChange={(e) => setParam('smaPeriod', Number(e.target.value))}
                  className="w-10 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none"
                  min={2} max={200}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </BaseNode>
  );
}
