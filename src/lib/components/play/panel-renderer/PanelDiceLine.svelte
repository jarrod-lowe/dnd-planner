<script lang="ts">
  import { resolveValueSource, resolveExpression } from './resolveValueSource';
  import DamageTypeIcon from './DamageTypeIcon.svelte';
  import type { DiceLineControl, DiceEntry, RollResult } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-engine';
  import { t } from '$lib/i18n';

  interface Props {
    control: DiceLineControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRoll?: (data: RollResult, dieIndex: number) => void;
    gwfActive?: boolean;
  }

  let {
    control,
    editable,
    facts,
    vars,
    selections = {},
    onSelectionChange: _onSelectionChange,
    onRoll,
    gwfActive = false
  }: Props = $props();

  void _onSelectionChange;

  type RollMode = 'normal' | 'advantage' | 'disadvantage';

  interface RangeEntry {
    distance: number;
    type: string;
    disadvantage?: boolean;
    label?: string;
    damageDie?: number;
    extraHands?: number;
  }

  let rangeIndex = $state(
    selections && typeof selections.rangeIndex === 'number' ? selections.rangeIndex : 0
  );
  let rollResults = $state<Record<number, RollResult>>({});
  let rollMode = $state<RollMode>('normal');
  let showAdvPopover = $state(false);
  let popoverDieIndex = $state(-1);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let didLongPress = $state(false);

  const chipRefs: Record<number, HTMLElement> = $state({});

  const ranges = $derived(
    control.ranges
      ? (resolveValueSource(control.ranges, facts, vars, selections) as RangeEntry[] | undefined)
      : undefined
  );

  const currentRange = $derived(
    ranges && ranges.length > 0 ? ranges[rangeIndex % ranges.length] : undefined
  );

  const rulesDisadvantage = $derived(
    control.advantage ? !!resolveValueSource(control.advantage, facts, vars, selections) : false
  );

  const defaultRollMode = $derived<RollMode>(
    rulesDisadvantage || currentRange?.disadvantage ? 'disadvantage' : 'normal'
  );

  const effectiveRollMode = $derived<RollMode>(
    defaultRollMode !== 'normal' && rollMode === 'normal' ? defaultRollMode : rollMode
  );

  function handleRangeTap(): void {
    if (!editable || !ranges || ranges.length <= 1) return;
    rangeIndex = (rangeIndex + 1) % ranges.length;
    const range = ranges[rangeIndex];
    if (_onSelectionChange) {
      _onSelectionChange({
        rangeIndex,
        extraHands: range?.extraHands ?? 0
      });
    }
  }

  function formatRangeText(range: RangeEntry): string {
    if (range.label) return `${range.distance}ft ${range.label}`;
    return `${range.distance}ft`;
  }

  function formatBonus(die: DiceEntry): string {
    if (die.bonus === undefined) return '';
    const value = resolveValueSource(die.bonus, facts, vars, selections) as number | undefined;
    if (value === undefined) return '';
    if (value >= 0) return `+${value}`;
    return `${value}`;
  }

  function formatDieExpression(die: DiceEntry): string {
    // Check for range-based damage die override (versatile weapons)
    if (die.damageType && currentRange?.damageDie) {
      return `d${currentRange.damageDie}`;
    }
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
    const result = rollResults[dieIndex];
    if (result !== undefined) {
      const prefix =
        result.mode === 'advantage' ? '▲ ' : result.mode === 'disadvantage' ? '▼ ' : '';
      return `${prefix}${result.total}`;
    }
    let text = formatDieExpression(die);
    text += formatBonus(die);
    return text;
  }

  function getDieSides(die: DiceEntry): number | undefined {
    // Check for range-based damage die override (versatile weapons)
    if (die.damageType && currentRange?.damageDie) {
      return currentRange.damageDie;
    }
    const expr = resolveExpression(die.expression, facts, vars, selections);
    if (typeof expr === 'string' && expr.startsWith('d')) {
      const parsed = parseInt(expr.slice(1), 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    if (typeof expr === 'number') return expr;
    return undefined;
  }

  function isD20(die: DiceEntry): boolean {
    return getDieSides(die) === 20;
  }

  function handleRoll(dieIndex: number, mode?: RollMode): void {
    if (!editable) return;
    const die = control.dice[dieIndex];
    const sides = getDieSides(die);
    if (sides === undefined || sides < 0) return;
    const bonus = (resolveValueSource(die.bonus, facts, vars, selections) as number) ?? 0;
    const rollModeToUse = mode ?? (sides === 20 ? effectiveRollMode : 'normal');
    let natural: number;
    let droppedRoll: number | undefined;
    if (sides === 0) {
      natural = 0;
    } else if (rollModeToUse === 'advantage') {
      const r1 = Math.floor(Math.random() * sides) + 1;
      const r2 = Math.floor(Math.random() * sides) + 1;
      natural = Math.max(r1, r2);
      droppedRoll = Math.min(r1, r2);
    } else if (rollModeToUse === 'disadvantage') {
      const r1 = Math.floor(Math.random() * sides) + 1;
      const r2 = Math.floor(Math.random() * sides) + 1;
      natural = Math.min(r1, r2);
      droppedRoll = Math.max(r1, r2);
    } else {
      natural = Math.floor(Math.random() * sides) + 1;
    }
    // Apply Great Weapon Fighting: damage die rolls of 1 or 2 count as 3
    let gwfFloor: number | undefined;
    if (gwfActive && die.damageType && sides > 2 && (natural === 1 || natural === 2)) {
      gwfFloor = natural;
      natural = 3;
    }
    const damageTypeStr = formatDamageType(die) || undefined;
    const result: RollResult = {
      total: natural + bonus,
      natural,
      mode: sides === 20 ? rollModeToUse : undefined,
      droppedRoll,
      bonus: bonus !== 0 ? bonus : undefined,
      sides,
      damageType: damageTypeStr,
      gwfFloor
    };
    rollResults[dieIndex] = result;
    rollMode = 'normal';
    onRoll?.(result, dieIndex);
    const el = chipRefs[dieIndex];
    if (el) {
      el.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }],
        { duration: 200 }
      );
    }
  }

  const LONG_PRESS_MS = 300;

  function handlePointerDown(dieIndex: number): void {
    if (!editable) return;
    didLongPress = false;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      didLongPress = true;
      popoverDieIndex = dieIndex;
      showAdvPopover = true;
    }, LONG_PRESS_MS);
  }

  function cancelLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleChipClick(dieIndex: number): void {
    cancelLongPress();
    if (didLongPress) {
      didLongPress = false;
      return;
    }
    handleRoll(dieIndex);
  }

  function handlePopoverSelect(mode: RollMode): void {
    const di = popoverDieIndex;
    showAdvPopover = false;
    popoverDieIndex = -1;
    rollMode = mode;
    handleRoll(di, mode);
  }

  function handlePopoverDismiss(): void {
    showAdvPopover = false;
    popoverDieIndex = -1;
  }

  const parts = $derived.by<
    { type: 'label' | 'range' | 'die'; die?: DiceEntry; dieIndex?: number }[]
  >(() => {
    const result: { type: 'label' | 'range' | 'die'; die?: DiceEntry; dieIndex?: number }[] = [];
    if (control.label) {
      result.push({ type: 'label' });
    }
    if (currentRange) {
      result.push({ type: 'range' });
    }
    for (let di = 0; di < control.dice.length; di++) {
      result.push({ type: 'die', die: control.dice[di], dieIndex: di });
    }
    return result;
  });
</script>

<div class="panel-renderer__dice-line" role="group">
  {#each parts as part, i (i)}
    {#if i > 0}
      <span class="panel-renderer__dice-separator">|</span>
    {/if}
    {#if part.type === 'label'}
      <span class="panel-renderer__range">{$t(control.label!)}</span>
    {:else if part.type === 'range'}
      {#if editable}
        <button
          class="panel-renderer__range"
          class:panel-renderer__range--clickable={ranges && ranges.length > 1}
          type="button"
          onclick={handleRangeTap}
          disabled={!ranges || ranges.length <= 1}
        >
          {formatRangeText(currentRange!)}
        </button>
      {:else}
        <span class="panel-renderer__range">{formatRangeText(currentRange!)}</span>
      {/if}
    {:else}
      {@const dieIsD20 = isD20(part.die!)}
      {#if defaultRollMode !== 'normal' && dieIsD20}
        <span class="panel-renderer__disadv-indicator" aria-label="Disadvantage">▼</span>
      {/if}
      <div class="panel-renderer__chip-wrapper">
        {#if editable}
          <button
            class="panel-renderer__die-chip"
            class:panel-renderer__die-chip--crit={rollResults[part.dieIndex!]?.natural === 20}
            class:panel-renderer__die-chip--fumble={rollResults[part.dieIndex!]?.natural === 1}
            class:panel-renderer__die-chip--adv={rollResults[part.dieIndex!]?.mode === 'advantage'}
            class:panel-renderer__die-chip--disadv={rollResults[part.dieIndex!]?.mode ===
              'disadvantage'}
            type="button"
            data-die-index={part.dieIndex}
            bind:this={chipRefs[part.dieIndex!]}
            onpointerdown={() => handlePointerDown(part.dieIndex!)}
            onpointerup={cancelLongPress}
            onpointerleave={cancelLongPress}
            onclick={() => handleChipClick(part.dieIndex!)}
          >
            {formatDieChip(part.die!, part.dieIndex!)}
          </button>
        {:else}
          <span class="panel-renderer__die-chip">{formatDieChip(part.die!, part.dieIndex!)}</span>
        {/if}
        {#if showAdvPopover && popoverDieIndex === part.dieIndex}
          <div class="panel-renderer__popover" role="menu" aria-label="Roll mode">
            <button
              type="button"
              class="panel-renderer__popover-item"
              role="menuitem"
              onclick={() => handlePopoverSelect('advantage')}
            >
              ▲ Advantage
            </button>
            <button
              type="button"
              class="panel-renderer__popover-item"
              role="menuitem"
              onclick={() => handlePopoverSelect('normal')}
            >
              — Normal
            </button>
            <button
              type="button"
              class="panel-renderer__popover-item"
              role="menuitem"
              onclick={() => handlePopoverSelect('disadvantage')}
            >
              ▼ Disadvantage
            </button>
          </div>
          <button
            type="button"
            class="panel-renderer__popover-backdrop"
            onclick={handlePopoverDismiss}
            aria-label="Close"
          ></button>
        {/if}
      </div>
      {#if !dieIsD20 && formatDamageType(part.die!)}
        <span class="panel-renderer__damage-type-icon">
          <DamageTypeIcon type={formatDamageType(part.die!)} />
        </span>
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
    cursor: default;
    white-space: nowrap;
  }

  .panel-renderer__range--clickable {
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
  }

  .panel-renderer__range--clickable:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__disadv-indicator {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-error);
  }

  .panel-renderer__chip-wrapper {
    position: relative;
    display: inline-flex;
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

  .panel-renderer__popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
    background: transparent;
    border: none;
    padding: 0;
    cursor: default;
  }

  .panel-renderer__popover {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: var(--spacing-xs);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .panel-renderer__popover-item {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
    background: transparent;
    border: none;
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }

  .panel-renderer__popover-item:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__damage-type-icon {
    display: inline-flex;
    align-items: center;
    width: 1rem;
    height: 1rem;
    color: var(--md-sys-color-on-surface);
  }

  .panel-renderer__damage-type-icon :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
