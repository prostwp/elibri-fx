import type { Node, Edge } from '@xyflow/react';

export type NodeCategory = 'source' | 'analysis' | 'logic' | 'agent' | 'output';
export type SegmentMode = 'beginner' | 'pro' | 'yolo';

export interface NodeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  icon: string;
  description: string;
  premium: boolean;
  inputs: string[];
  outputs: string[];
  defaultData: Record<string, unknown>;
}

export interface MarketPairData {
  pair: string;
  [key: string]: unknown;
}

export interface ChartSourceData {
  timeframe: string;
  [key: string]: unknown;
}

export interface TechnicalIndicatorData {
  indicators: string[];
  [key: string]: unknown;
}

export interface ConditionData {
  indicator: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  [key: string]: unknown;
}

export interface CombinerData {
  logic: 'AND' | 'OR';
  [key: string]: unknown;
}

export interface AIAgentData {
  prompt: string;
  [key: string]: unknown;
}

export interface DashboardData {
  widgets: string[];
  [key: string]: unknown;
}

export interface RiskCapData {
  maxDailyLoss: number;
  maxPositionSize: number;
  maxTradesPerDay: number;
  [key: string]: unknown;
}

export interface GuidedTraderData {
  level: 'beginner' | 'intermediate';
  [key: string]: unknown;
}

export type AppNode = Node;
export type AppEdge = Edge;

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult {
  name: string;
  value: number;
  signal: 'buy' | 'sell' | 'neutral';
  description: string;
}

export interface AIAnalysis {
  verdict: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  confidence: number;
  summary: string;
  signals: { name: string; direction: 'long' | 'short' | 'neutral'; strength: number }[];
  riskLevel: 'Low' | 'Medium' | 'High' | 'Extreme';
  riskMismatch: string | null;
  stopLoss: number;
  takeProfit: number;
  entry: number;
}

export interface BeginnerAnalysis extends AIAnalysis {
  whyExplanation: string;
  safeToTrade: boolean;
  steps: string[];
  lessonTip: string;
}

export interface YOLOAnalysis extends AIAnalysis {
  adrenalineMeter: number; // 0-100
  momentumScore: number;
  riskBudgetUsed: number; // percentage
  tradesUsed: number;
  maxTrades: number;
  dailyLossUsed: number;
  maxDailyLoss: number;
}
