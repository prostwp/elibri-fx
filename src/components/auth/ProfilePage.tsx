import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Calendar, LogOut, Save, ArrowLeft,
  AlertCircle, CheckCircle, Shield, Send, Copy, Link as LinkIcon, Unlink, Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAuth } from '../../hooks/useAuth';
import { updateMe } from '../../lib/authClient';
import { linkTelegram, unlinkTelegram, type TelegramLinkResponse } from '../../lib/scenarios';

export function ProfilePage() {
  const { user, profile, setProfile, fetchProfile } = useAuthStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Telegram linking state
  const [linkData, setLinkData] = useState<TelegramLinkResponse | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

  // Clean up any polling on unmount.
  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  // Stop polling once the backend reflects a linked chat_id.
  useEffect(() => {
    if (profile?.telegram_chat_id && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      setTgPolling(false);
      setLinkData(null);
      setMessage({ type: 'success', text: 'Telegram linked! Alerts will arrive shortly.' });
    }
  }, [profile?.telegram_chat_id]);

  const handleLinkTelegram = async () => {
    setTgBusy(true);
    setMessage(null);
    const data = await linkTelegram();
    setTgBusy(false);
    if (!data) {
      setMessage({ type: 'error', text: 'Failed to generate link code. Please try again.' });
      return;
    }
    setLinkData(data);
    // Poll /auth/me every 8s for up to ~2 minutes to detect successful link.
    setTgPolling(true);
    pollAttemptsRef.current = 0;
    pollTimerRef.current = setInterval(() => {
      pollAttemptsRef.current++;
      void fetchProfile();
      if (pollAttemptsRef.current >= 15) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setTgPolling(false);
      }
    }, 8_000);
  };

  const handleUnlinkTelegram = async () => {
    setTgBusy(true);
    const ok = await unlinkTelegram();
    if (ok) {
      await fetchProfile();
      setMessage({ type: 'success', text: 'Telegram disconnected.' });
    } else {
      setMessage({ type: 'error', text: 'Failed to unlink. Try again.' });
    }
    setTgBusy(false);
  };

  const handleCopyDeeplink = async () => {
    if (!linkData?.deeplink) return;
    try {
      await navigator.clipboard.writeText(linkData.deeplink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — browser may block clipboard in non-secure contexts
    }
  };

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

        {/* Telegram alerts */}
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-6 mb-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-300 uppercase tracking-wider">
            <Send className="h-4 w-4" />
            Telegram Alerts
          </h2>
          {profile?.telegram_chat_id ? (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle className="h-4 w-4" />
                Connected
                <span className="text-xs text-slate-500">(chat #{profile.telegram_chat_id})</span>
              </div>
              <p className="mb-3 text-xs text-slate-400">
                Paper-trading signals are delivered to your Telegram in real-time.
              </p>
              <button
                onClick={handleUnlinkTelegram}
                disabled={tgBusy}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                {tgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                Disconnect Telegram
              </button>
            </div>
          ) : linkData ? (
            <div>
              <p className="mb-3 text-xs text-slate-300">
                Open Telegram and send <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sky-300">/link {linkData.code}</code> to the bot.
                {linkData.bot_username && (
                  <> Or just click the button below — it opens Telegram pre-filled.</>
                )}
              </p>
              {linkData.deeplink ? (
                <div className="mb-3 flex items-center gap-2">
                  <a
                    href={linkData.deeplink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-sky-500/20 px-3 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/30 transition"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Open in Telegram
                  </a>
                  <button
                    onClick={handleCopyDeeplink}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
                    title="Copy deeplink"
                  >
                    {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              ) : (
                <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                  Bot username not configured on the server — contact support or send the /link command manually.
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                {tgPolling ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Waiting for confirmation from Telegram…
                  </>
                ) : (
                  <>Code expired? <button onClick={handleLinkTelegram} className="underline hover:text-slate-300">Generate new</button></>
                )}
              </div>
              <p className="mt-2 text-[10px] text-slate-600 font-mono">Expires: {new Date(linkData.expires_at).toLocaleTimeString()}</p>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs text-slate-400">
                Connect Telegram to receive paper-trading signals (entry, SL, TP, size) on your phone in real-time.
              </p>
              <button
                onClick={handleLinkTelegram}
                disabled={tgBusy}
                className="flex items-center gap-2 rounded-lg bg-sky-500/90 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
              >
                {tgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                Link Telegram
              </button>
            </div>
          )}
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
