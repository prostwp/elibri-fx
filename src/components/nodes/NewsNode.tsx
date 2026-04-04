import { useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { DEMO_NEWS } from '../../lib/demoData';
import { fetchForexNews, type NewsItem } from '../../lib/finnhub';
import type { NodeProps } from '@xyflow/react';

export function NewsNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const weight = (data.weight as number) ?? 0.5;

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchForexNews().then(items => {
      if (cancelled) return;
      if (items.length > 0) {
        setNews(items);
        setIsLive(true);
      } else {
        // Fallback to demo
        setNews(DEMO_NEWS.map(n => ({
          title: n.title,
          time: n.time,
          sentiment: n.sentiment as NewsItem['sentiment'],
          impact: n.impact as NewsItem['impact'],
          source: 'Demo',
        })));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <BaseNode icon="📰" label="News Feed" category="source" inputs={0} weight={weight} onWeightChange={(w) => updateNodeData(id, { weight: w })}>
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
            {news.slice(0, 6).map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5">
                <span className={`text-[10px] mt-0.5 ${
                  item.sentiment === 'bullish' ? 'text-emerald-400' :
                  item.sentiment === 'bearish' ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {item.sentiment === 'bullish' ? '▲' : item.sentiment === 'bearish' ? '▼' : '●'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] leading-tight text-gray-300 line-clamp-2">{item.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[8px] text-gray-600">{item.time}</span>
                    {item.source && <span className="text-[8px] text-gray-600">{item.source}</span>}
                    <span className={`text-[7px] font-bold px-1 rounded ${
                      item.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                      item.impact === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {item.impact.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
