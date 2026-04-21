import { useEffect, useRef, useState, useCallback } from 'react';

interface TradingViewChartProps {
  symbol: string; // e.g. 'EURUSD'
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}

// Map our pair names to TradingView symbols
function toTVSymbol(pair: string): string {
  const map: Record<string, string> = {
    EURUSD: 'FX:EURUSD',
    GBPUSD: 'FX:GBPUSD',
    USDJPY: 'FX:USDJPY',
    GBPJPY: 'FX:GBPJPY',
    XAUUSD: 'TVC:GOLD',
    USDCHF: 'FX:USDCHF',
    // Russian stocks — MOEX via TradingView
    SBER: 'MOEX:SBER',
    GAZP: 'MOEX:GAZP',
    LKOH: 'MOEX:LKOH',
    YNDX: 'MOEX:YNDX',
    GMKN: 'MOEX:GMKN',
    NLMK: 'MOEX:NLMK',
    ROSN: 'MOEX:ROSN',
    MTSS: 'MOEX:MTSS',
    // Crypto — Binance
    BTCUSDT: 'BINANCE:BTCUSDT',
    ETHUSDT: 'BINANCE:ETHUSDT',
    SOLUSDT: 'BINANCE:SOLUSDT',
    XRPUSDT: 'BINANCE:XRPUSDT',
    BNBUSDT: 'BINANCE:BNBUSDT',
  };
  if (pair.includes(':')) return pair;
  return map[pair] ?? `FX:${pair}`;
}

export function TradingViewChart({ symbol, entry, stopLoss, takeProfit }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const loadWidget = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const tvSymbol = toTVSymbol(symbol);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(13, 13, 20, 1)',
      gridColor: 'rgba(30, 30, 46, 0.6)',
      allow_symbol_change: true,
      hide_top_toolbar: !expanded,
      hide_legend: false,
      hide_side_toolbar: !expanded,
      save_image: false,
      calendar: false,
      hide_volume: !expanded,
      width: '100%',
      height: '100%',
      studies: expanded ? ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'] : [],
    });

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);
  }, [symbol, expanded]);

  useEffect(() => {
    loadWidget();
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [loadWidget]);

  const decimals = symbol === 'XAUUSD' || symbol === 'USDJPY' || symbol === 'GBPJPY' ? 2 : 5;

  return (
    <div className="relative">
      {/* Expand/Collapse */}
      <div className="flex items-center justify-end mb-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-gray-500 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
        >
          {expanded ? '⊖ Collapse' : '⊕ Expand'}
        </button>
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className={`rounded-lg overflow-hidden border border-white/5 transition-all duration-300 ${
          expanded ? 'h-[500px]' : 'h-[250px]'
        }`}
      />

      {/* Trade levels */}
      {(entry || stopLoss || takeProfit) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[9px]">
          {entry !== undefined && entry !== 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Entry {entry.toFixed(decimals)}
            </span>
          )}
          {stopLoss !== undefined && stopLoss !== 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              SL {stopLoss.toFixed(decimals)}
            </span>
          )}
          {takeProfit !== undefined && takeProfit !== 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              TP {takeProfit.toFixed(decimals)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
