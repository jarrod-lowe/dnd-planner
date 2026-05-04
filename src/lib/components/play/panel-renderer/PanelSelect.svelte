<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { SelectControl, SelectOption } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-engine';

  interface Props {
    control: SelectControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
  }

  let { control, editable, facts, vars, selections = {}, onSelectionChange }: Props = $props();

  const inlineOptions = $derived(
    Array.isArray(control.options) ? (control.options as SelectOption[]) : undefined
  );

  const resolvedRawOptions = $derived(
    inlineOptions
      ? undefined
      : (resolveValueSource(
          control.options as Exclude<SelectControl['options'], SelectOption[]>,
          facts,
          vars,
          selections
        ) as unknown[] | undefined)
  );

  type NormalizedOption = { value: unknown; label: string };

  const options = $derived<NormalizedOption[]>(
    inlineOptions
      ? inlineOptions
      : (resolvedRawOptions ?? []).map((v) => ({ value: v, label: String(v) }))
  );

  const selectedValue = $derived(resolveValueSource({ var: control.var }, facts, vars, selections));

  function handleChange(value: unknown): void {
    onSelectionChange?.({ [control.var]: value });
  }
</script>

<div class="panel-renderer__select" role="radiogroup" aria-label={control.var}>
  {#each options as option (String(option.value))}
    {#if editable}
      <button
        type="button"
        class="panel-renderer__radio-option"
        class:panel-renderer__radio-option--active={selectedValue === option.value}
        role="radio"
        aria-checked={selectedValue === option.value}
        onclick={() => handleChange(option.value)}
      >
        {option.label}
      </button>
    {:else}
      <span
        class="panel-renderer__radio-option panel-renderer__radio-option--readonly"
        class:panel-renderer__radio-option--active={selectedValue === option.value}
        role="radio"
        aria-checked={selectedValue === option.value}
      >
        {option.label}
      </span>
    {/if}
  {/each}
</div>

<style>
  .panel-renderer__select {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .panel-renderer__radio-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--md-sys-color-on-surface);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .panel-renderer__radio-option:hover {
    background: var(--md-sys-color-surface-container);
  }

  .panel-renderer__radio-option--active {
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }

  .panel-renderer__radio-option--readonly {
    cursor: default;
    opacity: 0.7;
  }

  .panel-renderer__radio-option--readonly.panel-renderer__radio-option--active {
    opacity: 1;
  }
</style>
