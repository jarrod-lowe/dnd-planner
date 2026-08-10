import {
  defineRule,
  statToModifier,
  type Contribution,
  type Diagnostic,
  type LegalWhen,
  type Offer,
  type RuleModule
} from '../builder';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
type Ability = (typeof ABILITIES)[number];

/** Ability code → the full word used in offer ids / i18n keys (set-strength, …). */
const FULL: Record<Ability, string> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma'
};

/** Skill → governing ability (18 skills; 5e 2024). */
const SKILLS: Record<string, Ability> = {
  athletics: 'str',
  acrobatics: 'dex',
  'sleight-of-hand': 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  'animal-handling': 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha'
};

const AS = 'rule.dnd-5e-2024.ability-scores';
const LOCKED = 'rule.dnd-5e-2024.build-lock.locked';
const MAX_SCORE = 20; // ASI cap (a score may reach but not exceed 20 by increases)

/** Every BUILD offer is gated on the build not being locked (build-lock group). */
const notLocked: LegalWhen = {
  condition: (f) => f.num('build.locked') === 0,
  diagnostics: [{ code: LOCKED, severity: 'error' }]
};

const SLIDER = {
  type: 'slider',
  var: 'score',
  max: { var: 'maxValue' },
  min: { number: 0 },
  step: 1
};
const SCORE_VARS = {
  score: { capture: true, default: { number: 10 } },
  maxValue: { default: { number: 30 } }
};
const SKILL_PROFICIENCY_CONTROL = {
  type: 'select',
  var: 'level',
  options: [
    {
      value: 0.5,
      label: 'play.topBar.proficientDotHalf',
      ariaLabel: 'play.choices.skillProficiency.half'
    },
    {
      value: 1,
      label: 'play.topBar.proficientDotFull',
      ariaLabel: 'play.choices.skillProficiency.full'
    },
    {
      value: 2,
      label: 'play.topBar.proficientDotDouble',
      ariaLabel: 'play.choices.skillProficiency.double'
    }
  ]
};

/** Set an ability score (slider). Illegal once already set; illegal-but-visible. */
function setOffer(a: Ability): Offer {
  const id = `set-${FULL[a]}`;
  const code = `${AS}.${id}-offer.already_set`;
  return {
    id,
    ui: {
      section: 'configuration',
      name: `${AS}.${id}.name`,
      ...(a === 'str' ? {} : { packBehind: 'set-strength' }),
      primaryControl: SLIDER,
      intents: { STAT: 'set' },
      actionCost: []
    },
    vars: SCORE_VARS,
    legalWhen: [
      notLocked,
      { condition: (f) => f.num(`${a}.value`) === 0, diagnostics: [{ code, severity: 'error' }] }
    ],
    apply: (f, selections) => {
      const score = typeof selections.score === 'number' ? selections.score : 10;
      const diagnostics: Diagnostic[] = [];
      if (f.num(`${a}.value`) !== 0) diagnostics.push({ code, severity: 'error' });
      // Keyed so re-setting replaces the base rather than stacking. Other
      // contributors to {a}.value (the increase effects) all use `sum`, so the
      // base + increments compose without a combine conflict.
      return {
        advertise: [
          {
            id: 'value',
            key: `${a}-value-base`,
            state: { [`${a}.value`]: score },
            // Named for the reveal toggle (effect-<ability>, hidden, shows the score).
            display: {
              name: `${AS}.effect-${FULL[a]}.name`,
              displayFact: `${a}.value`,
              hidden: true
            },
            expiry: { kind: 'permanent' }
          }
        ],
        diagnostics
      };
    }
  };
}

/** +1 to an ability score (permanent, stacking). Illegal at the 20 cap. */
function increaseOffer(a: Ability): Offer {
  const id = `increase-${FULL[a]}`;
  const code = `${AS}.${id}-offer.max_score`;
  return {
    id,
    ui: {
      section: 'configuration',
      name: `${AS}.${id}.name`,
      ...(a === 'str' ? {} : { packBehind: 'increase-strength' }),
      intents: { STAT: 'increase' },
      actionCost: []
    },
    legalWhen: [
      notLocked,
      {
        condition: (f) => f.num(`${a}.value`) < MAX_SCORE,
        diagnostics: [{ code, severity: 'error' }]
      }
    ],
    apply: (f) => {
      const diagnostics: Diagnostic[] = [];
      // An increase from >= 20 is illegal (increment first, then flag > 20).
      if (f.num(`${a}.value`) >= MAX_SCORE) diagnostics.push({ code, severity: 'error' });
      // Keyless so each increase stacks; permanent so it survives rests.
      return {
        advertise: [
          {
            id: 'increase',
            state: { [`${a}.value`]: 1 },
            display: { name: `${AS}.effect-increase-${FULL[a]}.name`, hidden: true },
            expiry: { kind: 'permanent' }
          }
        ],
        diagnostics
      };
    }
  };
}

/** Become proficient in a saving throw (adds the proficiency bonus to {a}.save). */
function saveProficiencyOffer(a: Ability): Offer {
  const id = `proficiency-${a}`;
  const code = `${AS}.${id}-offer.already_proficient`;
  return {
    id,
    ui: {
      section: 'configuration',
      name: `${AS}.${id}.name`,
      ...(a === 'str' ? {} : { packBehind: 'proficiency-str' }),
      intents: { PROFICIENCY: 'save' },
      actionCost: []
    },
    legalWhen: [
      notLocked,
      {
        condition: (f) => f.num(`${a}.save.proficient`) === 0,
        diagnostics: [{ code, severity: 'error' }]
      }
    ],
    apply: (f) => {
      const diagnostics: Diagnostic[] = [];
      if (f.num(`${a}.save.proficient`) !== 0) diagnostics.push({ code, severity: 'error' });
      return {
        advertise: [
          {
            id: 'save-prof',
            key: `${a}-save-prof`,
            state: { [`${a}.save.proficient`]: 1 },
            display: { name: `${AS}.effect-${a}-save-proficiency.name`, hidden: true },
            expiry: { kind: 'permanent' }
          }
        ],
        diagnostics
      };
    }
  };
}

/** Become proficient (or expert) in a skill; `level` is 0.5 / 1 / 2. */
function skillProficiencyOffer(skill: string): Offer {
  const id = `proficiency-${skill}`;
  const code = `${AS}.${skill}-proficiency-offer.already_proficient`;
  return {
    id,
    ui: {
      section: 'configuration',
      name: `${AS}.${id}.name`,
      // proficiency-acrobatics is the layout anchor; the rest pack behind it.
      ...(skill === 'acrobatics' ? {} : { packBehind: 'proficiency-acrobatics' }),
      primaryControl: SKILL_PROFICIENCY_CONTROL,
      intents: { PROFICIENCY: 'skill' },
      actionCost: []
    },
    vars: { level: { capture: true, default: { number: 1 } } },
    legalWhen: [
      notLocked,
      {
        condition: (f) => f.num(`skill.${skill}.proficiency`) === 0,
        diagnostics: [{ code, severity: 'error' }]
      }
    ],
    apply: (f, selections) => {
      const level = typeof selections.level === 'number' ? selections.level : 1;
      const diagnostics: Diagnostic[] = [];
      if (f.num(`skill.${skill}.proficiency`) !== 0) diagnostics.push({ code, severity: 'error' });
      return {
        advertise: [
          {
            id: 'skill-prof',
            key: `skill-${skill}-prof`,
            state: { [`skill.${skill}.proficiency`]: level },
            display: { name: `${AS}.effect-${skill}-proficiency.name`, hidden: true },
            expiry: { kind: 'permanent' }
          }
        ],
        diagnostics
      };
    }
  };
}

/**
 * Ability scores: the foundational build group. Six abilities, each with a
 * modifier and a saving throw; eighteen skills; and the BUILD offers that set
 * scores, raise them (ASI), and grant save/skill proficiencies.
 *
 * The functional shape vs the 3.7k-line legacy group:
 *  - A score (`{a}.value`) is contributed by EFFECTS, not derived: the `set`
 *    offer advertises a keyed base, each `increase` a keyless +1; both use `sum`,
 *    so they compose (base + increments) with no imperative "set then increment".
 *  - `{a}.modifier`, `{a}.save` and every `skill.*.value` are pure derives over
 *    those facts + `proficiency.bonus` (owned by class levels); the engine orders
 *    them by their reads, so no `early`/`after` phases.
 *  - Proficiency choices advertise keyed permanent effects the derives read.
 *
 * Foundational (auto-assigned, not user-searched), so no `meta` — like `hp` /
 * `action-economy`.
 */
const abilityScores: RuleModule = {
  id: 'ability-scores',
  derive: () => {
    const contributions: Contribution[] = [];
    for (const a of ABILITIES) {
      contributions.push({
        fact: `${a}.modifier`,
        // an unset score (absent fact) yields modifier 0, not
        // statToModifier(0) = -5. The scenarios assert modifier 0 for an
        // undefined input, and ability-score-set asserts str.modifier 0 pre-set.
        value: (f) => (f.has(`${a}.value`) ? statToModifier(f.num(`${a}.value`)) : 0)
      });
      contributions.push({
        // Save = ability modifier, plus the proficiency bonus if proficient.
        fact: `${a}.save`,
        value: (f) =>
          f.num(`${a}.modifier`) +
          (f.num(`${a}.save.proficient`) > 0 ? f.num('proficiency.bonus') : 0)
      });
    }
    for (const [skill, ability] of Object.entries(SKILLS)) {
      contributions.push({
        // Skill = governing ability modifier + proficiency bonus × level
        // (0 / 0.5 / 1 / 2), so half/expertise carry through.
        // combine:sum so situational bonuses (e.g. Emissary of Peace's +5
        // Persuasion) can be added by effects without a second-writer conflict.
        fact: `skill.${skill}.value`,
        combine: 'sum',
        value: (f) =>
          f.num(`${ability}.modifier`) +
          f.num('proficiency.bonus') * f.num(`skill.${skill}.proficiency`)
      });
    }
    return contributions;
  },
  offer: () => [
    ...ABILITIES.map(setOffer),
    ...ABILITIES.map(increaseOffer),
    ...ABILITIES.map(saveProficiencyOffer),
    ...Object.keys(SKILLS).map(skillProficiencyOffer)
  ]
};

export default defineRule(abilityScores);
