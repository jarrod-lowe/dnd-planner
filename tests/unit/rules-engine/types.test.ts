import { describe, it, expect } from 'vitest';
import { isPhaseAfter, PHASE_ORDER } from '$lib/rules-engine/types';

describe('isPhaseAfter', () => {
  it('returns true when target is after current', () => {
    expect(isPhaseAfter('normal', 'early')).toBe(true);
    expect(isPhaseAfter('safeguard', 'early')).toBe(true);
    expect(isPhaseAfter('safeguard', 'normal')).toBe(true);
  });

  it('returns false when target is before current', () => {
    expect(isPhaseAfter('early', 'normal')).toBe(false);
    expect(isPhaseAfter('early', 'safeguard')).toBe(false);
    expect(isPhaseAfter('normal', 'safeguard')).toBe(false);
  });

  it('returns false when target is same as current', () => {
    expect(isPhaseAfter('early', 'early')).toBe(false);
    expect(isPhaseAfter('normal', 'normal')).toBe(false);
    expect(isPhaseAfter('safeguard', 'safeguard')).toBe(false);
  });
});

describe('PHASE_ORDER', () => {
  it('defines increasing order from early to safeguard', () => {
    expect(PHASE_ORDER.early).toBeLessThan(PHASE_ORDER.normal);
    expect(PHASE_ORDER.normal).toBeLessThan(PHASE_ORDER.safeguard);
  });
});
