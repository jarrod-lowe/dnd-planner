<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import { formatUnitValue } from './unitLabel';
  import type { SliderControl, SliderNotch } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';
  import { t } from '$lib/i18n';

  interface Props {
    control: SliderControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    /**
     * Collapsed-row short form: renders only the formatted current value
     * (`displayValue`), no track/notches/input. The control instance stays
     * mounted across the collapse/expand toggle.
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

  // --- Notch-based slider ---
  // When `notches` is defined, the slider shows explicit values (e.g. [0, 2, 3, 4, 5])
  // instead of a sequential min/max range. Notches with an `enabled` condition that
  // resolves falsy are filtered out.

  const activeNotches = $derived.by(() => {
    if (!control.notches) return undefined;
    return control.notches.filter((n: SliderNotch) => {
      if (n.enabled === undefined) return true;
      return !!resolveValueSource(n.enabled, facts, vars, selections);
    });
  });

  // Resolve the target value (what the rules engine selected / defaulted)
  const resolvedValue = $derived(
    resolveValueSource({ var: control.var }, facts, vars, selections) as number | undefined
  );

  // --- Sequential (min/max/step) slider ---
  const resolvedMax = $derived(
    resolveValueSource(control.max, facts, vars, selections) as number | undefined
  );
  const resolvedMin = $derived(
    resolveValueSource(control.min, facts, vars, selections) as number | undefined
  );

  const min = $derived(resolvedMin ?? 0);
  const max = $derived(resolvedMax ?? 0);
  const step = $derived(control.step ?? 1);

  // --- Shared state ---
  // Local state for immediate visual feedback during drag.
  // Syncs from the externally-resolved value via $effect, but updates instantly on input.
  let localValue = $state(0);
  let localIndex = $state(0);
  $effect(() => {
    let syncedValue: number;
    if (activeNotches) {
      const idx = (activeNotches as SliderNotch[]).findIndex(
        (n: SliderNotch) => n.value === (resolvedValue ?? 0)
      );
      localIndex = idx >= 0 ? idx : 0;
      syncedValue = (activeNotches as SliderNotch[])[localIndex]?.value ?? 0;
      localValue = syncedValue;
    } else {
      syncedValue = resolvedValue ?? min;
      localValue = syncedValue;
    }
    // Sync selections when the displayed value doesn't match what's in selections.
    // Use the local variable to avoid tracking localValue as a dependency.
    const currentSelection = selections?.[control.var];
    if (syncedValue !== currentSelection) {
      onSelectionChange?.({ [control.var]: syncedValue });
    }
  });

  // Spell upcast sliders render the value as "Free Use" (0) / "Level N" (>=1)
  // instead of a raw number; everything else keeps the plain numeric + unit,
  // composed via `formatUnitValue` — `control.unit` is a literal notation
  // token authored on the rule (e.g. 'ft'), translated (and spaced) at this
  // render edge under the `play.units.<token>` namespace; an unrecognized
  // token falls back to the raw token rather than leaking a dotted key, and
  // no token at all just renders the bare number (see `unitLabel.ts`).
  const displayValue = $derived(
    control.valueFormat === 'spellLevel'
      ? localValue === 0
        ? $t('play.slider.freeUse')
        : $t('play.slider.level', { level: localValue })
      : formatUnitValue($t, control.unit, localValue)
  );

  function handleNotchChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const idx = Number(target.value);
    localIndex = idx;
    localValue = (activeNotches as SliderNotch[])[idx]?.value ?? 0;
    onSelectionChange?.({ [control.var]: localValue });
  }

  function handleChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const newValue = Number(target.value);
    localValue = newValue;
    onSelectionChange?.({ [control.var]: newValue });
  }
</script>

{#if summary}
  <span class="panel-renderer__slider-summary">{displayValue}</span>
{:else if activeNotches}
  <div class="panel-renderer__slider">
    <input
      type="range"
      min={0}
      max={activeNotches.length - 1}
      step={1}
      value={localIndex}
      disabled={!editable}
      oninput={editable ? handleNotchChange : undefined}
      aria-label={control.var}
      aria-valuetext={displayValue}
    />
    <span class="panel-renderer__slider-value">{displayValue}</span>
  </div>
{:else}
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
      aria-valuetext={displayValue}
    />
    <span class="panel-renderer__slider-value">{displayValue}</span>
  </div>
{/if}

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

  .panel-renderer__slider-summary {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
  }
</style>
