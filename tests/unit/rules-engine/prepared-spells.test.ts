import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import { enumeratePreparableSpells, preparedEffectState } from '$lib/rules-engine/preparedSpells';
import coreEvents from '$lib/rules-engine/rules/core-events';
import preparedSpells from '$lib/rules-engine/rules/prepared-spells';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
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
const preparable = (prepare: PrepareDef): RuleModule => ({
  id: `spell-${prepare.spellId}`,
  prepare
});

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
    const modules = [
      HANDS,
      preparable(AID),
      preparable(CALM_EMOTIONS),
      preparable(SLEEP),
      preparable(BLESS)
    ];
    expect(enumeratePreparableSpells(modules).map((d) => `${d.level}|${d.spellId}`)).toEqual([
      '1|bless',
      '1|sleep',
      '2|aid',
      '2|calm-emotions'
    ]);
  });

  it('is pure: the same modules in a different order yield the same list', () => {
    const modules = [
      HANDS,
      preparable(AID),
      preparable(SLEEP),
      preparable(BLESS),
      AC,
      preparable(CALM_EMOTIONS)
    ];
    const shuffled = [
      AC,
      preparable(CALM_EMOTIONS),
      HANDS,
      preparable(BLESS),
      preparable(AID),
      preparable(SLEEP)
    ];
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

/**
 * A finished Long Rest is when a prepared caster may swap spells out, so the
 * module reminds the player ON the long-rest recorder — and the reminder names
 * the set picker, because re-committing the set with the change IS the swap.
 */
const SWAP_KEY = 'rule.dnd-5e-2024.prepared-spells.annotation-long-rest';
// Class levels contribute prepared.max; none is in this module set, so it is a
// genuine input (the sheet rejects inputs a module derives).
const CAPACITY = { 'spellcasting.prepared.max': 2 };

describe('prepared-spells annotate — long-rest swap reminder', () => {
  it('targets the long-rest panel while the character can prepare spells', () => {
    const out = evaluate({ modules: [preparedSpells, spellcasting], inputFacts: CAPACITY });
    const ann = out.annotations.find((a) => a.key === SWAP_KEY);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual(['rest.long']);
    expect(ann!.addsToPlan).toEqual({ offer: 'set-prepared-spells' });
  });

  it('is absent for a character with no prepared capacity', () => {
    // No class level → prepared.max unset → 0: a known-spells caster (or no
    // caster at all) cannot swap prepared spells, so no reminder.
    const out = evaluate({ modules: [preparedSpells, spellcasting] });
    expect(out.annotations.find((a) => a.key === SWAP_KEY)).toBeUndefined();
  });

  it('lands: the long-rest recorder carries the rest.long label', () => {
    const out = evaluate({ modules: [coreEvents], planned: [] });
    const entry = out.availableRules.find((e) => e.rule.id === 'record-long-rest');
    expect(entry, 'record-long-rest offer exists').toBeDefined();
    expect((entry!.rule.ui as Record<string, unknown> | undefined)?.annotationLabels).toEqual([
      'rest.long'
    ]);
  });
});
