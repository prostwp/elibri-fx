import { useEffect, useRef, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { fetchQuotesFromBackend } from '../../lib/backendClient';
import type { NodeProps } from '@xyflow/react';

const TOP_USDT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT',
  'AVAXUSDT', 'TRXUSDT', 'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'SHIBUSDT', 'MATICUSDT',
  'TONUSDT', 'BCHUSDT', 'UNIUSDT', 'NEARUSDT', 'APTUSDT', 'ATOMUSDT', 'ETCUSDT',
  'ICPUSDT', 'XLMUSDT', 'FILUSDT', 'VETUSDT', 'HBARUSDT', 'INJUSDT', 'OPUSDT',
  'ARBUSDT', 'IMXUSDT', 'RUNEUSDT', 'RENDERUSDT', 'SUIUSDT', 'SEIUSDT', 'FTMUSDT',
  'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT', 'JUPUSDT', 'TIAUSDT',
  'ORDIUSDT', 'WLDUSDT', 'ENAUSDT', 'FETUSDT', 'LDOUSDT', 'GRTUSDT', 'AAVEUSDT',
  'STXUSDT', 'MKRUSDT',
] as const;

interface QuoteSnapshot {
  price: number;
  changePercent: number;
  marketCap: number;
}

function formatPrice(p: number): string {
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(6);
}

function formatCap(n: number): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export function CryptoAssetNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const setSelectedPair = useFlowStore(s => s.setSelectedPair);
  const pair = (data.pair as string) || 'BTCUSDT';

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const livePriceForPair = useCryptoStore(s => s.prices[pair]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedPair(pair);
  }, [pair, setSelectedPair]);

  // Click-outside closes the popover
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = TOP_USDT_PAIRS.filter(p =>
    p.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQuotesFromBackend([pair], 'binance')
      .then(quotes => {
        if (cancelled) return;
        const q = quotes?.[pair];
        if (q && typeof q.price === 'number') {
          setQuote({
            price: q.price,
            changePercent: q.changePercent ?? 0,
            marketCap: q.marketCap ?? 0,
          });
        } else if (livePriceForPair) {
          setQuote({ price: livePriceForPair.price, changePercent: livePriceForPair.change24h, marketCap: 0 });
        } else {
          setQuote(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setQuote(null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  const pickPair = (p: string) => {
    updateNodeData(id, { pair: p });
    setSelectedPair(p);
    setSearch('');
    setOpen(false);
  };

  return (
    <BaseNode
      id={id}
      icon="₿"
      label="Crypto Asset"
      category="source"
      inputs={0}
    >
      <div ref={wrapRef} className="space-y-1.5 min-w-[220px] relative">
        {/* Current pair button — click to open selector */}
        <button
          onClick={() => setOpen(v => !v)}
          className="nodrag nopan w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 py-1.5 text-white text-[11px] transition-colors cursor-pointer"
        >
          <span className="font-semibold">{pair.replace('USDT', '/USDT')}</span>
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Popover: search + scrollable list */}
        {open && (
          <div className="absolute top-10 left-0 right-0 z-[100] rounded-md border border-white/15 bg-[#0d0d14] shadow-2xl overflow-hidden">
            <input
              type="text"
              autoFocus
              placeholder="Search BTC, SOL, PEPE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nodrag nopan w-full bg-black/30 border-b border-white/10 px-2 py-1.5 text-white text-[10px] outline-none placeholder:text-gray-600"
            />
            <div className="nodrag nopan nowheel max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-2 py-3 text-center text-[10px] text-gray-500">No matches</div>
              ) : (
                filtered.map(p => (
                  <button
                    key={p}
                    onClick={() => pickPair(p)}
                    className={`
                      w-full text-left px-2 py-1.5 text-[10px] transition-colors
                      ${p === pair
                        ? 'bg-blue-500/20 text-blue-300 font-semibold'
                        : 'text-white/80 hover:bg-white/5'}
                    `}
                  >
                    {p.replace('USDT', '/USDT')}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="border-t border-white/5 pt-1.5 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/80 font-semibold">{pair.replace('USDT', '')}</span>
            {loading ? (
              <span className="text-[9px] text-gray-600">Loading...</span>
            ) : quote ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-white font-bold">${formatPrice(quote.price)}</span>
                <span className={`text-[9px] font-bold ${quote.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                </span>
              </div>
            ) : (
              <span className="text-[9px] text-gray-600">Demo Data</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-500">Mkt Cap</span>
            <span className="text-[9px] text-white/70 font-mono">{formatCap(quote?.marketCap ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-500">Source</span>
            <span className="text-[9px] text-blue-400/70">Binance</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}
