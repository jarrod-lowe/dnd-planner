import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { EffectInstance, Facts, RuleModule } from '$lib/rules-engine';
import conditionFrightened from '$lib/rules-engine/rules/condition-frightened';
import conditionPoisoned from '$lib/rules-engine/rules/condition-poisoned';

/**
 * The Frightened flag DERIVES (docs/plans/ideas/condition-frightened.md): the
 * 22 d20-test flags the SRD disadvantage touches, as gated derives (the
 * armorTrainingPenalties shape — effect `state` cannot be conditional on live
 * facts) reading BOTH `condition.frightened` and the player-asserted
 * `frightened.sourceHidden`. v2 drives the toggle through COMMITTED effects —
 * the state the dice-line chip's tap produces via the store's follow-up
 * channel (there is no picker offer any more). Pins: all 22 read 1 while
 * frightened with the source in sight; ALL 22 read 0 once the source is hidden
 * (FLAGS OFF MEANS OFF — zeroed, not merely absent: the contributions stand,
 * their value is 0); 0 while not frightened; and the combine-mode agreement
 * with Poisoned's stateCombine 'max' effect writes (co-evaluating the two must
 * not conflict-throw — the Blinded regression family).
 */
const SKILLS = [
  'acrobatics',
  'animal-handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight-of-hand',
  'stealth',
  'survival'
] as const;

const FLAG_FACTS = [
  'attack.str.disadvantage',
  'attack.dex.disadvantage',
  'initiative.disadvantage',
  'check.disadvantage',
  ...SKILLS.map((s) => `skill.${s}.disadvantage`)
];

const FACTS: Facts = {};

const conditionEffect = (): EffectInstance => ({
  id: 'effect-frightened',
  key: 'frightened',
  dependents: ['frightened-source'],
  state: { 'condition.frightened': 1 },
  expiry: { kind: 'untilShortRest' }
});

/** The committed toggle the chip's tap produces (addFollowupEffect, keyed replace). */
const hiddenToggle = (): EffectInstance => ({
  id: 'frightened-source-hidden',
  key: 'frightened-source',
  state: { 'frightened.sourceHidden': 1 },
  expiry: { kind: 'untilShortRest' }
});

const factsOf = (mods: RuleModule[], committed: EffectInstance[]) =>
  evaluate({ modules: mods, inputFacts: FACTS, committed }).facts;

/** Poisoned committed, as the recorder's apply advertises it (flags included). */
const poisonedCondition = (): EffectInstance => {
  const record = conditionPoisoned.offer!({ selections: {} }).find(
    (o) => o.id === 'record-poisoned'
  )!;
  return record.apply!({ num: () => 0, has: () => false }, {}).advertise![0]!;
};

describe('condition-frightened derives — the 22 gated flags', () => {
  it('visible: all 22 flags read 1 while frightened with the source in sight', () => {
    const facts = factsOf([conditionFrightened], [conditionEffect()]);
    expect(facts['condition.frightened']).toBe(1);
    for (const fact of FLAG_FACTS) expect(facts[fact], fact).toBe(1);
    expect(FLAG_FACTS).toHaveLength(22);
  });

  it('hidden: ALL 22 flags read 0 — zeroed, not merely absent', () => {
    const facts = factsOf([conditionFrightened], [conditionEffect(), hiddenToggle()]);
    expect(facts['frightened.sourceHidden']).toBe(1);
    for (const fact of FLAG_FACTS) {
      // The contribution still exists (a settled key holding 0), so a reader
      // that distinguishes unset from zero sees OFF, not unknown.
      expect(Object.keys(facts), fact).toContain(fact);
      expect(facts[fact], fact).toBe(0);
    }
  });

  it('un-frightened: the derives contribute 0 with no condition in force', () => {
    const facts = factsOf([conditionFrightened], []);
    for (const fact of FLAG_FACTS) expect(facts[fact] ?? 0, fact).toBe(0);
  });

  it('mode agreement with Poisoned: co-evaluation never conflict-throws, max wins', () => {
    const mods = [conditionPoisoned, conditionFrightened];
    // Both conditions live, source in sight: one effect write + one derive, max 1.
    const visible = factsOf(mods, [poisonedCondition(), conditionEffect()]);
    // Source hidden: Frightened contributes 0, Poisoned's write still wins max.
    const hidden = factsOf(mods, [poisonedCondition(), conditionEffect(), hiddenToggle()]);
    for (const fact of FLAG_FACTS) {
      expect(visible[fact], `${fact} visible`).toBe(1);
      expect(hidden[fact], `${fact} hidden — the uniform-max dividend`).toBe(1);
    }
  });
});
