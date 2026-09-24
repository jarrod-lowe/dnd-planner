import { describe, it, expect } from 'vitest';
import { concentrationBreakEffects } from '$lib/rules-engine/builder';
import type { FactReader } from '$lib/rules-engine';

/**
 * concentrationBreakEffects — the shared conditional break a condition's
 * recorder advertises (Incapacitated's "No Concentration" clause; the wave-5
 * composition children and Unconscious invoke the same helper). The yaml
 * scenarios pin the player-visible behaviour (concentration-broken-on-record,
 * record-incapacitated-no-hold-no-phantom); this pins the helper's CONTRACT
 * directly: empty with no hold live, and the exact eviction + clear pair with
 * one live.
 */
const reader = (facts: Record<string, number>): FactReader => ({
  num: (fact) => facts[fact] ?? 0,
  has: (fact) => fact in facts
});

describe('concentrationBreakEffects — the condition recorder break', () => {
  it('advertises nothing when no hold is live (unset / zero concentration.spent)', () => {
    // The conditional leg: an unconditional eviction would commit a permanent
    // "Concentration broken" chip recording with nothing held.
    expect(concentrationBreakEffects(reader({}))).toEqual([]);
    expect(concentrationBreakEffects(reader({ 'concentration.spent': 0 }))).toEqual([]);
  });

  it('breaks a live hold — the keyed eviction beside the damage-marker clear', () => {
    const effects = concentrationBreakEffects(reader({ 'concentration.spent': 1 }));
    expect(effects).toHaveLength(2);
    const [eviction, clear] = effects;
    // The empty same-key eviction: replaces the hold in-fold (undoable while
    // planned), permanent once committed, displayed via the REUSED
    // planner.concentration.broken key ("the state, not the breaker").
    expect(eviction).toEqual({
      id: 'concentration-broken-by-condition',
      key: 'concentration-spell',
      display: { name: 'planner.concentration.broken', section: 'other' },
      expiry: { kind: 'permanent' }
    });
    // The recast precedent: a damage save owed against the dead hold is moot.
    expect(clear).toEqual({
      id: 'concentration-damage-taken',
      key: 'concentration-damage-taken',
      state: { 'concentration.damage-taken': 0, 'concentration.last-damage': 0 },
      expiry: { kind: 'endOfTurn' }
    });
  });
});
