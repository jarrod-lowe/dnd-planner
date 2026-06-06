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

function makeItem(varsRuntime?: Record<string, unknown>): { rule: Rule } {
  return {
    rule: { id: 'test-rule', varsRuntime } as Rule
  };
}

describe('correctEntryForPlanItem', () => {
  describe('without error tracking (no varsRuntime.errors key)', () => {
    it('preserves entry legality when no varsRuntime', () => {
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

  describe('with error tracking (varsRuntime.errors key present)', () => {
    it('does NOT override entry illegality when errors are empty', () => {
      const entry = makeEntry({ legal: false });
      const item = makeItem({ errors: [] });

      const result = correctEntryForPlanItem(entry, item);

      expect(result.legal).toBe(false);
    });

    it('overrides to illegal when errors array is non-empty', () => {
      const entry = makeEntry({ legal: true });
      const item = makeItem({ errors: ['some-error'] });

      const result = correctEntryForPlanItem(entry, item);

      expect(result.legal).toBe(false);
      expect(result.diagnostics).toEqual([{ code: 'some-error', severity: 'error' }]);
    });

    it('uses error diagnostics over entry diagnostics when errors exist', () => {
      const entry = makeEntry({
        legal: false,
        diagnostics: [{ code: 'offer-error', severity: 'error' }]
      });
      const item = makeItem({ errors: ['inner-error'] });

      const result = correctEntryForPlanItem(entry, item);

      expect(result.legal).toBe(false);
      expect(result.diagnostics).toEqual([{ code: 'inner-error', severity: 'error' }]);
    });

    it('keeps entry diagnostics when errors array is empty', () => {
      const entry = makeEntry({
        legal: false,
        diagnostics: [{ code: 'offer-illegal', severity: 'error' }]
      });
      const item = makeItem({ errors: [] });

      const result = correctEntryForPlanItem(entry, item);

      expect(result.legal).toBe(false);
      expect(result.diagnostics).toEqual([{ code: 'offer-illegal', severity: 'error' }]);
    });

    it('handles multiple errors', () => {
      const entry = makeEntry({ legal: true });
      const item = makeItem({ errors: ['error-1', 'error-2'] });

      const result = correctEntryForPlanItem(entry, item);

      expect(result.legal).toBe(false);
      expect(result.diagnostics).toEqual([
        { code: 'error-1', severity: 'error' },
        { code: 'error-2', severity: 'error' }
      ]);
    });
  });
});
