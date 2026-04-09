import type { Node, Edge } from '@xyflow/react';
import type { SegmentMode } from '../types/nodes';

interface Template {
  name: string;
  description: string;
  icon: string;
  segment: SegmentMode;
  nodes: Node[];
  edges: Edge[];
}

const edgeStyle = { stroke: '#6366f1', strokeWidth: 2 };

export const TEMPLATES: Template[] = [
  {
    name: 'Safe Start',
    description: 'Beginner-friendly with explanations',
    icon: '🎓',
    segment: 'beginner',
    nodes: [
      { id: 'mp1', type: 'marketPair', position: { x: 50, y: 180 }, data: { pair: 'EURUSD' } },
      { id: 'cs1', type: 'chartSource', position: { x: 280, y: 100 }, data: { timeframe: 'H4' } },
      { id: 'nf1', type: 'newsFeed', position: { x: 280, y: 320 }, data: {} },
      { id: 'ti1', type: 'technicalIndicator', position: { x: 530, y: 60 }, data: { indicators: ['RSI', 'EMA', 'Bollinger Bands'] } },
      { id: 'cd1', type: 'condition', position: { x: 530, y: 260 }, data: { indicator: 'RSI', operator: '<', value: 30 } },
      { id: 'gt1', type: 'guidedTrader', position: { x: 800, y: 120 }, data: { level: 'beginner' } },
      { id: 'rm1', type: 'riskManager', position: { x: 800, y: 340 }, data: {} },
      { id: 'db1', type: 'dashboard', position: { x: 1070, y: 220 }, data: {} },
    ],
    edges: [
      { id: 'e1', source: 'mp1', target: 'cs1', animated: true, style: edgeStyle },
      { id: 'e2', source: 'mp1', target: 'nf1', animated: true, style: edgeStyle },
      { id: 'e3', source: 'cs1', target: 'ti1', animated: true, style: edgeStyle },
      { id: 'e4', source: 'cs1', target: 'cd1', animated: true, style: edgeStyle },
      { id: 'e5', source: 'ti1', target: 'gt1', animated: true, style: edgeStyle },
      { id: 'e6', source: 'nf1', target: 'gt1', animated: true, style: edgeStyle },
      { id: 'e7', source: 'cd1', target: 'gt1', animated: true, style: edgeStyle },
      { id: 'e8', source: 'gt1', target: 'rm1', animated: true, style: edgeStyle },
      { id: 'e9', source: 'gt1', target: 'db1', animated: true, style: edgeStyle },
      { id: 'e10', source: 'rm1', target: 'db1', animated: true, style: edgeStyle },
    ],
  },
  {
    name: 'News Sniper',
    description: 'Trade the news like a pro',
    icon: '📰',
    segment: 'pro',
    nodes: [
      { id: 'mp1', type: 'marketPair', position: { x: 50, y: 200 }, data: { pair: 'GBPUSD' } },
      { id: 'nf1', type: 'newsFeed', position: { x: 300, y: 80 }, data: {} },
      { id: 'ec1', type: 'economicCalendar', position: { x: 300, y: 280 }, data: {} },
      { id: 'cs1', type: 'chartSource', position: { x: 300, y: 460 }, data: { timeframe: 'M15' } },
      { id: 'sn1', type: 'sentiment', position: { x: 570, y: 80 }, data: {} },
      { id: 'fn1', type: 'fundamental', position: { x: 570, y: 280 }, data: {} },
      { id: 'ti1', type: 'technicalIndicator', position: { x: 570, y: 460 }, data: { indicators: ['RSI', 'MACD'] } },
      { id: 'ta1', type: 'tradingAnalyst', position: { x: 850, y: 180 }, data: {} },
      { id: 'rm1', type: 'riskManager', position: { x: 850, y: 380 }, data: {} },
      { id: 'db1', type: 'dashboard', position: { x: 1130, y: 280 }, data: {} },
    ],
    edges: [
      { id: 'e1', source: 'mp1', target: 'nf1', animated: true, style: edgeStyle },
      { id: 'e2', source: 'mp1', target: 'ec1', animated: true, style: edgeStyle },
      { id: 'e3', source: 'mp1', target: 'cs1', animated: true, style: edgeStyle },
      { id: 'e4', source: 'nf1', target: 'sn1', animated: true, style: edgeStyle },
      { id: 'e5', source: 'ec1', target: 'fn1', animated: true, style: edgeStyle },
      { id: 'e6', source: 'cs1', target: 'ti1', animated: true, style: edgeStyle },
      { id: 'e7', source: 'sn1', target: 'ta1', animated: true, style: edgeStyle },
      { id: 'e8', source: 'fn1', target: 'ta1', animated: true, style: edgeStyle },
      { id: 'e9', source: 'ti1', target: 'ta1', animated: true, style: edgeStyle },
      { id: 'e10', source: 'ta1', target: 'rm1', animated: true, style: edgeStyle },
      { id: 'e11', source: 'ta1', target: 'db1', animated: true, style: edgeStyle },
      { id: 'e12', source: 'rm1', target: 'db1', animated: true, style: edgeStyle },
    ],
  },
  {
    name: 'YOLO Mode',
    description: 'High-risk controlled gambling',
    icon: '🔥',
    segment: 'yolo',
    nodes: [
      { id: 'mp1', type: 'marketPair', position: { x: 50, y: 180 }, data: { pair: 'GBPJPY' } },
      { id: 'cs1', type: 'chartSource', position: { x: 280, y: 100 }, data: { timeframe: 'M5' } },
      { id: 'nf1', type: 'newsFeed', position: { x: 280, y: 320 }, data: {} },
      { id: 'ti1', type: 'technicalIndicator', position: { x: 530, y: 60 }, data: { indicators: ['MACD', 'Bollinger Bands', 'RSI'] } },
      { id: 'cb1', type: 'combiner', position: { x: 530, y: 260 }, data: { logic: 'OR' } },
      { id: 'ta1', type: 'tradingAnalyst', position: { x: 800, y: 120 }, data: {} },
      { id: 'rc1', type: 'riskCap', position: { x: 800, y: 340 }, data: { maxDailyLoss: 500, maxPositionSize: 1.0, maxTradesPerDay: 10 } },
      { id: 'db1', type: 'dashboard', position: { x: 1070, y: 220 }, data: {} },
    ],
    edges: [
      { id: 'e1', source: 'mp1', target: 'cs1', animated: true, style: edgeStyle },
      { id: 'e2', source: 'mp1', target: 'nf1', animated: true, style: edgeStyle },
      { id: 'e3', source: 'cs1', target: 'ti1', animated: true, style: edgeStyle },
      { id: 'e4', source: 'ti1', target: 'cb1', animated: true, style: edgeStyle },
      { id: 'e5', source: 'nf1', target: 'cb1', animated: true, style: edgeStyle },
      { id: 'e6', source: 'cb1', target: 'ta1', animated: true, style: edgeStyle },
      { id: 'e7', source: 'ta1', target: 'rc1', animated: true, style: edgeStyle },
      { id: 'e8', source: 'ta1', target: 'db1', animated: true, style: edgeStyle },
      { id: 'e9', source: 'rc1', target: 'db1', animated: true, style: edgeStyle },
    ],
  },

  // ─── T-Invest Fundamental ───────────────────────
  {
    name: 'T-Invest Fundamental',
    description: 'Полный фундаментальный анализ акции для Т-Инвестиций',
    icon: '🏛️',
    segment: 'pro' as SegmentMode,
    nodes: [
      // Col 1: Stock Analyzer (source)
      { id: 'sa1', type: 'stockAnalysis', position: { x: 0, y: 200 }, data: { ticker: 'SBER', weight: 0.8 } },
      // Col 2: First analysis layer
      { id: 'rs1', type: 'reportSelector', position: { x: 380, y: 0 }, data: { weight: 0.3 } },
      { id: 'cf1', type: 'cashFlow', position: { x: 380, y: 280 }, data: { weight: 0.7 } },
      { id: 'da1', type: 'debtAnalysis', position: { x: 380, y: 560 }, data: { weight: 0.6 } },
      // Col 3: Second analysis layer
      { id: 'pf1', type: 'profitability', position: { x: 760, y: 0 }, data: { weight: 0.7 } },
      { id: 'sc1', type: 'sectorCompare', position: { x: 760, y: 320 }, data: { weight: 0.5 } },
      // Col 4: Output
      { id: 'ps1', type: 'portfolioScore', position: { x: 1120, y: 200 }, data: { weight: 1.0 } },
    ],
    edges: [
      { id: 'fe1', source: 'sa1', target: 'rs1', animated: true, style: edgeStyle },
      { id: 'fe2', source: 'sa1', target: 'cf1', animated: true, style: edgeStyle },
      { id: 'fe3', source: 'sa1', target: 'da1', animated: true, style: edgeStyle },
      { id: 'fe4', source: 'rs1', target: 'pf1', animated: true, style: edgeStyle },
      { id: 'fe5', source: 'cf1', target: 'pf1', animated: true, style: edgeStyle },
      { id: 'fe6', source: 'cf1', target: 'sc1', animated: true, style: edgeStyle },
      { id: 'fe7', source: 'da1', target: 'sc1', animated: true, style: edgeStyle },
      { id: 'fe8', source: 'pf1', target: 'ps1', animated: true, style: edgeStyle },
      { id: 'fe9', source: 'sc1', target: 'ps1', animated: true, style: edgeStyle },
      { id: 'fe10', source: 'da1', target: 'ps1', animated: true, style: edgeStyle },
    ],
  },
];
