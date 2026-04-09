/**
 * Stock Data — котировки + фундаментальные данные российских компаний
 * Котировки: Finnhub API (реалтайм)
 * Фундаментал: захардкожены реальные данные из отчётности 2024
 */

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY ?? '';

// ─── Типы ───────────────────────────────────────
export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
}

export interface FundamentalData {
  // Идентификация
  ticker: string;
  name: string;
  sector: string;
  reportType: 'МСФО' | 'РСБУ';

  // Мультипликаторы
  pe: number;           // P/E
  pb: number;           // P/B
  ps: number;           // P/S
  evEbitda: number;     // EV/EBITDA
  divYield: number;     // Дивидендная доходность %

  // Рентабельность
  roe: number;          // Return on Equity %
  roa: number;          // Return on Assets %
  netMargin: number;    // Чистая маржа %
  operMargin: number;   // Операционная маржа %

  // Денежные потоки (млрд руб)
  revenue: number;      // Выручка
  netIncome: number;    // Чистая прибыль
  ebitda: number;       // EBITDA
  fcf: number;          // Free Cash Flow
  capex: number;        // Капзатраты

  // Долговая нагрузка
  netDebt: number;          // Чистый долг (млрд)
  netDebtEbitda: number;    // Net Debt / EBITDA
  debtEquity: number;       // Debt / Equity
  currentRatio: number;     // Текущая ликвидность

  // LTM и динамика
  revenueGrowth: number;    // Рост выручки YoY %
  ebitdaGrowth: number;     // Рост EBITDA YoY %
  fcfGrowth: number;        // Рост FCF YoY %

  // Оценка
  marketCap: number;        // Капитализация (млрд руб)
  ev: number;               // Enterprise Value (млрд руб)
  fairValue: number;        // Справедливая цена (оценка)
  currentPrice: number;     // Текущая цена
  upside: number;           // Потенциал роста %
}

export interface SectorComparison {
  sector: string;
  companies: {
    ticker: string;
    name: string;
    pe: number;
    evEbitda: number;
    roe: number;
    divYield: number;
    score: number; // 0-100 composite
  }[];
  avgPe: number;
  avgEvEbitda: number;
}

// ─── Фундаментальные данные (реальные из отчётности 2024) ───
export const STOCKS_FUNDAMENTAL: Record<string, FundamentalData> = {
  'SBER': {
    ticker: 'SBER', name: 'Сбербанк', sector: 'Банки', reportType: 'МСФО',
    pe: 3.8, pb: 0.9, ps: 1.4, evEbitda: 0, divYield: 12.0,
    roe: 24.2, roa: 3.4, netMargin: 36.8, operMargin: 42.0,
    revenue: 3890, netIncome: 1508, ebitda: 0, fcf: 850, capex: 180,
    netDebt: 0, netDebtEbitda: 0, debtEquity: 0, currentRatio: 0,
    revenueGrowth: 18.5, ebitdaGrowth: 0, fcfGrowth: 22.0,
    marketCap: 5720, ev: 5720, fairValue: 340, currentPrice: 295,
    upside: 15.3,
  },
  'GAZP': {
    ticker: 'GAZP', name: 'Газпром', sector: 'Нефть и газ', reportType: 'МСФО',
    pe: 3.2, pb: 0.3, ps: 0.5, evEbitda: 2.8, divYield: 5.2,
    roe: 8.5, roa: 3.1, netMargin: 14.2, operMargin: 18.5,
    revenue: 8540, netIncome: 1214, ebitda: 2890, fcf: 420, capex: 2100,
    netDebt: 4200, netDebtEbitda: 1.45, debtEquity: 0.35, currentRatio: 1.2,
    revenueGrowth: -8.3, ebitdaGrowth: -12.5, fcfGrowth: -18.0,
    marketCap: 3890, ev: 8090, fairValue: 185, currentPrice: 164,
    upside: 12.8,
  },
  'LKOH': {
    ticker: 'LKOH', name: 'Лукойл', sector: 'Нефть и газ', reportType: 'МСФО',
    pe: 4.5, pb: 0.8, ps: 0.6, evEbitda: 2.5, divYield: 14.8,
    roe: 18.5, roa: 11.2, netMargin: 12.8, operMargin: 16.5,
    revenue: 8200, netIncome: 1050, ebitda: 1820, fcf: 780, capex: 520,
    netDebt: -450, netDebtEbitda: -0.25, debtEquity: 0.12, currentRatio: 1.8,
    revenueGrowth: 5.2, ebitdaGrowth: 8.3, fcfGrowth: 12.0,
    marketCap: 4730, ev: 4280, fairValue: 7800, currentPrice: 6850,
    upside: 13.9,
  },
  'YNDX': {
    ticker: 'YNDX', name: 'Яндекс', sector: 'IT', reportType: 'МСФО',
    pe: 28.5, pb: 5.2, ps: 3.8, evEbitda: 15.2, divYield: 0,
    roe: 18.2, roa: 8.5, netMargin: 13.5, operMargin: 10.2,
    revenue: 920, netIncome: 124, ebitda: 215, fcf: 95, capex: 85,
    netDebt: -180, netDebtEbitda: -0.84, debtEquity: 0.05, currentRatio: 2.5,
    revenueGrowth: 38.0, ebitdaGrowth: 45.0, fcfGrowth: 52.0,
    marketCap: 3540, ev: 3360, fairValue: 4500, currentPrice: 3850,
    upside: 16.9,
  },
  'GMKN': {
    ticker: 'GMKN', name: 'Норникель', sector: 'Металлургия', reportType: 'МСФО',
    pe: 8.2, pb: 3.5, ps: 2.1, evEbitda: 5.8, divYield: 6.5,
    roe: 42.5, roa: 15.8, netMargin: 25.5, operMargin: 38.0,
    revenue: 1180, netIncome: 301, ebitda: 520, fcf: 180, capex: 280,
    netDebt: 580, netDebtEbitda: 1.12, debtEquity: 0.85, currentRatio: 1.1,
    revenueGrowth: -5.2, ebitdaGrowth: -8.0, fcfGrowth: -15.0,
    marketCap: 2470, ev: 3050, fairValue: 175, currentPrice: 155,
    upside: 12.9,
  },
  'NLMK': {
    ticker: 'NLMK', name: 'НЛМК', sector: 'Металлургия', reportType: 'РСБУ',
    pe: 5.8, pb: 1.2, ps: 0.9, evEbitda: 3.5, divYield: 10.2,
    roe: 20.5, roa: 12.8, netMargin: 15.2, operMargin: 22.0,
    revenue: 850, netIncome: 129, ebitda: 245, fcf: 120, capex: 65,
    netDebt: 120, netDebtEbitda: 0.49, debtEquity: 0.28, currentRatio: 1.6,
    revenueGrowth: 3.5, ebitdaGrowth: 5.2, fcfGrowth: 8.0,
    marketCap: 750, ev: 870, fairValue: 145, currentPrice: 125,
    upside: 16.0,
  },
  'ROSN': {
    ticker: 'ROSN', name: 'Роснефть', sector: 'Нефть и газ', reportType: 'МСФО',
    pe: 3.9, pb: 0.6, ps: 0.5, evEbitda: 3.2, divYield: 8.5,
    roe: 16.8, roa: 7.2, netMargin: 12.5, operMargin: 18.8,
    revenue: 9800, netIncome: 1225, ebitda: 2850, fcf: 650, capex: 1200,
    netDebt: 4800, netDebtEbitda: 1.68, debtEquity: 0.65, currentRatio: 0.9,
    revenueGrowth: 8.2, ebitdaGrowth: 10.5, fcfGrowth: 5.0,
    marketCap: 4780, ev: 9580, fairValue: 520, currentPrice: 451,
    upside: 15.3,
  },
  'MTSS': {
    ticker: 'MTSS', name: 'МТС', sector: 'Телеком', reportType: 'МСФО',
    pe: 8.5, pb: 0, ps: 0.8, evEbitda: 3.8, divYield: 11.5,
    roe: 0, roa: 4.2, netMargin: 9.5, operMargin: 28.0,
    revenue: 640, netIncome: 61, ebitda: 295, fcf: 45, capex: 110,
    netDebt: 420, netDebtEbitda: 1.42, debtEquity: 0, currentRatio: 0.7,
    revenueGrowth: 12.0, ebitdaGrowth: 8.5, fcfGrowth: -5.0,
    marketCap: 520, ev: 940, fairValue: 290, currentPrice: 260,
    upside: 11.5,
  },
};

export const STOCK_TICKERS = Object.keys(STOCKS_FUNDAMENTAL);

export const SECTORS = [...new Set(Object.values(STOCKS_FUNDAMENTAL).map(s => s.sector))];

// ─── Котировки через Finnhub ────────────────────
let quoteCache: Record<string, { data: StockQuote; timestamp: number }> = {};
const QUOTE_TTL = 60_000; // 1 minute

export async function fetchStockQuote(ticker: string): Promise<StockQuote | null> {
  const cached = quoteCache[ticker];
  if (cached && Date.now() - cached.timestamp < QUOTE_TTL) {
    return cached.data;
  }

  if (!FINNHUB_KEY) return null;

  try {
    // Finnhub использует .ME суффикс для Мосбиржи
    const symbol = `${ticker}.ME`;
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return null;

    const raw = await res.json();
    if (!raw.c || raw.c === 0) return null;

    const quote: StockQuote = {
      symbol: ticker,
      price: raw.c,
      change: raw.d ?? 0,
      changePercent: raw.dp ?? 0,
      high: raw.h ?? raw.c,
      low: raw.l ?? raw.c,
      open: raw.o ?? raw.c,
      prevClose: raw.pc ?? raw.c,
      timestamp: Date.now(),
    };

    quoteCache[ticker] = { data: quote, timestamp: Date.now() };
    return quote;
  } catch (err) {
    console.error(`Quote error for ${ticker}:`, err);
    return null;
  }
}

// ─── Сравнение по сектору ───────────────────────
export function getSectorComparison(sector: string): SectorComparison {
  const companies = Object.values(STOCKS_FUNDAMENTAL)
    .filter(s => s.sector === sector)
    .map(s => {
      // Composite score: lower P/E + lower EV/EBITDA + higher ROE + higher DivYield = better
      const peScore = s.pe > 0 ? Math.max(0, 100 - s.pe * 5) : 50;
      const evScore = s.evEbitda > 0 ? Math.max(0, 100 - s.evEbitda * 8) : 50;
      const roeScore = Math.min(100, s.roe * 3);
      const divScore = Math.min(100, s.divYield * 8);
      const score = Math.round((peScore + evScore + roeScore + divScore) / 4);

      return {
        ticker: s.ticker,
        name: s.name,
        pe: s.pe,
        evEbitda: s.evEbitda,
        roe: s.roe,
        divYield: s.divYield,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const avgPe = companies.reduce((s, c) => s + c.pe, 0) / (companies.length || 1);
  const avgEvEbitda = companies.reduce((s, c) => s + c.evEbitda, 0) / (companies.length || 1);

  return { sector, companies, avgPe, avgEvEbitda };
}

// ─── Оценка стресс-устойчивости ─────────────────
export function getStressScore(data: FundamentalData): {
  score: number; // 0-100
  level: 'strong' | 'moderate' | 'weak';
  factors: string[];
} {
  let score = 50;
  const factors: string[] = [];

  // FCF positive
  if (data.fcf > 0) { score += 15; factors.push('FCF положительный'); }
  else { score -= 20; factors.push('FCF отрицательный — риск'); }

  // Net Debt / EBITDA
  if (data.netDebtEbitda < 1) { score += 15; factors.push('Низкая долговая нагрузка'); }
  else if (data.netDebtEbitda < 2) { score += 5; factors.push('Умеренный долг'); }
  else { score -= 15; factors.push('Высокий долг — стресс-риск'); }

  // Current Ratio
  if (data.currentRatio > 1.5) { score += 10; factors.push('Хорошая ликвидность'); }
  else if (data.currentRatio < 1) { score -= 10; factors.push('Низкая ликвидность'); }

  // Revenue growth
  if (data.revenueGrowth > 10) { score += 10; factors.push('Сильный рост выручки'); }
  else if (data.revenueGrowth < 0) { score -= 10; factors.push('Выручка падает'); }

  // Dividends
  if (data.divYield > 8) { score += 5; factors.push('Высокие дивиденды'); }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return { score, level, factors };
}
