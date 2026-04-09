/**
 * 6 фундаментальных нод для сценария T-Invest Fundamental:
 * 1. ReportSelector — РСБУ vs МСФО
 * 2. CashFlowNode — FCF, EBITDA, CAPEX, LTM
 * 3. DebtAnalysisNode — долговая нагрузка, стресс-тест
 * 4. SectorCompareNode — сравнение компаний в секторе
 * 5. ProfitabilityNode — ROE, ROA, маржинальность
 * 6. PortfolioScoreNode — итоговый скоринг
 */

import { useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import {
  STOCKS_FUNDAMENTAL, getSectorComparison, getStressScore,
} from '../../lib/stockData';
import type { NodeProps } from '@xyflow/react';

// Helper: получить тикер из связанной StockAnalysis ноды
function useSelectedTicker(nodes: { id: string; type?: string; data: Record<string, unknown> }[]): string {
  const stockNode = nodes.find(n => n.type === 'stockAnalysis');
  return (stockNode?.data?.ticker as string) ?? 'SBER';
}

// ═══════════════════════════════════════════════════
// 1. Report Selector — РСБУ vs МСФО
// ═══════════════════════════════════════════════════
export function ReportSelectorNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;
  const ticker = useSelectedTicker(nodes);
  const fund = STOCKS_FUNDAMENTAL[ticker];

  return (
    <BaseNode icon="📊" label="Report Type" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{fund?.name ?? ticker}:</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            fund?.reportType === 'МСФО' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {fund?.reportType ?? 'N/A'}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-1.5">
            <div className="text-[9px] font-bold text-blue-400">МСФО (IFRS)</div>
            <div className="text-[8px] text-gray-400 leading-relaxed">
              Консолидированная отчётность группы. Для оценки бизнеса в целом, сравнения с международными аналогами.
            </div>
          </div>
          <div className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
            <div className="text-[9px] font-bold text-amber-400">РСБУ (RAS)</div>
            <div className="text-[8px] text-gray-400 leading-relaxed">
              Юрлицо отдельно. Для дивидендов (база начисления), налоговой отчётности.
            </div>
          </div>
        </div>

        <div className="text-[8px] text-gray-500 bg-white/5 rounded px-2 py-1">
          💡 Дивиденды считают от РСБУ прибыли, оценку — по МСФО
        </div>
      </div>
    </BaseNode>
  );
}

// ═══════════════════════════════════════════════════
// 2. Cash Flow — FCF, EBITDA, CAPEX, LTM
// ═══════════════════════════════════════════════════
export function CashFlowNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;
  const ticker = useSelectedTicker(nodes);
  const fund = STOCKS_FUNDAMENTAL[ticker];

  if (!fund) return null;

  const fcfYield = fund.marketCap > 0 ? ((fund.fcf / fund.marketCap) * 100) : 0;

  return (
    <BaseNode icon="💰" label="Cash Flow" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5 min-w-[200px]">
        <div className="text-[9px] text-gray-500 font-semibold">{fund.name} — Денежные потоки</div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-white/5 rounded px-2 py-1.5">
            <div className="text-[8px] text-gray-500">Выручка</div>
            <div className="text-[10px] text-white font-bold">{fund.revenue} млрд</div>
            <div className={`text-[8px] ${fund.revenueGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fund.revenueGrowth > 0 ? '↑' : '↓'} {fund.revenueGrowth}% YoY
            </div>
          </div>
          <div className="bg-white/5 rounded px-2 py-1.5">
            <div className="text-[8px] text-gray-500">EBITDA</div>
            <div className="text-[10px] text-white font-bold">{fund.ebitda > 0 ? `${fund.ebitda} млрд` : 'N/A'}</div>
            {fund.ebitdaGrowth !== 0 && (
              <div className={`text-[8px] ${fund.ebitdaGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fund.ebitdaGrowth > 0 ? '↑' : '↓'} {Math.abs(fund.ebitdaGrowth)}% YoY
              </div>
            )}
          </div>
          <div className="bg-white/5 rounded px-2 py-1.5">
            <div className="text-[8px] text-gray-500">FCF</div>
            <div className={`text-[10px] font-bold ${fund.fcf > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fund.fcf} млрд
            </div>
            <div className={`text-[8px] ${fund.fcfGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fund.fcfGrowth > 0 ? '↑' : '↓'} {Math.abs(fund.fcfGrowth)}% YoY
            </div>
          </div>
          <div className="bg-white/5 rounded px-2 py-1.5">
            <div className="text-[8px] text-gray-500">CAPEX</div>
            <div className="text-[10px] text-white font-bold">{fund.capex} млрд</div>
            <div className="text-[8px] text-gray-500">
              {fund.revenue > 0 ? `${((fund.capex / fund.revenue) * 100).toFixed(0)}% от выручки` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
          <span className="text-[8px] text-gray-400">FCF Yield</span>
          <span className={`text-[10px] font-bold ${fcfYield > 10 ? 'text-emerald-400' : fcfYield > 5 ? 'text-amber-400' : 'text-red-400'}`}>
            {fcfYield.toFixed(1)}%
          </span>
        </div>
      </div>
    </BaseNode>
  );
}

// ═══════════════════════════════════════════════════
// 3. Debt Analysis — долговая нагрузка
// ═══════════════════════════════════════════════════
export function DebtAnalysisNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;
  const ticker = useSelectedTicker(nodes);
  const fund = STOCKS_FUNDAMENTAL[ticker];

  const stress = useMemo(() => fund ? getStressScore(fund) : null, [fund]);
  if (!fund) return null;

  return (
    <BaseNode icon="📉" label="Debt Analysis" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5 min-w-[200px]">
        <div className="text-[9px] text-gray-500 font-semibold">{fund.name} — Долговая нагрузка</div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-400">Net Debt</span>
            <span className={`text-[10px] font-bold ${fund.netDebt < 0 ? 'text-emerald-400' : 'text-white'}`}>
              {fund.netDebt < 0 ? `${fund.netDebt} млрд (кэш)` : `${fund.netDebt} млрд`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-400">Net Debt / EBITDA</span>
            <span className={`text-[10px] font-bold ${
              fund.netDebtEbitda < 1 ? 'text-emerald-400' : fund.netDebtEbitda < 2 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {fund.netDebtEbitda.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-400">Debt / Equity</span>
            <span className="text-[10px] text-white">{fund.debtEquity.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-400">Current Ratio</span>
            <span className={`text-[10px] font-bold ${fund.currentRatio > 1.5 ? 'text-emerald-400' : fund.currentRatio > 1 ? 'text-amber-400' : 'text-red-400'}`}>
              {fund.currentRatio.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Stress test */}
        {stress && (
          <div className="border-t border-white/5 pt-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-gray-500 font-semibold">СТРЕСС-ТЕСТ</span>
              <span className={`text-[10px] font-bold ${
                stress.level === 'strong' ? 'text-emerald-400' : stress.level === 'moderate' ? 'text-amber-400' : 'text-red-400'
              }`}>
                {stress.score}/100
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${
                stress.level === 'strong' ? 'bg-emerald-500' : stress.level === 'moderate' ? 'bg-amber-500' : 'bg-red-500'
              }`} style={{ width: `${stress.score}%` }} />
            </div>
            {stress.factors.slice(0, 3).map((f, i) => (
              <div key={i} className="text-[8px] text-gray-500">• {f}</div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
}

// ═══════════════════════════════════════════════════
// 4. Sector Compare — сравнение в секторе
// ═══════════════════════════════════════════════════
export function SectorCompareNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;
  const ticker = useSelectedTicker(nodes);
  const fund = STOCKS_FUNDAMENTAL[ticker];
  const sector = fund?.sector ?? 'Нефть и газ';

  const comparison = useMemo(() => getSectorComparison(sector), [sector]);

  return (
    <BaseNode icon="🏭" label="Sector Compare" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5 min-w-[220px]">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-500 font-semibold">Сектор: {sector}</span>
          <span className="text-[8px] text-gray-600">Avg P/E: {comparison.avgPe.toFixed(1)}</span>
        </div>

        <div className="space-y-1">
          {comparison.companies.map((c, i) => (
            <div key={c.ticker} className={`flex items-center gap-2 px-2 py-1 rounded ${
              c.ticker === ticker ? 'bg-indigo-500/15 border border-indigo-500/30' : 'bg-white/5'
            }`}>
              <span className={`text-[9px] font-bold w-3 ${i === 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                {i + 1}
              </span>
              <span className="text-[9px] text-white flex-1 font-semibold">{c.ticker}</span>
              <span className="text-[8px] text-gray-400">P/E {c.pe.toFixed(1)}</span>
              <span className="text-[8px] text-gray-400">ROE {c.roe.toFixed(0)}%</span>
              <div className={`text-[9px] font-bold px-1.5 rounded ${
                c.score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                c.score >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {c.score}
              </div>
            </div>
          ))}
        </div>

        {comparison.companies[0] && (
          <div className="text-[8px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1">
            🏆 Лучшая в секторе: <strong>{comparison.companies[0].name}</strong> (score {comparison.companies[0].score})
          </div>
        )}
      </div>
    </BaseNode>
  );
}

// ═══════════════════════════════════════════════════
// 5. Profitability — рентабельность
// ═══════════════════════════════════════════════════
export function ProfitabilityNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;
  const ticker = useSelectedTicker(nodes);
  const fund = STOCKS_FUNDAMENTAL[ticker];

  if (!fund) return null;

  const metrics = [
    { label: 'ROE', value: fund.roe, suffix: '%', good: 15 },
    { label: 'ROA', value: fund.roa, suffix: '%', good: 8 },
    { label: 'Net Margin', value: fund.netMargin, suffix: '%', good: 15 },
    { label: 'Oper Margin', value: fund.operMargin, suffix: '%', good: 20 },
  ];

  return (
    <BaseNode icon="📈" label="Profitability" category="analysis"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
      <div className="space-y-1.5 min-w-[200px]">
        <div className="text-[9px] text-gray-500 font-semibold">{fund.name} — Рентабельность</div>

        {metrics.map(m => (
          <div key={m.label} className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-[9px] text-gray-400">{m.label}</span>
              <span className={`text-[10px] font-bold ${m.value >= m.good ? 'text-emerald-400' : m.value > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {m.value.toFixed(1)}{m.suffix}
              </span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${m.value >= m.good ? 'bg-emerald-500' : m.value > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, (m.value / (m.good * 2)) * 100)}%` }} />
            </div>
          </div>
        ))}

        <div className="border-t border-white/5 pt-1">
          <div className="flex justify-between">
            <span className="text-[9px] text-gray-400">Div Yield</span>
            <span className={`text-[10px] font-bold ${fund.divYield > 8 ? 'text-emerald-400' : fund.divYield > 4 ? 'text-amber-400' : 'text-gray-400'}`}>
              {fund.divYield.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-gray-400">Чистая прибыль</span>
            <span className="text-[10px] text-white font-bold">{fund.netIncome} млрд ₽</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// ═══════════════════════════════════════════════════
// 6. Portfolio Score — итоговый скоринг
// ═══════════════════════════════════════════════════
export function PortfolioScoreNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const nodes = useFlowStore(s => s.nodes);
  const weight = (data.weight as number) ?? 0.5;
  const ticker = useSelectedTicker(nodes);
  const fund = STOCKS_FUNDAMENTAL[ticker];

  const score = useMemo(() => {
    if (!fund) return { total: 0, verdict: 'N/A', factors: [] as string[] };

    let total = 0;
    const factors: string[] = [];

    // Valuation (0-25)
    if (fund.pe < 6) { total += 25; factors.push('Низкий P/E — недооценена'); }
    else if (fund.pe < 12) { total += 15; factors.push('Умеренный P/E'); }
    else { total += 5; factors.push('Высокий P/E — дорого'); }

    // Profitability (0-25)
    if (fund.roe > 20) { total += 25; factors.push('Высокая рентабельность'); }
    else if (fund.roe > 10) { total += 15; factors.push('Нормальная рентабельность'); }
    else { total += 5; factors.push('Низкая рентабельность'); }

    // Cash Flow (0-25)
    if (fund.fcf > 0 && fund.fcfGrowth > 0) { total += 25; factors.push('FCF растёт'); }
    else if (fund.fcf > 0) { total += 15; factors.push('FCF положительный'); }
    else { total += 0; factors.push('FCF отрицательный — осторожно'); }

    // Debt (0-25)
    if (fund.netDebtEbitda < 1) { total += 25; factors.push('Минимальный долг'); }
    else if (fund.netDebtEbitda < 2) { total += 15; factors.push('Умеренный долг'); }
    else { total += 5; factors.push('Высокий долг'); }

    const verdict = total >= 80 ? 'STRONG BUY' : total >= 60 ? 'BUY' : total >= 40 ? 'HOLD' : 'AVOID';

    return { total, verdict, factors };
  }, [fund]);

  if (!fund) return null;

  const verdictColor: Record<string, string> = {
    'STRONG BUY': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'BUY': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'HOLD': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'AVOID': 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <BaseNode icon="🎯" label="Portfolio Score" category="output"
      weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })} outputs={0}>
      <div className="space-y-2 min-w-[200px]">
        <div className="text-[9px] text-gray-500 font-semibold">{fund.name} ({fund.ticker})</div>

        {/* Big score */}
        <div className="text-center py-2">
          <div className={`text-3xl font-black ${
            score.total >= 70 ? 'text-emerald-400' : score.total >= 50 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {score.total}
          </div>
          <div className="text-[8px] text-gray-500">из 100</div>
        </div>

        {/* Verdict */}
        <div className={`text-center py-1.5 rounded border text-[11px] font-black ${verdictColor[score.verdict] ?? ''}`}>
          {score.verdict}
        </div>

        {/* Factors */}
        <div className="space-y-0.5">
          {score.factors.map((f, i) => (
            <div key={i} className="text-[8px] text-gray-400 flex items-center gap-1">
              <span>{f.includes('осторожно') || f.includes('Высок') || f.includes('дорого') ? '⚠️' : '✅'}</span>
              {f}
            </div>
          ))}
        </div>

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
