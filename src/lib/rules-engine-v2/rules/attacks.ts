import {
  defineRule,
  type ActionResult,
  type EffectInstance,
  type FactReader,
  type RuleModule
} from '../builder';

const NO_ACTION = 'rule.dnd-5e-2024.attacks.activation.no_action';

/** A per-turn spend effect: the given fact deltas, expiring at end of turn. */
const spend = (state: Record<string, number>): EffectInstance => ({
  id: 'spend',
  state,
  expiry: { kind: 'endOfTurn' }
});

/**
 * Extra-attack resolution over the *current* turn state — the fold re-derives it
 * to reflect earlier swings. No `attackAction.wasExtra` / `actionsBefore`
 * snapshots: read the live state and branch.
 *
 * The follow-up budget is modelled as `extraRemaining = extraGranted -
 * extraSpent`, both summed from per-turn effects: a new Attack action grants
 * `extraAttacks.max`; each extra swing spends 1.
 */
function applyUnarmedStrike(s: FactReader): ActionResult {
  if (s.num('attackAction.extraRemaining') > 0) {
    // Free follow-up swing.
    return {
      advertise: [spend({ 'attackAction.extraSpent': 1, 'attack.activation.count': 1 })]
    };
  }
  // New Attack action: spend an action and grant the follow-up budget — unless
  // this over-committed (no action to spend), mirroring v1's actionsBefore guard.
  const granted = s.num('actions.remaining') > 0 ? s.num('extraAttacks.max') : 0;
  return {
    advertise: [
      spend({
        'actions.spent': 1,
        'attackAction.extraGranted': granted,
        'attack.activation.count': 1
      })
    ]
  };
}

const attacks: RuleModule = {
  id: 'attacks',
  derive: () => [
    {
      fact: 'attackAction.extraRemaining',
      value: (f) => f.num('attackAction.extraGranted') - f.num('attackAction.extraSpent')
    },
    // Boolean "an attack was made this turn", derived from a summed counter so it
    // stays 0/1 no matter how many swings happen (flag, not a resource).
    {
      fact: 'attack.last.activation.action',
      value: (f) => (f.num('attack.activation.count') > 0 ? 1 : 0)
    },
    // Everyone can make a weapon attack as a reaction (Opportunity Attacks); the
    // weapon reaction offers gate on this capability.
    { fact: 'capability.attack.reaction.weapon', value: () => 1 }
  ],
  offer: () => [
    {
      id: 'unarmed-strike-use-action',
      ui: {
        section: 'action-attack',
        name: 'rule.dnd-5e-2024.attacks.unarmed-strike.name',
        actionCost: ['action']
      },
      legalWhen: [
        {
          condition: (f) =>
            f.num('actions.remaining') > 0 || f.num('attackAction.extraRemaining') > 0,
          diagnostics: [{ code: NO_ACTION, severity: 'error' }]
        }
      ],
      apply: applyUnarmedStrike
    }
  ]
};

export default defineRule(attacks);
