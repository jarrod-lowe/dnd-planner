/**
 * Per-level spell slot state for the play-mode UI.
 *
 * Why this lives in the UI layer and not in the rules engine: `evaluate()`
 * returns `plan.facts` — the *projected post-plan* facts — and `evaluateSheet`
 * builds the sheet from `[...committed, ...advertised]` merged together. The
 * engine therefore structurally cannot distinguish a slot "spent this turn"
 * (still in the uncommitted plan) from one spent on an earlier turn: both have
 * already been summed into `spellcasting.slots.levelN.spent` by the time facts
 * are produced.
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

export interface SlotLevel {
  /** Spell slot level, 1–9. */
  level: number;
  /** Slots of this level the character has in total. */
  total: number;
  /**
   * Slots still castable right now (`total - spent`). Negative when the plan is
   * over budget — that is intended, not a bug; see `deriveSlotLevels`.
   */
  open: number;
  /** Slots spent by the current, uncommitted plan. */
  thisTurn: number;
  /** Projected total spent — prior turns plus this turn. */
  spent: number;
}

/** Spell slot levels the rules engine models. */
const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function totalFact(level: number): string {
  return `spellcasting.slots.level${level}.total`;
}

function spentFact(level: number): string {
  return `spellcasting.slots.level${level}.spent`;
}

function numberFact(facts: Facts, path: string): number {
  const value = facts[path];
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Break the projected slot facts down into open / this-turn / spent per level.
 *
 * @param facts Projected post-plan facts from the engine.
 * @param advertised This turn's advertised (uncommitted) effects — the store's
 *   `engineOutput.effects`.
 * @returns One entry per level with at least one slot, in ascending level order.
 */
export function deriveSlotLevels(facts: Facts, advertised: EffectInstance[]): SlotLevel[] {
  const levels: SlotLevel[] = [];

  // A rest recorded by THIS plan restores the spends scoped to it within the
  // same evaluation — `evaluateSheet` skips exactly these effects (same
  // `endsOnRest` predicate) when building the projected facts, so `spent` does
  // not include them. They stay in `plan.advertised` all the same (endTurn ages
  // them out at the boundary), so counting them here would report a spend the
  // facts say never happened: "4 open, 1 this turn, 0 spent of 4" — five pips on
  // a four-slot level. Filter them out so `thisTurn` only ever counts spends
  // that still stand once the plan settles.
  const restLong = numberFact(facts, 'rest.long') > 0;
  const restShort = numberFact(facts, 'rest.short') > 0;
  const standing = advertised.filter((e) => !endsOnRest(e.expiry, restLong, restShort));

  for (const level of SLOT_LEVELS) {
    const total = numberFact(facts, totalFact(level));
    if (total <= 0) continue;

    const spent = numberFact(facts, spentFact(level));
    const path = spentFact(level);
    let thisTurn = 0;
    for (const effect of standing) {
      thisTurn += effect.state?.[path] ?? 0;
    }

    // `open` is DELIBERATELY allowed to go negative — do NOT clamp it with
    // `Math.max(0, …)`. The engine does not veto an over-budget cast: it still
    // applies the illegal cast and advertises its slot spend, so `spent` can
    // legitimately exceed `total`. The ledger already surfaces "this plan is
    // over budget" separately (`status.legal === false` drives its warn state),
    // so the number's job here is to say *how far* over: "-1" tells the player
    // they are one slot into the red. Reporting `0` would hide the overdraft
    // and make an illegal plan look castable.
    levels.push({ level, total, open: total - spent, thisTurn, spent });
  }

  return levels;
}
