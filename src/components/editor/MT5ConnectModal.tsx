import { useState } from 'react';
import { useMT5Store } from '../../stores/useMT5Store';
import { connectMT5, disconnectMT5, getPositions, getCandles } from '../../lib/mt5';
import { FOREX_PAIRS } from '../../lib/demoData';

export function MT5ConnectModal() {
  const {
    showConnectModal, setShowConnectModal,
    status, setStatus, setError, error,
    setConfig, setAccount, account,
    setPositions, setCandles, disconnect,
  } = useMT5Store();

  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');

  if (!showConnectModal) return null;

  const isConnected = status === 'connected';

  const handleConnect = async () => {
    if (!token.trim() || !accountId.trim()) {
      setError('Enter both API token and Account ID');
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const acc = await connectMT5(token.trim(), accountId.trim());
      setAccount(acc);
      setConfig({ token: token.trim(), accountId: accountId.trim() });
      setStatus('connected');

      // Load positions
      const pos = await getPositions();
      setPositions(pos);

      // Load candles for all forex pairs
      for (const pair of FOREX_PAIRS) {
        try {
          const candles = await getCandles(pair, 'H1', 200);
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
    }
  };

  const handleDisconnect = () => {
    disconnectMT5();
    disconnect();
    setToken('');
    setAccountId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] bg-[#111118] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <span className="text-xl">📡</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">MetaTrader 5</h2>
              <p className="text-[10px] text-gray-500">Connect via MetaApi Cloud</p>
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
          {isConnected && account ? (
            // Connected state
            <>
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-sm font-semibold text-emerald-400">Connected</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Account" value={`#${account.login}`} />
                  <InfoRow label="Server" value={account.server} />
                  <InfoRow label="Balance" value={`${account.balance.toFixed(2)} ${account.currency}`} />
                  <InfoRow label="Equity" value={`${account.equity.toFixed(2)} ${account.currency}`} />
                  <InfoRow label="Leverage" value={`1:${account.leverage}`} />
                  <InfoRow label="Free Margin" value={`${account.freeMargin.toFixed(2)}`} />
                  {account.broker && <InfoRow label="Broker" value={account.broker} />}
                  {account.name && <InfoRow label="Name" value={account.name} />}
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
            // Disconnected state
            <>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                  MetaApi Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Your MetaApi API access token"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                  disabled={status === 'connecting'}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                  Account ID
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="MetaApi account ID (UUID)"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                  disabled={status === 'connecting'}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                  <p className="text-[11px] text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={status === 'connecting'}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  status === 'connecting'
                    ? 'bg-indigo-500/20 text-indigo-300 cursor-wait'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                }`}
              >
                {status === 'connecting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  'Connect to MT5'
                )}
              </button>

              <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  <span className="font-semibold text-gray-400">How to get credentials:</span><br/>
                  1. Sign up at <span className="text-indigo-400">metaapi.cloud</span><br/>
                  2. Create a MetaApi account linked to your MT5<br/>
                  3. Copy your API token and Account ID
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-[11px] text-white font-medium truncate">{value}</div>
    </div>
  );
}
