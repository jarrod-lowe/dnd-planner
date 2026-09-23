import { defineRule, type ActionResult, type Annotation, type RuleModule } from '../builder';

const CP = 'rule.dnd-5e-2024.condition-prone';

/**
 * Prone — the first D&D condition, as a recorder. This models BEING KNOCKED
 * PRONE (imposed by an enemy effect), so the recorder is free and ungated —
 * legal at any Speed. Voluntarily DROPPING prone (a free choice under the SRD
 * "Dropping Prone" rule) is not modelled. Recording it commits a keyed effect
 * holding `condition.prone` plus the STR/DEX attack-disadvantage flags the
 * weapon and unarmed dice-lines already read (so the rollers default to
 * 2d20-take-low with zero roller changes), and a NOTICE carries the
 * condition's standing effects — attacks against you stay notice text only
 * (no NPC modelling).
 *
 * One deliberate deviation (docs/plans/ideas/condition-prone.md): any rest
 * clears the condition (`untilShortRest`; a long rest includes a short),
 * where SRD 5.2 leaves it standing until righted.
 *
 * The disadvantage flags carry `stateCombine: 'max'` (the armor idiom): the
 * armor modules derive the same facts with `combine: 'max'`, and the default
 * `sum` on an effect write would conflict-throw for any armored character.
 * Foundational, so no search meta.
 */
const conditionProne: RuleModule = {
  id: 'condition-prone',
  offer: () => [
    {
      id: 'record-prone',
      ui: {
        section: 'free',
        name: `${CP}.record-prone.name`,
        detailKey: 'condition/prone',
        intents: { CONDITION: 'prone' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [
          // Keyed so a later get-up clear (an empty same-key effect) evicts it.
          {
            id: 'effect-prone',
            key: 'prone',
            state: {
              'condition.prone': 1,
              'attack.str.disadvantage': 1,
              'attack.dex.disadvantage': 1
            },
            stateCombine: {
              'attack.str.disadvantage': 'max',
              'attack.dex.disadvantage': 'max'
            },
            display: { name: `${CP}.effect-prone.name` },
            expiry: { kind: 'untilShortRest' }
          }
        ]
      })
    }
  ],
  // While prone, a NOTICE carries the standing effects. 'notice' ==
  // NOTICE_TARGET; rule modules may import only the builder, so the reserved
  // label is a literal here (see feat-sentinel/hold-person).
  annotate: (f): Annotation[] =>
    f.num('condition.prone') > 0
      ? [
          {
            key: `${CP}.notice`,
            targets: ['notice'],
            source: `${CP}.effect-prone.name`,
            body: `${CP}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionProne);
