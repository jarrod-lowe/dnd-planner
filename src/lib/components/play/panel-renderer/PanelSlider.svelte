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
  function formatSliderValue(value: number): string {
    return control.valueFormat === 'spellLevel'
      ? value === 0
        ? $t('play.slider.freeUse')
        : $t('play.slider.level', { level: value })
      : formatUnitValue($t, control.unit, value);
  }

  const displayValue = $derived(formatSliderValue(localValue));

  // The value cell must not change width with the CURRENT value ("Free Use"
  // <-> "Level 2" would reflow the track mid-drag), so it is sized by a
  // hidden sizer holding the WIDEST candidate string: the same formatting
  // path as `displayValue`, applied to every value the slider can show.
  const candidateValues = $derived.by(() => {
    if (activeNotches) {
      const values = (activeNotches as SliderNotch[]).map((n) => n.value);
      // A persisted selection can outlive the notch it points at (slot spent
      // after the selection was made); keep the shown string among candidates.
      if (!values.includes(localValue)) values.push(localValue);
      return values;
    }
    const values: number[] = [];
    for (let v = min; v <= max; v += step) values.push(v);
    return values;
  });

  const valueSizerText = $derived.by(() => {
    let widest = '';
    for (const v of candidateValues) {
      const text = formatSliderValue(v);
      if (text.length > widest.length) widest = text;
    }
    return widest;
  });

  function handleNotchChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const idx = Number(target.value);
    localIndex = idx;
    localValue = (activeNotches as SliderNotch[])[idx]?.value ?? 0;
    onSelectionChange?.({ [control.var]: localValue });
  }

  // --- Notch label row ---
  // A row of tick + short label under the track, one per position. Explicit
  // notches are labelled by each notch's own value (gaps preserved); a
  // sequential slider synthesises its positions from the resolved min/max/step.
  // Only spell-level sliders have a short label form ("Free"/"Ln"); other
  // sliders (distance, hp, ability scores…) keep their numeric display and
  // render no row, whatever their positions.
  interface NotchMark {
    value: number;
    label: string;
  }

  function notchLabel(value: number): string {
    return value === 0
      ? $t('play.slider.freeShort')
      : $t('play.slider.levelShort', { level: value });
  }

  const notchMarks = $derived.by(() => {
    if (control.valueFormat !== 'spellLevel') return undefined;
    if (activeNotches) {
      return (activeNotches as SliderNotch[]).map((n) => ({
        value: n.value,
        label: notchLabel(n.value)
      }));
    }
    // Synthesise only when the positions are integer-spaced: step >= 1 and
    // the step divides the range into whole positions, so every value is an
    // integer (a fractional step like 0.5 has no label form).
    const span = max - min;
    const integerSpaced =
      Number.isInteger(min) && Number.isInteger(step) && step >= 1 && Number.isInteger(span / step);
    if (!integerSpaced) return undefined;
    const marks: NotchMark[] = [];
    for (let v = min; v <= max; v += step) {
      if (marks.length >= 10) return undefined; // too many positions to label legibly
      marks.push({ value: v, label: notchLabel(v) });
    }
    return marks;
  });

  function handleChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const newValue = Number(target.value);
    localValue = newValue;
    onSelectionChange?.({ [control.var]: newValue });
  }

  // Tapping a notch-label mark is a shortcut to the same change the input
  // reports: it selects the mark's own VALUE (never its index — the input's
  // index space differs on notch sliders with gaps).
  function handleMarkClick(value: number): void {
    if (!editable) return;
    localValue = value;
    if (activeNotches) {
      const idx = (activeNotches as SliderNotch[]).findIndex((n) => n.value === value);
      if (idx >= 0) localIndex = idx;
    }
    onSelectionChange?.({ [control.var]: value });
  }
</script>

{#snippet notchRow()}
  <!-- Decorative pointer shortcut: the native range input remains the sole
       accessible (and keyboard-operable) control, so the row is hidden from
       assistive tech and carries no focus. -->
  {#if notchMarks}
    <div class="panel-renderer__slider-notches" style="position: relative" aria-hidden="true">
      {#each notchMarks as mark, i (mark.value)}
        {@const position = notchMarks.length > 1 ? (i / (notchMarks.length - 1)) * 100 : 0}
        <!-- Intentionally no role and no key handler: the mark is a pointer-only
             shortcut inside the aria-hidden row; the input is the keyboard path. -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span
          class="panel-renderer__slider-notch"
          class:panel-renderer__slider-notch--current={mark.value === localValue}
          style:left={position + '%'}
          onclick={editable ? () => handleMarkClick(mark.value) : undefined}
        >
          <span class="panel-renderer__slider-notch-tick"></span>
          <span class="panel-renderer__slider-notch-label">{mark.label}</span>
        </span>
      {/each}
    </div>
  {/if}
{/snippet}

{#if summary}
  <span class="panel-renderer__slider-summary">{displayValue}</span>
{:else if activeNotches}
  <div class="panel-renderer__slider">
    <div class="panel-renderer__slider-track">
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
      {@render notchRow()}
    </div>
    <span class="panel-renderer__slider-value-cell">
      <span class="panel-renderer__slider-value-sizer" aria-hidden="true">
        {valueSizerText}
      </span>
      <span class="panel-renderer__slider-value">{displayValue}</span>
    </span>
  </div>
{:else}
  <div class="panel-renderer__slider">
    <div class="panel-renderer__slider-track">
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
      {@render notchRow()}
    </div>
    <span class="panel-renderer__slider-value-cell">
      <span class="panel-renderer__slider-value-sizer" aria-hidden="true">
        {valueSizerText}
      </span>
      <span class="panel-renderer__slider-value">{displayValue}</span>
    </span>
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

  .panel-renderer__slider-track {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  /* Marks are absolutely placed at i/(n-1) fractions of this row — the same
     box the input's thumb percentages reference — so tick centers sit under
     thumb positions regardless of label widths. Edge labels overhang the row
     by half their width (overflow stays visible; card padding absorbs it).
     The height is explicit because absolutely-positioned marks contribute
     none; it mirrors a mark's stack: 6px tick + xs gap + xs label line. */
  .panel-renderer__slider-notches {
    height: calc(6px + var(--spacing-xs) + var(--font-size-xs) * 1.5);
  }

  .panel-renderer__slider-notch {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-on-surface-variant);
  }

  .panel-renderer__slider-notch-tick {
    width: 1px;
    height: 6px;
    background: var(--md-sys-color-outline-variant);
  }

  .panel-renderer__slider-notch--current {
    color: var(--md-sys-color-primary);
  }

  .panel-renderer__slider-notch--current .panel-renderer__slider-notch-tick {
    background: var(--md-sys-color-primary);
  }

  /* The value cell stacks a hidden sizer under the live value (grid, one
     cell): the sizer's text — the widest candidate — fixes the cell width,
     so value changes never reflow the track. */
  .panel-renderer__slider-value-cell {
    display: grid;
    justify-items: end;
    align-items: center;
  }

  .panel-renderer__slider-value-cell > * {
    grid-area: 1 / 1;
  }

  .panel-renderer__slider-value-sizer {
    visibility: hidden;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    white-space: nowrap;
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
