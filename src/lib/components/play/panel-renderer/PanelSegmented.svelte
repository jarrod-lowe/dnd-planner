<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { SegmentedControl } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-engine';
  import { t } from '$lib/i18n';

  interface Props {
    control: SegmentedControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
  }

  let { control, editable, facts, vars, selections = {}, onSelectionChange }: Props = $props();

  const selectedValue = $derived(resolveValueSource({ var: control.var }, facts, vars, selections));

  function handleChange(value: number): void {
    onSelectionChange?.({ [control.var]: value });
  }
</script>

<div class="panel-renderer__segmented" role="radiogroup" aria-label={control.var}>
  {#each control.options as option (option.value)}
    {#if editable}
      <button
        type="button"
        class="panel-renderer__segment"
        class:panel-renderer__segment--active={selectedValue === option.value}
        role="radio"
        aria-checked={selectedValue === option.value}
        onclick={() => handleChange(option.value)}
      >
        {$t(option.label)}
      </button>
    {:else}
      <span
        class="panel-renderer__segment panel-renderer__segment--readonly"
        class:panel-renderer__segment--active={selectedValue === option.value}
        role="radio"
        aria-checked={selectedValue === option.value}
      >
        {$t(option.label)}
      </span>
    {/if}
  {/each}
</div>

<style>
  .panel-renderer__segmented {
    display: flex;
    gap: 1px;
    background: var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .panel-renderer__segment {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: none;
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .panel-renderer__segment:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__segment--active {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }

  .panel-renderer__segment--active:hover {
    background: var(--md-sys-color-primary);
  }

  .panel-renderer__segment--readonly {
    cursor: default;
    opacity: 0.7;
  }

  .panel-renderer__segment--readonly:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .panel-renderer__segment--readonly.panel-renderer__segment--active {
    opacity: 1;
  }

  .panel-renderer__segment--readonly.panel-renderer__segment--active:hover {
    background: var(--md-sys-color-primary);
  }
</style>
