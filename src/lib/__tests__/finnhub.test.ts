/**
 * finnhub.test.ts — sentiment keyword classifier.
 *
 * analyzeSentiment is the only bit of forex news processing we trust to run
 * client-side (the rest is just transport). Covered invariants:
 *   1. Bullish keywords -> bullish verdict.
 *   2. Bearish keywords -> bearish verdict.
 *   3. Empty / neutral text -> neutral.
 *   4. Mixed keywords cancel toward neutral unless one side dominates.
 *
 * Source: src/lib/finnhub.ts
 */

import { describe, it, expect } from 'vitest';
import { analyzeSentiment } from '../finnhub';

describe('analyzeSentiment', () => {
  it('returns bullish for rallying / upside language', () => {
    expect(analyzeSentiment('Bitcoin rally surges on strong growth')).toBe('bullish');
    expect(analyzeSentiment('EUR/USD gains as recovery exceeds forecasts')).toBe('bullish');
    expect(analyzeSentiment('positive optimism drives market higher')).toBe('bullish');
  });

  it('returns bearish for decline / loss language', () => {
    expect(analyzeSentiment('Stock drops on recession fears')).toBe('bearish');
    expect(analyzeSentiment('Crypto crash — miners miss earnings')).toBe('bearish');
    expect(analyzeSentiment('bear market deepens, losses mount')).toBe('bearish');
  });

  it('returns neutral for empty or balanced text', () => {
    expect(analyzeSentiment('')).toBe('neutral');
    expect(analyzeSentiment('Fed meets on Wednesday')).toBe('neutral');
    // "rally" (+1) and "drop" (-1) cancel to 0 → neutral.
    expect(analyzeSentiment('Stocks rally after earlier drop')).toBe('neutral');
  });
});
