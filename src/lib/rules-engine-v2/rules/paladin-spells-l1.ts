import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin Spells (Level 1) — a spell-list grouping. In v1 it has no rules of its
 * own (`rules: []`); it exists so a character can be granted the level-1 paladin
 * spell list as a unit (its `requires` pulls in bless / command / divine-favour /
 * divine-smite / protection-from-evil-and-good). The individual spell groups carry
 * the actual behaviour, so this module contributes nothing and needs no meta.
 */
const paladinSpellsL1: RuleModule = {
  id: 'paladin-spells-l1'
};

export default defineRule(paladinSpellsL1);
