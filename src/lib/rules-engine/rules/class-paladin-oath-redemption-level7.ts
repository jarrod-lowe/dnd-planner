import {
  defineRule,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const O = 'rule.class-paladin-oath-redemption-level7';

/**
 * Oath of Redemption, level 7 — Aura of the Guardian.
 *
 * A reaction that moves damage an ally would take onto the paladin instead. The
 * player enters the amount on a slider (the `record-damage` control, bounded by
 * `hp.max`) and the offer advertises it as a negative `hp.modifier.current`
 * delta — the same currency every other damage record uses, so `hp.current`,
 * the health chips and the concentration trigger all see it as real damage.
 *
 * - The reaction is the WHOLE cost: a keyless `endOfTurn` spend of
 *   `reactions.spent`, exactly like Rebuke the Violent. The source text's
 *   "magically" is a descriptor of the transfer, not a Magic action, and the
 *   feature costs no Channel Divinity or spell slot.
 * - The HP loss is a keyless `untilLongRest` effect, so repeated uses STACK
 *   (each turn's transfer is its own chip on the health strip) and a long rest
 *   clears them with the rest of the damage record.
 * - Taking the damage while concentrating trips `concentration.damage-taken`,
 *   mirroring `record-damage`: keyed + `endOfTurn` so a planned concentration
 *   check can clear it, and gated on `f.has` so it never sets a phantom fact
 *   when the concentration group is not loaded.
 *
 * There is deliberately no `amount > 0` gate and no HP floor — dropping
 * yourself to 0 to save an ally is the point of the feature.
 *
 * Deliberately not modelled (the app tracks one character's resources, not a
 * battlefield): the 10-foot radius, ally positioning and line of sight; the
 * "the damage can't be reduced in any way" clause (nothing in the engine
 * reduces damage, so there is no resistance or reduction step to suppress);
 * the "no other effects transfer with the damage" clause (conditions and
 * riders on the ally are not modelled); and the level-18 increase of the aura's
 * range to 30 feet, which belongs to the level-18 group.
 */
const oath: RuleModule = {
  id: 'class-paladin-oath-redemption-level7',
  offer: () => [
    {
      id: 'aura-of-the-guardian',
      ui: {
        section: 'reaction',
        name: `${O}.aura-of-the-guardian.name`,
        description: `${O}.aura-of-the-guardian.description`,
        detailKey: 'class-feature/aura-of-the-guardian',
        intents: { DEFEND: 'ward' },
        actionCost: ['reaction'],
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 0 },
          max: { fact: 'hp.max' },
          unit: 'hp'
        }
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      legalWhen: [
        {
          condition: (f) => f.num('reactions.remaining') > 0,
          diagnostics: [{ code: `${O}.offer-aura-of-the-guardian.no_reaction`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('reactions.remaining') <= 0)
          diagnostics.push({
            code: `${O}.offer-aura-of-the-guardian.no_reaction`,
            severity: 'error'
          });
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        const advertise: EffectInstance[] = [
          { id: 'cost', state: { 'reactions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
          {
            id: 'effect-aura-of-the-guardian',
            state: { 'hp.modifier.current': -amount },
            // Keyless and stacking, so each transfer carries its own amount.
            display: {
              name: `${O}.effect-aura-of-the-guardian.name`,
              section: 'health',
              value: amount
            },
            expiry: { kind: 'untilLongRest' }
          }
        ];
        if (f.has('concentration.remaining') && f.num('concentration.remaining') <= 0) {
          advertise.push({
            id: 'concentration-damage-taken',
            key: 'concentration-damage-taken',
            state: { 'concentration.damage-taken': 1 },
            expiry: { kind: 'endOfTurn' }
          });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(oath);
