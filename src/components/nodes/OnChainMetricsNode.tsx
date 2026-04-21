import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';

const METRICS = [
  { key: 'whale_activity', label: 'Whale Activity' },
  { key: 'exchange_inflow', label: 'Exchange Inflow' },
  { key: 'exchange_outflow', label: 'Exchange Outflow' },
  { key: 'active_addresses', label: 'Active Addresses' },
];

// Seeded demo values (same pattern as sentiment node in graphEngine)
function getMetricValue(key: string): { value: number; signal: 'buy' | 'sell' | 'neutral'; desc: string } {
  const seed = Math.floor(Date.now() / 300000);

  switch (key) {
    case 'whale_activity': {
      const v = ((seed * 7 + 13) % 100);
      return {
        value: v,
        signal: v > 60 ? 'buy' : v < 30 ? 'sell' : 'neutral',
        desc: v > 60 ? 'Whales accumulating' : v < 30 ? 'Whales selling' : 'Normal activity',
      };
    }
    case 'exchange_inflow': {
      const v = ((seed * 11 + 5) % 100);
      // High inflow = coins entering exchange = potential sell pressure
      return {
        value: v,
        signal: v > 65 ? 'sell' : v < 30 ? 'buy' : 'neutral',
        desc: v > 65 ? 'High inflow — sell pressure' : v < 30 ? 'Low inflow — holding' : 'Normal',
      };
    }
    case 'exchange_outflow': {
      const v = ((seed * 19 + 3) % 100);
      // High outflow = coins leaving exchange = bullish (hodling)
      return {
        value: v,
        signal: v > 60 ? 'buy' : v < 25 ? 'sell' : 'neutral',
        desc: v > 60 ? 'Coins leaving exchanges' : v < 25 ? 'Low outflow' : 'Normal',
      };
    }
    case 'active_addresses': {
      const v = ((seed * 23 + 17) % 100);
      return {
        value: v,
        signal: v > 65 ? 'buy' : v < 30 ? 'sell' : 'neutral',
        desc: v > 65 ? 'Rising activity' : v < 30 ? 'Declining activity' : 'Steady',
      };
    }
    default:
      return { value: 50, signal: 'neutral', desc: 'Unknown' };
  }
}

export function OnChainMetricsNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const selectedMetrics = (data.metrics as string[]) || ['whale_activity', 'exchange_inflow'];

  const toggleMetric = (key: string) => {
    const next = selectedMetrics.includes(key)
      ? selectedMetrics.filter(m => m !== key)
      : [...selectedMetrics, key];
    updateNodeData(id, { metrics: next });
  };

  return (
    <BaseNode
      id={id}
      icon="⛓️"
      label="On-Chain Metrics"
      category="analysis"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5">
        {METRICS.map(m => {
          const isSelected = selectedMetrics.includes(m.key);
          const metric = isSelected ? getMetricValue(m.key) : null;

          return (
            <div key={m.key}>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white/70 transition-colors">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleMetric(m.key)}
                  className="rounded border-gray-600 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 w-3 h-3"
                />
                <span>{m.label}</span>
                {metric && (
                  <span className={`ml-auto text-[9px] font-bold ${
                    metric.signal === 'buy' ? 'text-emerald-400' :
                    metric.signal === 'sell' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {metric.signal.toUpperCase()}
                  </span>
                )}
              </label>
              {metric && (
                <div className="ml-5 mt-0.5">
                  <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        metric.signal === 'buy' ? 'bg-emerald-500' :
                        metric.signal === 'sell' ? 'bg-red-500' : 'bg-gray-500'
                      }`}
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-gray-600">{metric.desc}</span>
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-1 border-t border-white/5">
          <span className="text-[8px] text-gray-600 italic">Demo on-chain data</span>
        </div>
      </div>
    </BaseNode>
  );
}
