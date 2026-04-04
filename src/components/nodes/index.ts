export { MarketPairNode } from './MarketPairNode';
export { ChartSourceNode } from './ChartSourceNode';
export { TechnicalIndicatorNode } from './TechnicalIndicatorNode';
export { NewsNode } from './NewsNode';
export { EconomicCalendarNode } from './EconomicCalendarNode';
export { ChartPatternNode, SentimentNode, FundamentalNode, PsychProfileNode } from './PremiumNode';
export { ConditionNode } from './ConditionNode';
export { CombinerNode } from './CombinerNode';
export { TradingAnalystNode } from './TradingAnalystNode';
export { RiskManagerNode } from './RiskManagerNode';
export { GuidedTraderNode } from './GuidedTraderNode';
export { RiskCapNode } from './RiskCapNode';
export { DashboardNode } from './DashboardNode';

import type { ComponentType } from 'react';
import type { NodeProps } from '@xyflow/react';
import { MarketPairNode } from './MarketPairNode';
import { ChartSourceNode } from './ChartSourceNode';
import { TechnicalIndicatorNode } from './TechnicalIndicatorNode';
import { NewsNode } from './NewsNode';
import { EconomicCalendarNode } from './EconomicCalendarNode';
import { ChartPatternNode, SentimentNode, FundamentalNode, PsychProfileNode } from './PremiumNode';
import { ConditionNode } from './ConditionNode';
import { CombinerNode } from './CombinerNode';
import { TradingAnalystNode } from './TradingAnalystNode';
import { RiskManagerNode } from './RiskManagerNode';
import { GuidedTraderNode } from './GuidedTraderNode';
import { RiskCapNode } from './RiskCapNode';
import { DashboardNode } from './DashboardNode';

export const nodeTypes: Record<string, ComponentType<NodeProps>> = {
  marketPair: MarketPairNode,
  chartSource: ChartSourceNode,
  technicalIndicator: TechnicalIndicatorNode,
  newsFeed: NewsNode as ComponentType<NodeProps>,
  economicCalendar: EconomicCalendarNode as ComponentType<NodeProps>,
  chartPattern: ChartPatternNode as ComponentType<NodeProps>,
  sentiment: SentimentNode as ComponentType<NodeProps>,
  fundamental: FundamentalNode as ComponentType<NodeProps>,
  psychProfile: PsychProfileNode as ComponentType<NodeProps>,
  condition: ConditionNode,
  combiner: CombinerNode,
  tradingAnalyst: TradingAnalystNode as ComponentType<NodeProps>,
  riskManager: RiskManagerNode as ComponentType<NodeProps>,
  guidedTrader: GuidedTraderNode as ComponentType<NodeProps>,
  riskCap: RiskCapNode as ComponentType<NodeProps>,
  dashboard: DashboardNode as ComponentType<NodeProps>,
};
