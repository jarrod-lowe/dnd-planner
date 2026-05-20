<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import type { TextInputControl } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-engine';

  interface Props {
    control: TextInputControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
  }

  let { control, editable, facts, vars, selections = {}, onSelectionChange }: Props = $props();

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
</style>
