import { describe, it, expect } from 'vitest';
import { evaluate, evaluatePlan, evaluateOffers } from '$lib/rules-engine';
import type { PlannedRef, RuleModule } from '$lib/rules-engine';
import { enumerateLoadouts } from '$lib/rules-engine/loadout';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import hands from '$lib/rules-engine/rules/hands';
import loadout from '$lib/rules-engine/rules/loadout';
import dagger from '$lib/rules-engine/rules/dagger';
import greataxe from '$lib/rules-engine/rules/greataxe';
import javelin from '$lib/rules-engine/rules/javelin';
import javelinMastery from '$lib/rules-engine/rules/javelin-mastery';
import spear from '$lib/rules-engine/rules/spear';

/**
 * Weapons spike — the `weaponOffers` builder helper that replaces the legacy Python
 * weapon preprocessor (definitions × profiles cross-product).
 *
 * The yaml-scenario parity harness already covers the offer-existence / mastery /
 * hands-budget surface. This file pins down the *apply* paths the runnable
 * scenarios don't reach: the attack/reaction resource spends and the offer shapes
 * that ride an equipped weapon.
 *
 * Getting a weapon INTO a hand is no longer a weapon concern: the per-item don
 * offers are gone and `set-loadout` is the only write path, so equipping here is
 * just setup (see `equip` below). The loadout offer itself — its keyed permanent
 * effect, its hand budget and its indifference to the build lock — belongs to
 * loadout.test.ts, not here.
 */
const ALL = [actionEconomy, attacks, hands, loadout, dagger, greataxe];

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

/**
 * Setup: plan the loadout that puts `configId` in hand. The configuration comes
 * from the enumerator rather than a hand-written literal, so these tests hold a
 * weapon exactly the way the UI does.
 */
const equip = (instanceId: string, modules: RuleModule[], configId: string): PlannedRef => {
  const config = enumerateLoadouts(modules).find((c) => c.id === configId);
  if (!config) throw new Error(`no such loadout configuration: ${configId}`);
  return { instanceId, ruleId: 'set-loadout', selections: { loadout: config } };
};

describe('weapons — attack offers gate on being equipped', () => {
  it('hides the action/reaction attacks when stowed, shows them when held', () => {
    const stowed = evaluateOffers(ALL, evaluatePlan(ALL, {}, []).facts);
    expect(stowed.some((o) => o.id === 'dagger-use-action')).toBe(false);
    expect(stowed.some((o) => o.id === 'dagger-use-reaction-weapon')).toBe(false);

    const held = evaluateOffers(ALL, evaluatePlan(ALL, {}, [equip('i0', ALL, 'dagger')]).facts);
    expect(held.some((o) => o.id === 'dagger-use-action')).toBe(true);
    expect(held.some((o) => o.id === 'dagger-use-reaction-weapon')).toBe(true);
  });
});

describe('weapons — activations spend their resource', () => {
  it('a weapon Attack action spends the action; a second over-commits', () => {
    const one = evaluatePlan(ALL, {}, [equip('i0', ALL, 'dagger'), ref('i1', 'dagger-use-action')]);
    expect(one.facts['actions.remaining']).toBe(0);
    expect(one.planDiagnostics.has('i1')).toBe(false); // the first swing is legal

    const two = evaluatePlan(ALL, {}, [
      equip('i0', ALL, 'dagger'),
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
    const held = evaluateOffers(ALL, evaluatePlan(ALL, {}, [equip('i0', ALL, 'dagger')]).facts);
    expect(held.find((o) => o.id === 'dagger-use-reaction-weapon')?.legal).toBe(true);

    const spent = evaluatePlan(ALL, {}, [
      equip('i0', ALL, 'dagger'),
      ref('i1', 'dagger-use-reaction-weapon')
    ]);
    expect(spent.facts['reactions.remaining']).toBe(0);
    const reaction = evaluateOffers(ALL, spent.facts).find(
      (o) => o.id === 'dagger-use-reaction-weapon'
    );
    expect(reaction?.legal).toBe(false);
  });
});

describe('weapons — javelin Slow followup is a native EffectInstance', () => {
  it('rides the attack offer as addRule.effect (not a legacy rule object)', () => {
    const MODS = [actionEconomy, attacks, hands, loadout, javelin, javelinMastery];
    // Hold the javelin so its Attack offer (which carries the Slow followup) shows.
    const out = evaluate({
      modules: MODS,
      inputFacts: {},
      planned: [equip('i0', MODS, 'javelin')],
      committed: []
    });
    const offer = out.availableRules.find((e) => e.rule.id === 'javelin-use-action');
    const followups = (
      offer?.rule.ui as { followups?: Array<{ addRule: { effect: unknown } }> } | undefined
    )?.followups;
    expect(followups?.[0].addRule.effect).toEqual({
      id: 'effect-javelin-slow',
      key: 'javelin-slow',
      ruleGroupId: 'javelin',
      display: { name: 'rule.dnd-5e-2024.attacks.javelin-slow.effect-name', section: 'mastery' },
      expiry: { kind: 'turns', remaining: 1 }
    });
  });
});

describe('weapons — reaction (opportunity attack) is melee-only', () => {
  it('drops thrown range bands from the reaction, keeps them on the Attack action', () => {
    const MODS = [actionEconomy, attacks, hands, loadout, javelin, javelinMastery];
    const facts = evaluatePlan(MODS, {}, [equip('i0', MODS, 'javelin')]).facts;
    const offers = evaluateOffers(MODS, facts);

    const rangesOf = (o: { vars?: Record<string, unknown> } | undefined) => {
      const ranges = o?.vars?.ranges as
        | { default?: { array?: Array<{ type: string }> } }
        | undefined;
      return ranges?.default?.array ?? [];
    };

    const reactionRanges = rangesOf(offers.find((o) => o.id === 'javelin-use-reaction-weapon'));
    const actionRanges = rangesOf(offers.find((o) => o.id === 'javelin-use-action'));

    // The javelin is a thrown weapon (melee 5 ft + thrown 30/120). An opportunity
    // attack must be melee-only; the Attack action keeps the thrown bands.
    expect(reactionRanges.length).toBeGreaterThan(0);
    expect(reactionRanges.every((r) => r.type === 'melee')).toBe(true);
    expect(actionRanges.some((r) => r.type === 'thrown')).toBe(true);
  });
});

describe("weapons — a versatile weapon's melee band names the grip", () => {
  /**
   * The grip is fixed by the LOADOUT, not chosen per attack, so the only thing on
   * an attack row that moved with it was the damage die — "d6 or d8?" with nothing
   * saying which grip you are in. The melee band therefore carries a label that
   * FOLLOWS the grip fact, reusing the loadout's own grip keys so the vocabulary
   * is the same on the attack row and on the loadout chip.
   */
  const GRIP_LABEL = {
    fact: 'weapon.spear.twoHanded',
    map: {
      0: 'rule.dnd-5e-2024.loadout.grip.one-handed',
      1: 'rule.dnd-5e-2024.loadout.grip.two-handed'
    }
  };

  const rangesOf = (o: { vars?: Record<string, unknown> } | undefined) => {
    const ranges = o?.vars?.ranges as
      | { default?: { array?: Array<{ type: string; label?: unknown }> } }
      | undefined;
    return ranges?.default?.array ?? [];
  };

  const spearRanges = (configId: string) => {
    const MODS = [actionEconomy, attacks, hands, loadout, spear];
    const facts = evaluatePlan(MODS, {}, [equip('i0', MODS, configId)]).facts;
    return rangesOf(evaluateOffers(MODS, facts).find((o) => o.id === 'spear-use-action'));
  };

  it('labels the single melee band from the grip fact', () => {
    const melee = spearRanges('spear').filter((r) => r.type === 'melee');
    expect(melee).toHaveLength(1);
    expect(melee[0].label).toEqual(GRIP_LABEL);
  });

  it('leaves the thrown bands unlabelled — the grip changes what you swing, not what you throw', () => {
    const thrown = spearRanges('spear:2h').filter((r) => r.type === 'thrown');
    expect(thrown.length).toBeGreaterThan(0);
    expect(thrown.every((r) => r.label === undefined)).toBe(true);
  });

  it('leaves a one-grip weapon unlabelled', () => {
    const facts = evaluatePlan(ALL, {}, [equip('i0', ALL, 'greataxe')]).facts;
    const ranges = rangesOf(evaluateOffers(ALL, facts).find((o) => o.id === 'greataxe-use-action'));
    expect(ranges.length).toBeGreaterThan(0);
    expect(ranges.every((r) => r.label === undefined)).toBe(true);
  });
});

/**
 * Whether a band is a MELEE weapon attack is a rule, so the engine states it on
 * the band — the same way it pins a thrown band's damage die. Riders that RAW
 * only reach melee weapon attacks (Great Weapon Fighting's 1-2 → 3 damage floor)
 * are row-level signals: they are derived from facts and cannot see which band
 * the row is currently cycled to, so the band has to carry the answer itself.
 *
 * Without this a spear gripped two-handed floored its THROWN damage too.
 */
describe('weapons — bands declare whether they are melee attacks', () => {
  const bandsOf = (o: { vars?: Record<string, unknown> } | undefined) => {
    const ranges = o?.vars?.ranges as
      | { default?: { array?: Array<{ type: string; meleeAttack?: boolean }> } }
      | undefined;
    return ranges?.default?.array ?? [];
  };

  const spearBands = (configId: string) => {
    const MODS = [actionEconomy, attacks, hands, loadout, spear];
    const facts = evaluatePlan(MODS, {}, [equip('i0', MODS, configId)]).facts;
    return bandsOf(evaluateOffers(MODS, facts).find((o) => o.id === 'spear-use-action'));
  };

  it('marks a two-handed spear’s melee band as a melee attack', () => {
    const melee = spearBands('spear:2h').filter((r) => r.type === 'melee');
    expect(melee).toHaveLength(1);
    expect(melee[0].meleeAttack).toBe(true);
  });

  it('marks a two-handed spear’s thrown bands as NOT melee attacks', () => {
    const thrown = spearBands('spear:2h').filter((r) => r.type === 'thrown');
    expect(thrown.length).toBeGreaterThan(0);
    expect(thrown.every((r) => r.meleeAttack === false)).toBe(true);
  });

  it('marks a one-grip melee weapon’s band as a melee attack', () => {
    const facts = evaluatePlan(ALL, {}, [equip('i0', ALL, 'greataxe')]).facts;
    const bands = bandsOf(evaluateOffers(ALL, facts).find((o) => o.id === 'greataxe-use-action'));
    expect(bands.length).toBeGreaterThan(0);
    expect(bands.every((r) => r.meleeAttack === true)).toBe(true);
  });
});
