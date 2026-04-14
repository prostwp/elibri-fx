import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { DEMO_SCAN_RESULTS } from '../../lib/demoData';
import type { NodeProps } from '@xyflow/react';

const SCAN_MODES = [
  { key: 'volume_spike', label: 'Volume Spikes', paramLabel: 'Min x:', paramKey: 'volumeMultiplier', defaultVal: 2.5 },
  { key: 'rsi_dip', label: 'RSI Dip', paramLabel: 'Oversold:', paramKey: 'rsiOversold', defaultVal: 30 },
  { key: 'price_dip', label: 'Price Dip', paramLabel: 'Min %:', paramKey: 'dipPercent', defaultVal: 5 },
] as const;

export function CryptoScannerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 0.5;
  const scanMode = (data.scanMode as string[]) || ['volume_spike', 'rsi_dip'];
  const thresholds = (data.thresholds as Record<string, number>) ?? {};

  const scanResults = useCryptoStore(s => s.scanResults);
  const results = scanResults.length > 0 ? scanResults : DEMO_SCAN_RESULTS;
  const topResults = results.slice(0, 3);

  const toggleMode = (mode: string) => {
    const next = scanMode.includes(mode)
      ? scanMode.filter(m => m !== mode)
      : [...scanMode, mode];
    updateNodeData(id, { scanMode: next });
  };

  const setThreshold = (key: string, val: number) => {
    updateNodeData(id, { thresholds: { ...thresholds, [key]: val } });
  };

  return (
    <BaseNode
      id={id}
      icon="🔍"
      label="Altcoin Scanner"
      category="analysis"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5">
        {SCAN_MODES.map(mode => (
          <div key={mode.key}>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white/70 transition-colors">
              <input
                type="checkbox"
                checked={scanMode.includes(mode.key)}
                onChange={() => toggleMode(mode.key)}
                className="rounded border-gray-600 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 w-3 h-3"
              />
              <span>{mode.label}</span>
            </label>
            {scanMode.includes(mode.key) && (
              <div className="ml-5 mt-0.5 flex items-center gap-1">
                <span className="text-[9px] text-gray-500">{mode.paramLabel}</span>
                <input
                  type="number"
                  value={thresholds[mode.paramKey] ?? mode.defaultVal}
                  onChange={(e) => setThreshold(mode.paramKey, Number(e.target.value))}
                  className="w-12 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none"
                  step={mode.key === 'volume_spike' ? 0.5 : 1}
                />
              </div>
            )}
          </div>
        ))}

        {/* Top scan results */}
        {topResults.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-white/5 space-y-1">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">Top Signals</span>
            {topResults.map(r => (
              <div key={r.symbol} className="flex items-center justify-between">
                <span className="text-[10px] text-white/80 font-medium">{r.symbol.replace('USDT', '')}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold ${
                    r.signal === 'buy' ? 'text-emerald-400' : r.signal === 'sell' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {r.signal.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-gray-500">{r.score}/100</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
