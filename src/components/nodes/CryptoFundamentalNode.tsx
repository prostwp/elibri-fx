import { useEffect, useMemo, useState } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { fetchFundamentalNews, type NewsAggregate } from '../../lib/backendClient';
import type { NodeProps } from '@xyflow/react';

const CATEGORIES = ['macro', 'geopolitics', 'regulation', 'adoption', 'crypto', 'social'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_LABEL: Record<Category, string> = {
  macro: 'Macro',
  geopolitics: 'Geopolitics',
  regulation: 'Regulation',
  adoption: 'Adoption',
  crypto: 'Crypto',
  social: 'Social',
};

const CATEGORY_COLOR: Record<Category, string> = {
  macro: 'bg-blue-500/20 text-blue-300',
  geopolitics: 'bg-red-500/20 text-red-300',
  regulation: 'bg-amber-500/20 text-amber-300',
  adoption: 'bg-emerald-500/20 text-emerald-300',
  crypto: 'bg-purple-500/20 text-purple-300',
  social: 'bg-sky-500/20 text-sky-300',
};

function isCryptoPair(pair: string): boolean {
  return pair.endsWith('USDT') || pair.endsWith('BUSD');
}

export function CryptoFundamentalNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const selectedPair = useFlowStore(s => s.selectedPair);
  const activePair = isCryptoPair(selectedPair) ? selectedPair : 'BTCUSDT';
  const weight = (data.weight as number) ?? 0.5;
  const enabledCats = useMemo(
    () => (data.categories as Category[]) || ['macro', 'geopolitics', 'regulation', 'social'],
    [data.categories],
  );
  const hours = (data.hours as number) || 24;

  const [news, setNews] = useState<NewsAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const setNewsAggregate = useCryptoStore(s => s.setNewsAggregate);

  const toggleCategory = (cat: Category) => {
    const next = enabledCats.includes(cat)
      ? enabledCats.filter(c => c !== cat)
      : [...enabledCats, cat];
    updateNodeData(id, { categories: next });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFundamentalNews(activePair, hours)
      .then(res => {
        if (!cancelled) {
          setNews(res);
          if (res) setNewsAggregate(activePair, res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activePair, hours, setNewsAggregate]);

  const filtered = useMemo(() => {
    if (!news) return [];
    return news.items.filter(it =>
      enabledCats.includes(it.category as Category) ||
      (enabledCats.includes('crypto') &&
        (it.source === 'coindesk' || it.source === 'cointelegraph')),
    );
  }, [news, enabledCats]);

  const visible = filtered.slice(0, expanded ? 5 : 2);

  // Recompute sentiment from filtered subset
  const filteredSentiment = useMemo(() => {
    if (filtered.length === 0) return 0;
    let weightedSum = 0;
    let weightTotal = 0;
    const now = Date.now();
    for (const it of filtered) {
      const pub = new Date(it.published_at).getTime();
      const hoursOld = (now - pub) / (1000 * 60 * 60);
      const w = 1 / (1 + hoursOld / 6);
      weightedSum += it.sentiment * w;
      weightTotal += w;
    }
    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  }, [filtered]);

  const verdict = filteredSentiment > 0.15 ? 'bull' : filteredSentiment < -0.15 ? 'bear' : 'neutral';
  const verdictColor = verdict === 'bull' ? 'text-emerald-400' : verdict === 'bear' ? 'text-red-400' : 'text-gray-400';
  const verdictIcon = verdict === 'bull' ? '▲' : verdict === 'bear' ? '▼' : '—';

  return (
    <BaseNode
      id={id}
      icon="📰"
      label="Crypto Fundamental"
      category="analysis"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-1.5 w-[240px]">
        {/* Category filters */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => {
            const on = enabledCats.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`
                  text-[9px] px-1.5 py-0.5 rounded transition-all
                  ${on
                    ? CATEGORY_COLOR[cat] + ' font-semibold'
                    : 'bg-white/5 text-gray-500 hover:bg-white/10'}
                `}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            );
          })}
        </div>

        {/* Aggregate verdict */}
        <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
          <span className="text-[10px] text-white/70">
            {filtered.length} news in last {hours}h
          </span>
          <span className={`text-[11px] font-bold ${verdictColor}`}>
            {verdictIcon} {filteredSentiment >= 0 ? '+' : ''}{filteredSentiment.toFixed(2)}
          </span>
        </div>

        {/* Headlines (2 by default, 5 when expanded) */}
        {loading ? (
          <div className="text-[9px] text-gray-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-[9px] text-gray-500">No news matching filter</div>
        ) : (
          <div className="space-y-1">
            {visible.map((it, i) => {
              const sentClass = it.sentiment > 0.15
                ? 'text-emerald-400/80'
                : it.sentiment < -0.15
                  ? 'text-red-400/80'
                  : 'text-gray-400';
              const sourceShort: Record<string, string> = {
                finnhub: 'FH',
                coindesk: 'CD',
                cointelegraph: 'CT',
                alphavantage: 'AV',
                reddit: 'R',
                'lunarcrush-tweet': '𝕏',
                'lunarcrush-reddit-post': 'R',
                'lunarcrush-news': 'LC',
              };
              const srcLabel = sourceShort[it.source] ?? it.source.slice(0, 2).toUpperCase();
              const isSocial = it.source === 'reddit' || it.source.startsWith('lunarcrush-');
              const isKOL = isSocial && it.mentions_coin; // backend flagged verified KOL / high-signal
              return (
                <div
                  key={i}
                  className={`text-[9px] leading-snug flex items-start gap-1 rounded px-1 py-0.5 ${
                    isKOL ? 'bg-sky-500/10 border border-sky-500/30' :
                    it.mentions_coin ? 'bg-amber-500/10 border border-amber-500/20' :
                    'bg-white/3'
                  }`}
                >
                  <span className={`${sentClass} font-bold text-[10px] shrink-0`}>
                    {it.sentiment > 0.15 ? '▲' : it.sentiment < -0.15 ? '▼' : '●'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white/85 line-clamp-1" title={it.headline}>
                      {isKOL && (
                        <span className="text-[8px] font-bold text-sky-400 mr-0.5" title="Verified crypto influencer">⚡ KOL</span>
                      )}
                      {!isSocial && it.mentions_coin && (
                        <span className="text-[8px] font-bold text-amber-400 mr-0.5">[{activePair.replace('USDT', '')}]</span>
                      )}
                      {it.headline}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] px-1 py-0 rounded bg-slate-700/60 text-slate-300 font-mono">{srcLabel}</span>
                      <span className="text-[7px] text-gray-600">
                        {CATEGORY_LABEL[it.category as Category] ?? it.category}
                      </span>
                      {isSocial && it.summary && (
                        <span className="text-[7px] text-sky-400/80 truncate" title={it.summary}>
                          {it.summary.split('·')[0]?.trim()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Expand toggle */}
        {filtered.length > 2 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full text-[9px] text-indigo-400/80 hover:text-indigo-300 text-center py-0.5 rounded hover:bg-white/5 transition"
          >
            {expanded ? '▲ Collapse' : `▼ ${Math.min(filtered.length - 2, 3)} more`}
          </button>
        )}
      </div>
    </BaseNode>
  );
}
