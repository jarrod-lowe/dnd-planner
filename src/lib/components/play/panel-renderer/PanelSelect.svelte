<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { SelectControl } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-engine';

  interface Props {
    control: SelectControl;
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
    onSelectionChange
  }: Props = $props();

  const options = $derived(
    resolveValueSource(control.options, facts, vars, selections) as unknown[] | undefined
  );

  const selectedValue = $derived(
    resolveValueSource({ var: control.var }, facts, vars, selections)
  );

  const displayValue = $derived(
    control.display
      ? resolveValueSource(control.display, facts, vars, selections)
      : selectedValue
  );

  function handleChange(value: unknown): void {
    onSelectionChange?.({ [control.var]: value });
  }
</script>

{#if editable}
  <div class="panel-renderer__select" role="radiogroup" aria-label={control.var}>
    {#each (options ?? []) as option}
      <label class="panel-renderer__radio">
        <input
          type="radio"
          name={control.var}
          value={String(option)}
          checked={selectedValue === option}
          onchange={() => handleChange(option)}
        />
        <span>{option}</span>
      </label>
    {/each}
  </div>
{:else}
  <div class="panel-renderer__select panel-renderer__select--readonly">
    <span class="panel-renderer__select-value">{displayValue ?? selectedValue ?? ''}</span>
  </div>
{/if}

<style>
  .panel-renderer__select {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .panel-renderer__radio {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
  }

  .panel-renderer__radio input[type='radio'] {
    accent-color: var(--md-sys-color-primary);
  }

  .panel-renderer__select--readonly {
    display: flex;
    align-items: center;
  }

  .panel-renderer__select-value {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
  }
</style>
