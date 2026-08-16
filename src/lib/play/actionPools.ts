/**
 * Per-pool action state for the play-mode UI.
 *
 * Why this lives in the UI layer and not in the rules engine: `evaluate()`
 * returns `plan.facts` — the *projected post-plan* facts — and `evaluateSheet`
 * builds the sheet from `[...committed, ...advertised]` merged together. The
 * engine therefore structurally cannot distinguish a pool "spent this turn"
 * (still in the uncommitted plan) from one spent on an earlier turn: both have
 * already been summed into `actions.spent` by the time facts are produced.
 *
 * The split survives only in the store, which keeps `state.committed` (prior
 * turns) apart from `engineOutput.effects` (= `plan.advertised`, this turn). So
 * we re-derive the breakdown here, from the projected facts plus this turn's
 * advertised effects. No new facts, no engine change.
 *
 * Pure: no store access, no side effects.
 */
import type { Facts } from '$lib/rules-view';
import { endsOnRest } from '$lib/rules-engine';
import type { EffectInstance } from '$lib/rules-engine';

export interface ActionPool {
  /** Fact key, e.g. 'actions'. */
  key: string;
  /** Pool size — the `.max` fact. */
  total: number;
  /** `total - spent`, DELIBERATELY unclamped (over-budget overdraft). */
  open: number;
  /** Spends from the current uncommitted plan. */
  thisTurn: number;
  /** Projected total spent. */
  spent: number;
}

/** Action pools the rules engine models for a player character. */
const PLAYER_POOLS = ['actions', 'bonusActions', 'reactions'];

function numberFact(facts: Facts, path: string): number {
  const value = facts[path];
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Break the projected pool facts down into open / this-turn / spent per pool.
 *
 * @param facts Projected post-plan facts from the engine.
 * @param advertised This turn's advertised (uncommitted) effects — the store's
 *   `engineOutput.effects`.
 * @param factPrefix Optional prefix for facts, e.g. `'companion.steed.'` for
 *   companion pools.
 * @param pools Pool keys to derive, default `PLAYER_POOLS`.
 * @returns One entry per pool with a positive max, in the order given by `pools`.
 */
export function deriveActionPools(
  facts: Facts,
  advertised: EffectInstance[],
  factPrefix = '',
  pools: string[] = PLAYER_POOLS
): ActionPool[] {
  const result: ActionPool[] = [];

  // A rest recorded by THIS plan restores the spends scoped to it within the
  // same evaluation — `evaluateSheet` skips exactly these effects (same
  // `endsOnRest` predicate) when building the projected facts, so `spent` does
  // not include them. They stay in `plan.advertised` all the same (endTurn ages
  // them out at the boundary), so counting them here would report a spend the
  // facts say never happened. Filter them out so `thisTurn` only ever counts
  // spends that still stand once the plan settles.
  const restLong = numberFact(facts, 'rest.long') > 0;
  const restShort = numberFact(facts, 'rest.short') > 0;
  const standing = advertised.filter((e) => !endsOnRest(e.expiry, restLong, restShort));

  for (const key of pools) {
    const totalPath = `${factPrefix}${key}.max`;
    const spentPath = `${factPrefix}${key}.spent`;

    const total = numberFact(facts, totalPath);
    if (total <= 0) continue;

    const spent = numberFact(facts, spentPath);
    let thisTurn = 0;
    for (const effect of standing) {
      thisTurn += effect.state?.[spentPath] ?? 0;
    }

    // `open` is DELIBERATELY allowed to go negative — do NOT clamp it with
    // `Math.max(0, …)`. The engine does not veto an over-budget action: it
    // still applies the illegal action and advertises its spend, so `spent`
    // can legitimately exceed `total`. The ledger already surfaces
    // "this plan is over budget" separately (`status.legal === false` drives
    // its warn state), so the number's job here is to say *how far* over:
    // "-1" tells the player they are one action into the red. Reporting `0`
    // would hide the overdraft and make an illegal plan look playable.
    result.push({ key, total, open: total - spent, thisTurn, spent });
  }

  return result;
}
