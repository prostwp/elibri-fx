import { create } from 'zustand';
import { listActiveScenarios, type ActiveScenario } from '../lib/scenarios';

/**
 * Cached list of user's active scenarios with a 30s auto-poll driven from
 * AppLayout. Consumers (Toolbar chip, Alerts page badge) read from here
 * instead of each fetching independently.
 *
 * Polling lifecycle:
 *   - AppLayout mount → startPolling()
 *   - AppLayout unmount / sign-out → stopPolling()
 *   - Activate/Stop actions → refresh() for immediate update
 */
interface ScenariosState {
  activeScenarios: ActiveScenario[];
  loading: boolean;
  lastFetchedAt: number | null;
  _timer: ReturnType<typeof setInterval> | null;

  refresh: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  reset: () => void;
}

export const useScenariosStore = create<ScenariosState>((set, get) => ({
  activeScenarios: [],
  loading: false,
  lastFetchedAt: null,
  _timer: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const data = await listActiveScenarios();
      set({ activeScenarios: data, loading: false, lastFetchedAt: Date.now() });
    } catch {
      set({ loading: false });
    }
  },

  startPolling: (intervalMs = 30_000) => {
    const existing = get()._timer;
    if (existing) return;            // Already polling.
    void get().refresh();            // Fire immediately on start.
    const t = setInterval(() => { void get().refresh(); }, intervalMs);
    set({ _timer: t });
  },

  stopPolling: () => {
    const t = get()._timer;
    if (t) {
      clearInterval(t);
      set({ _timer: null });
    }
  },

  reset: () => {
    const t = get()._timer;
    if (t) clearInterval(t);
    set({ activeScenarios: [], loading: false, lastFetchedAt: null, _timer: null });
  },
}));
