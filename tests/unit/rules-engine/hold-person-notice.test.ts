import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import concentration from '$lib/rules-engine/rules/concentration';
import holdPerson from '$lib/rules-engine/rules/hold-person';

/**
 * Notices batch 2 follow-up (user ruling): Hold Person is a concentration
 * spell, so its repeat-save reminder gets the SAME treatment as Concentrating,
 * not a spell-specific one. The cast's `effect-hold-person` marker spends the
 * concentration slot; the generic concentration reminder, keyed on
 * `concentration.remaining`, is what covers a held target — exactly as for
 * every other concentration spell. This pins that the module itself annotates
 * nothing and writes no private hold marker fact, so the held state cannot
 * grow a second reminder surface.
 */
const R = 'rule.spell-hold-person';
const ALL = [actionEconomy, spellcasting, concentration, holdPerson];
// A genuine L2 caster kit for this module set: slots + prepared are inputs (no
// class-level module here), and prof/modifier make the save DC a real number.
const FACTS: Facts = {
  'spellcasting.slots.level2.total': 1,
  'spell.l2.holdPerson.prepared': 1,
  'proficiency.bonus': 2,
  'spellcasting.modifier': 4
};
const cast = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-hold-person' });

describe('hold-person annotate — no notice', () => {
  it('a held target raises no hold-person notice; concentration is the reminder', () => {
    const out = evaluate({ modules: ALL, inputFacts: FACTS, planned: [cast('c1')] });
    // The cast holds concentration: the effect's `concentration.spent` is the
    // held state — the fact the generic concentration reminder keys on.
    expect(out.facts['concentration.remaining'], 'the hold spends the concentration slot').toBe(0);
    expect(out.facts['holdPerson.active'], 'no private hold marker fact').toBeUndefined();
    const own = out.annotations.filter((a) => a.key.startsWith(`${R}.`));
    expect(own, 'hold-person itself annotates nothing').toEqual([]);
    expect(
      own.some((a) => a.targets.includes(NOTICE_TARGET)),
      'no notice-targeted annotation while held'
    ).toBe(false);
  });
});
