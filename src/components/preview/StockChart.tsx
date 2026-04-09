import { useEffect, useRef, useState } from 'react';
import { createChart, type IChartApi, CandlestickSeries, LineSeries, ColorType } from 'lightweight-charts';

interface StockChartProps {
  ticker: string;
  fairValue?: number;
}

interface MOEXCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

async function fetchMOEXCandles(ticker: string): Promise<MOEXCandle[]> {
  try {
    const from = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]; // 6 months
    const res = await fetch(
      `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}/candles.json?iss.meta=off&iss.only=candles&candles.columns=begin,open,high,low,close,volume&interval=24&from=${from}`
    );
    if (!res.ok) return [];
    const raw = await res.json();
    const rows = raw?.candles?.data ?? [];

    return rows.map((r: [string, number, number, number, number, number]) => ({
      time: r[0].split(' ')[0], // "2025-01-03"
      open: r[1],
      high: r[2],
      low: r[3],
      close: r[4],
    }));
  } catch {
    return [];
  }
}

export function StockChart({ ticker, fairValue }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(99,102,241,0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(99,102,241,0.3)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.05)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        timeVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Load data
    fetchMOEXCandles(ticker).then(candles => {
      if (candles.length > 0) {
        series.setData(candles as any);

        // Add fair value line
        if (fairValue && fairValue > 0) {
          const fairLine = chart.addSeries(LineSeries, {
            color: '#6366f1',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
          });
          fairLine.setData(
            candles.map(c => ({ time: c.time, value: fairValue })) as any
          );
        }

        chart.timeScale().fitContent();
      }
      setLoading(false);
    });

    // Resize handler
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [ticker, fairValue]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-white/[0.02]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      )}
      <div ref={containerRef} />
      <div className="flex items-center justify-between px-2 py-1 text-[8px] text-gray-600">
        <span>MOEX:{ticker} • Daily • 6M</span>
        {fairValue && <span className="text-indigo-400">— Fair Value: {fairValue} ₽</span>}
      </div>
    </div>
  );
}
