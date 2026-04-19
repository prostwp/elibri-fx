/**
 * Plain-English trade summary builder.
 *
 * Takes graph result + nodes, returns a 1-2 sentence rationale explaining
 * the current trade setup. Used by both DashboardNode and PreviewPanel.
 */
import type { Node } from '@xyflow/react';
import type { GraphResult } from './graphEngine';

export function buildTradeSummary(nodes: Node[], graph: GraphResult): string {
  const ts = graph.tradeSetup;
  if (!ts) return 'No Risk Manager in graph — add one to see trade summary.';

  const dirLabel = ts.direction === 'buy' ? 'LONG' : ts.direction === 'sell' ? 'SHORT' : 'HOLD';
  const conf = Math.round(graph.confidence);

  // Pull MTF consensus from Crypto ML node data (set during predict).
  const cml = nodes.find(n => n.type === 'cryptoML');
  const mtf = cml?.data?.mtfConsensus as {
    direction?: string;
    alignment?: number;
    high_quality?: boolean;
  } | undefined;

  // Summarize strongest signal sources.
  const contributors = graph.signals
    .filter(s => Math.abs(s.signal) > 0.15 && s.weight > 0.05)
    .sort((a, b) => Math.abs(b.signal * b.weight) - Math.abs(a.signal * a.weight))
    .slice(0, 2)
    .map(s => prettyNodeName(s.nodeType))
    .filter(Boolean);

  // Case 1: explicit conflict → do not trade.
  if (ts.hasConflict && ts.direction !== 'hold') {
    return `Conflicting signals detected${mtf?.direction === 'mixed' ? ' across timeframes' : ''}. Size cut to ${ts.positionSize.toFixed(4)} units (×0.5). Wait for cleaner setup before entering.`;
  }

  // Case 2: no direction — hold.
  if (ts.direction === 'hold') {
    if (mtf?.direction === 'mixed') {
      return `Timeframes disagree (alignment ${Math.round((mtf.alignment ?? 0) * 100)}%). Do not trade — wait for higher-TF resolution.`;
    }
    return `No tradable edge right now (graph score ${graph.finalScore >= 0 ? '+' : ''}${graph.finalScore.toFixed(2)}, confidence ${conf}%). Hold and monitor.`;
  }

  // Case 3: tradable direction.
  const sourcesPhrase = contributors.length
    ? `${contributors.join(' and ')} support ${dirLabel}`
    : `Graph score ${graph.finalScore >= 0 ? '+' : ''}${graph.finalScore.toFixed(2)} → ${dirLabel}`;

  const mtfPhrase = mtf?.high_quality
    ? ' All timeframes aligned.'
    : mtf?.direction === 'mixed'
      ? ' Warning: timeframes not fully aligned — proceed with caution.'
      : '';

  const posPhrase = `Enter ${ts.positionSize.toFixed(ts.positionSize < 1 ? 4 : 2)} units at $${ts.entry.toFixed(2)}, stop $${ts.stopLoss.toFixed(2)}, target $${ts.takeProfit.toFixed(2)} (R:R 1:${ts.riskRewardRatio.toFixed(2)}, risking $${ts.riskDollars.toFixed(0)}).`;

  return `${sourcesPhrase} at ${conf}% confidence.${mtfPhrase} ${posPhrase}`;
}

export function prettyNodeName(type: string): string {
  const m: Record<string, string> = {
    cryptoML: 'Crypto ML',
    cryptoTechnical: 'Technical',
    cryptoFundamental: 'News sentiment',
    technicalIndicator: 'Indicators',
    newsFeed: 'News',
    sentiment: 'Sentiment',
    fundamental: 'Fundamentals',
    tradingAnalyst: 'Analyst',
    chartPattern: 'Chart patterns',
    tradingStyle: 'Trading style',
  };
  return m[type] ?? '';
}
