/**
 * Macro calendar client — /api/v1/macrocal.
 *
 * Backend polls Finnhub every 1h; frontend polls backend every 5min.
 * Empty events array is a legitimate state (no high-impact US events
 * in the window), not an error.
 */

import { authHeaders } from './authClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080';

export interface MacroEvent {
  country: string;
  event: string;
  impact: 'low' | 'medium' | 'high';
  time: string;          // ISO8601 UTC
  estimate?: number;
  actual?: number;
  prev?: number;
}

export interface MacroCalendarResponse {
  events: MacroEvent[];
  blackout_active: boolean;
  blackout_event: string;
  blackout_minutes: number; // negative = before, positive = after
  config: {
    enabled: boolean;
    before_minutes: number;
    after_minutes: number;
    min_impact: 'low' | 'medium' | 'high';
  };
  last_fetch: string;
}

export async function fetchMacroCalendar(hours = 48): Promise<MacroCalendarResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/macrocal?hours=${hours}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Computes the nearest upcoming event with its minutes-from-now. Used by
 * the Toolbar chip to show either "🛑 FOMC in 25m" (blackout active) or
 * "⚠ CPI in 4h" (upcoming warning). Returns null when no events in window.
 */
export function nearestEvent(events: MacroEvent[]): { event: MacroEvent; minutesFromNow: number } | null {
  const now = Date.now();
  let best: { event: MacroEvent; minutesFromNow: number } | null = null;
  for (const e of events) {
    const t = new Date(e.time).getTime();
    const diffMin = Math.round((t - now) / 60_000);
    if (diffMin < -15) continue; // too far past
    if (!best || Math.abs(diffMin) < Math.abs(best.minutesFromNow)) {
      best = { event: e, minutesFromNow: diffMin };
    }
  }
  return best;
}
