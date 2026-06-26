import type { EffectInstance } from './types';

export interface EndTurnOptions {
  /** Whether the turn that just ended was a long rest. */
  longRest?: boolean;
}

/**
 * Collapse effects that share a logical `key`, keeping the last occurrence.
 *
 * Replacement effects (HP modifiers, prepared spells) carry a stable `key`; a
 * newer one must evict the older rather than stack. Callers pass effects oldest
 * → newest (committed before advertised), so "last wins" = newest wins. Keyless
 * effects — the common per-turn spend — are all kept, in order. Order among the
 * survivors is irrelevant to the sheet (combine is order-independent).
 *
 * Pure: same input → same result.
 */
export function dedupeByKey(effects: EffectInstance[]): EffectInstance[] {
  const lastKeyed = new Map<string, EffectInstance>();
  const keyless: EffectInstance[] = [];
  for (const e of effects) {
    if (e.key === undefined) keyless.push(e);
    else lastKeyed.set(e.key, e); // last wins
  }
  return [...keyless, ...lastKeyed.values()];
}

/**
 * Advance persistent effects across a turn boundary.
 *
 * Merges the effects advertised this turn into the committed set, collapses
 * replacement effects by `key` (so the committed set never grows a stale
 * duplicate), then ages each by its expiry predicate. This replaces v1's
 * self-advertising (`self: true`) rules: persistence is data the engine ages,
 * not a rule that re-emits itself.
 *
 * - `endOfTurn`     — dropped.
 * - `untilLongRest` — dropped iff this turn was a long rest, else kept.
 * - `turns`         — decremented; dropped when it reaches 0.
 * - `permanent`     — always kept (removed only explicitly, never by the clock).
 *
 * Pure: same (committed, advertised, opts) → same result.
 */
export function endTurn(
  committed: EffectInstance[],
  advertised: EffectInstance[],
  opts: EndTurnOptions = {}
): EffectInstance[] {
  const next: EffectInstance[] = [];
  for (const effect of dedupeByKey([...committed, ...advertised])) {
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
      case 'permanent':
        next.push(effect); // never aged
        break;
    }
  }
  return next;
}
