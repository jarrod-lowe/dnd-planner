import { describe, it, expect } from 'vitest';
import { evaluatePlan } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hp from '$lib/rules-engine/rules/hp';

/**
 * The player damage/heal record chips must carry their own amount: the i18n
 * names are `Damage {{score}}` / `Healing {{score}}`, and the records are
 * KEYLESS and stack — each chip needs its own literal, not a shared running
 * fact like the steed's keyed records (a shared fact would show the net on
 * every chip).
 */
describe('player HP record effects carry their amount for the chip', () => {
  const damage = (instanceId: string, amount: number): PlannedRef => ({
    instanceId,
    ruleId: 'record-damage',
    selections: { amount }
  });
  const heal = (instanceId: string, amount: number): PlannedRef => ({
    instanceId,
    ruleId: 'record-heal',
    selections: { amount }
  });

  it('a damage record bakes the recorded amount into display.value', () => {
    const { advertised } = evaluatePlan([coreEvents], {}, [damage('d1', 7)]);
    const eff = advertised.find((e) => e.id.includes('effect-hp-damage'));
    expect(eff?.display?.value).toBe(7);
  });

  it('a heal record bakes the EFFECTIVE healed amount (capped at missing HP)', () => {
    // 10 damage then a 15 heal: only 10 HP were missing, so the chip must say
    // Healing 10 — the same effective amount the effect's state records.
    const { advertised } = evaluatePlan([coreEvents], {}, [damage('d1', 10), heal('h1', 15)]);
    const eff = advertised.find((e) => e.id.includes('effect-hp-heal'));
    expect(eff?.display?.value).toBe(10);
    expect(eff?.state?.['hp.modifier.current']).toBe(10);
  });
});

/**
 * The manual HP modifier setters share the same contract: their i18n names are
 * `Max HP {{score}}` / `HP {{score}}`. A `displayFact` would be wrong for the
 * current-HP chip — damage and heal records sum into `hp.modifier.current`
 * too, so the chip would show the net instead of the chosen slider value.
 */
describe('manual HP modifier chips carry the chosen amount', () => {
  const set = (instanceId: string, ruleId: string, modifier: number): PlannedRef => ({
    instanceId,
    ruleId,
    selections: { modifier }
  });

  it('the max-HP modifier bakes the slider value into display.value', () => {
    const { advertised } = evaluatePlan([hp], {}, [set('m1', 'set-hp-modifier-max', 12)]);
    const eff = advertised.find((e) => e.id.includes('effect-hp-modifier-max'));
    expect(eff).toBeDefined();
    expect(eff?.display?.value).toBe(12);
  });

  it('the current-HP modifier bakes the (possibly negative) slider value', () => {
    const { advertised } = evaluatePlan([hp], {}, [set('m1', 'set-hp-modifier-current', -5)]);
    const eff = advertised.find((e) => e.id.includes('effect-hp-modifier-current'));
    expect(eff).toBeDefined();
    expect(eff?.display?.value).toBe(-5);
  });
});
