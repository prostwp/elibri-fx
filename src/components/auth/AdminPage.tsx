import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, KeyRound, Shield, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { adminListUsers, adminResetPassword, type AuthUser } from '../../lib/authClient';

export function AdminPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore(s => s.user);

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ userId: string; tempPassword: string } | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Manual reload (e.g. after reset). Sets the spinner because this runs
  // from an event handler, not an effect — so it's safe to call setState sync.
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminListUsers();
      setUsers(list);
    } catch {
      setError('Failed to load users');
    }
    setLoading(false);
  };

  // Initial fetch — inline the promise chain so no setState runs synchronously
  // inside the effect body. `loading` already defaults to true so the UI
  // still shows the spinner on first render.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    adminListUsers()
      .then(list => {
        if (cancelled) return;
        setUsers(list);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Failed to load users');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAdmin]);

  const handleReset = async (userId: string) => {
    setResettingId(userId);
    setResetResult(null);
    const res = await adminResetPassword(userId);
    setResettingId(null);
    if (res.success && res.tempPassword) {
      setResetResult({ userId, tempPassword: res.tempPassword });
    } else {
      setError(res.error ?? 'Failed to reset password');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d0d14] p-8 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="mb-2 text-xl font-semibold text-white">Admin Access Required</h2>
          <p className="mb-6 text-sm text-slate-400">Your account does not have admin privileges.</p>
          <button
            onClick={() => navigate('/app')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Back to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate('/app')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Strategy Builder
        </button>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin Panel</h1>
            <p className="mt-1 text-sm text-slate-500">{users.length} user{users.length === 1 ? '' : 's'} registered</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {resetResult && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              Password reset — show this to the user:
            </div>
            <div className="flex items-center gap-2 rounded-md bg-slate-900/80 px-3 py-2 font-mono text-sm text-emerald-300">
              <span className="flex-1 select-all">{resetResult.tempPassword}</span>
              <button
                onClick={() => copyToClipboard(resetResult.tempPassword)}
                className="text-slate-400 hover:text-white transition"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              This is shown only once. The user should change it after first login.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-[#0d0d14] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No users yet</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-b border-slate-800/60 hover:bg-slate-900/30 transition">
                  <td className="px-4 py-3 text-sm text-white">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{u.display_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      u.role === 'admin'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleReset(u.id)}
                      disabled={resettingId === u.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-indigo-500/20 hover:border-indigo-500/40 hover:text-indigo-300 disabled:opacity-50"
                    >
                      {resettingId === u.id ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <KeyRound className="h-3 w-3" />
                      )}
                      {resettingId === u.id ? 'Resetting...' : 'Reset password'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
