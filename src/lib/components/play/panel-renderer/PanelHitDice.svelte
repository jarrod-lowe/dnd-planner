<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import DieChip from './DieChip.svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type { HitDiceControl, RollResult } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';
  import type { EffectInstance } from '$lib/rules-engine';
  import { t } from '$lib/i18n';

  interface Props {
    control: HitDiceControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    /** This row's own advertised effects (`entry.advertisedEffects`). */
    advertisedEffects?: EffectInstance[];
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRoll?: (data: RollResult, slotIndex: number) => void;
  }

  let {
    control,
    editable,
    facts,
    vars,
    selections = {},
    advertisedEffects = [],
    onSelectionChange,
    onRoll
  }: Props = $props();

  interface ResolvedPool {
    /** Die size (6, 8, 10, 12). */
    sides: number;
    /** Total dice ever owned at this size — one slot roller per die. */
    total: number;
    /**
     * COMMITTED-based availability — slots at index >= threshold are spent by
     * an EARLIER rest and render disabled. The raw `remaining` fact is resolved
     * against POST-plan facts, so it already includes this row's own pending
     * spends; offsetting it back by the row's own rolled slots (each rolled
     * slot spends exactly one die) yields availability that the row's own rolls
     * cannot shrink. Rest rows are plan-terminal (at most one per plan), so the
     * offset is exact — the row's spends can never double-count.
     */
    threshold: number;
    slots: number[];
  }

  // Resolve a numeric value source, ignoring anything non-numeric (a string
  // fact must never leak into arithmetic).
  function resolveNumber(
    source: HitDiceControl['pools'][number]['total'] | HitDiceControl['bonus'],
    fallback: number
  ): number {
    const resolved = resolveValueSource(source, facts, vars, selections);
    return typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : fallback;
  }

  function resolvePoolNumber(
    source: HitDiceControl['pools'][number]['total'],
    fallback: number
  ): number {
    const resolved = resolveNumber(source, fallback);
    return resolved > 0 ? Math.floor(resolved) : fallback;
  }

  // Unlike a dice-line's rollResults, hit-dice rolls are SLOT-KEYED and ride
  // the pending row's `selections.rolls` (the engine reads them from there).
  // Deriving the view from the selections prop means the rolls survive any
  // dice-signature change (the spent boundary moving as earlier plan items
  // commit) — there is deliberately no $effect that clears them.
  function parseRolls(raw: unknown): Record<string, Record<string, number>> {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const parsed: Record<string, Record<string, number>> = {};
    for (const [size, slots] of Object.entries(raw as Record<string, unknown>)) {
      if (slots === null || typeof slots !== 'object' || Array.isArray(slots)) continue;
      const sizeRolls: Record<string, number> = {};
      for (const [slot, value] of Object.entries(slots as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value)) sizeRolls[slot] = value;
      }
      parsed[size] = sizeRolls;
    }
    return parsed;
  }

  const rolls = $derived(parseRolls(selections.rolls));

  const pools = $derived.by<ResolvedPool[]>(() =>
    control.pools
      .map((pool) => {
        const total = resolvePoolNumber(pool.total, 0);
        // Clamp defensively: `remaining` may exceed `total` if a reset races a spend.
        const remaining = Math.min(resolvePoolNumber(pool.remaining, 0), total);
        // Distinct rolled SLOT KEYS for this size (a re-roll replaces its slot,
        // so it counts once) — the row's own pending spends to offset back out.
        const ownRolls = Object.keys(rolls[`d${pool.sides}`] ?? {}).length;
        return {
          sides: pool.sides,
          total,
          threshold: Math.min(remaining + ownRolls, total),
          slots: [] as number[]
        };
      })
      .filter((pool) => pool.total > 0)
      .map((pool) => ({
        ...pool,
        slots: Array.from({ length: pool.total }, (_, i) => i)
      }))
  );

  // The CON modifier added to each die's heal. Surfaced on the chip exactly as
  // a dice-line surfaces a die bonus ("d10+2" before the roll, natural+bonus
  // after); the engine's `apply` remains the authority on the final heal. A
  // bonus source that resolves to a non-number (a string fact) is no bonus —
  // it must never string-concatenate into the arithmetic.
  const bonus = $derived(control.bonus === undefined ? 0 : resolveNumber(control.bonus, 0));

  function slotRoll(pool: ResolvedPool, slot: number): number | undefined {
    return rolls[`d${pool.sides}`]?.[String(slot)];
  }

  function formatBonus(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  // Chip text follows the dice-line convention: the expression with its bonus
  // before rolling, the roll total (natural + modifier) after — never the
  // engine's floored heal, which shows in the structural HP preview instead.
  function chipText(pool: ResolvedPool, slot: number): string {
    const rolled = slotRoll(pool, slot);
    if (rolled !== undefined) return String(rolled + bonus);
    return control.bonus === undefined ? `d${pool.sides}` : `d${pool.sides}${formatBonus(bonus)}`;
  }

  // The HP missing from the POST-plan facts — but the engine budgets the heal
  // from the missing HP at ITS apply time, which excludes this row's own
  // effects (the fold pushes them only after apply runs). Those heals are
  // already subtracted here, so add the row's own advertised heals back to
  // reconstruct the budget the engine actually commits against. Heals from
  // EARLIER plan rows stay subtracted: the engine's apply sees those.
  const missingHp = $derived.by(() => {
    const postPlan = Math.max(0, -Number(facts['hp.modifier.current'] ?? 0));
    return postPlan + ownPendingHeal();
  });

  // Sum of the effective heals this row's `effect-hit-die-heal` effects carry —
  // the engine's capped values, never a recomputed roll + CON (the cap is
  // exactly what recomputation cannot recover from the facts alone).
  function ownPendingHeal(): number {
    let sum = 0;
    for (const effect of advertisedEffects) {
      const heal = effect.state?.['hp.modifier.current'];
      if (typeof heal !== 'number') continue;
      // Only the hit-die heals: the row also advertises the rest flag, which
      // touches no HP.
      if (!Object.keys(effect.state ?? {}).some((k) => /^hitDie\.d\d+\.spent$/.test(k))) continue;
      sum += heal;
    }
    return sum;
  }

  // The engine consumes the budget in ascending size-then-slot order, so the
  // preview walks pools in that order (whatever order they render in).
  const orderedPools = $derived([...pools].sort((a, b) => a.sides - b.sides));

  // The heal a given slot's roll would land, mirroring shortRestOffer exactly:
  // min(max(1, roll + bonus), budget left when this slot's turn comes), with
  // every earlier-in-order rolled slot having already claimed its capped heal.
  // `natural` overrides the stored roll (the just-tapped roll is not in the
  // selections yet). Same input, same answer as the engine commits.
  function cappedHealFor(pool: ResolvedPool, slot: number, natural: number): number {
    let missing = missingHp;
    for (const p of orderedPools) {
      for (const s of p.slots) {
        const isTarget = p.sides === pool.sides && s === slot;
        const rolled = isTarget ? natural : slotRoll(p, s);
        if (rolled === undefined) continue;
        const effective = Math.min(healFor(rolled), missing);
        if (isTarget) return effective;
        missing -= effective;
      }
    }
    // The slot's pool is filtered out of the render (total 0) — unreachable
    // for a tappable slot, but keep the engine's shape anyway.
    return Math.min(healFor(natural), missing);
  }

  // The announced heal per rolled slot (aria-label). Precomputed so each chip
  // labels without re-walking the whole board.
  const announcedHeals = $derived.by(() => {
    const bySlot = new SvelteMap<string, number>();
    for (const pool of pools) {
      for (const slot of pool.slots) {
        const rolled = slotRoll(pool, slot);
        if (rolled === undefined) continue;
        bySlot.set(`d${pool.sides}:${slot}`, cappedHealFor(pool, slot, rolled));
      }
    }
    return bySlot;
  });

  function rollSlot(pool: ResolvedPool, slot: number): void {
    if (!editable || slot >= pool.threshold) return;
    const natural = Math.floor(Math.random() * pool.sides) + 1;
    const key = `d${pool.sides}`;
    // Re-roll replaces: one slot = one die = one entry in the map.
    onSelectionChange?.({
      rolls: { ...rolls, [key]: { ...(rolls[key] ?? {}), [String(slot)]: natural } }
    });
    onRoll?.(
      {
        total: cappedHealFor(pool, slot, natural),
        natural,
        bonus: bonus !== 0 ? bonus : undefined,
        sides: pool.sides,
        unit: control.unit,
        purpose: 'healing'
      },
      slot
    );
  }

  // A roll stranded on a slot an EARLIER rest's committed spend has blocked
  // can ONLY be cleared — committing it would error die_already_spent with no
  // other fix but deleting the row.
  function clearRoll(pool: ResolvedPool, slot: number): void {
    if (!editable) return;
    const key = `d${pool.sides}`;
    const sizeRolls = { ...(rolls[key] ?? {}) };
    delete sizeRolls[String(slot)];
    const nextRolls = { ...rolls };
    if (Object.keys(sizeRolls).length > 0) nextRolls[key] = sizeRolls;
    else delete nextRolls[key];
    onSelectionChange?.({ rolls: nextRolls });
  }

  // Each die heals at least 1 HP (the engine's floor); the missing-HP cap is
  // applied by `cappedHealFor` and committed engine-side.
  function healFor(natural: number): number {
    return Math.max(1, natural + bonus);
  }

  function poolAriaLabel(pool: ResolvedPool): string {
    // The announced unspent count is the COMMITTED-based threshold, not the raw
    // post-plan `remaining` — the row's own pending rolls are still unspent
    // until End Turn commits them.
    return $t('play.hitDice.poolLabel', {
      sides: String(pool.sides),
      remaining: String(pool.threshold),
      total: String(pool.total)
    });
  }

  function slotAriaLabel(pool: ResolvedPool, slot: number): string {
    const params = {
      sides: String(pool.sides),
      slot: String(slot + 1),
      total: String(pool.total)
    };
    // A rolled slot announces its roll and its CAPPED heal (the same value the
    // engine commits — never a heal that lands 0). A rolled slot blocked by an
    // EARLIER rest's committed spend stays tappable solely to clear the roll,
    // so its label says so; only never-rolled slots announce the bare spent
    // label.
    const rolled = slotRoll(pool, slot);
    if (rolled !== undefined) {
      const heal = announcedHeals.get(`d${pool.sides}:${slot}`) ?? healFor(rolled);
      if (slot >= pool.threshold) {
        return $t('play.hitDice.slotSpentRolledLabel', {
          ...params,
          roll: String(rolled),
          heal: String(heal)
        });
      }
      return $t('play.hitDice.slotRolledLabel', {
        ...params,
        roll: String(rolled),
        heal: String(heal)
      });
    }
    if (slot >= pool.threshold) return $t('play.hitDice.slotSpentLabel', params);
    return $t('play.hitDice.slotLabel', params);
  }
</script>

{#if pools.length > 0}
  <div class="panel-renderer__hit-dice" role="group" aria-label={$t('play.hitDice.groupLabel')}>
    {#each pools as pool (pool.sides)}
      <div
        class="panel-renderer__hit-dice-pool"
        role="group"
        aria-label={poolAriaLabel(pool)}
        data-die-sides={pool.sides}
      >
        {#each pool.slots as slot (slot)}
          {@const spent = slot >= pool.threshold}
          {@const rolled = slotRoll(pool, slot) !== undefined}
          <DieChip
            text={chipText(pool, slot)}
            {editable}
            ariaLabel={slotAriaLabel(pool, slot)}
            disabled={spent && !rolled}
            dieSides={pool.sides}
            slotIndex={slot}
            onclick={() => (spent ? clearRoll(pool, slot) : rollSlot(pool, slot))}
          />
        {/each}
      </div>
    {/each}
  </div>
{/if}

<style>
  .panel-renderer__hit-dice {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .panel-renderer__hit-dice-pool {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }
</style>
