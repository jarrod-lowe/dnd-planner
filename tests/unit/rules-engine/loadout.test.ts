import { describe, it, expect } from 'vitest';
import { enumerateLoadouts, loadoutEffectState, MAX_HANDS } from '$lib/rules-engine/loadout';
import type { LoadoutConfig } from '$lib/rules-engine/loadout';
import { evaluate, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import ac from '$lib/rules-engine/rules/ac';
import abilityScores from '$lib/rules-engine/rules/ability-scores';
import buildLock from '$lib/rules-engine/rules/build-lock';
import dagger from '$lib/rules-engine/rules/dagger';
import greataxe from '$lib/rules-engine/rules/greataxe';
import loadout from '$lib/rules-engine/rules/loadout';
import spear from '$lib/rules-engine/rules/spear';
import shield from '$lib/rules-engine/rules/shield';
import hands from '$lib/rules-engine/rules/hands';

/**
 * The loadout enumerator — the pure, registry-driven function that turns the
 * modules a character has assigned into the legal whole-hand configurations the
 * `set-loadout` offer can be pointed at.
 *
 * The unit of choice is the CONFIGURATION, not the item: "Spear (two-handed)" and
 * "Spear + Shield" are two rows, and "Spear (one-handed)" is a third because a
 * free hand is load-bearing (somatic components, Grapple, Lay on Hands).
 */
const MODULES = [hands, dagger, greataxe, spear, shield];

const byId = (configs: LoadoutConfig[], id: string): LoadoutConfig | undefined =>
  configs.find((c) => c.id === id);

const itemIds = (c: LoadoutConfig): string[] => c.items.map((i) => i.id);

describe('loadout enumerator', () => {
  const configs = enumerateLoadouts(MODULES);

  it('offers empty hands', () => {
    const empty = byId(configs, 'empty');
    expect(empty).toBeDefined();
    expect(empty!.hands).toBe(0);
    expect(empty!.handsFree).toBe(2);
    expect(empty!.items).toEqual([]);
  });

  it('ignores modules that declare no equip (hands is foundational, not an item)', () => {
    expect(configs.every((c) => !itemIds(c).includes('hands'))).toBe(true);
  });

  it('gives a two-handed weapon both hands and no companion', () => {
    const axe = byId(configs, 'greataxe');
    expect(axe).toBeDefined();
    expect(axe!.hands).toBe(2);
    expect(axe!.handsFree).toBe(0);
    // Every configuration holding the greataxe holds ONLY the greataxe.
    const withAxe = configs.filter((c) => itemIds(c).includes('greataxe'));
    expect(withAxe.map(itemIds)).toEqual([['greataxe']]);
  });

  it('offers a versatile weapon in both grips', () => {
    const oneHanded = byId(configs, 'spear');
    expect(oneHanded).toBeDefined();
    expect(oneHanded!.hands).toBe(1);
    expect(oneHanded!.handsFree).toBe(1);
    expect(oneHanded!.items[0].twoHanded).toBe(false);

    const twoHanded = byId(configs, 'spear:2h');
    expect(twoHanded).toBeDefined();
    expect(twoHanded!.hands).toBe(2);
    expect(twoHanded!.items).toHaveLength(1);
    expect(twoHanded!.items[0].twoHanded).toBe(true);
  });

  it('pairs a one-handed weapon with a shield', () => {
    const pair = byId(configs, 'dagger+shield');
    expect(pair).toBeDefined();
    expect(pair!.hands).toBe(2);
    expect(itemIds(pair!).sort()).toEqual(['dagger', 'shield']);
  });

  it('allows the same one-handed weapon in both hands', () => {
    const two = byId(configs, 'dagger+dagger');
    expect(two).toBeDefined();
    expect(two!.hands).toBe(2);
    expect(itemIds(two!)).toEqual(['dagger', 'dagger']);
  });

  it('never pairs a two-handed weapon with a shield', () => {
    const both = configs.filter(
      (c) => itemIds(c).includes('greataxe') && itemIds(c).includes('shield')
    );
    expect(both).toEqual([]);
  });

  it('does not stack a shield with itself (only stackable items repeat)', () => {
    expect(byId(configs, 'shield+shield')).toBeUndefined();
  });

  it('never exceeds the hand budget', () => {
    expect(configs.every((c) => c.hands <= 2 && c.handsFree === 2 - c.hands)).toBe(true);
  });

  it('is deterministically ordered by hands then id', () => {
    const keys = configs.map((c) => `${c.hands}|${c.id}`);
    expect(keys).toEqual([...keys].sort());
    // Pure: the same modules in a different order yield the same list.
    const shuffled = enumerateLoadouts([shield, spear, hands, greataxe, dagger]);
    expect(shuffled.map((c) => c.id)).toEqual(configs.map((c) => c.id));
  });

  it('carries the facts each item sets while held', () => {
    expect(byId(configs, 'spear')!.items[0].state).toEqual({ 'weapon.spear.equipped': 1 });
    expect(byId(configs, 'spear:2h')!.items[0].state).toEqual({
      'weapon.spear.equipped': 1,
      'weapon.spear.twoHanded': 1
    });
    const shieldItem = byId(configs, 'shield')!.items[0];
    expect(shieldItem.state).toEqual({ 'armor.shield.equipped': 1, 'ac.shieldBonus': 2 });
  });

  it('carries an i18n key for every item name and for the empty configuration', () => {
    for (const c of configs) {
      for (const item of c.items) expect(item.nameKey.startsWith('rule.')).toBe(true);
    }
    expect(byId(configs, 'empty')!.emptyKey?.startsWith('rule.')).toBe(true);
  });

  it('labels the grip of a versatile weapon only', () => {
    expect(byId(configs, 'spear:2h')!.items[0].gripKey).toMatch(/two-handed$/);
    expect(byId(configs, 'spear')!.items[0].gripKey).toMatch(/one-handed$/);
    expect(byId(configs, 'dagger')!.items[0].gripKey).toBeUndefined();
  });
});

/**
 * The `set-loadout` offer itself: one keyed permanent effect, no build-lock gate,
 * and no action spend. The yaml scenarios cover the player-visible facts; these
 * pin the effect's shape (which the scenario asserts can't reach) and the
 * degradation of a selection that outlived the evaluation that produced it.
 */
const PLAY = [hands, loadout, ac, abilityScores, shield, dagger, greataxe, spear];

const configOf = (id: string): LoadoutConfig => {
  const found = enumerateLoadouts(PLAY).find((c) => c.id === id);
  if (!found) throw new Error(`no such configuration: ${id}`);
  return found;
};

const plan = (instanceId: string, config: LoadoutConfig): PlannedRef => ({
  instanceId,
  ruleId: 'set-loadout',
  selections: { loadout: config }
});

const NO_HANDS = 'rule.dnd-5e-2024.loadout.set-loadout-offer.no-hands';

const hasNoHands = (diagnostics: { code: string }[] | undefined): boolean =>
  diagnostics?.some((d) => d.code === NO_HANDS) ?? false;

/** A hand tied up by something that is not the loadout — the shared-budget case. */
const GRAPPLING: EffectInstance = {
  id: 'effect-grappling',
  key: 'grappling',
  state: { 'hands.spent': 1 },
  expiry: { kind: 'permanent' }
};

describe('set-loadout offer', () => {
  it('commits ONE permanent effect under the shared `loadout` key', () => {
    const out = evaluatePlan(PLAY, {}, [plan('i0', configOf('dagger+shield'))]);
    const effects = out.advertised.filter((e) => e.id.includes('effect-loadout'));
    expect(effects).toHaveLength(1);
    expect(effects[0].key).toBe('loadout');
    expect(effects[0].expiry).toEqual({ kind: 'permanent' });

    // Permanent → survives the turn, so the loadout is still held next turn.
    const committed = endTurn([], out.advertised, {});
    expect(committed.filter((e) => e.id.includes('effect-loadout'))).toHaveLength(1);
  });

  it('spends no action — swapping is free (house rule)', () => {
    const out = evaluatePlan(PLAY, {}, [plan('i0', configOf('greataxe'))]);
    expect(out.facts['hands.remaining']).toBe(0);
    expect(out.facts['actions.spent'] ?? 0).toBe(0);
  });

  it('stays legal while the build is locked', () => {
    const locked = evaluatePlan([...PLAY, buildLock], {}, [{ instanceId: 'i0', ruleId: 'lock' }]);
    expect(locked.facts['build.locked']).toBe(1);
    const offer = evaluateOffers([...PLAY, buildLock], locked.facts).find(
      (o) => o.id === 'set-loadout'
    );
    expect(offer?.legal).toBe(true);
    expect(offer?.diagnostics).toEqual([]);
  });

  it('degrades an unreadable selection to empty hands rather than throwing', () => {
    const out = evaluatePlan(PLAY, {}, [
      { instanceId: 'i0', ruleId: 'set-loadout', selections: { loadout: 'nonsense' } }
    ]);
    expect(out.facts['hands.remaining']).toBe(2);
    expect(out.facts['weapon.dagger.equipped'] ?? 0).toBe(0);
  });

  it('flags a selection asking for more hands than the character has', () => {
    const overreach: LoadoutConfig = {
      ...configOf('dagger+shield'),
      items: [...configOf('dagger+shield').items, ...configOf('greataxe').items]
    };
    const out = evaluatePlan(PLAY, {}, [plan('i0', overreach)]);
    expect(hasNoHands(out.planDiagnostics.get('i0'))).toBe(true);
  });

  /**
   * The budget is shared. Grapple keeps a hand while the target is Grappled, so a
   * two-handed loadout no longer fits — and the gate has to notice, because the
   * reverse order already did: Grapple's own gate reads `hands.remaining`. Reading
   * `hands.max` alone made loadout-after-grapple the one unguarded direction.
   */
  it('counts hands already spent elsewhere, not just the character’s maximum', () => {
    const out = evaluatePlan(PLAY, {}, [plan('i0', configOf('greataxe'))], [GRAPPLING]);
    expect(hasNoHands(out.planDiagnostics.get('i0'))).toBe(true);
    expect(out.planIllegal.has('i0')).toBe(true);
  });

  it('leaves a loadout that still fits alongside the grapple alone', () => {
    const out = evaluatePlan(PLAY, {}, [plan('i0', configOf('dagger'))], [GRAPPLING]);
    expect(hasNoHands(out.planDiagnostics.get('i0'))).toBe(false);
    expect(out.facts['hands.remaining']).toBe(0);
  });

  /**
   * The subtraction must use the loadout's OWN share, not the aggregate, or
   * swapping one two-handed weapon for another would read as needing four hands.
   */
  it('does not count the loadout it is replacing', () => {
    const held = evaluatePlan(PLAY, {}, [plan('i0', configOf('greataxe'))]);
    const committed = endTurn([], held.advertised, {});
    const swap = evaluatePlan(PLAY, {}, [plan('i1', configOf('spear:2h'))], committed);
    expect(hasNoHands(swap.planDiagnostics.get('i1'))).toBe(false);
    expect(swap.facts['hands.remaining']).toBe(0);
  });
});

/**
 * The enumerator and the `hands` rule must bound the same budget. They used to
 * hard-code 2 independently, so a change to one would have silently offered
 * configurations the other rejects.
 */
describe('hand budget', () => {
  it('enumerates against the same maximum the hands rule derives', () => {
    expect(evaluatePlan([hands], {}, []).facts['hands.max']).toBe(MAX_HANDS);
    expect(enumerateLoadouts(PLAY).every((c) => c.hands <= MAX_HANDS)).toBe(true);
  });
});

describe('loadoutEffectState', () => {
  it('merges every held item’s facts and the hands they spend', () => {
    expect(loadoutEffectState(configOf('spear:2h'))).toEqual({
      'hands.spent': 2,
      'loadout.hands.spent': 2,
      'grip.twoHanded': 1,
      'weapon.spear.equipped': 1,
      'weapon.spear.twoHanded': 1
    });
  });

  it('sets a held fact once, however many copies are held', () => {
    expect(loadoutEffectState(configOf('dagger+dagger'))).toEqual({
      'hands.spent': 2,
      'loadout.hands.spent': 2,
      'weapon.dagger.equipped': 1
    });
  });

  it('empties the hands when nothing is held', () => {
    expect(loadoutEffectState(configOf('empty'))).toEqual({
      'hands.spent': 0,
      'loadout.hands.spent': 0
    });
  });

  /**
   * `hands.spent` is the shared budget — Grapple writes it too — so the loadout
   * also records its OWN share. Only one loadout effect can exist (they share a
   * key, and the newest evicts the older), so this fact is unambiguous, and it is
   * what lets the gate work out how many hands are spoken for elsewhere and the
   * matcher tell one dagger from two without being fooled by a grapple.
   */
  it('records its own share of the hand budget separately from the aggregate', () => {
    for (const id of ['empty', 'dagger', 'dagger+dagger', 'spear:2h', 'greataxe']) {
      const state = loadoutEffectState(configOf(id));
      expect(state['loadout.hands.spent'], id).toBe(state['hands.spent']);
    }
  });

  /**
   * `grip.twoHanded` is the GRIP, not the weapon: rules that care whether both
   * hands are on one haft (Great Weapon Fighting) should not have to know which
   * weapon it is. A two-handed grip consumes both hands, so at most one item can
   * ever be held that way and one global fact is unambiguous.
   */
  it('flags a two-handed grip for an inherently two-handed weapon too', () => {
    expect(loadoutEffectState(configOf('greataxe'))).toEqual({
      'hands.spent': 2,
      'loadout.hands.spent': 2,
      'grip.twoHanded': 1,
      'weapon.greataxe.equipped': 1
    });
  });

  it('does not flag a grip when both hands hold separate one-handed items', () => {
    expect(loadoutEffectState(configOf('dagger+dagger'))['grip.twoHanded']).toBeUndefined();
    expect(loadoutEffectState(configOf('spear'))['grip.twoHanded']).toBeUndefined();
  });
});

/**
 * Shield training. The deleted `don-shield` offer carried the ONLY
 * warning-severity gate in the codebase, and the check itself is a real rule —
 * a shield you have no training with grants you nothing — so the loadout
 * inherits it rather than losing it.
 *
 * Warning, never error, exactly as don-shield was: the loadout still applies and
 * the planned row stays LEGAL (the fold only blocks on an `apply` diagnostic of
 * ERROR severity), while the catalog row reads illegal-but-visible for as long as
 * the untrained shield is actually in hand.
 */
const NOT_PROFICIENT = 'rule.dnd-5e-2024.loadout.set-loadout-offer.not-proficient';

const withShield = (proficient: number, config = 'dagger+shield') =>
  evaluate({
    modules: PLAY,
    inputFacts: { 'armor.shield.proficient': proficient },
    planned: [plan('i0', configOf(config))]
  });

describe('set-loadout — shield training', () => {
  it('warns when the chosen loadout holds a shield the character is untrained with', () => {
    const out = withShield(0);
    expect(out.planDiagnostics['i0'] ?? []).toContainEqual({
      code: NOT_PROFICIENT,
      severity: 'warning'
    });
  });

  it('does not block: the row stays legal and the shield is still equipped', () => {
    const out = withShield(0);
    expect(out.plannedOffers['i0'].legal).toBe(true);
    expect(out.status.legal).toBe(true);
    expect(out.facts['armor.shield.equipped']).toBe(1);
    expect(out.facts['ac.shieldBonus']).toBe(2);
  });

  it('stays silent once the character is proficient with shields', () => {
    const out = withShield(1);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.plannedOffers['i0'].legal).toBe(true);
  });

  it('stays silent for a loadout with no shield in it', () => {
    const out = withShield(0, 'dagger+dagger');
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
  });

  it('marks the catalog row illegal-but-visible while the untrained shield is held', () => {
    const row = withShield(0).availableRules.find((o) => o.rule.id === 'set-loadout');
    expect(row?.legal).toBe(false);
    expect(row?.diagnostics).toContainEqual({ code: NOT_PROFICIENT, severity: 'warning' });
  });

  it('leaves the catalog row clean when the shield is trained, or not held at all', () => {
    const trained = withShield(1).availableRules.find((o) => o.rule.id === 'set-loadout');
    expect(trained?.legal).toBe(true);
    expect(trained?.diagnostics).toEqual([]);

    const empty = evaluate({
      modules: PLAY,
      inputFacts: { 'armor.shield.proficient': 0 },
      planned: []
    }).availableRules.find((o) => o.rule.id === 'set-loadout');
    expect(empty?.legal).toBe(true);
    expect(empty?.diagnostics).toEqual([]);
  });
});
