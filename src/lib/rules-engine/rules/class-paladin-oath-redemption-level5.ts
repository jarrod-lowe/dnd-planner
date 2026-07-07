import { defineRule, type Contribution, type RuleModule } from '../builder';

/** Always-prepared grant for a level-2 oath spell (`prepared` via max, composes). */
const alwaysPreparedL2 = (spell: string): Contribution[] => [
  { fact: `spell.l2.${spell}.prepared`, combine: 'max', value: () => 1 },
  { fact: `spell.l2.${spell}.alwaysPrepared`, value: () => 1 }
];

/**
 * Oath of Redemption, level 5 — grants Calm Emotions and Hold Person
 * always-prepared (they do not count against the prepared-spell limit and can't
 * be unprepared). No Channel Divinity options at this level. Foundational, so no
 * meta.
 */
const oathLevel5: RuleModule = {
  id: 'class-paladin-oath-redemption-level5',
  derive: () => [...alwaysPreparedL2('calmEmotions'), ...alwaysPreparedL2('holdPerson')]
};

export default defineRule(oathLevel5);
