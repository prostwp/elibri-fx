import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, LogOut, Save, ArrowLeft, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAuth } from '../../hooks/useAuth';
import { updateMe } from '../../lib/authClient';

export function ProfilePage() {
  const { user, profile, setProfile } = useAuthStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    const updated = await updateMe(displayName);
    if (!updated) {
      setMessage({ type: 'error', text: 'Failed to save. Try again.' });
    } else {
      setProfile(updated);
      setMessage({ type: 'success', text: 'Profile updated!' });
    }

    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const initials = (profile?.display_name ?? user?.email ?? 'U')
    .slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <button
          onClick={() => navigate('/app')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Strategy Builder
        </button>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {profile?.display_name ?? 'Trader'}
            </h1>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d0d14] p-6 mb-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-300 uppercase tracking-wider">Profile Info</h2>

          {message && (
            <div className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-sm border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success'
                ? <CheckCircle className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />}
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Display Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/20 py-2.5 pl-10 pr-4 text-sm text-slate-500 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {profile?.created_at && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar className="h-4 w-4" />
                Member since {formatDate(profile.created_at)}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {profile?.role === 'admin' && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 mb-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400 uppercase tracking-wider">
              <Shield className="h-4 w-4" />
              Admin Controls
            </h2>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2.5 text-sm font-medium text-amber-300 transition hover:bg-amber-500/30"
            >
              Open Admin Panel
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-[#0d0d14] p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-300 uppercase tracking-wider">Account</h2>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
