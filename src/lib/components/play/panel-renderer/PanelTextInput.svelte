<script module lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { TextInputControl } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';

  /**
   * Whether this control has nothing to show in summary mode (no text
   * entered). Exported so `PanelRenderer` can decide whether to render this
   * control's `.panel-renderer__control` wrapper at all — an empty-but-present
   * wrapper would leave a dangling/doubled `·` separator next to nothing
   * (`PanelRenderer` only emits a real, `aria-hidden` separator element next
   * to a wrapper it already knows will render). Deciding this up front,
   * rather than mounting the component and reading back an "I'm empty"
   * signal, avoids mounting then immediately unmounting the control.
   */
  export function textInputIsEmpty(
    control: TextInputControl,
    facts: Facts,
    vars: Record<string, VarDefinition>,
    selections: Record<string, unknown>
  ): boolean {
    return !resolveValueSource({ var: control.var }, facts, vars, selections);
  }
</script>

<script lang="ts">
  interface Props {
    control: TextInputControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    /** Collapsed-row short form: the entered text, ellipsized, nothing when empty. */
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

  const resolvedValue = $derived(
    resolveValueSource({ var: control.var }, facts, vars, selections) as string | undefined
  );

  // eslint-disable-next-line svelte/prefer-writable-derived
  let localValue = $state('');
  $effect(() => {
    localValue = resolvedValue ?? '';
  });

  function handleInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    localValue = target.value;
    onSelectionChange?.({ [control.var]: target.value });
  }
</script>

{#if summary}
  {#if localValue}
    <span class="panel-renderer__text-summary">{localValue}</span>
  {/if}
{:else}
  <div class="panel-renderer__text">
    {#if editable}
      {#if control.multiline}
        <textarea value={localValue} oninput={handleInput} aria-label={control.var} rows={3}
        ></textarea>
      {:else}
        <input type="text" value={localValue} oninput={handleInput} aria-label={control.var} />
      {/if}
    {:else}
      <span class="panel-renderer__text-value">{localValue}</span>
    {/if}
  </div>
{/if}

<style>
  .panel-renderer__text {
    display: flex;
    width: 100%;
  }

  .panel-renderer__text input[type='text'],
  .panel-renderer__text textarea {
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    resize: vertical;
  }

  .panel-renderer__text input[type='text']:focus,
  .panel-renderer__text textarea:focus {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 1px;
    border-color: var(--md-sys-color-primary);
  }

  .panel-renderer__text-value {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Collapsed-row short form: single line, ellipsized on overflow. */
  .panel-renderer__text-summary {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    vertical-align: bottom;
  }
</style>
