import { describe, it, expect } from 'vitest';
import { plannedEntry, plannedEntries } from '$lib/rules-engine/adapter';
import type { AvailableRuleEntry, EngineOutput, PlannedRef } from '$lib/rules-engine';

/**
 * M4/W1 contract adapter — resolving each planned ref to the offer that RAN at
 * its step (from `plannedOffers`, keyed by instanceId), carrying that instance's
 * `planDiagnostics` and captured selections. Legality is passed through from the
 * engine's entry (the fold's verdict), NOT re-inferred from diagnostic severity,
 * so a warning-severity gate failure stays illegal here as in the catalog.
 */

/** An offer catalog entry for a rule id (the shape plannedOffers stores). */
const offerEntry = (id: string, legal = true): AvailableRuleEntry => ({
  rule: { id, ui: { section: 'action-spell' }, vars: {} },
  legal,
  applicable: true,
  diagnostics: []
});

const baseOutput = (overrides: Partial<EngineOutput> = {}): EngineOutput => ({
  status: { ok: true, legal: true, applicable: true },
  facts: {},
  availableRules: [],
  planDiagnostics: {},
  plannedOffers: {},
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
  it('resolves a planned ref to its step-time offer and carries its selections', () => {
    const out = baseOutput({ plannedOffers: { i0: offerEntry('cast-bless') } });
    const entry = plannedEntry(out, ref('i0', 'cast-bless', { slotLevel: 2 }));
    expect(entry?.rule.id).toBe('cast-bless');
    expect(entry?.instanceId).toBe('i0');
    expect(entry?.selections).toEqual({ slotLevel: 2 });
    expect(entry?.legal).toBe(true);
    expect(entry?.diagnostics).toEqual([]);
  });

  it('passes the offer legal=false through and folds in its diagnostics', () => {
    const out = baseOutput({
      plannedOffers: { i0: offerEntry('unarmed-strike-use-action', false) },
      planDiagnostics: { i0: [{ code: 'no_action', severity: 'error' }] }
    });
    const entry = plannedEntry(out, ref('i0', 'unarmed-strike-use-action'));
    expect(entry?.legal).toBe(false);
    expect(entry?.diagnostics).toEqual([{ code: 'no_action', severity: 'error' }]);
  });

  it('keeps a warning-flagged illegal offer illegal (legality is decided upstream)', () => {
    // A warning-severity gate failure (e.g. don a shield while not proficient) is
    // illegal in the fold; the adapter must NOT re-infer legal from severity.
    const out = baseOutput({
      plannedOffers: { i0: offerEntry('don-shield', false) },
      planDiagnostics: { i0: [{ code: 'not_proficient', severity: 'warning' }] }
    });
    expect(plannedEntry(out, ref('i0', 'don-shield'))?.legal).toBe(false);
  });

  it('returns undefined when the instance never ran (no plannedOffers entry)', () => {
    expect(plannedEntry(baseOutput(), ref('i0', 'cast-bless'))).toBeUndefined();
  });

  it('resolves a self-gate-closing offer that ran but dropped out of availableRules', () => {
    // Dismiss Steed clears the `summoned` gate it is offered under, so it is
    // absent from the final availableRules — but it ran, so plannedOffers
    // captured it at its step. The row must still resolve, not fall back.
    const out = baseOutput({
      availableRules: [],
      plannedOffers: { i0: offerEntry('offer-dismiss-steed') }
    });
    const entry = plannedEntry(out, ref('i0', 'offer-dismiss-steed'));
    expect(entry?.rule.id).toBe('offer-dismiss-steed');
    expect(entry?.legal).toBe(true);
  });

  it('scopes legality + diagnostics to the instance — two instances of one offer differ', () => {
    const out = baseOutput({
      plannedOffers: { i0: offerEntry('cast-bless'), i1: offerEntry('cast-bless', false) },
      planDiagnostics: { i1: [{ code: 'already_used', severity: 'error' }] }
    });
    expect(plannedEntry(out, ref('i0', 'cast-bless'))?.legal).toBe(true);
    expect(plannedEntry(out, ref('i1', 'cast-bless'))?.legal).toBe(false);
  });
});

describe('adapter — plannedEntries', () => {
  it('preserves plan order and skips refs whose offer never ran', () => {
    const out = baseOutput({
      plannedOffers: {
        a: offerEntry('cast-bless'),
        b: offerEntry('unarmed-strike-use-action', false)
      },
      planDiagnostics: { b: [{ code: 'no_action', severity: 'error' }] }
    });
    const entries = plannedEntries(out, [
      ref('a', 'cast-bless'),
      ref('gone', 'no-such-offer'),
      ref('b', 'unarmed-strike-use-action')
    ]);
    expect(entries.map((e) => e.instanceId)).toEqual(['a', 'b']);
    expect(entries.map((e) => e.legal)).toEqual([true, false]);
  });
});
