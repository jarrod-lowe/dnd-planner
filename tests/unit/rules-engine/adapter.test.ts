import { describe, it, expect } from 'vitest';
import { plannedEntry, plannedEntries } from '$lib/rules-engine/adapter';
import type { EngineOutput, PlannedRef } from '$lib/rules-engine';

/**
 * M4/W1 contract adapter — folding per-instance `planDiagnostics` back onto planned
 * items (what the view contract carries inside each planned rule's own entry).
 */

const baseOutput = (overrides: Partial<EngineOutput> = {}): EngineOutput => ({
  status: { ok: true, legal: true, applicable: true },
  facts: {},
  availableRules: [
    {
      rule: { id: 'cast-bless', ui: { section: 'action-spell' }, vars: {} },
      legal: true,
      applicable: true,
      diagnostics: []
    },
    {
      rule: { id: 'unarmed-strike-use-action', ui: {} },
      legal: true,
      applicable: true,
      diagnostics: []
    }
  ],
  planDiagnostics: {},
  annotations: [],
  effects: [],
  diagnostics: { errors: [], warnings: [], notices: [] },
  next: { modules: [] },
  ...overrides
});

const ref = (
  instanceId: string,
  ruleId: string,
  selections?: Record<string, unknown>
): PlannedRef => ({
  instanceId,
  ruleId,
  ...(selections ? { selections } : {})
});

describe('adapter — plannedEntry', () => {
  it('resolves a planned ref to its offer and carries its selections', () => {
    const out = baseOutput();
    const entry = plannedEntry(out, ref('i0', 'cast-bless', { slotLevel: 2 }));
    expect(entry?.rule.id).toBe('cast-bless');
    expect(entry?.instanceId).toBe('i0');
    expect(entry?.selections).toEqual({ slotLevel: 2 });
    expect(entry?.legal).toBe(true);
    expect(entry?.diagnostics).toEqual([]);
  });

  it('folds the instance planDiagnostics in and derives legal=false on an error', () => {
    const out = baseOutput({
      planDiagnostics: { i0: [{ code: 'no_action', severity: 'error' }] }
    });
    const entry = plannedEntry(out, ref('i0', 'unarmed-strike-use-action'));
    expect(entry?.legal).toBe(false);
    expect(entry?.diagnostics).toEqual([{ code: 'no_action', severity: 'error' }]);
  });

  it('stays legal when the instance has only a warning/notice', () => {
    const out = baseOutput({
      planDiagnostics: { i0: [{ code: 'not_proficient', severity: 'warning' }] }
    });
    expect(plannedEntry(out, ref('i0', 'cast-bless'))?.legal).toBe(true);
  });

  it('returns undefined when the offer is not present (stale/gated-out plan item)', () => {
    expect(plannedEntry(baseOutput(), ref('i0', 'no-such-offer'))).toBeUndefined();
  });

  it('scopes diagnostics to the instance — two instances of one offer differ', () => {
    const out = baseOutput({
      planDiagnostics: { i1: [{ code: 'already_used', severity: 'error' }] }
    });
    expect(plannedEntry(out, ref('i0', 'cast-bless'))?.legal).toBe(true);
    expect(plannedEntry(out, ref('i1', 'cast-bless'))?.legal).toBe(false);
  });
});

describe('adapter — plannedEntries', () => {
  it('preserves plan order and skips refs whose offer is gone', () => {
    const out = baseOutput({ planDiagnostics: { b: [{ code: 'no_action', severity: 'error' }] } });
    const entries = plannedEntries(out, [
      ref('a', 'cast-bless'),
      ref('gone', 'no-such-offer'),
      ref('b', 'unarmed-strike-use-action')
    ]);
    expect(entries.map((e) => e.instanceId)).toEqual(['a', 'b']);
    expect(entries.map((e) => e.legal)).toEqual([true, false]);
  });
});
