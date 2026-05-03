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
  const value = $derived(resolvedValue ?? min);

  function handleChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const newValue = Number(target.value);
    onSelectionChange?.({ [control.var]: newValue });
  }
</script>

{#if editable}
  <div class="panel-renderer__slider">
    <input
      type="range"
      {min}
      {max}
      {value}
      oninput={handleChange}
      aria-label={control.var}
    />
  </div>
{:else}
  <span class="panel-renderer__slider panel-renderer__slider--readonly">{value}</span>
{/if}

<style>
  .panel-renderer__slider {
    display: flex;
    align-items: center;
  }

  .panel-renderer__slider input[type='range'] {
    width: 100%;
    accent-color: var(--md-sys-color-primary);
  }

  .panel-renderer__slider--readonly {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
  }
</style>
