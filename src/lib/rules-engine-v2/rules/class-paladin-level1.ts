import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 1 contributions to the sheet: +2 proficiency, a d10 hit die
 * worth of max HP (10 + CON modifier), two level-1 spell slots, Wisdom/Charisma
 * save proficiency, and Charisma as the spellcasting ability. All use
 * `combine: sum` so multiple class levels / classes stack with no ordering —
 * addition is commutative and the engine settles all contributors before
 * dependents read the total.
 *
 * (Still partial vs the v1 group: hit-die, the lay-on-hands pool and
 * prepared-spell capacity port with their dependent groups in later M3 waves.)
 */
const paladinLevel1: RuleModule = {
  id: 'class-paladin-level1',
  derive: () => [
    { fact: 'proficiency.bonus', combine: 'sum', value: () => 2 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 10 + f.num('con.modifier') },
    // Paladin level 1 grants two level-1 spell slots.
    { fact: 'spellcasting.slots.level1.total', combine: 'sum', value: () => 2 },
    // Wisdom and Charisma save proficiency. Only the flag is set; ability-scores'
    // save derive adds the proficiency bonus from it, so it is not double-counted.
    { fact: 'wis.save.proficient', combine: 'sum', value: () => 1 },
    { fact: 'cha.save.proficient', combine: 'sum', value: () => 1 },
    // Charisma is the paladin's spellcasting ability; its modifier feeds the
    // spell save DC (computed by the spellcasting group).
    { fact: 'spellcasting.modifier', combine: 'sum', value: (f) => f.num('cha.modifier') },
    // Proficient in all armor and shields.
    { fact: 'armor.light.proficient', combine: 'sum', value: () => 1 },
    { fact: 'armor.medium.proficient', combine: 'sum', value: () => 1 },
    { fact: 'armor.heavy.proficient', combine: 'sum', value: () => 1 },
    { fact: 'armor.shield.proficient', combine: 'sum', value: () => 1 }
  ]
};

export default defineRule(paladinLevel1);
