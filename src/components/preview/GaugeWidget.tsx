import { useMemo } from 'react';

interface GaugeWidgetProps {
  verdict: string;
  confidence: number;
}

export function GaugeWidget({ verdict, confidence }: GaugeWidgetProps) {
  const angle = useMemo(() => {
    const map: Record<string, number> = {
      'Strong Sell': -80,
      'Sell': -45,
      'Neutral': 0,
      'Buy': 45,
      'Strong Buy': 80,
    };
    return map[verdict] ?? 0;
  }, [verdict]);

  const color = useMemo(() => {
    if (verdict.includes('Buy')) return '#10b981';
    if (verdict.includes('Sell')) return '#ef4444';
    return '#f59e0b';
  }, [verdict]);

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="100" viewBox="0 0 180 100">
        {/* Background arc */}
        <path
          d="M 15 90 A 75 75 0 0 1 165 90"
          fill="none"
          stroke="#1e1e2e"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Colored sections */}
        <path d="M 15 90 A 75 75 0 0 1 45 30" fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <path d="M 45 30 A 75 75 0 0 1 75 12" fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <path d="M 75 12 A 75 75 0 0 1 105 12" fill="none" stroke="#eab308" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <path d="M 105 12 A 75 75 0 0 1 135 30" fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
        <path d="M 135 30 A 75 75 0 0 1 165 90" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" opacity="0.3" />

        {/* Needle */}
        <g transform={`rotate(${angle}, 90, 90)`}>
          <line x1="90" y1="90" x2="90" y2="25" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="90" cy="90" r="5" fill={color} />
        </g>

        {/* Labels */}
        <text x="10" y="98" fontSize="9" fill="#6b7280" fontWeight="500">Sell</text>
        <text x="80" y="8" fontSize="9" fill="#6b7280" fontWeight="500" textAnchor="middle">Neutral</text>
        <text x="170" y="98" fontSize="9" fill="#6b7280" fontWeight="500" textAnchor="end">Buy</text>
      </svg>

      <div className="mt-1 text-center">
        <div className="text-lg font-bold" style={{ color }}>{verdict}</div>
        <div className="text-[10px] text-gray-500">Confidence: {confidence}%</div>
      </div>
    </div>
  );
}
