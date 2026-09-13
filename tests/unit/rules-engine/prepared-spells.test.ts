import { describe, it, expect } from 'vitest';
import { enumeratePreparableSpells, preparedEffectState } from '$lib/rules-engine/preparedSpells';
import type { PrepareDef } from '$lib/rules-engine/types';
import type { RuleModule } from '$lib/rules-engine/types';

/**
 * The prepared-spells enumerator — the pure, registry-driven function that turns
 * the modules a character has assigned into the preparable spell rows the
 * `set-prepared-spells` picker can show, one row per module declaring `prepare`.
 *
 * The unit of choice is the WHOLE SET, not the spell: the picker commits one
 * keyed effect carrying every prepared fact, so un-preparing is just a shorter
 * selection, not a separate offer.
 */

/** A module that declares a preparable spell — everything but `prepare` is noise here. */
const preparable = (prepare: PrepareDef): RuleModule => ({ id: `spell-${prepare.spellId}`, prepare });

const BLESS: PrepareDef = {
  spellId: 'bless',
  level: 1,
  nameKey: 'rule.spell-bless.offer-bless.name',
  preparedFact: 'spell.l1.bless.prepared',
  alwaysPreparedFact: 'spell.l1.bless.alwaysPrepared'
};

const SLEEP: PrepareDef = {
  spellId: 'sleep',
  level: 1,
  nameKey: 'rule.spell-sleep.offer-sleep.name',
  preparedFact: 'spell.l1.sleep.prepared',
  alwaysPreparedFact: 'spell.l1.sleep.alwaysPrepared'
};

const AID: PrepareDef = {
  spellId: 'aid',
  level: 2,
  nameKey: 'rule.spell-aid.offer-aid.name',
  preparedFact: 'spell.l2.aid.prepared',
  alwaysPreparedFact: 'spell.l2.aid.alwaysPrepared'
};

const CALM_EMOTIONS: PrepareDef = {
  spellId: 'calm-emotions',
  level: 2,
  nameKey: 'rule.spell-calm-emotions.offer-calm-emotions.name',
  preparedFact: 'spell.l2.calmEmotions.prepared',
  alwaysPreparedFact: 'spell.l2.calmEmotions.alwaysPrepared'
};

/** Foundational modules with no `prepare` — the enumerator must skip them silently. */
const HANDS: RuleModule = { id: 'hands' };
const AC: RuleModule = { id: 'ac' };

describe('enumeratePreparableSpells', () => {
  it('returns the prepare defs of modules that declare one, ignoring the rest', () => {
    const modules = [HANDS, preparable(CALM_EMOTIONS), preparable(BLESS), AC, preparable(SLEEP)];
    expect(enumeratePreparableSpells(modules).map((d) => d.spellId)).toEqual([
      'bless',
      'sleep',
      'calm-emotions'
    ]);
  });

  it('orders by level ascending, then spellId ascending', () => {
    const modules = [HANDS, preparable(AID), preparable(CALM_EMOTIONS), preparable(SLEEP), preparable(BLESS)];
    expect(
      enumeratePreparableSpells(modules).map((d) => `${d.level}|${d.spellId}`)
    ).toEqual(['1|bless', '1|sleep', '2|aid', '2|calm-emotions']);
  });

  it('is pure: the same modules in a different order yield the same list', () => {
    const modules = [HANDS, preparable(AID), preparable(SLEEP), preparable(BLESS), AC, preparable(CALM_EMOTIONS)];
    const shuffled = [AC, preparable(CALM_EMOTIONS), HANDS, preparable(BLESS), preparable(AID), preparable(SLEEP)];
    expect(enumeratePreparableSpells(shuffled)).toEqual(enumeratePreparableSpells(modules));
  });

  it('carries each def verbatim', () => {
    expect(enumeratePreparableSpells([HANDS, preparable(BLESS)])).toEqual([BLESS]);
  });

  it('enumerates nothing when no module declares a prepare', () => {
    expect(enumeratePreparableSpells([HANDS, AC])).toEqual([]);
  });
});

describe('preparedEffectState', () => {
  it('sets each selected spell’s prepared fact to 1, combined with max', () => {
    expect(preparedEffectState([BLESS, AID])).toEqual({
      state: { 'spell.l1.bless.prepared': 1, 'spell.l2.aid.prepared': 1 },
      stateCombine: { 'spell.l1.bless.prepared': 'max', 'spell.l2.aid.prepared': 'max' }
    });
  });

  it('sets no facts when nothing is selected', () => {
    expect(preparedEffectState([])).toEqual({ state: {}, stateCombine: {} });
  });
});
