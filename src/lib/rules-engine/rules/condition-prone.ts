import {
  defineRule,
  type ActionResult,
  type Annotation,
  type Diagnostic,
  type RuleModule
} from '../builder';

const CP = 'rule.dnd-5e-2024.condition-prone';
const CANNOT_GET_UP = `${CP}.get-up-offer.cannot_get_up`;
const OUT_OF_MOVEMENT = `${CP}.get-up-offer.out_of_movement`;

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
 * While prone, GET UP rights you for half your SPEED (floored — the
 * `character.movement.half_speed` the movement group derives from the
 * species-contributed `character.movement.speed`; Dash boosts movement.total
 * only, so dashing never raises the cost). Its apply advertises the SAME
 * eviction idiom a failed concentration save uses: an EMPTY same-`key`
 * ('prone') effect that newest-wins-replaces the condition while merely
 * planned, plus a keyless endOfTurn movement spend (the move idiom).
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
    },
    {
      // Right yourself, ending the condition. Structural gate, not legality:
      // the offer does not EXIST while standing, and a planned get-up row
      // whose gate has closed is skipped — so Get Up cannot be pre-planned
      // before dropping prone.
      id: 'get-up',
      when: (f) => f.num('condition.prone') > 0,
      ui: {
        section: 'move',
        name: `${CP}.get-up.name`,
        description: `${CP}.get-up.description`,
        intents: { MOVE: 'rise' },
        // Fixed cost (half Speed, floored) — no slider, the dash shape.
        actionCost: ['move']
      },
      legalWhen: [
        // SRD 5.2 Prone: "If your Speed is 0, you can't right yourself."
        {
          condition: (f) => f.num('character.movement.speed') > 0,
          diagnostics: [{ code: CANNOT_GET_UP, severity: 'error' }]
        },
        // Affordability: the cost is fixed (half Speed), so it must be on hand.
        {
          condition: (f) =>
            f.num('character.movement.remaining') >= f.num('character.movement.half_speed'),
          diagnostics: [{ code: OUT_OF_MOVEMENT, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row
        // carries its own diagnostics from the fold.
        const diagnostics: Diagnostic[] = [];
        if (f.num('character.movement.speed') <= 0)
          diagnostics.push({ code: CANNOT_GET_UP, severity: 'error' });
        if (f.num('character.movement.remaining') < f.num('character.movement.half_speed'))
          diagnostics.push({ code: OUT_OF_MOVEMENT, severity: 'error' });
        return {
          advertise: [
            // The clear: an EMPTY same-key effect (the concentration-broken
            // idiom) — newest-wins evicts the prone effect while the row is
            // still merely planned, and endTurn merges the eviction
            // permanently. Carries display because a nameless hidden effect
            // renders nothing on the effects strip.
            {
              id: 'prone-ended',
              key: 'prone',
              display: { name: `${CP}.get-up.effect-cleared.name` },
              expiry: { kind: 'permanent' }
            },
            // The spend: keyless, per-turn — the move idiom.
            {
              id: 'get-up-move',
              state: { 'character.movement.spent': f.num('character.movement.half_speed') },
              expiry: { kind: 'endOfTurn' }
            }
          ],
          diagnostics
        };
      }
    }
  ],
  // While prone, a NOTICE carries the standing effects, its body quoting the
  // live Get Up cost (half Speed, floored — the same `half_speed` fact the
  // offer spends) via double-brace interpolation. 'notice' == NOTICE_TARGET;
  // rule modules may import only the builder, so the reserved label is a
  // literal here (see feat-sentinel/hold-person).
  annotate: (f): Annotation[] =>
    f.num('condition.prone') > 0
      ? [
          {
            key: `${CP}.notice`,
            targets: ['notice'],
            source: `${CP}.effect-prone.name`,
            body: `${CP}.notice.body`,
            values: { cost: f.num('character.movement.half_speed') }
          }
        ]
      : []
};

export default defineRule(conditionProne);
