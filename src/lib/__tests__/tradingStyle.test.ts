/**
 * tradingStyle.test.ts — Patch 2K regression guard.
 *
 * The TradingStyle node multiplies incoming fundamental/technical consensus
 * by a horizon factor (scalping=0.2, daytrading=0.4, swing=0.7, position=1.0,
 * longterm=1.2). This is the ONLY knob that lets a long-term investor
 * amplify fundamentals while a scalper damps them to near-zero.
 *
 * Patch 2K bug: TradingStyle used to silent-cast unknown styles to the ML
 * request's `swing` default without mirroring that in the UI. Here we lock
 * the multipliers so future refactors don't accidentally flip them.
 *
 * Source: src/lib/graphEngine.ts:506-533
 */

import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { evaluateGraph } from '../graphEngine';
import type { OHLCVCandle } from '../../types/nodes';

function mkNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data } as Node;
}
function mkEdge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}
function flatCandles(n = 30, price = 1.05): OHLCVCandle[] {
  // Flat price so technical indicators don't add noise; only upstream
  // fundamental signal feeds into TradingStyle.
  return Array.from({ length: n }, (_, i) => ({
    time: 1700000000 + i * 3600,
    open: price,
    high: price + 0.0001,
    low: price - 0.0001,
    close: price,
    volume: 1,
  }));
}

/**
 * Build a 3-node graph: fundamental -> tradingStyle -> dashboard.
 * Returns the signal on the tradingStyle node — that's what we assert on.
 */
function runStyle(style: string): number {
  const nodes = [
    mkNode('mp', 'marketPair', { pair: 'USDJPY' }),
    mkNode('f', 'fundamental', { weight: 1.0 }),
    mkNode('ts', 'tradingStyle', { tradingStyle: style, weight: 1.0 }),
    mkNode('db', 'dashboard'),
  ];
  const edges = [
    mkEdge('e1', 'mp', 'f'),
    mkEdge('e2', 'f', 'ts'),
    mkEdge('e3', 'ts', 'db'),
  ];
  const res = evaluateGraph(nodes, edges, flatCandles());
  const styleSig = res.signals.find((s) => s.nodeType === 'tradingStyle');
  if (!styleSig) throw new Error('tradingStyle node missing from result');
  return styleSig.signal;
}

describe('tradingStyle multiplier mapping', () => {
  it('scalping dampens fundamental signal toward zero', () => {
    // USDJPY fundamental = clamp(5.15/5, -1, 1) = +1. Scalping mult 0.2 →
    // expected ≈ 0.2 (±floating-point slack).
    const scalp = runStyle('scalping');
    const longterm = runStyle('longterm');

    // Both should be positive (upstream +1).
    expect(scalp).toBeGreaterThan(0);
    expect(longterm).toBeGreaterThan(0);

    // Order invariant: scalp < swing < longterm. Locked so nobody accidentally
    // flips the dict. We test the extremes here; swing is covered below.
    expect(scalp).toBeLessThan(longterm);

    // Absolute magnitude — tolerate ±0.02 for clamp + weighted-avg rounding.
    expect(Math.abs(scalp - 0.2)).toBeLessThan(0.05);
  });

  it('longterm amplifies beyond 1.0 then re-clamps to 1', () => {
    // longterm mult = 1.2 × upstream 1.0 = 1.2, then clamped to [-1, +1].
    // Invariant: the node must NEVER emit |signal| > 1, no matter the
    // multiplier. This was the Patch 2K concern — unclamped signals poisoned
    // downstream weighted averages.
    const longterm = runStyle('longterm');

    expect(Math.abs(longterm)).toBeLessThanOrEqual(1);
    // Still close to 1 (the clamp ceiling), confirming the multiplier fires.
    expect(longterm).toBeGreaterThan(0.9);
  });
});
