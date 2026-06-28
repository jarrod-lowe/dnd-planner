import { defineRule, type Contribution, type RuleModule } from '../builder';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * Core spellcasting: one spell per turn, spell slots, and the highest slot level
 * owned. Everything is `remaining = total/max - spent` over the unified effect
 * model — slots are spent by `untilLongRest` effects, the per-turn "one spell"
 * by an `endOfTurn` effect. No explicit reset rules (effects age themselves).
 *
 * Slot capacities (`...total`) are inputs contributed by class levels.
 */
const spellcasting: RuleModule = {
  id: 'spellcasting',
  derive: () => [
    { fact: 'spellcasting.max', value: () => 1 },
    {
      fact: 'spellcasting.remaining',
      value: (f) => f.num('spellcasting.max') - f.num('spellcasting.spent')
    },
    ...LEVELS.map(
      (n): Contribution => ({
        fact: `spellcasting.slots.level${n}.remaining`,
        value: (f) =>
          f.num(`spellcasting.slots.level${n}.total`) - f.num(`spellcasting.slots.level${n}.spent`)
      })
    ),
    {
      // Highest slot level the character owns by capacity (0 if none).
      fact: 'spellcasting.maxSlotLevel',
      value: (f) => {
        let max = 0;
        for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.total`) > 0) max = n;
        return max;
      }
    },
    {
      // Save DC = 8 + proficiency bonus + spellcasting ability modifier. The
      // modifier (and which ability it is) is contributed by the casting class
      // (e.g. class-paladin-level1 → CHA); 0 here means no caster class.
      fact: 'spellcasting.saveDC',
      value: (f) => 8 + f.num('proficiency.bonus') + f.num('spellcasting.modifier')
    }
  ]
};

export default defineRule(spellcasting);
