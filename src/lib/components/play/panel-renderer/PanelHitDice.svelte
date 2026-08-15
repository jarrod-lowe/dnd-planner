<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import DieChip from './DieChip.svelte';
  import type { HitDiceControl, RollResult } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';
  import { t } from '$lib/i18n';

  interface Props {
    control: HitDiceControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRoll?: (data: RollResult, slotIndex: number) => void;
  }

  let {
    control,
    editable,
    facts,
    vars,
    selections = {},
    onSelectionChange,
    onRoll
  }: Props = $props();

  interface ResolvedPool {
    /** Die size (6, 8, 10, 12). */
    sides: number;
    /** Total dice ever owned at this size — one slot roller per die. */
    total: number;
    /** Unspent dice — slots at index >= remaining are spent and render disabled. */
    remaining: number;
    slots: number[];
  }

  function resolvePoolNumber(
    source: HitDiceControl['pools'][number]['total'],
    fallback: number
  ): number {
    const resolved = resolveValueSource(source, facts, vars, selections);
    return typeof resolved === 'number' && resolved > 0 ? Math.floor(resolved) : fallback;
  }

  const pools = $derived.by<ResolvedPool[]>(() =>
    control.pools
      .map((pool) => {
        const total = resolvePoolNumber(pool.total, 0);
        return {
          sides: pool.sides,
          total,
          // Clamp defensively: `remaining` may exceed `total` if a reset races a spend.
          remaining: Math.min(resolvePoolNumber(pool.remaining, 0), total),
          slots: [] as number[]
        };
      })
      .filter((pool) => pool.total > 0)
      .map((pool) => ({
        ...pool,
        slots: Array.from({ length: pool.total }, (_, i) => i)
      }))
  );

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

  // The CON modifier added to each die's heal. Surfaced on the chip exactly as
  // a dice-line surfaces a die bonus ("d10+2" before the roll, natural+bonus
  // after); the engine's `apply` remains the authority on the final heal.
  const bonus = $derived(
    control.bonus === undefined
      ? 0
      : ((resolveValueSource(control.bonus, facts, vars, selections) as number | undefined) ?? 0)
  );

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

  function rollSlot(pool: ResolvedPool, slot: number): void {
    if (!editable || slot >= pool.remaining) return;
    const natural = Math.floor(Math.random() * pool.sides) + 1;
    const key = `d${pool.sides}`;
    // Re-roll replaces: one slot = one die = one entry in the map.
    onSelectionChange?.({
      rolls: { ...rolls, [key]: { ...(rolls[key] ?? {}), [String(slot)]: natural } }
    });
    onRoll?.(
      {
        total: healFor(natural),
        natural,
        bonus: bonus !== 0 ? bonus : undefined,
        sides: pool.sides,
        unit: control.unit,
        purpose: 'healing'
      },
      slot
    );
  }

  // Each die heals at least 1 HP (the engine's floor); the missing-HP cap is
  // applied engine-side and shows up in the structural HP preview instead.
  function healFor(natural: number): number {
    return Math.max(1, natural + bonus);
  }

  function poolAriaLabel(pool: ResolvedPool): string {
    return $t('play.hitDice.poolLabel', {
      sides: String(pool.sides),
      remaining: String(pool.remaining),
      total: String(pool.total)
    });
  }

  function slotAriaLabel(pool: ResolvedPool, slot: number): string {
    const params = {
      sides: String(pool.sides),
      slot: String(slot + 1),
      total: String(pool.total)
    };
    // A rolled slot announces its roll even when the spent boundary has since
    // moved past it — sighted users still see the rolled value on the chip, and
    // the (disabled) button state already conveys spent. Only never-rolled
    // slots announce the bare spent label.
    const rolled = slotRoll(pool, slot);
    if (rolled !== undefined) {
      return $t('play.hitDice.slotRolledLabel', {
        ...params,
        roll: String(rolled),
        heal: String(healFor(rolled))
      });
    }
    if (slot >= pool.remaining) return $t('play.hitDice.slotSpentLabel', params);
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
          {@const spent = slot >= pool.remaining}
          <DieChip
            text={chipText(pool, slot)}
            {editable}
            ariaLabel={slotAriaLabel(pool, slot)}
            disabled={spent}
            dieSides={pool.sides}
            slotIndex={slot}
            onclick={() => rollSlot(pool, slot)}
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
