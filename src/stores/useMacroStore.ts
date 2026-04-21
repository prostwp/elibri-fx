import { create } from 'zustand';
import { fetchMacroCalendar, type MacroEvent, type MacroCalendarResponse } from '../lib/macrocal';

/**
 * Cached macro calendar with a 5-min poll. Consumed by the Toolbar chip
 * and (optionally) by EconomicCalendarNode. Started from AppLayout on
 * mount, stopped on unmount/sign-out.
 */
interface MacroState {
  data: MacroCalendarResponse | null;
  events: MacroEvent[];
  blackoutActive: boolean;
  loading: boolean;
  _timer: ReturnType<typeof setInterval> | null;

  refresh: () => Promise<void>;
  startPolling: (ms?: number) => void;
  stopPolling: () => void;
  reset: () => void;
}

export const useMacroStore = create<MacroState>((set, get) => ({
  data: null,
  events: [],
  blackoutActive: false,
  loading: false,
  _timer: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const data = await fetchMacroCalendar(48);
      if (data) {
        set({
          data,
          events: data.events,
          blackoutActive: data.blackout_active,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  startPolling: (ms = 300_000) => {
    if (get()._timer) return;
    void get().refresh();
    const t = setInterval(() => { void get().refresh(); }, ms);
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
    set({ data: null, events: [], blackoutActive: false, loading: false, _timer: null });
  },
}));
