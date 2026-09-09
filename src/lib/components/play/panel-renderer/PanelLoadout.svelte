<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '$lib/i18n';
  import { enumerateLoadouts, type LoadoutConfig } from '$lib/rules-engine/loadout';
  import type { LoadoutControl } from './types';
  import type { RuleModule } from '$lib/rules-engine/types';

  /**
   * The hand-configuration picker for `set-loadout`.
   *
   * The unit of choice is a WHOLE hand configuration, not an item, so every row
   * is one legal configuration and picking one replaces both hands at once. The
   * rows are not authored: `enumerateLoadouts` derives them from the modules the
   * character has assigned, which is why adding a weapon needs no change here.
   *
   * Not a `PanelSelect`: that control is a flat radiogroup with no arrow-key
   * traversal whose options resolve through `String(v)` (untranslated), while a
   * loadout's value is an object and its label is a row of translated chips.
   */

  interface Props {
    control: LoadoutControl;
    editable: boolean;
    /** The character's resolved modules — the same array the engine evaluates. */
    modules?: RuleModule[];
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
  }

  let { control, editable, modules = [], selections = {}, onSelectionChange }: Props = $props();

  const configs = $derived(enumerateLoadouts(modules));

  const selectedId = $derived((selections[control.var] as LoadoutConfig | undefined)?.id);

  /**
   * The loadout the character arrived with, read ONCE at mount rather than
   * tracked. It is what the list is pinned by, and re-pinning on every keystroke
   * would slide the rows out from under the finger mid-choice.
   */
  const pinnedId = untrack(() => (selections[control.var] as LoadoutConfig | undefined)?.id);

  const ordered = $derived.by(() => {
    const index = configs.findIndex((c) => c.id === pinnedId);
    if (index <= 0) return configs;
    return [configs[index], ...configs.slice(0, index), ...configs.slice(index + 1)];
  });

  // Roving tabindex: exactly one row is in the tab order. Arrowing selects as it
  // moves (standard radiogroup behaviour), so the selected row IS the tab stop;
  // with nothing chosen yet the first row takes it.
  const focusIndex = $derived(
    Math.max(
      0,
      ordered.findIndex((c) => c.id === selectedId)
    )
  );

  let rowEls = $state<(HTMLElement | undefined)[]>([]);

  /**
   * Three literal keys rather than one built from the count: the i18n coverage
   * test resolves keys statically, and a plural rule is not a string template.
   */
  function handsFreeKey(handsFree: number): string {
    if (handsFree <= 0) return 'play.loadout.handsFree.none';
    if (handsFree === 1) return 'play.loadout.handsFree.one';
    return 'play.loadout.handsFree.many';
  }

  /**
   * The row's accessible name. The chips are decorative (the whole strip is
   * aria-hidden), so this is the only thing a screen reader hears: every item,
   * its grip where the grip is a choice, and how many hands are left over — a
   * free hand is load-bearing, so it is never left implied.
   */
  function rowLabel(config: LoadoutConfig): string {
    const parts: string[] = [];
    if (config.items.length === 0 && config.emptyKey) parts.push($t(config.emptyKey));
    for (const item of config.items) {
      parts.push($t(item.nameKey));
      if (item.gripKey) parts.push($t(item.gripKey));
    }
    parts.push($t(handsFreeKey(config.handsFree), { count: String(config.handsFree) }));
    return parts.join(', ');
  }

  function freeHandSlots(config: LoadoutConfig): number[] {
    return Array.from({ length: Math.max(0, config.handsFree) }, (_, i) => i);
  }

  function select(config: LoadoutConfig): void {
    onSelectionChange?.({ [control.var]: config });
  }

  function handleKeydown(event: KeyboardEvent, index: number): void {
    const count = ordered.length;
    if (count === 0) return;
    let next: number;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % count;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
      next = (index - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;
    event.preventDefault();
    select(ordered[next]);
    rowEls[next]?.focus();
  }
</script>

{#snippet chips(config: LoadoutConfig)}
  <span class="loadout-picker__chips" aria-hidden="true">
    {#if config.items.length === 0 && config.emptyKey}
      <span class="loadout-picker__chip loadout-picker__chip--empty">{$t(config.emptyKey)}</span>
    {/if}
    {#each config.items as item, i (`${item.id}-${i}`)}
      <span class="loadout-picker__chip loadout-picker__chip--item">{$t(item.nameKey)}</span>
      {#if item.gripKey}
        <span class="loadout-picker__chip loadout-picker__chip--grip">{$t(item.gripKey)}</span>
      {/if}
    {/each}
    {#each freeHandSlots(config) as slot (slot)}
      <span class="loadout-picker__chip loadout-picker__chip--free">{$t(config.freeHandKey)}</span>
    {/each}
  </span>
{/snippet}

<div class="loadout-picker" role="radiogroup" aria-label={$t('play.loadout.groupLabel')}>
  {#each ordered as config, i (config.id)}
    {#if editable}
      <button
        type="button"
        bind:this={rowEls[i]}
        class="loadout-picker__row"
        class:loadout-picker__row--active={config.id === selectedId}
        role="radio"
        aria-checked={config.id === selectedId}
        aria-label={rowLabel(config)}
        data-loadout-id={config.id}
        tabindex={i === focusIndex ? 0 : -1}
        onclick={() => select(config)}
        onkeydown={(event) => handleKeydown(event, i)}
      >
        {@render chips(config)}
      </button>
    {:else}
      <span
        class="loadout-picker__row loadout-picker__row--readonly"
        class:loadout-picker__row--active={config.id === selectedId}
        role="radio"
        aria-checked={config.id === selectedId}
        aria-label={rowLabel(config)}
        data-loadout-id={config.id}
      >
        {@render chips(config)}
      </span>
    {/if}
  {/each}
</div>

<style>
  .loadout-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  /* One whole hand configuration. Tablet-sized tap target. */
  .loadout-picker__row {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 2.75rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    color: var(--md-sys-color-on-surface);
    font-family: var(--font-body);
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .loadout-picker__row:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .loadout-picker__row:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .loadout-picker__row--active {
    border-color: var(--md-sys-color-primary);
    background: var(--md-sys-color-surface-container);
  }

  .loadout-picker__row--readonly {
    cursor: default;
  }

  .loadout-picker__row--readonly:hover {
    background: transparent;
  }

  .loadout-picker__row--readonly.loadout-picker__row--active {
    background: var(--md-sys-color-surface-container);
  }

  .loadout-picker__chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-xs);
  }

  /* Same chip vocabulary as ModChip: a small uppercase pill. */
  .loadout-picker__chip {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem var(--spacing-sm);
    border-radius: var(--radius-full);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1.4;
    white-space: nowrap;
  }

  /* A held item — the solid chip, as ModChip's effect variant is solid. */
  .loadout-picker__chip--item {
    border: 1.5px solid var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary-container);
    background: var(--md-sys-color-primary-container);
  }

  /* Grip is an annotation on the item before it, so it reads quieter. */
  .loadout-picker__chip--grip {
    border: 1.5px solid var(--md-sys-color-outline-variant);
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
  }

  /* A free hand is a slot, not a thing held — outline only, as ModChip's
     illegal variant marks an absence. */
  .loadout-picker__chip--free,
  .loadout-picker__chip--empty {
    border: 1.5px dashed var(--md-sys-color-outline);
    color: var(--md-sys-color-on-surface-variant);
    background: transparent;
  }
</style>
