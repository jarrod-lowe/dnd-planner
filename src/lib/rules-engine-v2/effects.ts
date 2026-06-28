import type { EffectInstance, Expiry } from './types';

export interface EndTurnOptions {
  /** Whether the turn that just ended was a long rest. */
  longRest?: boolean;
  /**
   * Whether the turn that just ended was a short rest. A long rest grants a short
   * rest's benefits too, so `longRest` also satisfies short-rest expiry — callers
   * need not set both.
   */
  shortRest?: boolean;
}

/** Whether one expiry condition fires at this turn boundary, and its aged form. */
function ageCondition(c: Expiry, opts: EndTurnOptions): { expired: boolean; next: Expiry } {
  switch (c.kind) {
    case 'endOfTurn':
      return { expired: true, next: c };
    case 'untilLongRest':
      return { expired: !!opts.longRest, next: c };
    case 'untilShortRest':
      // A long rest includes a short rest, so either ends it.
      return { expired: !!opts.shortRest || !!opts.longRest, next: c };
    case 'turns': {
      const remaining = c.remaining - 1;
      return { expired: remaining <= 0, next: { kind: 'turns', remaining } };
    }
    case 'permanent':
      return { expired: false, next: c };
  }
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
 * Each condition (`endOfTurn`, `untilLongRest`, `untilShortRest`, `turns`,
 * `permanent`) is aged independently; an effect with several conditions ends as
 * soon as the EARLIEST fires (so a duration buff also ends on a rest). A
 * surviving effect keeps its conditions with `turns` decremented, preserving the
 * single-vs-array shape it was authored with.
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
    const isArray = Array.isArray(effect.expiry);
    const conditions: Expiry[] = Array.isArray(effect.expiry) ? effect.expiry : [effect.expiry];
    const aged = conditions.map((c) => ageCondition(c, opts));
    if (aged.some((a) => a.expired)) continue; // earliest condition to fire ends it
    const nextConditions = aged.map((a) => a.next);
    next.push({ ...effect, expiry: isArray ? nextConditions : nextConditions[0] });
  }
  return next;
}
