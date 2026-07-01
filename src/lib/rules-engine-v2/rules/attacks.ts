import {
  defineRule,
  type ActionResult,
  type EffectInstance,
  type FactReader,
  type RuleModule
} from '../builder';

const NO_ACTION = 'rule.dnd-5e-2024.attacks.activation.no_action';
const NO_REACTION = 'rule.dnd-5e-2024.attacks.activation.no_reaction';
const UNARMED = 'rule.dnd-5e-2024.attacks.unarmed-strike';
const UNARMED_LABELS = ['attack.any', 'attack.melee', 'attack.unarmed', 'dice.any'];

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
    // Unarmed strike to-hit / damage: STR-based, proficient (v1
    // compute-unarmed-hit-bonus / -damage-bonus). Pure derives over the ability
    // modifier + proficiency bonus, so ordering vs ability-scores is engine-sorted.
    {
      fact: 'attack.unarmed.hitBonus',
      value: (f) => f.num('str.modifier') + f.num('proficiency.bonus')
    },
    { fact: 'attack.unarmed.damageBonus', value: (f) => f.num('str.modifier') },
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
        name: `${UNARMED}.name`,
        actionCost: ['action'],
        annotationLabels: [...UNARMED_LABELS, 'attack.action']
      },
      legalWhen: [
        {
          condition: (f) =>
            f.num('actions.remaining') > 0 || f.num('attackAction.extraRemaining') > 0,
          diagnostics: [{ code: NO_ACTION, severity: 'error' }]
        }
      ],
      apply: applyUnarmedStrike
    },
    {
      // Unarmed opportunity attack (Opportunity Attacks are weapon attacks). Gated
      // on the reaction-weapon capability; spends the reaction, not the Attack
      // action, so it never touches the Extra Attack budget.
      id: 'unarmed-strike-use-reaction',
      when: (f) => f.num('capability.attack.reaction.weapon') === 1,
      ui: {
        section: 'reaction',
        name: `${UNARMED}.name`,
        description: `${UNARMED}.description`,
        detailKey: 'attack/unarmed-strike',
        intents: { DEFEND: 'brawl' },
        actionCost: ['reaction'],
        disadvantageFact: 'attack.str.disadvantage',
        annotationLabels: [...UNARMED_LABELS, 'attack.reaction']
      },
      legalWhen: [
        {
          condition: (f) => f.num('reactions.remaining') > 0,
          diagnostics: [{ code: NO_REACTION, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => ({
        advertise: [spend({ 'reactions.spent': 1, 'attack.last.weapon': 1 })],
        diagnostics: f.num('reactions.remaining') > 0 ? [] : [{ code: NO_REACTION, severity: 'error' }]
      })
    }
  ],
  // Remind the player an Extra Attack follow-up is available — once the Attack
  // action has been taken and a charge remains (extraRemaining > 0). Targets
  // attack.action so it shows only on Attack-action attacks (v1 extra-attack-annotate).
  annotate: (f) =>
    f.num('attackAction.extraRemaining') > 0
      ? [{ key: 'rule.dnd-5e-2024.attacks.extra-attack.annotation', targets: ['attack.action'] }]
      : []
};

export default defineRule(attacks);
