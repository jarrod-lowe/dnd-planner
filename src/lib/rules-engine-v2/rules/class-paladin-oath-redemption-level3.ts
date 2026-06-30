import {
  defineRule,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const O = 'rule.class-paladin-oath-redemption-level3';

/**
 * An always-prepared grant for a level-1 oath spell: `prepared` via `max` so it
 * composes with the spell's own prepare effect (also `max`) without a combine
 * conflict, and `alwaysPrepared` to block its Unprepare offer. Mirrors how
 * class-paladin-paladin-smite grants Divine Smite.
 */
const alwaysPrepared = (spell: string): Contribution[] => [
  { fact: `spell.l1.${spell}.prepared`, combine: 'max', value: () => 1 },
  { fact: `spell.l1.${spell}.alwaysPrepared`, value: () => 1 }
];

/** A divinity spend that persists until a long rest (refunded by the rest model). */
const divinitySpend = (id: string): EffectInstance => ({
  id,
  state: { 'divinity.spent': 1 },
  expiry: { kind: 'untilLongRest' }
});

/**
 * Oath of Redemption, level 3 — the subclass's Channel Divinity options plus its
 * always-prepared oath spells (Sleep, Sanctuary).
 *
 * - **Rebuke the Violent**: a reaction spending 1 Divinity point. This is the
 *   first runnable use of the reaction economy (`reactions.remaining`): the
 *   reaction is an `endOfTurn` spend (resets next turn) while the Divinity point
 *   is an `untilLongRest` spend (`divinity.spent`), so it persists like Divine
 *   Sense and refills on a long rest.
 * - **Emissary of Peace**: a bonus action spending 1 Divinity point. (Its +5
 *   Persuasion buff is omitted for now — `skill.<x>.value` is a single override
 *   derive in ability-scores, so an effect can't add to it without a combine
 *   path; no runnable scenario plans Emissary, so the buff is deferred.)
 */
const oath: RuleModule = {
  id: 'class-paladin-oath-redemption-level3',
  derive: () => [...alwaysPrepared('sleep'), ...alwaysPrepared('sanctuary')],
  offer: () => [
    {
      id: 'rebuke-the-violent',
      ui: {
        section: 'reaction',
        name: `${O}.rebuke-the-violent.name`,
        description: `${O}.rebuke-the-violent.description`,
        intents: { DEFEND: 'ward' },
        actionCost: ['reaction', 'CD']
      },
      legalWhen: [
        {
          condition: (f) => f.num('reactions.remaining') > 0,
          diagnostics: [{ code: `${O}.offer-rebuke-the-violent.no_reaction`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('divinity.remaining') > 0,
          diagnostics: [{ code: `${O}.offer-rebuke-the-violent.no_divinity`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('reactions.remaining') <= 0)
          diagnostics.push({ code: `${O}.offer-rebuke-the-violent.no_reaction`, severity: 'error' });
        if (f.num('divinity.remaining') <= 0)
          diagnostics.push({ code: `${O}.offer-rebuke-the-violent.no_divinity`, severity: 'error' });
        return {
          advertise: [
            { id: 'cost', state: { 'reactions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
            divinitySpend('effect-rebuke-the-violent-divinity')
          ],
          diagnostics
        };
      }
    },
    {
      id: 'emissary-of-peace',
      ui: {
        section: 'bonus-action-other',
        name: `${O}.emissary-of-peace.name`,
        description: `${O}.emissary-of-peace.description`,
        intents: { AID: 'self' },
        actionCost: ['bonus', 'CD']
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${O}.offer-emissary-of-peace.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('divinity.remaining') > 0,
          diagnostics: [{ code: `${O}.offer-emissary-of-peace.no_divinity`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${O}.offer-emissary-of-peace.no_bonus_action`, severity: 'error' });
        if (f.num('divinity.remaining') <= 0)
          diagnostics.push({ code: `${O}.offer-emissary-of-peace.no_divinity`, severity: 'error' });
        return {
          advertise: [
            { id: 'cost', state: { 'bonusActions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
            divinitySpend('effect-emissary-of-peace-divinity')
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(oath);
