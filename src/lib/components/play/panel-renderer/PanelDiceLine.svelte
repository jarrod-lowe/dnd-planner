<script lang="ts">
  import { resolveValueSource, resolveExpression } from './resolveValueSource';
  import type { DiceLineControl, DiceEntry } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-engine';

  interface Props {
    control: DiceLineControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
  }

  let {
    control,
    editable,
    facts,
    vars,
    selections = {},
    onSelectionChange: _onSelectionChange
  }: Props = $props();

  void _onSelectionChange;

  interface RangeEntry {
    distance: number;
    type: string;
  }

  let rangeIndex = $state(0);

  const ranges = $derived(
    control.ranges
      ? (resolveValueSource(control.ranges, facts, vars, selections) as RangeEntry[] | undefined)
      : undefined
  );

  const currentRange = $derived(
    ranges && ranges.length > 0 ? ranges[rangeIndex % ranges.length] : undefined
  );

  function handleRangeTap(): void {
    if (!editable || !ranges || ranges.length <= 1) return;
    rangeIndex = (rangeIndex + 1) % ranges.length;
  }

  function formatBonus(die: DiceEntry): string {
    if (die.bonus === undefined) return '';
    const value = resolveValueSource(die.bonus, facts, vars, selections) as number | undefined;
    if (value === undefined) return '';
    if (value >= 0) return `+${value}`;
    return `${value}`;
  }

  function formatDieExpression(die: DiceEntry): string {
    const expr = resolveExpression(die.expression, facts, vars, selections);
    if (typeof expr === 'number') return `d${expr}`;
    return expr ?? '';
  }

  function formatDamageType(die: DiceEntry): string {
    if (!die.damageType) return '';
    const value = resolveValueSource(die.damageType, facts, vars, selections) as string | undefined;
    return value ?? '';
  }

  function formatDieChip(die: DiceEntry): string {
    let text = formatDieExpression(die);
    text += formatBonus(die);
    const dmgType = formatDamageType(die);
    if (dmgType) text += ` ${dmgType}`;
    return text;
  }

  const parts = $derived.by<{ type: 'range' | 'die'; die?: DiceEntry }[]>(() => {
    const result: { type: 'range' | 'die'; die?: DiceEntry }[] = [];
    if (currentRange) {
      result.push({ type: 'range' });
    }
    for (const die of control.dice) {
      result.push({ type: 'die', die });
    }
    return result;
  });
</script>

<div class="panel-renderer__dice-line">
  {#each parts as part, i (i)}
    {#if i > 0}
      <span class="panel-renderer__dice-separator">|</span>
    {/if}
    {#if part.type === 'range'}
      {#if editable}
        <button
          class="panel-renderer__range"
          type="button"
          onclick={handleRangeTap}
          disabled={!ranges || ranges.length <= 1}
        >
          {currentRange!.distance}ft
        </button>
      {:else}
        <span class="panel-renderer__range">{currentRange!.distance}ft</span>
      {/if}
    {:else}
      {#if editable}
        <button class="panel-renderer__die-chip" type="button">
          {formatDieChip(part.die!)}
        </button>
      {:else}
        <span class="panel-renderer__die-chip">{formatDieChip(part.die!)}</span>
      {/if}
    {/if}
  {/each}
</div>

<style>
  .panel-renderer__dice-line {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .panel-renderer__dice-separator {
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
  }

  .panel-renderer__range {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .panel-renderer__range:disabled {
    cursor: default;
  }

  .panel-renderer__die-chip {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    white-space: nowrap;
  }

  button.panel-renderer__die-chip:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  span.panel-renderer__die-chip {
    cursor: default;
    background: transparent;
    border: none;
    padding: 0;
  }
</style>
