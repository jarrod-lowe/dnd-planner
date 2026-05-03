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

  let rollResults = $state<Record<number, { total: number; natural: number }>>({});

  const chipRefs: Record<number, HTMLElement> = $state({});

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

  function formatDieChip(die: DiceEntry, dieIndex: number): string {
    if (rollResults[dieIndex] !== undefined) {
      return String(rollResults[dieIndex].total);
    }
    let text = formatDieExpression(die);
    text += formatBonus(die);
    const dmgType = formatDamageType(die);
    if (dmgType) text += ` ${dmgType}`;
    return text;
  }

  function getDieSides(die: DiceEntry): number | undefined {
    const expr = resolveExpression(die.expression, facts, vars, selections);
    if (typeof expr === 'string' && expr.startsWith('d')) {
      const parsed = parseInt(expr.slice(1), 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    if (typeof expr === 'number') return expr;
    return undefined;
  }

  function handleRoll(dieIndex: number): void {
    if (!editable) return;
    const die = control.dice[dieIndex];
    const sides = getDieSides(die);
    if (sides === undefined || sides < 1) return;
    const natural = Math.floor(Math.random() * sides) + 1;
    const bonus = (resolveValueSource(die.bonus, facts, vars, selections) as number) ?? 0;
    rollResults[dieIndex] = { total: natural + bonus, natural };
    const el = chipRefs[dieIndex];
    if (el) {
      el.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.1)' },
          { transform: 'scale(1)' }
        ],
        { duration: 200 }
      );
    }
  }

  const parts = $derived.by<{ type: 'range' | 'die'; die?: DiceEntry; dieIndex?: number }[]>(() => {
    const result: { type: 'range' | 'die'; die?: DiceEntry; dieIndex?: number }[] = [];
    if (currentRange) {
      result.push({ type: 'range' });
    }
    for (let di = 0; di < control.dice.length; di++) {
      result.push({ type: 'die', die: control.dice[di], dieIndex: di });
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
        <button
          class="panel-renderer__die-chip"
          class:panel-renderer__die-chip--crit={rollResults[part.dieIndex!]?.natural === 20}
          class:panel-renderer__die-chip--fumble={rollResults[part.dieIndex!]?.natural === 1}
          type="button"
          data-die-index={part.dieIndex}
          bind:this={chipRefs[part.dieIndex!]}
          onclick={() => handleRoll(part.dieIndex!)}
        >
          {formatDieChip(part.die!, part.dieIndex!)}
        </button>
      {:else}
        <span class="panel-renderer__die-chip">{formatDieChip(part.die!, part.dieIndex!)}</span>
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

  .panel-renderer__die-chip--crit {
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }

  .panel-renderer__die-chip--fumble {
    color: var(--md-sys-color-on-error);
    background: var(--md-sys-color-error);
    border-color: var(--md-sys-color-error);
  }
</style>
