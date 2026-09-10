<script module lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { SegmentedControl } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';

  /**
   * Whether this control has nothing to show in summary mode (no option
   * matches the current value). Exported so `PanelRenderer` can decide
   * whether to render this control's `.panel-renderer__control` wrapper at
   * all — see `textInputIsEmpty` in `PanelTextInput.svelte` for why this must
   * be resolved before mounting, not signalled back from a mounted instance.
   */
  export function segmentedIsEmpty(
    control: SegmentedControl,
    facts: Facts,
    vars: Record<string, VarDefinition>,
    selections: Record<string, unknown>
  ): boolean {
    const selectedValue = resolveValueSource({ var: control.var }, facts, vars, selections);
    return !control.options.some((option) => option.value === selectedValue);
  }
</script>

<script lang="ts">
  import { nextSegmentedId } from './segmentedId';
  import { t } from '$lib/i18n';

  interface Props {
    control: SegmentedControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    /**
     * Collapsed-row short form: renders only the selected option's label
     * (plus its authored `prefix`, if any), no fieldset/segments. The
     * control instance stays mounted across the collapse/expand toggle.
     */
    summary?: boolean;
  }

  let {
    control,
    editable,
    facts,
    vars,
    selections = {},
    onSelectionChange,
    summary = false
  }: Props = $props();

  // Unique prefix so two controls sharing the same `var` (e.g. Grapple and a
  // save record both use "passed") don't collide on input ids, label[for]
  // associations, the radio name, or the prefix label's id.
  const uid = nextSegmentedId();

  const selectedValue = $derived(resolveValueSource({ var: control.var }, facts, vars, selections));

  const selectedOption = $derived(control.options.find((option) => option.value === selectedValue));

  function handleChange(value: number): void {
    onSelectionChange?.({ [control.var]: value });
  }
</script>

{#if summary}
  <span class="panel-renderer__segmented-summary">
    {#if control.prefix}<span class="panel-renderer__segmented-prefix">{$t(control.prefix)}</span
      >&nbsp;{/if}{selectedOption ? $t(selectedOption.label) : ''}
  </span>
{:else}
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
{/if}

<style>
  .panel-renderer__segmented-summary {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
  }

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
