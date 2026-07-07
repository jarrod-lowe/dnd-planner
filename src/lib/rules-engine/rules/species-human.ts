import { defineRule, type EffectInstance, type RestKind, type RuleModule } from '../builder';

/**
 * Human species: base movement constants (speed 30, swim at double cost, no fly)
 * and "regain Heroic Inspiration on a long rest".
 *
 * The HI grant uses the `onRest` hook (a passive module's only way to emit an
 * effect): a long rest advertises a PERMANENT effect setting
 * `heroicInspiration.remaining`, keyed the same as the heroic-inspiration group's
 * grant/use so it composes — a repeat long rest does not stack it, and a later
 * `use-hi` (same key, endOfTurn) still consumes it. Foundational, so no meta.
 */
const speciesHuman: RuleModule = {
  id: 'species-human',
  derive: () => [
    // combine:sum so per-turn movement boosts (e.g. Dash) can add to the base.
    { fact: 'character.movement.total', combine: 'sum', value: () => 30 },
    { fact: 'character.movement.swim.can', value: () => 1 },
    { fact: 'character.movement.swim.cost', value: () => 2 },
    { fact: 'character.movement.fly.can', value: () => 0 }
  ],
  onRest: (kind: RestKind): EffectInstance[] =>
    kind === 'long'
      ? [
          {
            id: 'effect-hi-set',
            key: 'heroic-inspiration',
            state: { 'heroicInspiration.remaining': 1 },
            expiry: { kind: 'permanent' }
          }
        ]
      : []
};

export default defineRule(speciesHuman);
