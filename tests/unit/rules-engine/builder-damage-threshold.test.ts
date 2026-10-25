import { describe, it, expect } from 'vitest';
import { damageThresholdGate } from '$lib/rules-engine/builder';
import type { FactReader } from '$lib/rules-engine';

/**
 * The GENERIC damage-threshold gate (builder-level, not vehicle-local): a
 * subject whose stat block carries a damage threshold (the Tormentor's 10)
 * records NOTHING for a blow below it. The helper is the one place the
 * comparison lives — the caller owns the threshold FACT (data on the board
 * effect, so a later vehicle with a different threshold needs no code change)
 * and the diagnostic CODE (the caller's i18n namespace), which keeps the
 * helper reusable by any damage-recording subject.
 *
 * The diagnostic itself carries no interpolation values (the Diagnostic type
 * is code + severity), so the threshold number is baked into the caller's
 * copy — the helper stays value-free.
 */

/** The code a caller hands the gate (the module-owned i18n namespace). */
const CODE = 'rule.tormentor.record-damage.below_threshold';

/** A synthetic reader holding ONLY the threshold fact (absent when undefined). */
function readerWith(threshold: number | undefined): FactReader {
  return {
    num: (fact: string) => (fact === 'test.damageThreshold' ? (threshold ?? 0) : 0),
    has: (fact: string) => fact === 'test.damageThreshold' && threshold !== undefined
  };
}

describe('damageThresholdGate', () => {
  it('returns the caller-code diagnostic for an amount BELOW the fact', () => {
    expect(damageThresholdGate(readerWith(10), 9, 'test.damageThreshold', CODE)).toEqual({
      code: CODE,
      severity: 'error'
    });
    // A row left at the slider's 0 default is sub-threshold like any other.
    expect(damageThresholdGate(readerWith(10), 0, 'test.damageThreshold', CODE)).toEqual({
      code: CODE,
      severity: 'error'
    });
  });

  it('returns null AT the threshold (the blow lands in full)', () => {
    expect(damageThresholdGate(readerWith(10), 10, 'test.damageThreshold', CODE)).toBeNull();
  });

  it('returns null ABOVE the threshold — the threshold is a floor, not a cap', () => {
    expect(damageThresholdGate(readerWith(10), 60, 'test.damageThreshold', CODE)).toBeNull();
  });

  it('never gates a subject with no threshold fact (unset reads 0, everything passes)', () => {
    expect(damageThresholdGate(readerWith(undefined), 1, 'test.damageThreshold', CODE)).toBeNull();
    expect(damageThresholdGate(readerWith(0), 1, 'test.damageThreshold', CODE)).toBeNull();
  });
});
