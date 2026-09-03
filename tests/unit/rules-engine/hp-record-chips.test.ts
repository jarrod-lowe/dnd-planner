import { describe, it, expect } from 'vitest';
import { evaluatePlan } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hp from '$lib/rules-engine/rules/hp';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import auraOfTheGuardian from '$lib/rules-engine/rules/class-paladin-oath-redemption-level7';

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

  it('a heal past the floor clears the hidden overkill but shows only the visible HP', () => {
    // hp.max 12 with the manual current-HP override at −30: hp.current reads 0
    // and 18 points sit hidden BELOW the floor. A 5-point heal has to pay off
    // that 18 as well as restore the 5, so the state delta is 23 — but the chip
    // says Healing 5, the HP the player actually watched come back.
    const { advertised, facts } = evaluatePlan([coreEvents, hp], { 'hp.base.max': 12 }, [
      { instanceId: 'm1', ruleId: 'set-hp-modifier-current', selections: { modifier: -30 } },
      heal('h1', 5)
    ]);
    const eff = advertised.find((e) => e.id.includes('effect-hp-heal'));
    expect(eff?.display?.value).toBe(5);
    expect(eff?.state?.['hp.modifier.current']).toBe(23);
    expect(facts['hp.current']).toBe(5);
  });

  it('a damage record bakes the EFFECTIVE damage (capped at the HP held)', () => {
    // hp.max 12, 10 damage taken, then a 10-damage record with 2 HP left: only
    // 2 HP can be lost, so both the chip and the state say 2 — banking −10
    // would push hp.modifier.current past −max and swallow a later heal.
    const { advertised } = evaluatePlan([coreEvents, hp], { 'hp.base.max': 12 }, [
      damage('d1', 10),
      damage('d2', 10)
    ]);
    const eff = advertised.find((e) => e.id.startsWith('d2#'));
    expect(eff?.display?.value).toBe(2);
    expect(eff?.state?.['hp.modifier.current']).toBe(-2);
  });

  it('an Aura of the Guardian transfer caps at the HP the paladin holds', () => {
    // hp.max 12, 10 already taken: absorbing 20 for an ally can only cost the
    // 2 HP left, so the chip and the effect both record 2 (HP floors at 0).
    const { advertised, facts } = evaluatePlan(
      [coreEvents, hp, actionEconomy, auraOfTheGuardian],
      { 'hp.base.max': 12 },
      [
        damage('d1', 10),
        { instanceId: 'a1', ruleId: 'aura-of-the-guardian', selections: { amount: 20 } }
      ]
    );
    const eff = advertised.find((e) => e.id.includes('effect-aura-of-the-guardian'));
    expect(eff?.display?.value).toBe(2);
    expect(eff?.state?.['hp.modifier.current']).toBe(-2);
    expect(facts['hp.current']).toBe(0);
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
