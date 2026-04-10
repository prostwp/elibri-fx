import { useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { STOCKS_FUNDAMENTAL } from '../../lib/stockData';
import type { NodeProps } from '@xyflow/react';

// Dividend data per ticker (real 2024 data)
const DIVIDEND_DATA: Record<string, {
  dps: number; // dividend per share
  payoutRatio: number; // % of net income
  exDate: string;
  frequency: string;
  yearsConsecutive: number;
  growth5y: number; // 5yr dividend growth %
}> = {
  SBER: { dps: 33.3, payoutRatio: 50, exDate: '2025-07-14', frequency: '1x/год', yearsConsecutive: 5, growth5y: 25 },
  GAZP: { dps: 7.4, payoutRatio: 50, exDate: '2025-07-21', frequency: '1x/год', yearsConsecutive: 2, growth5y: -15 },
  LKOH: { dps: 885, payoutRatio: 100, exDate: '2025-06-02', frequency: '2x/год', yearsConsecutive: 8, growth5y: 18 },
  YNDX: { dps: 0, payoutRatio: 0, exDate: '-', frequency: 'Не платит', yearsConsecutive: 0, growth5y: 0 },
  GMKN: { dps: 915, payoutRatio: 50, exDate: '2025-06-16', frequency: '1x/год', yearsConsecutive: 10, growth5y: -8 },
  NLMK: { dps: 12.5, payoutRatio: 60, exDate: '2025-06-09', frequency: '4x/год', yearsConsecutive: 4, growth5y: 5 },
  ROSN: { dps: 36.5, payoutRatio: 50, exDate: '2025-07-07', frequency: '2x/год', yearsConsecutive: 6, growth5y: 12 },
  MTSS: { dps: 35, payoutRatio: 100, exDate: '2025-07-10', frequency: '2x/год', yearsConsecutive: 12, growth5y: 8 },
};

export function DividendNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;

  const ticker = useMemo(() => {
    const sn = nodes.find(n => n.type === 'stockAnalysis');
    return (sn?.data?.ticker as string) ?? 'SBER';
  }, [nodes]);

  const div = DIVIDEND_DATA[ticker];
  const fund = STOCKS_FUNDAMENTAL[ticker];
  if (!div || !fund) return null;

  const divYield = fund.divYield;
  const daysToEx = div.exDate !== '-' ? Math.max(0, Math.round((new Date(div.exDate).getTime() - Date.now()) / 86400000)) : null;

  return (
    <BaseNode icon="💎" label="Dividend Capture" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5 min-w-[210px]">
        <div className="text-[9px] text-gray-500 font-semibold">{fund.name} — Дивиденды</div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-white/5 rounded px-2 py-1.5 text-center">
            <div className="text-[8px] text-gray-500">Div Yield</div>
            <div className={`text-[12px] font-black ${divYield > 10 ? 'text-emerald-400' : divYield > 5 ? 'text-amber-400' : 'text-red-400'}`}>
              {divYield}%
            </div>
          </div>
          <div className="bg-white/5 rounded px-2 py-1.5 text-center">
            <div className="text-[8px] text-gray-500">DPS</div>
            <div className="text-[12px] font-black text-white">{div.dps} ₽</div>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">Payout Ratio</span>
            <span className={`font-bold ${div.payoutRatio > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>{div.payoutRatio}%</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">Частота</span>
            <span className="text-white">{div.frequency}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">Подряд лет</span>
            <span className={`font-bold ${div.yearsConsecutive >= 5 ? 'text-emerald-400' : 'text-amber-400'}`}>{div.yearsConsecutive}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">Рост 5л</span>
            <span className={`font-bold ${div.growth5y > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {div.growth5y > 0 ? '+' : ''}{div.growth5y}%
            </span>
          </div>
        </div>

        {daysToEx !== null && (
          <div className={`text-center py-1 rounded border text-[10px] font-bold ${
            daysToEx < 30 ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            daysToEx < 90 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
            'bg-white/5 border-white/10 text-gray-400'
          }`}>
            {daysToEx === 0 ? '🔴 ОТСЕЧКА СЕГОДНЯ' : `До отсечки: ${daysToEx} дней (${div.exDate})`}
          </div>
        )}
        {div.dps === 0 && (
          <div className="text-center py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-bold">
            Не платит дивиденды
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export const DIVIDEND_INFO = DIVIDEND_DATA;
