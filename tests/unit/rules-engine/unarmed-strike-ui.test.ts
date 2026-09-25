import { describe, it, expect } from 'vitest';
import attacks from '$lib/rules-engine/rules/attacks';

/**
 * The unarmed strike offers carry the dice panel the legacy attacks.yaml
 * authored: a dice-line primary control (d20 + hit bonus, flat 1 + STR damage —
 * `damageDie` 0 renders the flat bonus) and the captured hitBonus/damageBonus
 * vars defaulting to the module's own derives. Without them a planned unarmed
 * strike renders as a bare row with no roller.
 */

const offers = attacks.offer!({ selections: {} });
const byId = new Map(offers.map((o) => [o.id, o]));

describe('unarmed strike offers — dice panel', () => {
  for (const id of ['unarmed-strike-use-action', 'unarmed-strike-use-reaction'] as const) {
    it(`${id} carries the dice-line control and captured hit/damage vars`, () => {
      const offer = byId.get(id);
      if (!offer?.ui) throw new Error(`offer ${id} with a ui payload expected`);
      expect(offer.ui.primaryControl).toEqual({
        type: 'dice-line',
        ranges: [{ distance: 5, type: 'melee' }],
        // The historical name — this is the DISadvantage source (Prone,
        // Blinded, untrained armor). advantageUp beside it is the honest-named
        // ADVANTAGE source (Invisible), which PR1's roller reads.
        advantage: { fact: 'attack.str.disadvantage' },
        advantageUp: { fact: 'attack.str.advantage' },
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
          {
            sides: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            purpose: 'damage',
            damageType: { string: 'bludgeoning' }
          }
        ]
      });
      expect(offer.vars).toEqual({
        hitBonus: { capture: true, default: { fact: 'attack.unarmed.hitBonus' } },
        damageDie: { default: { number: 0 } },
        damageBonus: { capture: true, default: { fact: 'attack.unarmed.damageBonus' } }
      });
      // The panel metadata legacy carried on both copies.
      expect(offer.ui.detailKey).toBe('attack/unarmed-strike');
      expect(offer.ui.disadvantageFact).toBe('attack.str.disadvantage');
      // ...and its advantage mirror (panel-documentation parity with the
      // weapon offers' ui.advantageFact).
      expect(offer.ui.advantageFact).toBe('attack.str.advantage');
    });
  }
});
