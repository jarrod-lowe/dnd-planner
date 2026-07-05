import {
  defineRule,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const S = 'rule.dnd-5e-2024.feat-savage-attacker';
const USE = `${S}.savage-attacker-use`;
const OFF = `${S}.offer-savage-attacker`;

/**
 * Savage Attacker (origin feat) — once per turn, when you hit with a weapon you
 * may reroll the weapon's damage dice and keep either. Modelled as a one-per-turn
 * resource plus a free "use" rider on weapon attacks:
 *  - `savageAttacker.max` = 1; `remaining` = max − spent, where the use advertises
 *    an `endOfTurn` `savageAttacker.spent` (so it resets each turn, matching v1's
 *    copy-max-to-remaining-then-decrement).
 *  - a free-section offer, illegal-but-visible until a weapon attack has been made
 *    this turn (`attack.last.weapon`) and a use remains.
 *  - an annotation on weapon attacks while a use is available.
 *
 * Foundational feat, so no search meta (matching feat-alert / feat-sentinel).
 */
const featSavageAttacker: RuleModule = {
  id: 'feat-savage-attacker',
  derive: () => [
    { fact: 'savageAttacker.max', value: () => 1 },
    {
      fact: 'savageAttacker.remaining',
      value: (f) => f.num('savageAttacker.max') - f.num('savageAttacker.spent')
    }
  ],
  offer: () => [
    {
      id: 'savage-attacker-use',
      ui: {
        section: 'free',
        name: `${USE}.name`,
        description: `${USE}.description`,
        detailKey: 'feat/savage-attacker',
        intents: { ATTACK: 'brawl' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('attack.last.weapon') >= 1,
          diagnostics: [{ code: `${OFF}.no_attack`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('savageAttacker.remaining') > 0,
          diagnostics: [{ code: `${OFF}.already_used`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const advertise: EffectInstance[] = [
          { id: 'spend', state: { 'savageAttacker.spent': 1 }, expiry: { kind: 'endOfTurn' } }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('attack.last.weapon') < 1)
          diagnostics.push({ code: `${OFF}.no_attack`, severity: 'error' });
        if (f.num('savageAttacker.remaining') <= 0)
          diagnostics.push({ code: `${OFF}.already_used`, severity: 'error' });
        return { advertise, diagnostics };
      }
    }
  ],
  // "Reroll available" on weapon attacks while a use remains this turn.
  annotate: (f) =>
    f.num('attack.last.weapon') >= 1 && f.num('savageAttacker.remaining') > 0
      ? [{ key: `${S}.annotation`, targets: ['attack.weapon'] }]
      : []
};

export default defineRule(featSavageAttacker);
