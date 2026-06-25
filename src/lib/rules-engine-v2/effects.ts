import type { EffectInstance } from './types';

export interface EndTurnOptions {
  /** Whether the turn that just ended was a long rest. */
  longRest?: boolean;
}

/**
 * Advance persistent effects across a turn boundary.
 *
 * Merges the effects advertised this turn into the committed set, then ages each
 * by its expiry predicate. This replaces v1's self-advertising (`self: true`)
 * rules: persistence is data the engine ages, not a rule that re-emits itself.
 *
 * - `endOfTurn`     — dropped.
 * - `untilLongRest` — dropped iff this turn was a long rest, else kept.
 * - `turns`         — decremented; dropped when it reaches 0.
 *
 * Pure: same (committed, advertised, opts) → same result.
 */
export function endTurn(
  committed: EffectInstance[],
  advertised: EffectInstance[],
  opts: EndTurnOptions = {}
): EffectInstance[] {
  const next: EffectInstance[] = [];
  for (const effect of [...committed, ...advertised]) {
    switch (effect.expiry.kind) {
      case 'endOfTurn':
        break; // expires now
      case 'untilLongRest':
        if (!opts.longRest) next.push(effect);
        break;
      case 'turns': {
        const remaining = effect.expiry.remaining - 1;
        if (remaining > 0) next.push({ ...effect, expiry: { kind: 'turns', remaining } });
        break;
      }
    }
  }
  return next;
}
