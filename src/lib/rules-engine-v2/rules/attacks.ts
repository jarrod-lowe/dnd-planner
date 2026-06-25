import type { ActionResult, FactReader, RuleModule } from '../types';

const NO_ACTION = 'rule.dnd-5e-2024.attacks.activation.no_action';

/**
 * Extra-attack resolution as a pure transition over the *current* turn state —
 * the reducer guarantees that state already reflects earlier swings.
 *
 * Contrast v1 attacks.yaml, which snapshots `attackAction.wasExtra` and
 * `attackAction.actionsBefore` before mutating, then branches on the snapshots.
 * Here there is nothing to snapshot: read the live state and branch.
 */
function applyUnarmedStrike(s: FactReader): ActionResult {
  if (s.num('attackAction.extraRemaining') > 0) {
    // Free follow-up swing: spend one extra-attack charge from this Attack.
    return {
      facts: {
        'attackAction.extraRemaining': s.num('attackAction.extraRemaining') - 1,
        'attack.last.activation.action': 1
      }
    };
  }

  // New Attack action: spend an action and refill the follow-up budget — unless
  // this over-committed (mirrors v1's actionsBefore > 0 guard).
  const actionsLeft = s.num('actions.remaining') - 1;
  return {
    facts: {
      'actions.remaining': actionsLeft,
      'attackAction.extraRemaining': actionsLeft >= 0 ? s.num('extraAttacks.max') : 0,
      'attack.last.activation.action': 1
    },
    diagnostics: actionsLeft < 0 ? [{ code: NO_ACTION, severity: 'error' }] : []
  };
}

const attacks: RuleModule = {
  id: 'attacks',
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

export default attacks;
