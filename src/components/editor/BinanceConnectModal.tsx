import { useState } from 'react';
import { useCryptoStore } from '../../stores/useCryptoStore';
import { connectBinance, disconnectBinance, getKlines } from '../../lib/binance';
import { CRYPTO_PAIRS } from '../../lib/demoData';

export function BinanceConnectModal() {
  const {
    showConnectModal, setShowConnectModal,
    status, setStatus, setError, error,
    setConfig, setCandles, disconnect,
  } = useCryptoStore();

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);

  if (!showConnectModal) return null;

  const isConnected = status === 'connected' || status === 'public';

  const handleConnect = async (publicMode = false) => {
    setLoading(true);
    setError(null);

    try {
      if (!publicMode) {
        if (!apiKey.trim() || !apiSecret.trim()) {
          setError('Enter both API Key and Secret');
          setLoading(false);
          return;
        }
        await connectBinance(apiKey.trim(), apiSecret.trim());
        setConfig({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
        setStatus('connected');
      } else {
        await connectBinance();
        setStatus('public');
      }

      // Load klines for all crypto pairs
      for (const pair of CRYPTO_PAIRS) {
        try {
          const candles = await getKlines(pair, 'H1', 200);
          if (candles.length > 0) {
            setCandles(pair, candles);
          }
        } catch {
          // Skip pairs that fail
        }
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectBinance();
    disconnect();
    setApiKey('');
    setApiSecret('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] bg-[#111118] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <span className="text-xl">₿</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Binance</h2>
              <p className="text-[10px] text-gray-500">Real-time crypto data</p>
            </div>
          </div>
          <button
            onClick={() => setShowConnectModal(false)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {isConnected ? (
            <>
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-sm font-semibold text-emerald-400">
                    {status === 'connected' ? 'Connected (Authenticated)' : 'Connected (Public Mode)'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {status === 'connected'
                    ? 'Full access — real-time prices, klines, and account data'
                    : 'Public access — real-time prices and klines only'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CRYPTO_PAIRS.map(p => (
                    <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-gray-400">
                      {p.replace('USDT', '')}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-[11px] text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Binance API key"
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">API Secret</label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Enter your Binance API secret"
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div className="text-[10px] text-gray-600">
                Get API keys from{' '}
                <span className="text-amber-400/70">binance.com → API Management</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleConnect(false)}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
                <button
                  onClick={() => handleConnect(true)}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-gray-400 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Public Mode
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
