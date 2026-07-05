import { describe, it, expect } from 'vitest';
import { evaluate, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine-v2';
import type { PlannedRef } from '$lib/rules-engine-v2';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';
import attacks from '$lib/rules-engine-v2/rules/attacks';
import hands from '$lib/rules-engine-v2/rules/hands';
import dagger from '$lib/rules-engine-v2/rules/dagger';
import greataxe from '$lib/rules-engine-v2/rules/greataxe';
import javelin from '$lib/rules-engine-v2/rules/javelin';
import javelinMastery from '$lib/rules-engine-v2/rules/javelin-mastery';

/**
 * Weapons spike — the `weaponOffers` builder helper that replaces v1's Python
 * weapon preprocessor (definitions × profiles cross-product).
 *
 * The yaml-scenario parity harness already covers the offer-existence / mastery /
 * hands-budget surface. This file pins down the *apply* paths the runnable
 * scenarios don't reach: the permanent keyed equip effect, the equip-budget
 * accounting, the build-lock gate, and the attack/reaction resource spends.
 */
const ALL = [actionEconomy, attacks, hands, dagger, greataxe];

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

describe('v2 weapons — equip (don)', () => {
  it('equips via a permanent keyed effect that survives end of turn, costing one hand', () => {
    const out = evaluatePlan(ALL, {}, [ref('i0', 'don-dagger')]);
    expect(out.facts['weapon.dagger.equipped']).toBe(1);
    expect(out.facts['hands.remaining']).toBe(1); // 2 - 1

    const eff = out.advertised.find((e) => e.id.includes('effect-dagger'));
    expect(eff?.key).toBe('equip:dagger');
    expect(eff?.expiry).toEqual({ kind: 'permanent' });

    // Permanent → still committed next turn, so the weapon stays equipped.
    const committed = endTurn([], out.advertised, {});
    expect(committed.some((e) => e.id.includes('effect-dagger'))).toBe(true);
  });

  it('re-donning the same weapon does not stack (the equip key dedupes)', () => {
    const out = evaluatePlan(ALL, {}, [ref('i0', 'don-dagger'), ref('i1', 'don-dagger')]);
    expect(out.facts['weapon.dagger.equipped']).toBe(1);
    expect(out.facts['hands.remaining']).toBe(1); // not 0 — one hand, not two
  });

  it('a two-handed weapon consumes both hands', () => {
    const out = evaluatePlan(ALL, {}, [ref('i0', 'don-greataxe')]);
    expect(out.facts['hands.remaining']).toBe(0); // 2 - 2
  });

  it('is illegal while the build is locked', () => {
    const facts = evaluatePlan(ALL, { 'build.locked': 1 }, []).facts;
    const don = evaluateOffers(ALL, facts).find((o) => o.id === 'don-dagger');
    expect(don?.legal).toBe(false);
    expect(don?.diagnostics.some((d) => d.code === 'rule.dnd-5e-2024.build-lock.locked')).toBe(
      true
    );
  });
});

describe('v2 weapons — attack offers gate on being equipped', () => {
  it('hides the action/reaction attacks when stowed, shows them when donned', () => {
    const stowed = evaluateOffers(ALL, evaluatePlan(ALL, {}, []).facts);
    expect(stowed.some((o) => o.id === 'dagger-use-action')).toBe(false);
    expect(stowed.some((o) => o.id === 'dagger-use-reaction-weapon')).toBe(false);

    const donned = evaluateOffers(ALL, evaluatePlan(ALL, {}, [ref('i0', 'don-dagger')]).facts);
    expect(donned.some((o) => o.id === 'dagger-use-action')).toBe(true);
    expect(donned.some((o) => o.id === 'dagger-use-reaction-weapon')).toBe(true);
  });
});

describe('v2 weapons — activations spend their resource', () => {
  it('a weapon Attack action spends the action; a second over-commits', () => {
    const one = evaluatePlan(ALL, {}, [ref('i0', 'don-dagger'), ref('i1', 'dagger-use-action')]);
    expect(one.facts['actions.remaining']).toBe(0);
    expect(one.planDiagnostics.has('i1')).toBe(false); // the first swing is legal

    const two = evaluatePlan(ALL, {}, [
      ref('i0', 'don-dagger'),
      ref('i1', 'dagger-use-action'),
      ref('i2', 'dagger-use-action')
    ]);
    expect(
      two.planDiagnostics
        .get('i2')
        ?.some((d) => d.code === 'rule.dnd-5e-2024.attacks.activation.no_action')
    ).toBe(true);
  });

  it('a weapon reaction spends the reaction and then reads illegal', () => {
    const donned = evaluateOffers(ALL, evaluatePlan(ALL, {}, [ref('i0', 'don-dagger')]).facts);
    expect(donned.find((o) => o.id === 'dagger-use-reaction-weapon')?.legal).toBe(true);

    const spent = evaluatePlan(ALL, {}, [
      ref('i0', 'don-dagger'),
      ref('i1', 'dagger-use-reaction-weapon')
    ]);
    expect(spent.facts['reactions.remaining']).toBe(0);
    const reaction = evaluateOffers(ALL, spent.facts).find(
      (o) => o.id === 'dagger-use-reaction-weapon'
    );
    expect(reaction?.legal).toBe(false);
  });
});

describe('v2 weapons — javelin Slow followup is a native EffectInstance', () => {
  it('rides the attack offer as addRule.effect (v2 shape, not a v1 rule)', () => {
    const MODS = [actionEconomy, attacks, hands, javelin, javelinMastery];
    // Equip the javelin so its Attack offer (which carries the Slow followup) shows.
    const out = evaluate({
      modules: MODS,
      inputFacts: {},
      planned: [ref('i0', 'don-javelin')],
      committed: []
    });
    const offer = out.availableRules.find((e) => e.rule.id === 'javelin-use-action');
    const followups = (
      offer?.rule.ui as { followups?: Array<{ addRule: { effect: unknown } }> } | undefined
    )?.followups;
    expect(followups?.[0].addRule.effect).toEqual({
      id: 'effect-javelin-slow',
      key: 'javelin-slow',
      display: { name: 'rule.dnd-5e-2024.attacks.javelin-slow.effect-name', section: 'mastery' },
      expiry: { kind: 'turns', remaining: 1 }
    });
  });
});
