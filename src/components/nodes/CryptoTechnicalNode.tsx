import { useEffect, useMemo, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { fetchCandlesFromBackend } from '../../lib/backendClient';
import { getCryptoIndicatorSignals } from '../../lib/cryptoIndicators';
import { DEMO_CRYPTO } from '../../lib/demoData';
import type { NodeProps } from '@xyflow/react';
import type { IndicatorResult, OHLCVCandle } from '../../types/nodes';

const CRYPTO_INDICATORS = ['RSI', 'MACD', 'Bollinger Bands', 'EMA', 'ATR'] as const;
const INTERVALS = ['5m', '15m', '1h', '4h', '1d'] as const;

function isCryptoPair(pair: string): boolean {
  return pair.endsWith('USDT') || pair.endsWith('BUSD');
}

export function CryptoTechnicalNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const selectedPair = useFlowStore(s => s.selectedPair);
  const setCandles = useCryptoStore(s => s.setCandles);

  const activePair = isCryptoPair(selectedPair) ? selectedPair : 'BTCUSDT';
  const selected = useMemo(
    () => (data.indicators as string[]) || ['RSI', 'MACD', 'Bollinger Bands'],
    [data.indicators],
  );
  const selectedKey = selected.join('|');
  const interval = (data.interval as string) || '1h';
  const weight = (data.weight as number) ?? 1.0;

  const [signals, setSignals] = useState<IndicatorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'live' | 'demo' | 'none'>('none');

  const toggle = (ind: string) => {
    const next = selected.includes(ind)
      ? selected.filter(i => i !== ind)
      : [...selected, ind];
    updateNodeData(id, { indicators: next });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const apiCandles = await fetchCandlesFromBackend(activePair, 'binance', interval, 200);
      if (cancelled) return;

      let candles: OHLCVCandle[];
      let src: 'live' | 'demo' | 'none';
      if (apiCandles && apiCandles.length > 0) {
        candles = apiCandles as OHLCVCandle[];
        setCandles(activePair, candles);
        src = 'live';
      } else {
        // Read from store lazily to avoid re-trigger loop
        const existing = useCryptoStore.getState().candles[activePair];
        candles = existing ?? DEMO_CRYPTO[activePair]?.candles ?? [];
        src = candles.length ? 'demo' : 'none';
      }

      if (cancelled) return;
      setSource(src);
      setSignals(candles.length ? getCryptoIndicatorSignals(candles, selected) : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // selected via selectedKey to avoid ref-identity churn; setCandles stable from zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePair, interval, selectedKey]);

  return (
    <BaseNode
      id={id}
      icon="📊"
      label="Crypto Technical"
      category="analysis"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5 min-w-[220px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500">TF</span>
          <select
            value={interval}
            onChange={(e) => updateNodeData(id, { interval: e.target.value })}
            className="nodrag nopan flex-1 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-[10px] outline-none"
          >
            {INTERVALS.map(tf => (
              <option key={tf} value={tf} className="bg-gray-900">{tf}</option>
            ))}
          </select>
          <span className="text-[9px] text-white/60 font-semibold">
            {activePair.replace('USDT', '')}
          </span>
          <span className={`text-[8px] px-1 py-0.5 rounded ${
            source === 'live' ? 'bg-emerald-500/20 text-emerald-400' :
            source === 'demo' ? 'bg-amber-500/20 text-amber-400' :
            'bg-white/5 text-gray-500'
          }`}>
            {source === 'live' ? 'LIVE' : source === 'demo' ? 'DEMO' : 'N/A'}
          </span>
        </div>

        <div className="space-y-1">
          {CRYPTO_INDICATORS.map(ind => (
            <label key={ind} className="flex items-center gap-2 cursor-pointer hover:text-white/70 transition-colors">
              <input
                type="checkbox"
                checked={selected.includes(ind)}
                onChange={() => toggle(ind)}
                className="rounded border-gray-600 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 w-3 h-3"
              />
              <span className="text-[10px]">{ind}</span>
            </label>
          ))}
        </div>

        {loading ? (
          <div className="pt-1.5 border-t border-white/5">
            <span className="text-[9px] text-gray-500">Fetching candles...</span>
          </div>
        ) : signals.length ? (
          <div className="pt-1.5 border-t border-white/5 space-y-0.5">
            <span className="text-[8px] text-gray-500 uppercase tracking-wider">Live Signals</span>
            {signals.map(s => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-[9px] text-gray-400">{s.name}</span>
                <span className={`text-[9px] font-bold ${
                  s.signal === 'buy' ? 'text-emerald-400' :
                  s.signal === 'sell' ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {s.signal.toUpperCase()} · {Number(s.value).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </BaseNode>
  );
}
