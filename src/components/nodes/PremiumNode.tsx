import { useEffect, useMemo, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useMT5Store } from '../../stores/useMT5Store';
import { DEMO_PAIRS } from '../../lib/demoData';
import { detectPatterns } from '../../lib/chartPatterns';
import type { NodeProps } from '@xyflow/react';

// ─── Chart Patterns ─────────────────────────────
export function ChartPatternNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const selectedPair = useFlowStore(s => s.selectedPair);
  const weight = (data.weight as number) ?? 1.0;

  const liveCandles = useMT5Store(s => s.candles);
  const mt5Status = useMT5Store(s => s.status);
  const demoPair = DEMO_PAIRS[selectedPair] ?? DEMO_PAIRS.EURUSD;
  const candles = (mt5Status === 'connected' && liveCandles[selectedPair]?.length > 0)
    ? liveCandles[selectedPair] : demoPair.candles;

  const patterns = useMemo(() => detectPatterns(candles), [candles]);

  return (
    <BaseNode
      icon="🔍" label="Chart Patterns" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1">
        {patterns.slice(0, 3).map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              p.type === 'bullish' ? 'bg-emerald-500' :
              p.type === 'bearish' ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="text-[10px] text-white/80 flex-1">{p.name}</span>
            {p.confidence > 0 && (
              <span className={`text-[9px] font-bold ${
                p.type === 'bullish' ? 'text-emerald-400' :
                p.type === 'bearish' ? 'text-red-400' : 'text-gray-500'
              }`}>
                {p.confidence}%
              </span>
            )}
          </div>
        ))}
      </div>
    </BaseNode>
  );
}

// ─── Sentiment Analysis ─────────────────────────
export function SentimentNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const sensitivity = (data.sensitivity as string) ?? 'balanced';

  // Simulated sentiment (deterministic from time, not random).
  // Seed changes every 5 min; stored in state + refreshed via interval so render stays pure.
  const [seed, setSeed] = useState<number>(() => Math.floor(Date.now() / 300000));
  useEffect(() => {
    const interval = setInterval(() => setSeed(Math.floor(Date.now() / 300000)), 300_000);
    return () => clearInterval(interval);
  }, []);
  const fearGreed = ((seed * 7 + 13) % 100);
  const socialBuzz = ((seed * 11 + 29) % 100);
  const retailSentiment = ((seed * 3 + 47) % 100);

  const sentimentLabel = fearGreed > 70 ? 'Greed' : fearGreed < 30 ? 'Fear' : 'Neutral';
  const sentimentColor = fearGreed > 70 ? 'text-emerald-400' : fearGreed < 30 ? 'text-red-400' : 'text-amber-400';

  return (
    <BaseNode
      icon="🧠" label="Sentiment Analysis" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">Fear & Greed</span>
          <span className={`text-[10px] font-bold ${sentimentColor}`}>{fearGreed} — {sentimentLabel}</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fearGreed > 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${fearGreed}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">Social Buzz</span>
          <span className="text-[10px] text-white/70">{socialBuzz}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">Retail Sentiment</span>
          <span className={`text-[10px] ${retailSentiment > 60 ? 'text-emerald-400' : retailSentiment < 40 ? 'text-red-400' : 'text-gray-400'}`}>
            {retailSentiment > 60 ? 'Bullish' : retailSentiment < 40 ? 'Bearish' : 'Mixed'}
          </span>
        </div>

        <select
          value={sensitivity}
          onChange={(e) => updateNodeData(id, { sensitivity: e.target.value })}
          className="nodrag nopan w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-white text-[9px] outline-none mt-1"
        >
          <option value="conservative" className="bg-gray-900">Conservative</option>
          <option value="balanced" className="bg-gray-900">Balanced</option>
          <option value="aggressive" className="bg-gray-900">Aggressive</option>
        </select>
      </div>
    </BaseNode>
  );
}

// ─── Fundamental Analysis ───────────────────────
export function FundamentalNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const selectedPair = useFlowStore(s => s.selectedPair);
  const weight = (data.weight as number) ?? 1.0;

  // Macro data based on currency pair
  const macroData = useMemo(() => {
    const base = selectedPair.slice(0, 3);
    const quote = selectedPair.slice(3, 6);

    const ratesMap: Record<string, { rate: string; gdp: string; cpi: string; employment: string; bias: string }> = {
      USD: { rate: '5.25%', gdp: '2.8%', cpi: '3.1%', employment: '3.7%', bias: 'Hawkish' },
      EUR: { rate: '4.50%', gdp: '0.6%', cpi: '2.4%', employment: '6.5%', bias: 'Neutral' },
      GBP: { rate: '5.25%', gdp: '0.3%', cpi: '3.4%', employment: '4.2%', bias: 'Hawkish' },
      JPY: { rate: '0.10%', gdp: '1.9%', cpi: '2.8%', employment: '2.5%', bias: 'Dovish' },
      CHF: { rate: '1.75%', gdp: '1.3%', cpi: '1.3%', employment: '2.1%', bias: 'Neutral' },
      XAU: { rate: 'N/A', gdp: 'N/A', cpi: 'N/A', employment: 'N/A', bias: 'Safe Haven' },
    };

    return { base: ratesMap[base] ?? ratesMap.USD, quote: ratesMap[quote] ?? ratesMap.USD };
  }, [selectedPair]);

  return (
    <BaseNode
      icon="🏦" label="Fundamental Analysis" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5">
        <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">
          {selectedPair.slice(0, 3)} vs {selectedPair.slice(3, 6)}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div>
            <div className="text-[8px] text-gray-600">{selectedPair.slice(0, 3)} Rate</div>
            <div className="text-[10px] text-white font-semibold">{macroData.base.rate}</div>
          </div>
          <div>
            <div className="text-[8px] text-gray-600">{selectedPair.slice(3, 6)} Rate</div>
            <div className="text-[10px] text-white font-semibold">{macroData.quote.rate}</div>
          </div>
          <div>
            <div className="text-[8px] text-gray-600">GDP Growth</div>
            <div className="text-[10px] text-emerald-400">{macroData.base.gdp}</div>
          </div>
          <div>
            <div className="text-[8px] text-gray-600">CPI</div>
            <div className="text-[10px] text-amber-400">{macroData.base.cpi}</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-[9px] text-gray-500">CB Bias</span>
          <span className={`text-[10px] font-bold ${
            macroData.base.bias === 'Hawkish' ? 'text-emerald-400' :
            macroData.base.bias === 'Dovish' ? 'text-red-400' : 'text-gray-400'
          }`}>{macroData.base.bias}</span>
        </div>
      </div>
    </BaseNode>
  );
}

// ─── Risk Profile (Psychology) ──────────────────
export function PsychProfileNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const profile = (data.profile as string) ?? 'moderate';

  const profiles: Record<string, { maxRisk: string; maxTrades: string; style: string; color: string }> = {
    conservative: { maxRisk: '1%', maxTrades: '2/day', style: 'Wait for high-probability setups only', color: 'text-emerald-400' },
    moderate: { maxRisk: '2%', maxTrades: '5/day', style: 'Balance risk and opportunity', color: 'text-amber-400' },
    aggressive: { maxRisk: '5%', maxTrades: '10/day', style: 'Trade momentum, accept higher risk', color: 'text-red-400' },
  };

  const p = profiles[profile] ?? profiles.moderate;

  return (
    <BaseNode
      icon="🎯" label="Risk Profile" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5">
        <select
          value={profile}
          onChange={(e) => updateNodeData(id, { profile: e.target.value })}
          className="nodrag nopan w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-white text-[10px] outline-none"
        >
          <option value="conservative" className="bg-gray-900">🟢 Conservative</option>
          <option value="moderate" className="bg-gray-900">🟡 Moderate</option>
          <option value="aggressive" className="bg-gray-900">🔴 Aggressive</option>
        </select>

        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span className="text-[9px] text-gray-500">Max Risk/Trade</span>
            <span className={`text-[10px] font-bold ${p.color}`}>{p.maxRisk}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-gray-500">Max Trades</span>
            <span className="text-[10px] text-white/70">{p.maxTrades}</span>
          </div>
        </div>

        <div className="text-[9px] text-gray-500 leading-tight">{p.style}</div>
      </div>
    </BaseNode>
  );
}
