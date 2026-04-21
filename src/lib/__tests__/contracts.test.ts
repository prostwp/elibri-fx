/**
 * contracts.test.ts — frontend half of the Patch 2N JSON contract test.
 *
 * The backend repo owns the canonical snapshot in contracts/scenarios.snapshot.json.
 * The frontend cannot import that file directly across repos, so we duplicate
 * the key list here. Both repos must be updated in lockstep — that's the point
 * of the test.
 *
 * WHEN TO UPDATE
 *
 * When you rename / add / remove a field on ActiveScenario or Alert:
 *   1. Update the interface in scenarios.ts.
 *   2. Update scenario_handlers.go response struct.
 *   3. Update backend contract test snapshot (UPDATE_SNAPSHOT=1).
 *   4. Update the EXPECTED_* constants here.
 *   5. Both `go test` and `vitest` must pass before merging.
 *
 * This is a lightweight version of OpenAPI — we gain drift detection without
 * forcing a schema generator into the build.
 *
 * Source of truth: elibri-backend/contracts/scenarios.snapshot.json
 */

import { describe, it, expect } from 'vitest';
import type { ActiveScenario, Alert } from '../scenarios';

// Mirror of elibri-backend/contracts/scenarios.snapshot.json.
// If these drift from the backend snapshot, CI catches it here.
const EXPECTED_ACTIVE_SCENARIO_KEYS = [
  'id',
  'interval',
  'is_active',
  'last_signal_bar_time',
  'last_signal_direction',
  'name',
  'paused_until',
  'risk_tier',
  'running',
  'symbol',
].sort();

const EXPECTED_ALERT_KEYS = [
  'bar_time',
  'confidence',
  'created_at',
  'direction',
  'entry_price',
  'id',
  'interval',
  'label',
  'meta',
  'position_size_usd',
  'stop_loss',
  'strategy_id',
  'symbol',
  'take_profit',
  'telegram_message_id',
  'telegram_sent_at',
].sort();

// Satisfy ESLint/tsc: a typed dummy instance proves the fields compile. If the
// TypeScript interface ever loses a field, this object fails to typecheck;
// if it gains a field, our key-list below is stale and the unit test below
// will fail (we compare keys of the typed object).
//
// We also export 'id' with the required *type* to make sure the compiler
// notices any broader type change (e.g. if `id: string` became `id: number`).
const activeScenarioSample: ActiveScenario = {
  id: 'x',
  name: 'x',
  symbol: 'BTCUSDT',
  interval: '4h',
  risk_tier: 'conservative',
  is_active: true,
  running: true,
  paused_until: null,
  last_signal_bar_time: 0,
  last_signal_direction: '',
};

const alertSample: Alert = {
  id: 'x',
  user_id: 'x',
  strategy_id: 'x',
  symbol: 'BTCUSDT',
  interval: '4h',
  direction: 'buy',
  label: 'trend_aligned',
  confidence: 72,
  entry_price: 50000,
  stop_loss: 48000,
  take_profit: 53000,
  position_size_usd: 1000,
  bar_time: 1700000000,
  created_at: '2026-04-20T10:00:00Z',
  telegram_sent_at: null,
  telegram_message_id: null,
  meta: {},
};

describe('JSON contract: ActiveScenario', () => {
  it('TypeScript interface exposes the same keys as backend snapshot', () => {
    const actualKeys = Object.keys(activeScenarioSample).sort();
    expect(actualKeys).toEqual(EXPECTED_ACTIVE_SCENARIO_KEYS);
  });
});

describe('JSON contract: Alert', () => {
  it('TypeScript interface exposes the same keys as backend snapshot', () => {
    // NOTE: Alert has one extra key compared to backend contract (`user_id`).
    // Backend doesn't emit it on the /alerts endpoint (filtered by auth context),
    // but the frontend type includes it because /auth/me and other endpoints
    // do surface it and sharing the type is cleaner than a subtype. We
    // explicitly assert the BACKEND keys are a subset of our TS keys.
    const actualKeys = Object.keys(alertSample).sort();
    for (const k of EXPECTED_ALERT_KEYS) {
      expect(actualKeys).toContain(k);
    }
    // But we also want NO unexpected surplus — if someone added a TS field
    // without updating the backend, we want to know. Allow `user_id` as a
    // known extra.
    const allowedExtras = new Set(['user_id']);
    for (const k of actualKeys) {
      if (!EXPECTED_ALERT_KEYS.includes(k) && !allowedExtras.has(k)) {
        throw new Error(`unexpected TS Alert field: ${k}. Either add to backend or to allowedExtras.`);
      }
    }
  });
});
