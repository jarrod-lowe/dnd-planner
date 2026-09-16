import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin Spells (Level 1) — a spell-list grouping with no rules of its
 * own (`rules: []`); it exists so a character can be granted the level-1 paladin
 * spell list as a unit (its `requires` pulls in bless / command / cure-wounds /
 * detect-evil-and-good / divine-favour /
 * divine-smite / protection-from-evil-and-good / searing-smite /
 * shield-of-faith / thunderous-smite — the last a 2024-PHB paladin spell that
 * is absent from SRD 5.2, so its detail source is `custom`). The individual
 * spell groups carry
 * the actual behaviour, so this module contributes nothing and needs no meta.
 */
const paladinSpellsL1: RuleModule = {
  id: 'paladin-spells-l1'
};

export default defineRule(paladinSpellsL1);
