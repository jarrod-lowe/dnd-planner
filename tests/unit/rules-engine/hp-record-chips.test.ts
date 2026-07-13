import { describe, it, expect } from 'vitest';
import { evaluatePlan } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';

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
