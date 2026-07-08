import { describe, it, expect } from 'vitest';
import findSteed from '$lib/rules-engine/rules/find-steed';
import type { Offer } from '$lib/rules-engine';

/**
 * Otherworldly Slam is a rollable spell attack, not a bare action row: the
 * action and reaction copies both carry the dice-line panel legacy authored —
 * d20 + the steed's slam hit bonus to hit, 1d8 + spell level damage, typed by
 * the steed's creature type. Both reuse the `steed-slam.*` i18n keys (the
 * reaction must NOT reference unauthored `steed-slam-reaction.*`), and the
 * reaction's legality is a "no reaction" message, not "no actions".
 */

const offers = findSteed.offer!({ selections: {} });
const byId = new Map(offers.map((o) => [o.id, o]));

const S = 'rule.spell-find-steed';
const CONTROL = {
  type: 'dice-line',
  ranges: [{ distance: 5, type: 'melee' }],
  dice: [
    { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
    {
      sides: { var: 'damageDie' },
      bonus: { var: 'damageBonus' },
      purpose: 'damage',
      damageType: { fact: 'companion.steed.damageType' }
    }
  ]
};
const VARS = {
  hitBonus: { capture: true, default: { fact: 'companion.steed.slam.hitBonus' } },
  damageDie: { default: { number: 8 } },
  damageBonus: { capture: true, default: { fact: 'find-steed.selectedLevel' } }
};

function codesOf(offer: Offer): string[] {
  return (offer.legalWhen ?? []).flatMap((g) => g.diagnostics.map((d) => d.code));
}

describe('steed Otherworldly Slam — rollable dice panel', () => {
  for (const id of ['steed-slam', 'steed-slam-reaction'] as const) {
    it(`${id} carries the dice-line, vars, and reuses the steed-slam i18n keys`, () => {
      const offer = byId.get(id);
      if (!offer?.ui) throw new Error(`offer ${id} with a ui payload expected`);
      expect(offer.ui.primaryControl).toEqual(CONTROL);
      expect(offer.vars).toEqual(VARS);
      // Both copies reuse the action's authored name/description (with the
      // {{damageType}} the description fills from the synthesized fact).
      expect(offer.ui.name).toBe(`${S}.steed-slam.name`);
      expect(offer.ui.description).toBe(`${S}.steed-slam.description`);
      expect(offer.ui.descriptionValues).toEqual({
        damageType: { fact: 'companion.steed.damageType' }
      });
      expect(offer.ui.detailKey).toBe('action/otherworldly-slam');
    });
  }

  it('the action reports "no actions", the reaction "no reaction" (authored keys)', () => {
    expect(codesOf(byId.get('steed-slam')!)).toEqual([`${S}.steed-slam.no_actions`]);
    expect(codesOf(byId.get('steed-slam-reaction')!)).toEqual([`${S}.steed-slam.no_reaction`]);
  });
});
