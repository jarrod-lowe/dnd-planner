import {
  defineRule,
  effectiveDamage,
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
 *   `reactions.spent`, exactly like Rebuke the Violent. The transfer is
 *   described as magical, but that is flavour rather than a Magic action, and
 *   the feature costs no Channel Divinity or spell slot.
 * - The HP loss is a keyless `untilLongRest` effect, so repeated uses STACK
 *   (each turn's transfer is its own chip on the health strip) and a long rest
 *   clears them with the rest of the damage record.
 * - Taking the damage while concentrating trips `concentration.damage-taken`,
 *   mirroring `record-damage`: keyed + `endOfTurn` so a planned concentration
 *   check can clear it, and gated on `f.has` so it never sets a phantom fact
 *   when the concentration group is not loaded.
 *
 * There is deliberately no `amount > 0` gate, and no gate on having enough HP —
 * dropping yourself to 0 to save an ally is the point of the feature. The
 * recorded loss is capped at the HP held (`effectiveDamage`) so the paladin
 * bottoms out at 0 rather than going negative or banking the overkill.
 *
 * Deliberately not modelled (the app tracks one character's resources, not a
 * battlefield): the 10-foot radius, ally positioning and line of sight; the
 * ban on mitigating the absorbed damage (nothing in the engine reduces damage,
 * so there is no resistance or reduction step to suppress); the rule that only
 * hit point loss crosses over (conditions and riders on the ally are not
 * modelled); and the widening of the aura to 30 feet at level 18, which
 * belongs to the level-18 group.
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
        // The transfer is real damage, so it caps like any other damage record
        // (see effectiveDamage): absorbing more than the paladin has left drops
        // them to 0 — never negative — and records only the HP actually lost, so
        // the surplus cannot bank and swallow a later heal. The chip therefore
        // shows the EFFECTIVE amount, exactly as the damage and heal chips do.
        const effective = effectiveDamage(f, amount);
        const advertise: EffectInstance[] = [
          { id: 'cost', state: { 'reactions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
          {
            id: 'effect-aura-of-the-guardian',
            state: { 'hp.modifier.current': -effective },
            // Keyless and stacking, so each transfer carries its own amount.
            display: {
              name: `${O}.effect-aura-of-the-guardian.name`,
              section: 'health',
              value: effective
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
