<script module lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { SelectControl, SelectOption } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';

  type NormalizedOption = { value: unknown; label: string };

  function resolveOptions(
    control: SelectControl,
    facts: Facts,
    vars: Record<string, VarDefinition>,
    selections: Record<string, unknown>
  ): NormalizedOption[] {
    if (Array.isArray(control.options)) return control.options as SelectOption[];
    const resolved = resolveValueSource(
      control.options as Exclude<SelectControl['options'], SelectOption[]>,
      facts,
      vars,
      selections
    ) as unknown[] | undefined;
    return (resolved ?? []).map((v) => ({ value: v, label: String(v) }));
  }

  /**
   * Whether this control has nothing to show in summary mode (no option
   * matches the current value). Exported so `PanelRenderer` can decide
   * whether to render this control's `.panel-renderer__control` wrapper at
   * all — see `textInputIsEmpty` in `PanelTextInput.svelte` for why this must
   * be resolved before mounting, not signalled back from a mounted instance.
   */
  export function selectIsEmpty(
    control: SelectControl,
    facts: Facts,
    vars: Record<string, VarDefinition>,
    selections: Record<string, unknown>
  ): boolean {
    const selectedValue = resolveValueSource({ var: control.var }, facts, vars, selections);
    return !resolveOptions(control, facts, vars, selections).some(
      (option) => option.value === selectedValue
    );
  }
</script>

<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    control: SelectControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    /**
     * Collapsed-row short form: renders only the selected option's label, no
     * radiogroup/buttons. The control instance stays mounted across the
     * collapse/expand toggle.
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

  const options = $derived<NormalizedOption[]>(resolveOptions(control, facts, vars, selections));

  const selectedValue = $derived(resolveValueSource({ var: control.var }, facts, vars, selections));

  const selectedOption = $derived(options.find((option) => option.value === selectedValue));

  function handleChange(value: unknown): void {
    onSelectionChange?.({ [control.var]: value });
  }
</script>

{#if summary}
  <span class="panel-renderer__select-summary"
    >{selectedOption ? $t(selectedOption.label) : ''}</span
  >
{:else}
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
          {$t(option.label)}
        </button>
      {:else}
        <span
          class="panel-renderer__radio-option panel-renderer__radio-option--readonly"
          class:panel-renderer__radio-option--active={selectedValue === option.value}
          role="radio"
          aria-checked={selectedValue === option.value}
        >
          {$t(option.label)}
        </span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .panel-renderer__select-summary {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
  }

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
