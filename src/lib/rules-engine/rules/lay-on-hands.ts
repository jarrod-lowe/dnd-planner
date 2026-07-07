import { defineRule, type ActionResult, type Diagnostic, type RuleModule } from '../builder';

const LOH = 'rule.class-paladin-lay-on-hands';
const PURIFY_COST = 5; // points to cure the Poisoned condition

/**
 * Lay on Hands: a healing pool (5 × paladin level, from class-paladin-level1)
 * spent as a bonus action — heal an amount, or spend 5 to purify poison.
 *
 * `remaining = total − spent`, where each use advertises an `untilLongRest`
 * effect adding to `layOnHands.pool.spent`. The pool refills on a long rest
 * purely via the rest model (those effects are excluded the turn a long rest is
 * recorded, and dropped at endTurn) — no explicit reset rule. Foundational
 * (auto-granted with the class), so no search meta.
 */
const layOnHands: RuleModule = {
  id: 'class-paladin-lay-on-hands',
  derive: () => [
    {
      fact: 'layOnHands.pool.remaining',
      value: (f) => f.num('layOnHands.pool.total') - f.num('layOnHands.pool.spent')
    }
  ],
  offer: () => [
    {
      id: 'loh-heal',
      ui: {
        section: 'bonus-action-other',
        name: `${LOH}.loh-heal.name`,
        description: `${LOH}.loh-heal.description`,
        detailKey: 'class-feature/lay-on-hands',
        sliderMin: 1,
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 1 },
          max: { var: 'maxValue' }
        },
        intents: { AID: 'self' },
        actionCost: ['bonus', 'LoH']
      },
      vars: {
        amount: { capture: true, default: { fact: 'layOnHands.pool.remaining' } },
        maxValue: { capture: true, default: { fact: 'layOnHands.pool.total' } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${LOH}.offer-loh-heal.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('layOnHands.pool.remaining') >= 1,
          diagnostics: [{ code: `${LOH}.offer-loh-heal.pool_empty`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const amount =
          typeof selections.amount === 'number'
            ? selections.amount
            : f.num('layOnHands.pool.remaining');
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${LOH}.offer-loh-heal.no_bonus_action`, severity: 'error' });
        if (f.num('layOnHands.pool.remaining') < amount)
          diagnostics.push({ code: `${LOH}.offer-loh-heal.pool_empty`, severity: 'error' });
        return {
          advertise: [
            { id: 'cost', state: { 'bonusActions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
            {
              id: 'loh',
              state: { 'layOnHands.pool.spent': amount },
              expiry: { kind: 'untilLongRest' }
            }
          ],
          diagnostics
        };
      }
    },
    {
      id: 'loh-purify-poison',
      ui: {
        section: 'bonus-action-other',
        name: `${LOH}.loh-purify-poison.name`,
        description: `${LOH}.loh-purify-poison.description`,
        detailKey: 'class-feature/lay-on-hands',
        intents: { AID: 'self' },
        actionCost: ['bonus', 'LoH']
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [
            { code: `${LOH}.offer-loh-purify-poison.no_bonus_action`, severity: 'error' }
          ]
        },
        {
          condition: (f) => f.num('layOnHands.pool.remaining') >= PURIFY_COST,
          diagnostics: [
            { code: `${LOH}.offer-loh-purify-poison.insufficient_pool`, severity: 'error' }
          ]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({
            code: `${LOH}.offer-loh-purify-poison.no_bonus_action`,
            severity: 'error'
          });
        if (f.num('layOnHands.pool.remaining') < PURIFY_COST)
          diagnostics.push({
            code: `${LOH}.offer-loh-purify-poison.insufficient_pool`,
            severity: 'error'
          });
        return {
          advertise: [
            { id: 'cost', state: { 'bonusActions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
            {
              id: 'loh',
              state: { 'layOnHands.pool.spent': PURIFY_COST },
              expiry: { kind: 'untilLongRest' }
            }
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(layOnHands);
