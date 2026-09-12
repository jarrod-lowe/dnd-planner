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
 * What `record-heal` advertises for `hp.modifier.current` is also the number
 * Life Bond (Find Steed) seeds into the steed's heal row — the annotation's
 * `seed: { amount: { effect: 'hp.modifier.current' } }` sums this row's
 * contribution to exactly this fact (`contributionTo` in playStore). So these
 * two cases pin the seed's source as much as the chip's value.
 *
 * The pair exists because the two cases DISAGREE, and the disagreement is
 * issue #395, not a Life Bond defect: `hp.modifier.current` is a signed sum of
 * independently removable deltas and only `hp.current` clamps it, so overkill
 * damage banks below `-hp.max` and the next heal is partly swallowed. The
 * advertised figure is then larger than the HP the sheet actually shows the
 * character regaining. Fixing it needs the ordered replay #395 describes; two
 * record-time repairs were tried on #394 and reverted, because a correction
 * stored in a chip other than the one that caused the problem is orphaned when
 * that chip is deleted. When #395 lands, the second case's expectations move
 * to 10/10 and an advertised 10, and Life Bond follows for free.
 */
describe('the heal a record advertises is the HP the character regains', () => {
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

  it('matches the HP regained when no overkill has banked', () => {
    // 10 max, wounded to 0/10 by exactly lethal damage, then healed 15. The
    // surplus 5 is lost: the character regains 10 and the steed is seeded 10.
    const { advertised, facts } = evaluatePlan([coreEvents, hp], { 'hp.base.max': 10 }, [
      damage('d1', 10),
      heal('h1', 15)
    ]);
    const eff = advertised.find((e) => e.id.includes('effect-hp-heal'));
    expect(eff?.state?.['hp.modifier.current']).toBe(10);
    expect(facts['hp.current']).toBe(10);
    expect(facts['hp.max']).toBe(10);
  });

  it('OVERSTATES the HP regained once overkill has banked (known, issue #395)', () => {
    // Same 10 max, but 20 damage recorded: `hp.modifier.current` banks to −20
    // while the sheet floors at 0/10.
    const banked = evaluatePlan([coreEvents, hp], { 'hp.base.max': 10 }, [
      damage('d1', 10),
      damage('d2', 10)
    ]);
    expect(banked.facts['hp.modifier.current']).toBe(-20);
    expect(banked.facts['hp.current']).toBe(0);

    // A 15-point heal now caps at the BANKED shortfall (20), not the visible
    // one (10), so the whole 15 is advertised — but it only pays off overkill
    // as far as −5, moving the sheet from 0/10 to 5/10. By RAW the character
    // regained 10; the record says 15 and the sheet shows 5, and neither the
    // heal chip nor the Life Bond seed can tell the difference. Capping at the
    // VISIBLE shortfall instead would not fix it — that advertises 10 and
    // leaves the sheet at 0/10, trading one wrong pair for another.
    const { advertised, facts } = evaluatePlan([coreEvents, hp], { 'hp.base.max': 10 }, [
      damage('d1', 10),
      damage('d2', 10),
      heal('h1', 15)
    ]);
    const eff = advertised.find((e) => e.id.includes('effect-hp-heal'));
    expect(eff?.state?.['hp.modifier.current']).toBe(15);
    expect(eff?.display?.value).toBe(15);
    expect(facts['hp.current']).toBe(5);
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
