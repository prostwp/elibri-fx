import type { OHLCVCandle } from '../types/nodes';

function generateCandles(basePrice: number, count: number, volatility: number): OHLCVCandle[] {
  const candles: OHLCVCandle[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const interval = 3600; // 1h

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(Math.random() * 1000000) + 500000;

    candles.push({
      time: now - (count - i) * interval,
      open: Math.round(open * 100000) / 100000,
      high: Math.round(high * 100000) / 100000,
      low: Math.round(low * 100000) / 100000,
      close: Math.round(close * 100000) / 100000,
      volume,
    });
    price = close;
  }
  return candles;
}

export const FOREX_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'XAUUSD', 'USDCHF',
] as const;

export type ForexPair = typeof FOREX_PAIRS[number];

export const DEMO_PAIRS: Record<string, { candles: OHLCVCandle[]; displayName: string; pipSize: number }> = {
  EURUSD: { candles: generateCandles(1.0820, 200, 0.0035), displayName: 'EUR/USD', pipSize: 0.0001 },
  GBPUSD: { candles: generateCandles(1.2950, 200, 0.0045), displayName: 'GBP/USD', pipSize: 0.0001 },
  USDJPY: { candles: generateCandles(150.20, 200, 0.45), displayName: 'USD/JPY', pipSize: 0.01 },
  GBPJPY: { candles: generateCandles(194.80, 200, 0.65), displayName: 'GBP/JPY', pipSize: 0.01 },
  XAUUSD: { candles: generateCandles(3100, 200, 18), displayName: 'XAU/USD', pipSize: 0.01 },
  USDCHF: { candles: generateCandles(0.8780, 200, 0.003), displayName: 'USD/CHF', pipSize: 0.0001 },
};

export const MT5_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'] as const;

export const DEMO_NEWS = [
  { time: '12 min ago', title: 'US Non-Farm Payrolls beat expectations: 303K vs 200K forecast', sentiment: 'bullish' as const, impact: 'high' as const },
  { time: '1h ago', title: 'ECB holds rates steady at 4.50%, signals June cut possible', sentiment: 'bearish' as const, impact: 'high' as const },
  { time: '2h ago', title: 'Fed Chair Powell: "No rush to cut rates" — hawkish tone', sentiment: 'bearish' as const, impact: 'high' as const },
  { time: '3h ago', title: 'UK GDP grows 0.3% in February, above 0.1% forecast', sentiment: 'bullish' as const, impact: 'medium' as const },
  { time: '5h ago', title: 'BOJ hints at possible rate hike in April meeting', sentiment: 'bearish' as const, impact: 'high' as const },
  { time: '6h ago', title: 'Swiss CPI falls to 1.0% YoY — SNB rate cut on the table', sentiment: 'bearish' as const, impact: 'medium' as const },
  { time: '8h ago', title: 'China PMI rebounds to 51.2, manufacturing recovery signal', sentiment: 'bullish' as const, impact: 'low' as const },
  { time: '12h ago', title: 'Gold surges past $3000 on safe-haven demand', sentiment: 'bullish' as const, impact: 'medium' as const },
];

export const DEMO_CALENDAR = [
  { date: 'Today 14:30', event: 'US Non-Farm Payrolls', impact: 'high' as const, forecast: '200K', previous: '275K', currency: 'USD', minutesUntil: -30 },
  { date: 'Today 16:00', event: 'ISM Services PMI', impact: 'high' as const, forecast: '52.8', previous: '52.6', currency: 'USD', minutesUntil: 60 },
  { date: 'Tomorrow 09:30', event: 'UK Manufacturing PMI', impact: 'medium' as const, forecast: '49.9', previous: '49.3', currency: 'GBP', minutesUntil: 1200 },
  { date: 'Wed 14:00', event: 'FOMC Meeting Minutes', impact: 'high' as const, forecast: '-', previous: '-', currency: 'USD', minutesUntil: 2880 },
  { date: 'Thu 13:45', event: 'ECB Interest Rate Decision', impact: 'high' as const, forecast: '4.50%', previous: '4.50%', currency: 'EUR', minutesUntil: 4200 },
  { date: 'Thu 14:30', event: 'US CPI YoY', impact: 'high' as const, forecast: '3.1%', previous: '3.2%', currency: 'USD', minutesUntil: 4300 },
  { date: 'Fri 09:00', event: 'EU Flash GDP QoQ', impact: 'medium' as const, forecast: '0.1%', previous: '0.0%', currency: 'EUR', minutesUntil: 5400 },
];
