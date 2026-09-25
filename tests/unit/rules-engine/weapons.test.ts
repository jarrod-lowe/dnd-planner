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
import scimitar from '$lib/rules-engine/rules/scimitar';
import greataxeMastery from '$lib/rules-engine/rules/greataxe-mastery';
import conditionBlinded from '$lib/rules-engine/rules/condition-blinded';
import conditionInvisible from '$lib/rules-engine/rules/condition-invisible';
import { resolveValueSource } from '$lib/components/play/panel-renderer/resolveValueSource';
import type { ValueSource } from '$lib/components/play/panel-renderer/types';

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
   * FOLLOWS the grip, onto the loadout's ABBREVIATED grip keys: the label
   * shares a button with the range ("5ft 1H"), and the full words made that button
   * change width as the grip changed. The picker's vertical list keeps the words.
   *
   * It reads the CAPTURED `twoHanded` var rather than `weapon.spear.twoHanded`
   * directly, so it freezes with the damage die it sits beside — see the captured
   * vars below, and PanelDiceLine-versatile-capture.test.ts for the behaviour.
   */
  const GRIP_LABEL = {
    var: 'twoHanded',
    map: {
      0: 'rule.dnd-5e-2024.loadout.grip.one-handed-short',
      1: 'rule.dnd-5e-2024.loadout.grip.two-handed-short'
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

  /**
   * The grip label and the damage die are the SAME statement about a row, so they
   * are captured together (#398). Split them — capture one, leave the other live —
   * and a row reads "1H" beside a d8 the moment a later loadout change lands, which
   * is worse than either drifting alone. Asserted on the authored shape so the pair
   * cannot be separated by an edit that never renders anything.
   */
  it('captures the grip and the die together on a versatile weapon', () => {
    const MODS = [actionEconomy, attacks, hands, loadout, spear];
    const facts = evaluatePlan(MODS, {}, [equip('i0', MODS, 'spear:2h')]).facts;
    const vars = evaluateOffers(MODS, facts).find((o) => o.id === 'spear-use-action')?.vars;

    expect(vars?.twoHanded).toEqual({
      capture: true,
      default: { fact: 'weapon.spear.twoHanded' }
    });
    expect(vars?.damageDie).toEqual({
      capture: true,
      default: { fact: 'attack.spear.damageDie' }
    });
  });

  it('leaves a one-grip weapon with a static die and no grip var', () => {
    const facts = evaluatePlan(ALL, {}, [equip('i0', ALL, 'greataxe')]).facts;
    const vars = evaluateOffers(ALL, facts).find((o) => o.id === 'greataxe-use-action')?.vars;

    expect(vars?.twoHanded).toBeUndefined();
    expect(vars?.damageDie).toEqual({ default: { number: 12 } });
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

/**
 * The builder's `diceControl` wires every PRIMARY attack control to the
 * weapon's disadvantage fact; the greataxe's Cleave secondary control is
 * authored in the module (not by the builder), so it must name the same source
 * itself. Without it a blinded/prone/untrained-armored Cleave rolled a flat
 * d20 while the swing beside it rolled 2d20-take-low.
 */
describe('weapons — the Cleave secondary control carries the disadvantage source', () => {
  it('reads the same STR flag the primary dice-line reads, so a blinded Cleave takes the low die', () => {
    const MODS = [
      actionEconomy,
      attacks,
      hands,
      loadout,
      greataxe,
      greataxeMastery,
      conditionBlinded
    ];
    // Hold the greataxe (mastery on, so the Cleave control exists) and be
    // blinded: the effect's disadvantage flags are live in the plan.
    const facts = evaluatePlan(MODS, {}, [
      equip('i0', MODS, 'greataxe'),
      ref('i1', 'record-blinded')
    ]).facts;
    expect(facts['condition.blinded']).toBe(1);
    expect(facts['attack.str.disadvantage']).toBe(1);

    const offer = evaluateOffers(MODS, facts).find((o) => o.id === 'greataxe-use-action');
    const ui = offer?.ui as { secondaryControl?: { advantage?: ValueSource } } | undefined;
    // Authored shape: the Cleave control declares the STR disadvantage fact,
    // mirroring the builder's `advantage: { fact: def.disadvantageFact }`.
    expect(ui?.secondaryControl?.advantage).toEqual({ fact: 'attack.str.disadvantage' });
    // ...and resolved against the blinded plan it is truthy — the exact source
    // PanelDiceLine's rulesDisadvantage reads, so the to-hit rolls 2d20-take-low.
    // (vars are untyped on the offer; resolveValueSource takes the panel's VarDefs)
    const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
    expect(resolveValueSource(ui?.secondaryControl?.advantage, facts, vars)).toBe(1);
  });
});

/**
 * The advantage counterpart of the two describes above: Invisible writes the
 * STR/DEX attack-ADVANTAGE flags, and every weapon dice-line gains an
 * `advantageUp` leg beside the historical `advantage` (which stays the
 * DISADVANTAGE source). The builder's `diceControl` wires the PRIMARY controls
 * from the new required `def.advantageFact`; pinned per ability — a STR
 * weapon (dagger) and the DEX-flagged scimitar — resolved against an invisible
 * plan the way PanelDiceLine's rulesAdvantage reads them.
 */
describe('weapons — the primary dice-lines carry the advantage source', () => {
  it.each([
    // [label, weapon module, equipped config, expected advantage fact]
    ['dagger (STR)', dagger, 'dagger', 'attack.str.advantage'],
    ['scimitar (DEX)', scimitar, 'scimitar', 'attack.dex.advantage']
  ] as const)(
    '%s declares and resolves advantageUp while invisible',
    (_label, weapon, configId, advantageFact) => {
      const MODS = [actionEconomy, attacks, hands, loadout, weapon, conditionInvisible];
      // Hold the weapon and be invisible: the effect's advantage flag is live
      // in the plan.
      const facts = evaluatePlan(MODS, {}, [
        equip('i0', MODS, configId),
        ref('i1', 'record-invisible')
      ]).facts;
      expect(facts['condition.invisible']).toBe(1);
      expect(facts[advantageFact]).toBe(1);

      const offer = evaluateOffers(MODS, facts).find((o) => o.id === `${weapon.id}-use-action`);
      const ui = offer?.ui as
        | {
            advantageFact?: string;
            primaryControl?: { advantageUp?: ValueSource };
          }
        | undefined;
      // Authored shape: the primary control declares the weapon's advantage
      // fact (`advantageUp: { fact: def.advantageFact }`), and the offer's ui
      // mirrors it beside the legacy disadvantageFact metadata.
      expect(ui?.primaryControl?.advantageUp).toEqual({ fact: advantageFact });
      expect(ui?.advantageFact).toBe(advantageFact);
      // ...and resolved against the invisible plan it is truthy — the exact
      // source PanelDiceLine's rulesAdvantage reads, so the to-hit defaults to
      // 2d20-take-high.
      const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
      expect(resolveValueSource(ui?.primaryControl?.advantageUp, facts, vars)).toBe(1);
    }
  );
});

describe('weapons — the Cleave secondary control carries the advantage source', () => {
  it('reads the same STR flag the primary dice-line reads, so an invisible Cleave takes the high die', () => {
    const MODS = [
      actionEconomy,
      attacks,
      hands,
      loadout,
      greataxe,
      greataxeMastery,
      conditionInvisible
    ];
    // Hold the greataxe (mastery on, so the Cleave control exists) and be
    // invisible: the effect's advantage flag is live in the plan.
    const facts = evaluatePlan(MODS, {}, [
      equip('i0', MODS, 'greataxe'),
      ref('i1', 'record-invisible')
    ]).facts;
    expect(facts['condition.invisible']).toBe(1);
    expect(facts['attack.str.advantage']).toBe(1);

    const offer = evaluateOffers(MODS, facts).find((o) => o.id === 'greataxe-use-action');
    const ui = offer?.ui as { secondaryControl?: { advantageUp?: ValueSource } } | undefined;
    // Authored shape: the Cleave control declares the STR advantage fact,
    // mirroring the builder's `advantageUp: { fact: def.advantageFact }`.
    expect(ui?.secondaryControl?.advantageUp).toEqual({ fact: 'attack.str.advantage' });
    // ...and resolved against the invisible plan it is truthy — the exact
    // source PanelDiceLine's rulesAdvantage reads, so the to-hit rolls
    // 2d20-take-high (the Cleave swing is still YOUR attack roll).
    const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
    expect(resolveValueSource(ui?.secondaryControl?.advantageUp, facts, vars)).toBe(1);
  });
});
