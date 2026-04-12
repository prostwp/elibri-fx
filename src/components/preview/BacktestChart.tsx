import { useEffect, useRef } from 'react';
import { createChart, LineSeries, ColorType } from 'lightweight-charts';

interface BacktestChartProps {
  equityCurve: { date: string; value: number }[];
  initialValue: number;
}

export function BacktestChart({ equityCurve, initialValue }: BacktestChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || equityCurve.length < 2) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 150,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 9,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.02)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: false },
    });

    const series = chart.addSeries(LineSeries, {
      color: equityCurve[equityCurve.length - 1].value >= initialValue ? '#10b981' : '#ef4444',
      lineWidth: 2,
      priceLineVisible: false,
    });

    // Add baseline at initial value
    const baseline = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.1)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
    });

    series.setData(equityCurve.map(p => ({ time: p.date, value: p.value })) as any);
    baseline.setData(equityCurve.map(p => ({ time: p.date, value: initialValue })) as any);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [equityCurve, initialValue]);

  return <div ref={containerRef} className="rounded-lg overflow-hidden" />;
}
