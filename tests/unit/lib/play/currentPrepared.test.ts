import { describe, it, expect } from 'vitest';
import { currentPrepared } from '$lib/play/currentPrepared';
import type { Facts } from '$lib/rules-view';
import type { PrepareDef, RuleModule } from '$lib/rules-engine/types';

const def = (spellId: string, level: number): PrepareDef => ({
  spellId,
  level,
  nameKey: `rule.test.${spellId}.name`,
  preparedFact: `spell.l${level}.${spellId}.prepared`,
  alwaysPreparedFact: `spell.l${level}.${spellId}.alwaysPrepared`
});

const command = def('command', 1);
const sanctuary = def('sanctuary', 1);
const sleep = def('sleep', 1);
const aid = def('aid', 2);

const spell = (d: PrepareDef): RuleModule => ({ id: d.spellId, prepare: d });
// A module the picker must ignore: no `prepare` declaration, no vote.
const dagger: RuleModule = {
  id: 'dagger',
  equip: { hands: 1, nameKey: 'rule.test.dagger.name', state: { 'weapon.dagger.equipped': 1 } }
};

const modules: RuleModule[] = [spell(command), spell(sanctuary), spell(sleep), spell(aid), dagger];

/**
 * Hand-written facts, unlike currentLoadout's derived fixtures: that matcher
 * compares against the union of every fact any configuration can write, so a
 * literal fixture can silently stop matching, while this read consults only each
 * def's own `preparedFact` — there is no cross-fact set to drift out of sync
 * with. Each def is independent, so the literals are honest by construction.
 */
describe('currentPrepared', () => {
  it('seeds exactly the spells whose prepared fact reads 1', () => {
    const facts: Facts = {
      [command.preparedFact]: 1,
      [sleep.preparedFact]: 1
    };

    expect(currentPrepared(modules, facts)).toEqual([command, sleep]);
  });

  it('seeds nothing when no spell is prepared', () => {
    expect(currentPrepared(modules, {})).toEqual([]);
  });

  it('reads an absent prepared fact as 0, not as unselected-but-kept', () => {
    // The engine drops facts that settle to nothing, so "not prepared" arrives
    // as a missing key — aid must fall out of the set, not linger.
    const facts: Facts = { [command.preparedFact]: 1 };

    expect(currentPrepared(modules, facts)).toEqual([command]);
  });

  it('returns full PrepareDef objects the picker can commit, not bare ids', () => {
    const facts: Facts = { [aid.preparedFact]: 1 };
    const [seeded] = currentPrepared(modules, facts);

    expect(seeded).toEqual(aid);
    expect(seeded.preparedFact).toBe('spell.l2.aid.prepared');
  });

  /**
   * DECISION — always-prepared but not prepared does NOT seed.
   *
   * Facts are facts, mirroring currentLoadout's "empty hands is the honest
   * answer: it claims nothing": the seed claims exactly what the sheet carries,
   * and this def's `preparedFact` carries 0. Membership would be inert anyway —
   * PanelSpellPrepare renders the row checked via its OWN read of the
   * `alwaysPreparedFact` (`checked={locked || isSelected(def)}`), and both the
   * panel counter and the offer's cap count exclude always-prepared defs — so
   * seeding it would only make the committed effect write a `prepared` fact the
   * character never had.
   *
   * Grant-covered spells (prepared AND alwaysPrepared both 1) are a different
   * story — see the test below: those must NOT seed either.
   */
  it('does not seed an always-prepared spell whose prepared fact is unset', () => {
    const facts: Facts = {
      [sanctuary.alwaysPreparedFact]: 1,
      [command.preparedFact]: 1
    };

    expect(currentPrepared(modules, facts)).toEqual([command]);
  });

  /**
   * DECISION — a grant-covered spell (prepared AND alwaysPrepared both 1) does
   * NOT seed, even though its prepared fact reads 1.
   *
   * Always-prepared grants (Oath of Redemption and friends) write BOTH facts.
   * If the picker's selection captured such a spell, an untouched commit would
   * bake `prepared: 1` into the permanent `prepared-spells` effect — turning a
   * class-granted preparation into a manual one that outlives the grant (the
   * spell stays prepared and consumes cap after the granting module is
   * unassigned). The panel loses nothing: it renders the row checked via its
   * OWN `locked ||` read of the `alwaysPreparedFact`
   * (`checked={locked || isSelected(def)}`) and excludes always-prepared defs
   * from every count.
   */
  it('does not seed a grant-covered spell whose prepared fact the grant wrote', () => {
    const facts: Facts = {
      [sleep.preparedFact]: 1,
      [sleep.alwaysPreparedFact]: 1,
      [command.preparedFact]: 1
    };

    expect(currentPrepared(modules, facts)).toEqual([command]);
  });
});
