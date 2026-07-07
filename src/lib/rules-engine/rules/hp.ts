import { defineRule, type ActionResult, type RuleModule } from '../builder';

const H = 'rule.dnd-5e-2024.hp';

/** The captured slider value, or 0 if unset. */
const modifierOf = (selections: Record<string, unknown>): number =>
  typeof selections.modifier === 'number' ? selections.modifier : 0;

/**
 * A manual HP-modifier setter: bakes the captured slider value into a permanent,
 * KEYED effect so re-using the offer (this turn or a later one) REPLACES rather
 * than stacks — dedupeByKey keeps the newest, so `hp.max`/`hp.current` always
 * recompute from base + the single latest modifier.
 */
const modifierSetter = (
  fact: string,
  effectId: string,
  key: string,
  name: string,
  min: number,
  max: number
) => ({
  id: effectId.replace('effect-', 'set-'),
  ui: {
    section: 'free' as const,
    name,
    primaryControl: { type: 'slider', var: 'modifier', min: { number: min }, max: { number: max } },
    intents: { HEALTH: 'hp' },
    actionCost: [] as string[]
  },
  vars: { modifier: { capture: true, default: { number: 0 } } },
  apply: (_f: unknown, selections: Record<string, unknown>): ActionResult => ({
    advertise: [
      {
        id: effectId,
        key,
        state: { [fact]: modifierOf(selections) },
        // Shown on the strip — removing the chip clears the modifier.
        display: { name: `rule.dnd-5e-2024.hp.${effectId}.name`, section: 'health' },
        expiry: { kind: 'permanent' as const }
      }
    ]
  })
});

/**
 * HP derivation. The legacy engine needed an hp-reset → (class contributions) → hp-copy
 * three-group ordering dance (hp-total / hp-set / hp-copied). Here it is two
 * plain definitions: `hp.max` reads the settled `hp.base.max` total, and
 * `hp.current` reads `hp.max`. The engine derives the order.
 *
 * `hp.base.max` is contributed by class levels (combine: sum). `hp.modifier.*`
 * are adjustments contributed by effects (e.g. core-events damage/healing sums
 * into `hp.modifier.current`, negative for damage) or the manual setter offers
 * below; they read as 0 here.
 *
 * `hp.current` clamps at `hp.max`: damage drives `hp.modifier.current` negative,
 * healing back toward 0, and the `min(0, …)` caps it so over-heal never exceeds
 * the max.
 */
const hp: RuleModule = {
  id: 'hp',
  derive: () => [
    { fact: 'hp.max', value: (f) => f.num('hp.base.max') + f.num('hp.modifier.max') },
    {
      fact: 'hp.current',
      value: (f) => f.num('hp.max') + Math.min(0, f.num('hp.modifier.current'))
    }
  ],
  offer: () => [
    modifierSetter(
      'hp.modifier.max',
      'effect-hp-modifier-max',
      'hp-modifier-max',
      `${H}.set-hp-modifier-max.name`,
      -10,
      30
    ),
    modifierSetter(
      'hp.modifier.current',
      'effect-hp-modifier-current',
      'hp-modifier-current',
      `${H}.set-hp-modifier-current.name`,
      -30,
      30
    )
  ]
};

export default defineRule(hp);
