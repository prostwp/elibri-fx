import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { CRYPTO_PAIRS } from '../../lib/demoData';
import type { NodeProps } from '@xyflow/react';

export function CryptoSourceNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const setSelectedPair = useFlowStore(s => s.setSelectedPair);
  const pair = (data.pair as string) || 'BTCUSDT';

  const cryptoStatus = useCryptoStore(s => s.status);
  const prices = useCryptoStore(s => s.prices);
  const currentPrice = prices[pair];

  return (
    <BaseNode
      icon="₿"
      label="Crypto Pair"
      category="source"
      inputs={0}
    >
      <select
        value={pair}
        onChange={(e) => {
          updateNodeData(id, { pair: e.target.value });
          setSelectedPair(e.target.value);
        }}
        className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-white text-[11px] outline-none focus:border-blue-500/50 cursor-pointer"
      >
        {CRYPTO_PAIRS.map(p => (
          <option key={p} value={p} className="bg-gray-900">{p.replace('USDT', '/USDT')}</option>
        ))}
      </select>

      {/* Live price or demo badge */}
      <div className="mt-1.5 flex items-center justify-between">
        {currentPrice ? (
          <div className="flex items-center gap-1.5">
            <span className="text-white text-[11px] font-medium">
              ${currentPrice.price.toLocaleString()}
            </span>
            <span className={`text-[9px] font-bold ${currentPrice.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentPrice.change24h >= 0 ? '+' : ''}{currentPrice.change24h.toFixed(2)}%
            </span>
          </div>
        ) : (
          <span className="text-[9px] text-gray-600">Demo Data</span>
        )}
        {cryptoStatus === 'connected' || cryptoStatus === 'public' ? (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400/70">Live</span>
          </span>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">Binance</span>
        )}
      </div>
    </BaseNode>
  );
}
