<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import { nextSegmentedId } from './segmentedId';
  import type { SegmentedControl } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';
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

  // Unique prefix so two controls sharing the same `var` (e.g. Grapple and a
  // save record both use "passed") don't collide on input ids, label[for]
  // associations, the radio name, or the prefix label's id.
  const uid = nextSegmentedId();

  const selectedValue = $derived(resolveValueSource({ var: control.var }, facts, vars, selections));

  function handleChange(value: number): void {
    onSelectionChange?.({ [control.var]: value });
  }
</script>

<div class="panel-renderer__segmented-row">
  {#if control.prefix}
    <span id={`${uid}-prefix`} class="panel-renderer__segmented-prefix">
      {$t(control.prefix)}
    </span>
  {/if}
  <fieldset
    class="panel-renderer__segmented"
    aria-labelledby={control.prefix ? `${uid}-prefix` : undefined}
  >
    {#each control.options as option (option.value)}
      {#if editable}
        {@const inputId = `${uid}-${option.value}`}
        <div class="panel-renderer__segment-wrapper">
          <input
            type="radio"
            name={uid}
            id={inputId}
            value={option.value}
            class="panel-renderer__segment-input"
            checked={selectedValue === option.value}
            onchange={() => handleChange(option.value)}
          />
          <label
            for={inputId}
            class="panel-renderer__segment"
            class:panel-renderer__segment--active={selectedValue === option.value}
          >
            {$t(option.label)}
          </label>
        </div>
      {:else}
        <span
          class="panel-renderer__segment panel-renderer__segment--readonly"
          class:panel-renderer__segment--active={selectedValue === option.value}
        >
          {$t(option.label)}
        </span>
      {/if}
    {/each}
  </fieldset>
</div>

<style>
  .panel-renderer__segmented-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .panel-renderer__segmented-prefix {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
  }

  .panel-renderer__segmented-prefix::after {
    content: ':';
  }

  .panel-renderer__segmented-row .panel-renderer__segmented {
    flex: 1;
    min-width: 0;
  }

  .panel-renderer__segmented {
    display: flex;
    gap: 1px;
    background: var(--md-sys-color-outline-variant);
    border: none;
    border-radius: var(--radius-sm);
    overflow: hidden;
    padding: 0;
    margin: 0;
    min-inline-size: 0;
  }

  .panel-renderer__segment-wrapper {
    flex: 1;
    display: flex;
    position: relative;
  }

  .panel-renderer__segment-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
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
