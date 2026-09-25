import { defineRule, type ActionResult, type Diagnostic, type RuleModule } from '../builder';

const D = 'rule.dnd-5e-2024.dash';
const NO_ACTION = `${D}.action-dash-offer.no_action`;
// SRD 5.2 Grappled (and every Speed-0 condition — the movement module's
// halted fact): "Your Speed is 0 and can't increase."
const CANNOT_WHILE_HALTED = `${D}.action-dash-offer.cannot_while_halted`;

/**
 * Dash — spend your action to add your speed to this turn's movement. The apply
 * reads the current `character.movement.total` (the base speed, floored at 0 — a
 * raw-negative total must not subtract from the budget) and advertises an
 * endOfTurn effect adding that much to it, so `remaining = total − spent` picks up
 * the boost and it resets next turn. `character.movement.total` is a combine:sum
 * fact (species base + this), so the add composes with no second-writer conflict.
 * While halted (any Speed-0 condition) Dash is ILLEGAL — its whole job is
 * increasing Speed — but a planned-anyway row still advertises the boost
 * (illegal-but-visible): `total` genuinely rises for derived math while the
 * halted mask keeps `remaining` at 0, and the diagnostic informs without
 * withdrawing. Foundational, so no meta.
 */
const dash: RuleModule = {
  id: 'dash',
  offer: () => [
    {
      id: 'dash-action',
      ui: {
        section: 'action-other',
        name: `${D}.dash-action.name`,
        description: `${D}.dash-action.description`,
        intents: { MOVE: 'dash' },
        actionCost: ['action']
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: NO_ACTION, severity: 'error' }]
        },
        {
          condition: (f) => f.num('character.movement.halted') === 0,
          diagnostics: [{ code: CANNOT_WHILE_HALTED, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        // The boost amount is floored at 0: `total` is a combine:sum fact that
        // can read negative (splint −10 + Exhaustion −5 × level stacking — the
        // reads-floor decision, see movement.ts), and a negative "extra
        // movement" would SUBTRACT from the turn's budget. The raw fact itself
        // is untouched — only the advertised amount clamps.
        const speed = Math.max(0, f.num('character.movement.total'));
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: NO_ACTION, severity: 'error' });
        if (f.num('character.movement.halted') !== 0)
          diagnostics.push({ code: CANNOT_WHILE_HALTED, severity: 'error' });
        return {
          advertise: [
            {
              id: 'dash',
              state: { 'actions.spent': 1, 'character.movement.total': speed },
              expiry: { kind: 'endOfTurn' }
            }
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(dash);
