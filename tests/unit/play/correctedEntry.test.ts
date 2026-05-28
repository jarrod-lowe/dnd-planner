import { describe, it, expect } from 'vitest';
import { correctEntryForPlanItem } from '$lib/play/correctedEntry';
import type { AvailableRuleEntry } from '$lib/rules-engine';
import type { Rule } from '$lib/rules-engine';

function makeEntry(overrides: Partial<AvailableRuleEntry> = {}): AvailableRuleEntry {
  return {
    rule: { id: 'test-rule' } as Rule,
    legal: true,
    applicable: true,
    diagnostics: [],
    ...overrides
  };
}

function makeItem(varsRuntime?: { errors?: string[] }): { rule: Rule } {
  return {
    rule: { id: 'test-rule', varsRuntime } as Rule,
  };
}

describe('correctEntryForPlanItem', () => {
  it('preserves entry legality when no runtime errors', () => {
    const entry = makeEntry({ legal: false });
    const item = makeItem();

    const result = correctEntryForPlanItem(entry, item);

    expect(result.legal).toBe(false);
  });

  it('preserves entry legality when legal and no errors', () => {
    const entry = makeEntry({ legal: true });
    const item = makeItem();

    const result = correctEntryForPlanItem(entry, item);

    expect(result.legal).toBe(true);
  });

  it('overrides to illegal when runtime errors exist', () => {
    const entry = makeEntry({ legal: true });
    const item = makeItem({ errors: ['some-error'] });

    const result = correctEntryForPlanItem(entry, item);

    expect(result.legal).toBe(false);
    expect(result.diagnostics).toEqual([{ code: 'some-error', severity: 'error' }]);
  });

  it('stays illegal when entry illegal and runtime errors exist', () => {
    const entry = makeEntry({ legal: false, diagnostics: [{ code: 'offer-error', severity: 'error' }] });
    const item = makeItem({ errors: ['inner-error'] });

    const result = correctEntryForPlanItem(entry, item);

    expect(result.legal).toBe(false);
    expect(result.diagnostics).toEqual([{ code: 'inner-error', severity: 'error' }]);
  });

  it('preserves entry diagnostics when no runtime errors', () => {
    const entry = makeEntry({
      legal: false,
      diagnostics: [{ code: 'offer-illegal', severity: 'error' }]
    });
    const item = makeItem();

    const result = correctEntryForPlanItem(entry, item);

    expect(result.diagnostics).toEqual([{ code: 'offer-illegal', severity: 'error' }]);
  });
});
