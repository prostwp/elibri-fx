interface Signal {
  name: string;
  direction: 'long' | 'short' | 'neutral';
  strength: number;
}

interface SignalTableProps {
  signals: Signal[];
}

export function SignalTable({ signals }: SignalTableProps) {
  const longCount = signals.filter(s => s.direction === 'long').length;
  const shortCount = signals.filter(s => s.direction === 'short').length;
  const neutralCount = signals.filter(s => s.direction === 'neutral').length;
  const total = signals.length || 1;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(longCount / total) * 100}%` }} />
          <div className="bg-gray-500 transition-all duration-500" style={{ width: `${(neutralCount / total) * 100}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${(shortCount / total) * 100}%` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-gray-400">Long</span>
            <span className="text-[11px] font-bold text-white">{longCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-[10px] text-gray-400">Neutral</span>
            <span className="text-[11px] font-bold text-white">{neutralCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-gray-400">Short</span>
            <span className="text-[11px] font-bold text-white">{shortCount}</span>
          </div>
        </div>
      </div>

      {/* Signal list */}
      <div className="space-y-1">
        {signals.map((signal, i) => (
          <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-white/[0.02]">
            <span className={`w-1.5 h-1.5 rounded-full ${
              signal.direction === 'long' ? 'bg-emerald-500' :
              signal.direction === 'short' ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="flex-1 text-[10px] text-gray-400">{signal.name}</span>
            <span className={`text-[10px] font-semibold ${
              signal.direction === 'long' ? 'text-emerald-400' :
              signal.direction === 'short' ? 'text-red-400' : 'text-gray-500'
            }`}>
              {signal.direction === 'long' ? 'Long' : signal.direction === 'short' ? 'Short' : 'Neutral'}
            </span>
            <div className="w-12 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  signal.direction === 'long' ? 'bg-emerald-500' :
                  signal.direction === 'short' ? 'bg-red-500' : 'bg-gray-500'
                }`}
                style={{ width: `${signal.strength}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
