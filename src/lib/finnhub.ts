/**
 * Finnhub API — реальные новости и экономический календарь
 */

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY ?? '';
const BASE = 'https://finnhub.io/api/v1';

export interface FinnhubNews {
  id: number;
  headline: string;
  summary: string;
  source: string;
  datetime: number;
  url: string;
  category: string;
}

export interface FinnhubCalendarEvent {
  country: string;
  event: string;
  impact: string; // "low" | "medium" | "high"
  time: string;
  actual?: string;
  estimate?: string;
  prev?: string;
  unit?: string;
}

export interface NewsItem {
  title: string;
  time: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  source: string;
}

export interface CalendarItem {
  event: string;
  currency: string;
  impact: 'high' | 'medium' | 'low';
  forecast: string;
  previous: string;
  actual: string;
  time: string;
  minutesUntil: number;
}

// Simple keyword-based sentiment
function analyzeSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = text.toLowerCase();
  const bullish = ['rally', 'surge', 'gain', 'rise', 'bull', 'up', 'high', 'growth', 'strong', 'beat', 'exceed', 'positive', 'recovery', 'optimism'];
  const bearish = ['drop', 'fall', 'crash', 'decline', 'bear', 'down', 'low', 'weak', 'miss', 'cut', 'negative', 'fear', 'recession', 'loss'];

  let score = 0;
  for (const w of bullish) if (lower.includes(w)) score++;
  for (const w of bearish) if (lower.includes(w)) score--;

  return score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral';
}

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() / 1000) - timestamp);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Cache ──────────────────────────────────────
let newsCache: { data: NewsItem[]; timestamp: number } | null = null;
let calendarCache: { data: CalendarItem[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Fetch Forex News ───────────────────────────
export async function fetchForexNews(): Promise<NewsItem[]> {
  if (newsCache && Date.now() - newsCache.timestamp < CACHE_TTL) {
    return newsCache.data;
  }

  if (!API_KEY) return [];

  try {
    const res = await fetch(`${BASE}/news?category=forex&token=${API_KEY}`);
    if (!res.ok) throw new Error(`Finnhub news: ${res.status}`);

    const raw: FinnhubNews[] = await res.json();

    const items: NewsItem[] = raw.slice(0, 20).map(n => {
      const sentiment = analyzeSentiment(n.headline + ' ' + n.summary);
      return {
        title: n.headline,
        time: timeAgo(n.datetime),
        sentiment,
        impact: sentiment !== 'neutral' ? 'high' : 'medium',
        source: n.source,
      };
    });

    newsCache = { data: items, timestamp: Date.now() };
    return items;
  } catch (err) {
    console.error('Finnhub news error:', err);
    return [];
  }
}

// ─── Fetch Economic Calendar ────────────────────
export async function fetchEconomicCalendar(): Promise<CalendarItem[]> {
  if (calendarCache && Date.now() - calendarCache.timestamp < CACHE_TTL) {
    return calendarCache.data;
  }

  if (!API_KEY) return [];

  try {
    // Get events for today and next 3 days
    const from = new Date().toISOString().split('T')[0];
    const to = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

    const res = await fetch(`${BASE}/calendar/economic?from=${from}&to=${to}&token=${API_KEY}`);
    if (!res.ok) throw new Error(`Finnhub calendar: ${res.status}`);

    const raw = await res.json();
    const events: FinnhubCalendarEvent[] = raw.economicCalendar ?? [];

    // Filter for major currencies
    const majorCountries = ['US', 'EU', 'GB', 'JP', 'CH', 'AU', 'CA', 'NZ'];
    const countryToCurrency: Record<string, string> = {
      US: 'USD', EU: 'EUR', GB: 'GBP', JP: 'JPY', CH: 'CHF', AU: 'AUD', CA: 'CAD', NZ: 'NZD',
    };

    const items: CalendarItem[] = events
      .filter(e => majorCountries.includes(e.country))
      .slice(0, 20)
      .map(e => {
        const eventTime = new Date(e.time).getTime();
        const minutesUntil = Math.round((eventTime - Date.now()) / 60000);

        return {
          event: e.event,
          currency: countryToCurrency[e.country] ?? e.country,
          impact: (e.impact === 'high' ? 'high' : e.impact === 'medium' ? 'medium' : 'low') as CalendarItem['impact'],
          forecast: e.estimate ?? 'N/A',
          previous: e.prev ?? 'N/A',
          actual: e.actual ?? '-',
          time: e.time,
          minutesUntil,
        };
      })
      .sort((a, b) => a.minutesUntil - b.minutesUntil);

    calendarCache = { data: items, timestamp: Date.now() };
    return items;
  } catch (err) {
    console.error('Finnhub calendar error:', err);
    return [];
  }
}
