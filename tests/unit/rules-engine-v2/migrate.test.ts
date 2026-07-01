import { describe, it, expect } from 'vitest';
import { v1EffectRuleToInstance, migratePersistedEffects } from '$lib/rules-engine-v2/migrate';

/**
 * M4/W2 — the pure v1-effect → v2-EffectInstance conversion (W5 migration core).
 * Covers the shared-namespace committed-effect shapes that actually persist;
 * resource-`remaining` remapping is W5's semantic layer (asserted as a boundary).
 */

describe('migrate — v1EffectRuleToInstance', () => {
  it('converts an equipped-weapon flag (numberSet) to a keyed permanent override', () => {
    const { effect, unresolved } = v1EffectRuleToInstance({
      id: 'effect-dagger',
      group: ['equip:dagger'],
      activities: [
        { type: 'numberSet', target: { fact: 'weapon.dagger.equipped' }, source: { number: 1 } },
        { type: 'advertiseEffect', self: true }
      ]
    });
    expect(effect).toEqual({
      id: 'effect-dagger',
      key: 'equip:dagger',
      state: { 'weapon.dagger.equipped': 1 },
      stateCombine: { 'weapon.dagger.equipped': 'override' },
      expiry: { kind: 'permanent' }
    });
    expect(unresolved).toEqual([]);
  });

  it('resolves a captured var (varsRuntime) — HP max modifier', () => {
    const { effect } = v1EffectRuleToInstance({
      id: 'effect-hp-modifier-max',
      varsRuntime: { modifier: 5 },
      activities: [
        { type: 'numberSet', target: { fact: 'hp.modifier.max' }, source: { var: 'modifier' } },
        { type: 'advertiseEffect', self: true }
      ]
    });
    expect(effect.state).toEqual({ 'hp.modifier.max': 5 });
    expect(effect.expiry).toEqual({ kind: 'permanent' });
  });

  it('maps numberIncrement to a summed contribution (negated when subtract)', () => {
    const { effect } = v1EffectRuleToInstance({
      id: 'effect-loh-spend',
      activities: [
        { type: 'numberIncrement', target: { fact: 'lohPool.spent' }, source: { number: 5 } },
        { type: 'advertiseEffect', self: true }
      ]
    });
    // No stateCombine override → v2 default sum.
    expect(effect.state).toEqual({ 'lohPool.spent': 5 });
    expect(effect.stateCombine).toBeUndefined();

    const sub = v1EffectRuleToInstance({
      id: 'x',
      activities: [{ type: 'numberIncrement', target: { fact: 'f' }, source: { number: 3 }, subtract: true }]
    });
    expect(sub.effect.state).toEqual({ f: -3 });
  });

  it('treats a non-self-advertising effect as one-turn (endOfTurn)', () => {
    const { effect } = v1EffectRuleToInstance({
      id: 'effect-oneturn',
      activities: [{ type: 'numberSet', target: { fact: 'flag' }, source: { number: 1 } }]
    });
    expect(effect.expiry).toEqual({ kind: 'endOfTurn' });
    expect(effect.key).toBeUndefined();
  });

  it('flags eval-time (fact-sourced) activities as unresolved rather than dropping them', () => {
    const { effect, unresolved } = v1EffectRuleToInstance({
      id: 'effect-derived',
      activities: [
        { type: 'numberSet', target: { fact: 'a.b' }, source: { fact: 'some.other' } },
        { type: 'numberSet', target: { fact: 'c.d' }, source: { number: 2 } }
      ]
    });
    expect(effect.state).toEqual({ 'c.d': 2 });
    expect(unresolved).toEqual(['numberSet a.b']);
  });
});

describe('migrate — migratePersistedEffects (batch)', () => {
  it('converts a character effect blob and collects per-effect unresolved notes', () => {
    const { effects, unresolved } = migratePersistedEffects([
      { id: 'effect-bless', group: ['bless'], activities: [{ type: 'numberSet', target: { fact: 'bless.active' }, source: { number: 1 } }, { type: 'advertiseEffect', self: true }] },
      { id: 'effect-derived', activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { fact: 'y' } }] }
    ]);
    expect(effects.map((e) => e.id)).toEqual(['effect-bless', 'effect-derived']);
    expect(effects[0].state).toEqual({ 'bless.active': 1 });
    expect(unresolved).toEqual({ 'effect-derived': ['numberSet x'] });
  });
});
