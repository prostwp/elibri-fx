/**
 * scenarios.test.ts — API client boundary tests.
 *
 * We don't spin up a real backend in unit tests; we mock `fetch` and verify:
 *   1. startScenario returns the backend's {status, id} body verbatim.
 *   2. On HTTP error / network fail, we degrade to a well-formed error object
 *      rather than throwing — the UI depends on this contract (Day 7 review).
 *
 * Source: src/lib/scenarios.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startScenario, listActiveScenarios } from '../scenarios';

describe('startScenario', () => {
  beforeEach(() => {
    // Reset globals between cases — avoids cross-test pollution.
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the body on 200 OK', async () => {
    const body = { status: 'started', id: 'abc-123' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(body),
      } as unknown as Response),
    );

    const res = await startScenario('abc-123');

    expect(res).toEqual(body);
  });

  it('returns {status:"error"} when the fetch rejects', async () => {
    // Simulate a network-level failure (DNS, abort, CORS) — scenarios.request()
    // catches and returns null, then the public wrapper substitutes an error
    // envelope. The UI then shows a toast; it never crashes on a thrown
    // fetch error. Guards us from regressing that contract.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const res = await startScenario('abc-123');

    expect(res).toEqual({ status: 'error' });
  });
});

describe('listActiveScenarios', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns [] when backend responds with 500 (non-OK)', async () => {
    // The UI's /alerts page renders "0 active" on empty array. If we ever
    // leaked null into the caller, Array.map would throw. Invariant: always
    // return an array, empty or not.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'internal error',
      } as unknown as Response),
    );

    const res = await listActiveScenarios();

    expect(Array.isArray(res)).toBe(true);
    expect(res).toHaveLength(0);
  });
});
