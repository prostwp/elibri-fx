import { useState, useEffect, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import {
  STOCKS_FUNDAMENTAL, STOCK_TICKERS, fetchStockQuote,
  getStressScore, type StockQuote,
} from '../../lib/stockData';
import type { NodeProps } from '@xyflow/react';

export function StockAnalysisNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 1.0;
  const selectedTicker = (data.ticker as string) ?? 'SBER';
  const [quote, setQuote] = useState<StockQuote | null>(null);

  const fund = STOCKS_FUNDAMENTAL[selectedTicker];

  useEffect(() => {
    fetchStockQuote(selectedTicker).then(q => { if (q) setQuote(q); });
  }, [selectedTicker]);

  const stress = useMemo(() => fund ? getStressScore(fund) : null, [fund]);

  if (!fund) return null;

  const priceColor = (quote?.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <BaseNode
      icon="🏦" label="Stock Analyzer" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-2 min-w-[220px]">
        {/* Ticker selector */}
        <select
          value={selectedTicker}
          onChange={(e) => updateNodeData(id, { ticker: e.target.value })}
          className="nodrag nopan w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none"
        >
          {STOCK_TICKERS.map(t => (
            <option key={t} value={t} className="bg-gray-900">
              {t} — {STOCKS_FUNDAMENTAL[t].name}
            </option>
          ))}
        </select>

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{fund.name}</span>
          {quote ? (
            <span className={`text-[11px] font-bold ${priceColor}`}>
              {quote.price.toFixed(2)} ₽ ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(1)}%)
            </span>
          ) : (
            <span className="text-[10px] text-gray-600">Loading...</span>
          )}
        </div>

        {/* Report type badge */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
            fund.reportType === 'IFRS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {fund.reportType}
          </span>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{fund.sector}</span>
        </div>

        {/* Key multipliers */}
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-white/5 rounded px-1.5 py-1 text-center">
            <div className="text-[8px] text-gray-500">P/E</div>
            <div className="text-[10px] text-white font-bold">{fund.pe.toFixed(1)}</div>
          </div>
          <div className="bg-white/5 rounded px-1.5 py-1 text-center">
            <div className="text-[8px] text-gray-500">EV/EBITDA</div>
            <div className="text-[10px] text-white font-bold">{fund.evEbitda.toFixed(1)}</div>
          </div>
          <div className="bg-white/5 rounded px-1.5 py-1 text-center">
            <div className="text-[8px] text-gray-500">Div %</div>
            <div className="text-[10px] text-emerald-400 font-bold">{fund.divYield.toFixed(1)}%</div>
          </div>
        </div>

        {/* Profitability */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex justify-between">
            <span className="text-[8px] text-gray-500">ROE</span>
            <span className="text-[9px] text-white">{fund.roe.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[8px] text-gray-500">Net Margin</span>
            <span className="text-[9px] text-white">{fund.netMargin.toFixed(1)}%</span>
          </div>
        </div>

        {/* Cash flows */}
        <div className="border-t border-white/5 pt-1 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-[8px] text-gray-500">EBITDA</span>
            <span className="text-[9px] text-white">{fund.ebitda > 0 ? `${fund.ebitda}B` : 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[8px] text-gray-500">FCF</span>
            <span className={`text-[9px] font-bold ${fund.fcf > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fund.fcf}B
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[8px] text-gray-500">Debt/EBITDA</span>
            <span className={`text-[9px] ${fund.netDebtEbitda < 1 ? 'text-emerald-400' : fund.netDebtEbitda < 2 ? 'text-amber-400' : 'text-red-400'}`}>
              {fund.netDebtEbitda.toFixed(2)}x
            </span>
          </div>
        </div>

        {/* Stress score */}
        {stress && (
          <div className={`flex items-center justify-between px-2 py-1 rounded border ${
            stress.level === 'strong' ? 'bg-emerald-500/10 border-emerald-500/20' :
            stress.level === 'moderate' ? 'bg-amber-500/10 border-amber-500/20' :
            'bg-red-500/10 border-red-500/20'
          }`}>
            <span className="text-[8px] text-gray-400">Stress Score</span>
            <span className={`text-[10px] font-bold ${
              stress.level === 'strong' ? 'text-emerald-400' :
              stress.level === 'moderate' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {stress.score}/100 {stress.level === 'strong' ? '💪' : stress.level === 'moderate' ? '⚠️' : '🔴'}
            </span>
          </div>
        )}

        {/* Upside */}
        <div className="flex items-center justify-between px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
          <span className="text-[8px] text-gray-400">Fair Value</span>
          <span className="text-[10px] font-bold text-indigo-400">
            {fund.fairValue} ₽ ({fund.upside > 0 ? '+' : ''}{fund.upside.toFixed(1)}%)
          </span>
        </div>
      </div>
    </BaseNode>
  );
}
