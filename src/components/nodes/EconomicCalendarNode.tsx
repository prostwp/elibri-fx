import { useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { DEMO_CALENDAR } from '../../lib/demoData';
import { fetchEconomicCalendar, type CalendarItem } from '../../lib/finnhub';
import type { NodeProps } from '@xyflow/react';

function formatCountdown(minutes: number): string {
  if (minutes < -60) return 'PAST';
  if (minutes < 0) return 'LIVE';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function EconomicCalendarNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;

  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEconomicCalendar().then(items => {
      if (cancelled) return;
      if (items.length > 0) {
        setEvents(items);
        setIsLive(true);
      } else {
        // Fallback to demo
        setEvents(DEMO_CALENDAR.map(e => ({
          event: e.event,
          currency: e.currency,
          impact: e.impact as CalendarItem['impact'],
          forecast: e.forecast,
          previous: e.previous,
          actual: '-',
          time: '',
          minutesUntil: e.minutesUntil,
        })));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <BaseNode icon="📅" label="Economic Calendar" category="source" inputs={0} weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5">
        {isLive && (
          <div className="flex items-center gap-1 mb-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[8px] text-emerald-400 font-semibold uppercase">Live via Finnhub</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <div className="max-h-[140px] overflow-y-auto space-y-1.5">
            {events.slice(0, 6).map((evt, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className={`text-[8px] ${
                  evt.impact === 'high' ? 'text-red-400' : evt.impact === 'medium' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {evt.impact === 'high' ? '🔴' : evt.impact === 'medium' ? '🟡' : '🟢'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-300 truncate">{evt.event}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-gray-600">{evt.currency}</span>
                    <span className="text-[8px] text-gray-600">F: {evt.forecast}</span>
                    <span className="text-[8px] text-gray-600">P: {evt.previous}</span>
                    {evt.actual !== '-' && (
                      <span className="text-[8px] text-white font-bold">A: {evt.actual}</span>
                    )}
                  </div>
                </div>
                <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                  evt.minutesUntil < 0 ? 'bg-red-500/20 text-red-400 animate-pulse' :
                  evt.minutesUntil < 60 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-white/5 text-gray-500'
                }`}>
                  {formatCountdown(evt.minutesUntil)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
