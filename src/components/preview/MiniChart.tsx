import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { OHLCVCandle } from '../../types/nodes';

interface MiniChartProps {
  candles: OHLCVCandle[];
  pair: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export function MiniChart({ candles, pair, entry, stopLoss, takeProfit }: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 200,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1e1e2e' },
        horzLines: { color: '#1e1e2e' },
      },
      crosshair: {
        vertLine: { color: '#6366f1', width: 1, style: 2 },
        horzLine: { color: '#6366f1', width: 1, style: 2 },
      },
      timeScale: {
        borderColor: '#1e1e2e',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1e1e2e',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const chartData = candles.slice(-80).map(c => ({
      time: c.time as number,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(chartData as never);

    // Add price lines for entry, SL, TP
    if (entry) {
      candlestickSeries.createPriceLine({
        price: entry,
        color: '#6366f1',
        lineWidth: 1,
        lineStyle: 2,
        title: 'Entry',
      });
    }
    if (stopLoss) {
      candlestickSeries.createPriceLine({
        price: stopLoss,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2,
        title: 'SL',
      });
    }
    if (takeProfit) {
      candlestickSeries.createPriceLine({
        price: takeProfit,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 2,
        title: 'TP',
      });
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [candles, pair, entry, stopLoss, takeProfit]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-300">{pair}</span>
        <span className="text-[10px] text-gray-600">H1</span>
      </div>
      <div ref={containerRef} className="rounded-lg overflow-hidden" />
    </div>
  );
}
