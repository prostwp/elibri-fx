import { useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { STOCKS_FUNDAMENTAL } from '../../lib/stockData';
import type { NodeProps } from '@xyflow/react';

// Recent events per ticker
const EVENTS_DATA: Record<string, {
  events: { date: string; type: string; title: string; impact: 'positive' | 'negative' | 'neutral'; delta?: string }[];
}> = {
  SBER: { events: [
    { date: '2025-03-28', type: 'Отчёт', title: 'Прибыль МСФО +15% YoY', impact: 'positive', delta: '+3.2%' },
    { date: '2025-03-15', type: 'Решение СД', title: 'Дивиденды 33.3₽/акция утверждены', impact: 'positive', delta: '+1.8%' },
    { date: '2025-02-20', type: 'Макро', title: 'ЦБ сохранил ставку 21%', impact: 'neutral' },
  ]},
  GAZP: { events: [
    { date: '2025-03-25', type: 'Отчёт', title: 'Выручка -8% YoY, прибыль -22%', impact: 'negative', delta: '-4.1%' },
    { date: '2025-03-01', type: 'Новость', title: 'Транзит газа через Украину не возобновлён', impact: 'negative', delta: '-2.5%' },
    { date: '2025-02-15', type: 'Решение СД', title: 'Дивиденды 7.4₽ — ниже ожиданий', impact: 'negative', delta: '-3.0%' },
  ]},
  LKOH: { events: [
    { date: '2025-03-20', type: 'Отчёт', title: 'FCF +12% YoY, buyback продолжается', impact: 'positive', delta: '+2.1%' },
    { date: '2025-03-10', type: 'Buyback', title: 'Обратный выкуп на 50 млрд', impact: 'positive', delta: '+1.5%' },
  ]},
  YNDX: { events: [
    { date: '2025-03-22', type: 'Отчёт', title: 'Выручка +38% YoY, рекорд', impact: 'positive', delta: '+5.2%' },
    { date: '2025-03-05', type: 'Продукт', title: 'Запуск нового AI-сервиса', impact: 'positive', delta: '+2.0%' },
  ]},
  GMKN: { events: [
    { date: '2025-03-18', type: 'Отчёт', title: 'EBITDA -8%, капекс растёт', impact: 'negative', delta: '-1.8%' },
    { date: '2025-02-28', type: 'Макро', title: 'Цены на никель -15% за квартал', impact: 'negative', delta: '-3.5%' },
  ]},
  NLMK: { events: [
    { date: '2025-03-15', type: 'Отчёт', title: 'Стабильные результаты, FCF +8%', impact: 'positive', delta: '+1.0%' },
  ]},
  ROSN: { events: [
    { date: '2025-03-20', type: 'Отчёт', title: 'Выручка +8%, Восток Ойл на графике', impact: 'positive', delta: '+2.5%' },
  ]},
  MTSS: { events: [
    { date: '2025-03-12', type: 'Отчёт', title: 'Выручка +12%, долг растёт', impact: 'neutral', delta: '+0.5%' },
    { date: '2025-02-25', type: 'Решение СД', title: 'Дивиденды 35₽ подтверждены', impact: 'positive', delta: '+1.2%' },
  ]},
};

export function EventRepricingNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;

  const ticker = useMemo(() => {
    const sn = nodes.find(n => n.type === 'stockAnalysis');
    return (sn?.data?.ticker as string) ?? 'SBER';
  }, [nodes]);

  const events = EVENTS_DATA[ticker]?.events ?? [];
  const fund = STOCKS_FUNDAMENTAL[ticker];
  if (!fund) return null;

  // Score from events
  const eventScore = events.reduce((s, e) => s + (e.impact === 'positive' ? 1 : e.impact === 'negative' ? -1 : 0), 0);
  const sentiment = eventScore > 0 ? 'Позитивный' : eventScore < 0 ? 'Негативный' : 'Нейтральный';

  return (
    <BaseNode icon="📰" label="Event Repricing" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5 min-w-[220px]">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-500 font-semibold">{fund.name} — События</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            eventScore > 0 ? 'bg-emerald-500/20 text-emerald-400' :
            eventScore < 0 ? 'bg-red-500/20 text-red-400' :
            'bg-white/10 text-gray-400'
          }`}>{sentiment}</span>
        </div>

        <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
          {events.map((e, i) => (
            <div key={i} className={`rounded border px-2 py-1.5 ${
              e.impact === 'positive' ? 'bg-emerald-500/5 border-emerald-500/15' :
              e.impact === 'negative' ? 'bg-red-500/5 border-red-500/15' :
              'bg-white/[0.02] border-white/5'
            }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[8px] font-bold px-1 rounded ${
                  e.type === 'Отчёт' ? 'bg-blue-500/20 text-blue-400' :
                  e.type === 'Решение СД' ? 'bg-purple-500/20 text-purple-400' :
                  e.type === 'Buyback' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-white/10 text-gray-400'
                }`}>{e.type}</span>
                <span className="text-[8px] text-gray-600">{e.date}</span>
                {e.delta && (
                  <span className={`text-[8px] font-bold ml-auto ${
                    e.delta.startsWith('+') ? 'text-emerald-400' : 'text-red-400'
                  }`}>{e.delta}</span>
                )}
              </div>
              <div className="text-[9px] text-gray-300">{e.title}</div>
            </div>
          ))}
        </div>

        <div className={`text-center py-1 rounded text-[9px] font-bold ${
          eventScore > 1 ? 'bg-emerald-500/10 text-emerald-400' :
          eventScore < -1 ? 'bg-red-500/10 text-red-400' :
          'bg-white/5 text-gray-500'
        }`}>
          Event Score: {eventScore > 0 ? '+' : ''}{eventScore} ({sentiment})
        </div>
      </div>
    </BaseNode>
  );
}
