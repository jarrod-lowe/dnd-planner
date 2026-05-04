<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { SliderControl } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-engine';

  interface Props {
    control: SliderControl;
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

  const resolvedMax = $derived(
    resolveValueSource(control.max, facts, vars, selections) as number | undefined
  );
  const resolvedMin = $derived(
    resolveValueSource(control.min, facts, vars, selections) as number | undefined
  );
  const resolvedValue = $derived(
    resolveValueSource({ var: control.var }, facts, vars, selections) as number | undefined
  );

  const min = $derived(resolvedMin ?? 0);
  const max = $derived(resolvedMax ?? 0);
  const step = $derived(control.step ?? 1);
  const unit = $derived(control.unit ?? '');

  // Local state for immediate visual feedback during drag.
  // Syncs from the externally-resolved value via $effect, but updates instantly on input.
  // eslint-disable-next-line svelte/prefer-writable-derived -- need mutable local state for drag responsiveness
  let localValue = $state(0);
  $effect(() => {
    localValue = resolvedValue ?? min;
  });

  function handleChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const newValue = Number(target.value);
    localValue = newValue;
    onSelectionChange?.({ [control.var]: newValue });
  }
</script>

<div class="panel-renderer__slider">
  <input
    type="range"
    {min}
    {max}
    {step}
    value={localValue}
    disabled={!editable}
    oninput={editable ? handleChange : undefined}
    aria-label={control.var}
  />
  <span class="panel-renderer__slider-value">{localValue}{unit ? ` ${unit}` : ''}</span>
</div>

<style>
  .panel-renderer__slider {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .panel-renderer__slider input[type='range'] {
    flex: 1;
    accent-color: var(--md-sys-color-primary);
  }

  .panel-renderer__slider-value {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
    min-width: 4ch;
    text-align: right;
  }
</style>
