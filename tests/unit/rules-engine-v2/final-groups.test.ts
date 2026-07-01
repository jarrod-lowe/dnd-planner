import { describe, it, expect } from 'vitest';
import {
  evaluateSheet,
  evaluatePlan,
  evaluateOffers,
  collectAnnotations,
  endTurn
} from '$lib/rules-engine-v2';
import type { PlannedRef } from '$lib/rules-engine-v2';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';
import attacks from '$lib/rules-engine-v2/rules/attacks';
import hands from '$lib/rules-engine-v2/rules/hands';
import dagger from '$lib/rules-engine-v2/rules/dagger';
import spellcasting from '$lib/rules-engine-v2/rules/spellcasting';
import spearPlus1 from '$lib/rules-engine-v2/rules/spear-plus1';
import featSavageAttacker from '$lib/rules-engine-v2/rules/feat-savage-attacker';
import spellAid from '$lib/rules-engine-v2/rules/spell-aid';
import prayerOfHealing from '$lib/rules-engine-v2/rules/prayer-of-healing';

/**
 * The final four rule groups. Every scenario that exercises them is v1
 * `initialEffects`-format (so blocked from the parity harness); these unit tests
 * are the interim contract check that completes the port to 67/67 groups.
 */

const ref = (instanceId: string, ruleId: string, selections?: Record<string, unknown>): PlannedRef => ({
  instanceId,
  ruleId,
  ...(selections ? { selections } : {})
});

describe('v2 spear-plus1 — magical weapon variant', () => {
  const ALL = [actionEconomy, attacks, hands, spearPlus1];
  // STR +3, proficiency +2.
  const INPUT = { 'str.modifier': 3, 'proficiency.bonus': 2 };

  it('folds the +1 enhancement into hit and damage bonuses', () => {
    const facts = evaluateSheet(ALL, INPUT);
    expect(facts['attack.spear-plus1.hitBonus']).toBe(6); // 3 + 2 + 1
    expect(facts['attack.spear-plus1.damageBonus']).toBe(4); // 3 + 1
  });

  it('offers don + attack profiles like the base spear (via weaponOffers)', () => {
    const stowed = evaluateOffers(ALL, evaluatePlan(ALL, INPUT, []).facts);
    expect(stowed.some((o) => o.id === 'don-spear-plus1')).toBe(true);
    expect(stowed.some((o) => o.id === 'spear-plus1-use-action')).toBe(false); // needs equipping

    const donned = evaluatePlan(ALL, INPUT, [ref('i0', 'don-spear-plus1')]);
    expect(donned.facts['weapon.spear-plus1.equipped']).toBe(1);
    expect(evaluateOffers(ALL, donned.facts).some((o) => o.id === 'spear-plus1-use-action')).toBe(true);
  });

  it('marks the weapon magical unconditionally', () => {
    const anns = collectAnnotations(ALL, evaluateSheet(ALL, INPUT));
    const magical = anns.find((a) => a.key === 'rule.dnd-5e-2024.spear-plus1.magical');
    expect(magical?.targets).toContain('property.magical');
  });
});

describe('v2 feat-savage-attacker — once-per-turn reroll rider', () => {
  const ALL = [actionEconomy, attacks, hands, dagger, featSavageAttacker];

  it('starts each turn with one use available', () => {
    const facts = evaluateSheet([featSavageAttacker], {});
    expect(facts['savageAttacker.max']).toBe(1);
    expect(facts['savageAttacker.remaining']).toBe(1);
  });

  it('is illegal-but-visible until a weapon attack has been made', () => {
    const noAttack = evaluateOffers([featSavageAttacker], evaluateSheet([featSavageAttacker], {}));
    const before = noAttack.find((o) => o.id === 'savage-attacker-use');
    expect(before?.legal).toBe(false);
    expect(before?.diagnostics.some((d) => d.code.endsWith('no_attack'))).toBe(true);

    const attacked = evaluateSheet([featSavageAttacker], { 'attack.last.weapon': 1 });
    const after = evaluateOffers([featSavageAttacker], attacked).find((o) => o.id === 'savage-attacker-use');
    expect(after?.legal).toBe(true);
  });

  it('spends its one use per turn, then reads already-used, and resets next turn', () => {
    const plan = [
      ref('i0', 'don-dagger'),
      ref('i1', 'dagger-use-action'),
      ref('i2', 'savage-attacker-use'),
      ref('i3', 'savage-attacker-use')
    ];
    const out = evaluatePlan(ALL, {}, plan);
    expect(out.planDiagnostics.get('i2')).toBeUndefined(); // first use legal
    expect(out.planDiagnostics.get('i3')?.some((d) => d.code.endsWith('already_used'))).toBe(true);

    // The spend is endOfTurn, so a fresh turn restores the use.
    const nextTurn = endTurn([], out.advertised.filter((e) => e.expiry.kind !== 'endOfTurn'), {});
    expect(evaluateSheet(ALL, {}, nextTurn)['savageAttacker.remaining']).toBe(1);
  });

  it('annotates weapon attacks only while a use remains', () => {
    const available = collectAnnotations(
      [featSavageAttacker],
      evaluateSheet([featSavageAttacker], { 'attack.last.weapon': 1 })
    );
    expect(available.some((a) => a.key === 'rule.dnd-5e-2024.feat-savage-attacker.annotation')).toBe(true);

    // A used-up turn (spent === max) → no reroll available → no annotation.
    const used = collectAnnotations(
      [featSavageAttacker],
      evaluateSheet([featSavageAttacker], { 'attack.last.weapon': 1, 'savageAttacker.spent': 1 })
    );
    expect(used.some((a) => a.key === 'rule.dnd-5e-2024.feat-savage-attacker.annotation')).toBe(false);
  });
});

describe('v2 spell-aid — L2 action spell, L2-5 slot cascade', () => {
  const ALL = [actionEconomy, spellcasting, spellAid];
  const INPUT = { 'spellcasting.slots.level2.total': 1, 'spell.l2.aid.prepared': 1 };

  it('only offers the cast when prepared', () => {
    const unprepared = evaluatePlan(ALL, { 'spellcasting.slots.level2.total': 1 }, []);
    expect(evaluateOffers(ALL, unprepared.facts).some((o) => o.id === 'cast-aid')).toBe(false);

    const prepared = evaluatePlan(ALL, INPUT, []);
    expect(evaluateOffers(ALL, prepared.facts).some((o) => o.id === 'cast-aid')).toBe(true);
  });

  it('spends the action, the turn spell, and the L2 slot (restored on a long rest)', () => {
    const out = evaluatePlan(ALL, INPUT, [ref('c1', 'cast-aid')]);
    expect(out.planDiagnostics.get('c1')).toBeUndefined();
    expect(out.facts['spellcasting.remaining']).toBe(0);
    expect(out.facts['spellcasting.slots.level2.remaining']).toBe(0);

    // Advertised ids are namespaced by the planned instance (`instanceId#i#id`).
    const slotEffect = out.advertised.find((e) => e.id.endsWith('effect-aid-slot-l2'));
    expect(slotEffect?.expiry).toEqual({ kind: 'untilLongRest' });

    const afterRest = endTurn([], out.advertised, { longRest: true });
    expect(evaluateSheet(ALL, INPUT, afterRest)['spellcasting.slots.level2.remaining']).toBe(1);
  });
});

describe('v2 prayer-of-healing — L2 action spell, full L2-9 cascade', () => {
  const ALL = [actionEconomy, spellcasting, prayerOfHealing];

  it('defaults to the lowest owned slot and can upcast to a chosen level', () => {
    const INPUT = {
      'spellcasting.slots.level2.total': 1,
      'spellcasting.slots.level3.total': 1,
      'spell.l2.prayerOfHealing.prepared': 1
    };
    expect(evaluateSheet(ALL, INPUT)['prayerOfHealing.lowestAvailableSlotLevel']).toBe(2);

    const upcast = evaluatePlan(ALL, INPUT, [ref('c1', 'cast-prayer-of-healing', { slotLevel: 3 })]);
    expect(upcast.facts['spellcasting.slots.level3.remaining']).toBe(0);
    expect(upcast.facts['spellcasting.slots.level2.remaining']).toBe(1); // untouched
    expect(upcast.advertised.some((e) => e.id.endsWith('effect-prayer-of-healing-slot-l3'))).toBe(true);
  });
});
