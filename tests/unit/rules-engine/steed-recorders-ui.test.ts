import { describe, it, expect } from 'vitest';
import findSteed from '$lib/rules-engine/rules/find-steed';
import type { Offer } from '$lib/rules-engine';

/**
 * The steed's recorder rows are rollable, not bare: saves and skill checks carry
 * a d20 dice-line (+ the steed's save bonus / relevant ability modifier), saves
 * also a pass/fail outcome, and the note a text box — reusing the shared
 * `planner.record.save.*` / `play.stats.skills.*` name keys legacy used. The
 * Find Steed cast offer regains its slot-level slider and creature-type segmented.
 */

const offers = findSteed.offer!({ selections: {} });
const byId = new Map(offers.map((o) => [o.id, o]));
const S = 'rule.spell-find-steed';
const get = (id: string): Offer & { ui: NonNullable<Offer['ui']> } => {
  const o = byId.get(id);
  if (!o?.ui) throw new Error(`offer ${id} with a ui payload expected`);
  return o as Offer & { ui: NonNullable<Offer['ui']> };
};

describe('steed save recorders', () => {
  it('str save: d20 + the steed save bonus, a pass/fail outcome, shared name key', () => {
    const o = get('steed-save-str');
    expect(o.ui.name).toBe('planner.record.save.str');
    expect(o.ui.primaryControl).toEqual({
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'save' }]
    });
    expect(o.ui.secondaryControl).toEqual({
      type: 'segmented',
      var: 'passed',
      options: [
        { value: -1, label: 'planner.record.outcome.none' },
        { value: 1, label: 'planner.record.passed' },
        { value: 0, label: 'planner.record.failed' }
      ]
    });
    expect(o.vars?.rollBonus).toEqual({
      capture: true,
      default: { fact: 'companion.steed.str.save' }
    });
  });
});

describe('steed skill recorders', () => {
  it('acrobatics: d20 + the steed DEX modifier, shared skill name key', () => {
    const o = get('steed-skill-acrobatics');
    expect(o.ui.name).toBe('play.stats.skills.acrobatics');
    expect(o.ui.primaryControl).toEqual({
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'check' }]
    });
    expect(o.vars?.rollBonus).toEqual({
      capture: true,
      default: { fact: 'companion.steed.dex.modifier' }
    });
  });

  it('athletics maps to STR, arcana to INT (skill→ability)', () => {
    expect(get('steed-skill-athletics').vars?.rollBonus).toEqual({
      capture: true,
      default: { fact: 'companion.steed.str.modifier' }
    });
    expect(get('steed-skill-arcana').vars?.rollBonus).toEqual({
      capture: true,
      default: { fact: 'companion.steed.int.modifier' }
    });
  });
});

describe('steed note recorder', () => {
  it('is a multiline text box', () => {
    const o = get('steed-note');
    expect(o.ui.name).toBe(`${S}.steed-note.name`);
    expect(o.ui.primaryControl).toEqual({ type: 'text', var: 'text', multiline: true });
    expect(o.vars?.text).toEqual({ capture: true, default: { string: '' } });
  });
});

describe('Find Steed cast controls', () => {
  it('has a slot-level slider (free-use + L2–5, each gated) and a creature-type segmented', () => {
    const o = get('cast-find-steed');
    // `notches` — the key PanelSlider reads for explicit choices (not `values`) —
    // plus valueFormat so 0 renders as "Free Use".
    expect(o.ui.primaryControl).toEqual({
      type: 'slider',
      var: 'slotLevel',
      notches: [
        { value: 0, enabled: { fact: 'paladinFindSteed.total' } },
        { value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } },
        { value: 3, enabled: { fact: 'spellcasting.slots.level3.total' } },
        { value: 4, enabled: { fact: 'spellcasting.slots.level4.total' } },
        { value: 5, enabled: { fact: 'spellcasting.slots.level5.total' } }
      ],
      valueFormat: 'spellLevel'
    });
    expect(o.ui.secondaryControl).toEqual({
      type: 'segmented',
      var: 'creatureType',
      options: [
        { value: 0, label: `${S}.offer-find-steed.creature-type.celestial` },
        { value: 1, label: `${S}.offer-find-steed.creature-type.fey` },
        { value: 2, label: `${S}.offer-find-steed.creature-type.fiend` }
      ]
    });
  });
});
