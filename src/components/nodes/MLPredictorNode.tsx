import { useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { DEMO_CRYPTO } from '../../lib/demoData';
import { predictCrypto } from '../../lib/mlClient';
import type { NodeProps } from '@xyflow/react';

const FEATURES = ['RSI', 'MACD', 'Volume', 'Volatility', 'Momentum', 'BB Position'];

export function MLPredictorNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const selectedPair = useFlowStore(s => s.selectedPair);
  const weight = (data.weight as number) ?? 1.0;

  const mlPredictions = useCryptoStore(s => s.mlPredictions);
  const mlStatus = useCryptoStore(s => s.mlStatus);
  const setMLPrediction = useCryptoStore(s => s.setMLPrediction);
  const setMLStatus = useCryptoStore(s => s.setMLStatus);
  const cryptoCandles = useCryptoStore(s => s.candles);

  const prediction = mlPredictions[selectedPair];
  const [localStatus, setLocalStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const runPrediction = useCallback(async () => {
    setLocalStatus('loading');
    setMLStatus('predicting');

    try {
      const candles = cryptoCandles[selectedPair] ?? DEMO_CRYPTO[selectedPair]?.candles ?? [];
      if (candles.length < 30) {
        setLocalStatus('error');
        setMLStatus('error');
        return;
      }

      const result = await predictCrypto(candles, FEATURES, selectedPair);
      setMLPrediction(selectedPair, result);
      setLocalStatus('ready');
      setMLStatus('idle');
      updateNodeData(id, { modelStatus: 'ready' });
    } catch {
      setLocalStatus('error');
      setMLStatus('error');
    }
  }, [selectedPair, cryptoCandles, setMLPrediction, setMLStatus, updateNodeData, id]);

  const statusDisplay = localStatus === 'loading' || mlStatus === 'predicting' ? 'loading' : prediction ? 'ready' : localStatus;

  return (
    <BaseNode
      id={id}
      icon="🧠"
      label="ML Predictor"
      category="agent"
      glowClass="node-glow-ai"
      weight={weight}
      onWeightChange={(w) => updateNodeData(id, { weight: w })}
    >
      <div className="space-y-2">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {statusDisplay === 'loading' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] text-amber-400">Training...</span>
              </>
            )}
            {statusDisplay === 'ready' && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-400">Ready</span>
              </>
            )}
            {statusDisplay === 'error' && (
              <>
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[10px] text-red-400">Error</span>
              </>
            )}
            {statusDisplay === 'idle' && (
              <>
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-[10px] text-gray-500">Untrained</span>
              </>
            )}
          </div>
          <button
            onClick={runPrediction}
            disabled={statusDisplay === 'loading'}
            className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          >
            {statusDisplay === 'loading' ? 'Running...' : 'Predict'}
          </button>
        </div>

        {/* Prediction result */}
        {prediction && (
          <div className="p-1.5 rounded bg-white/3 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${
                prediction.direction === 'buy' ? 'text-emerald-400' :
                prediction.direction === 'sell' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {prediction.direction === 'buy' ? '↗ LONG' : prediction.direction === 'sell' ? '↘ SHORT' : '→ NEUTRAL'}
              </span>
              <span className="text-[10px] text-white/60">
                {prediction.confidence}% conf
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-gray-500">Target: <span className="text-white/70">${prediction.priceTarget.toLocaleString()}</span></span>
              <span className="text-gray-500">{prediction.timeframe}</span>
            </div>
          </div>
        )}

        {/* Feature chips */}
        <div className="flex flex-wrap gap-1">
          {FEATURES.map(f => (
            <span key={f} className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300/70">
              {f}
            </span>
          ))}
        </div>
      </div>
    </BaseNode>
  );
}
