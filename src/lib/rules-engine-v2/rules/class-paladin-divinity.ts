import {
  defineRule,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type RestKind,
  type RuleModule
} from '../builder';

const D = 'rule.class-paladin-divinity';

/**
 * Channel Divinity ("Divinity") — the pool that fuels paladin divine options.
 * `divinity.total` is contributed by class levels (2 from level 3); here
 * `remaining = total − spent`, each use advertising an `untilLongRest` effect that
 * adds to `divinity.spent`, so a long rest refills the pool purely via the rest
 * model (those effects are excluded the turn a long rest is recorded and dropped
 * at endTurn).
 *
 * Short-rest recovery: Channel Divinity regains *one* use on a short rest (all on
 * a long rest). That asymmetry can't be aged per-effect (aging the spends would
 * refund *every* use), so it uses the `onRest` hook: a short rest emits an
 * `untilLongRest` `divinity.recovered` point, and `remaining = clamp(total − spent
 * + recovered)`. A long rest needs no hook — the spend AND recovery effects (both
 * `untilLongRest`) age out, refilling the pool to full.
 *
 * Divine Sense is the first option: a bonus action spending 1 point, leaving a
 * removable status reminder (`effect-divine-sense`) plus the spend marker.
 */
const divinity: RuleModule = {
  id: 'class-paladin-divinity',
  derive: () => [
    {
      fact: 'divinity.remaining',
      value: (f) => {
        const total = f.num('divinity.total');
        const net = total - f.num('divinity.spent') + f.num('divinity.recovered');
        return Math.max(0, Math.min(total, net));
      }
    }
  ],
  // A short rest regains one Channel Divinity use (a long rest refills fully via
  // the spends/recovery aging out — no hook needed). Keyless so successive short
  // rests stack; `untilLongRest` so a long rest clears them.
  onRest: (kind: RestKind): EffectInstance[] =>
    kind === 'short'
      ? [
          {
            id: 'effect-divinity-short-rest',
            state: { 'divinity.recovered': 1 },
            expiry: { kind: 'untilLongRest' }
          }
        ]
      : [],
  offer: () => [
    {
      id: 'divine-sense',
      ui: {
        section: 'bonus-action-other',
        name: `${D}.divine-sense.name`,
        description: `${D}.divine-sense.description`,
        detailKey: 'class-feature/divine-sense',
        intents: { INSPECT: 'sense' },
        actionCost: ['bonus', 'CD']
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${D}.offer-divine-sense.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('divinity.remaining') > 0,
          diagnostics: [{ code: `${D}.offer-divine-sense.no_divinity`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${D}.offer-divine-sense.no_bonus_action`, severity: 'error' });
        if (f.num('divinity.remaining') <= 0)
          diagnostics.push({ code: `${D}.offer-divine-sense.no_divinity`, severity: 'error' });
        const advertise: EffectInstance[] = [
          { id: 'cost', state: { 'bonusActions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
          {
            id: 'effect-divine-sense-divinity',
            state: { 'divinity.spent': 1 },
            expiry: { kind: 'untilLongRest' }
          },
          // Status reminder the player clears from the ledger; no fact state, so
          // removing it never refunds the point (the spend marker above persists).
          {
            id: 'effect-divine-sense',
            display: {
              name: 'rule.class-paladin-divinity.effect-divine-sense-divinity.name',
              section: 'senses'
            },
            expiry: { kind: 'untilLongRest' }
          }
        ];
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(divinity);
