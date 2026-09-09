import { describe, it, expect } from 'vitest';
import { evaluatePlan, evaluateSheet } from '$lib/rules-engine';
import type { PlannedRef, RuleModule } from '$lib/rules-engine';
import { enumerateLoadouts } from '$lib/rules-engine/loadout';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import hands from '$lib/rules-engine/rules/hands';
import loadout from '$lib/rules-engine/rules/loadout';
import dagger from '$lib/rules-engine/rules/dagger';
import level1 from '$lib/rules-engine/rules/class-paladin-level1';
import level5 from '$lib/rules-engine/rules/class-paladin-level5';

/**
 * Extra Attack (paladin level 5). No yaml scenario reaches this — every one is
 * initialEffects-blocked — so this drives the follow-up budget fold directly:
 * a level-5 character gets `extraAttacks.max = 1`, so an Attack action grants one
 * free follow-up swing (no extra action), and a third swing over-commits.
 *
 * Covers BOTH apply paths: unarmed (attacks module) and a weapon (weaponOffers).
 */
const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });
const NO_ACTION = 'rule.dnd-5e-2024.attacks.activation.no_action';

/** Setup: plan the loadout that puts `configId` in hand (the only equip path). */
const equip = (instanceId: string, modules: RuleModule[], configId: string): PlannedRef => {
  const config = enumerateLoadouts(modules).find((c) => c.id === configId);
  if (!config) throw new Error(`no such loadout configuration: ${configId}`);
  return { instanceId, ruleId: 'set-loadout', selections: { loadout: config } };
};

describe('extra attack — level 5 grants the follow-up budget', () => {
  it('contributes extraAttacks.max (stacking) and +1 proficiency', () => {
    expect(evaluateSheet([actionEconomy, attacks, level5], {})['extraAttacks.max']).toBe(1);
    expect(evaluateSheet([actionEconomy, attacks], {})['extraAttacks.max'] ?? 0).toBe(0);
    // level 1 (+2) and level 5 (+1) stack to a +3 proficiency bonus.
    expect(evaluateSheet([level1, level5], {})['proficiency.bonus']).toBe(3);
  });

  it('unarmed: the second swing is a free follow-up, the third over-commits', () => {
    const mods = [actionEconomy, attacks, level5];
    const a = 'unarmed-strike-use-action';

    const one = evaluatePlan(mods, {}, [ref('i0', a)]);
    expect(one.facts['actions.remaining']).toBe(0); // Attack action spent the action
    expect(one.facts['attackAction.extraRemaining']).toBe(1); // one follow-up granted

    const two = evaluatePlan(mods, {}, [ref('i0', a), ref('i1', a)]);
    expect(two.facts['actions.remaining']).toBe(0); // the follow-up costs no action
    expect(two.facts['attackAction.extraRemaining']).toBe(0); // budget spent
    expect(two.planDiagnostics.has('i1')).toBe(false); // the follow-up is legal

    const three = evaluatePlan(mods, {}, [ref('i0', a), ref('i1', a), ref('i2', a)]);
    expect(three.planDiagnostics.get('i2')?.some((d) => d.code === NO_ACTION)).toBe(true);
  });

  it('weapon: a held dagger gets the same one free follow-up', () => {
    const mods = [actionEconomy, attacks, hands, loadout, dagger, level5];
    const two = evaluatePlan(mods, {}, [
      equip('i0', mods, 'dagger'),
      ref('i1', 'dagger-use-action'),
      ref('i2', 'dagger-use-action')
    ]);
    expect(two.facts['actions.remaining']).toBe(0); // one action for two swings
    expect(two.facts['attackAction.extraRemaining']).toBe(0);
    expect(two.planDiagnostics.has('i2')).toBe(false); // second swing legal (free)

    const three = evaluatePlan(mods, {}, [
      equip('i0', mods, 'dagger'),
      ref('i1', 'dagger-use-action'),
      ref('i2', 'dagger-use-action'),
      ref('i3', 'dagger-use-action')
    ]);
    expect(three.planDiagnostics.get('i3')?.some((d) => d.code === NO_ACTION)).toBe(true);
  });
});

describe('unarmed opportunity attack is not a weapon attack', () => {
  it('the unarmed reaction does not set attack.last.weapon (weapon-only riders stay gated)', () => {
    const out = evaluatePlan([actionEconomy, attacks], {}, [
      ref('i0', 'unarmed-strike-use-reaction')
    ]);
    // The reaction is spent...
    expect(out.facts['reactions.remaining']).toBe(0);
    // ...but it is NOT a weapon attack: Savage Attacker / Great Weapon Fighting
    // read attack.last.weapon, and the unarmed ACTION path never sets it either.
    expect(out.facts['attack.last.weapon'] ?? 0).toBe(0);
  });

  it('a held weapon reaction DOES set attack.last.weapon (contrast)', () => {
    const mods = [actionEconomy, attacks, hands, loadout, dagger];
    const out = evaluatePlan(mods, {}, [
      equip('i0', mods, 'dagger'),
      ref('i1', 'dagger-use-reaction-weapon')
    ]);
    expect(out.facts['attack.last.weapon']).toBe(1);
  });
});
