<script lang="ts">
  import { t } from '$lib/i18n';
  import type { SettingDefinition } from '$lib/rules/settingsTypes';
  import { get } from 'svelte/store';
  import { SvelteMap } from 'svelte/reactivity';
  import SettingsForm from './SettingsForm.svelte';

  interface SettingsGroup {
    ruleGroupId: string;
    name: string;
    settings: SettingDefinition[];
  }

  interface Props {
    isOpen: boolean;
    groups: SettingsGroup[];
    onSubmit: (values: Map<string, Record<string, string>>) => void;
    onCancel: () => void;
  }

  let { isOpen, groups, onSubmit, onCancel }: Props = $props();

  let dialogEl: HTMLDivElement | undefined = $state();
  let selections: Record<string, string> = $state({});

  const allSettings = $derived(groups.flatMap((g) => g.settings));
  const allFilled = $derived(allSettings.every((s) => selections[s.id]));

  function handleConfirm(): void {
    const result = new SvelteMap<string, Record<string, string>>();
    for (const group of groups) {
      const groupValues: Record<string, string> = {};
      for (const setting of group.settings) {
        groupValues[setting.id] = selections[setting.id];
      }
      result.set(group.ruleGroupId, groupValues);
    }
    onSubmit(result);
    resetState();
  }

  function handleCancel(): void {
    onCancel();
    resetState();
  }

  function handleOverlayClick(): void {
    handleCancel();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  function resetState(): void {
    selections = {};
  }

  $effect(() => {
    if (isOpen && dialogEl) {
      dialogEl.focus();
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="dialog-overlay" onclick={handleOverlayClick} role="presentation">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      bind:this={dialogEl}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <h2 id="settings-dialog-title" class="dialog__title">
        {get(t)('rules.settingsTitle', { name: groups[0]?.name ?? '' } as Record<string, unknown>)}
      </h2>

      <div class="dialog__content">
        {#each groups as group (group.ruleGroupId)}
          {#if groups.length > 1}
            <h3 class="dialog__group-title">{group.name}</h3>
          {/if}
          <SettingsForm
            settings={group.settings}
            values={selections}
            onchange={(newValues) => {
              selections = newValues;
            }}
          />
        {/each}
      </div>

      <div class="dialog__actions">
        <button
          type="button"
          class="dialog__button dialog__button--secondary"
          onclick={handleCancel}
        >
          {get(t)('rules.settingsCancel')}
        </button>
        <button
          type="button"
          class="dialog__button dialog__button--primary"
          onclick={handleConfirm}
          disabled={!allFilled}
        >
          {get(t)('rules.settingsConfirm')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
  }

  .dialog {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    padding: var(--spacing-xl);
    background: var(--md-sys-color-surface-container-high);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    min-width: 20rem;
    width: 24rem;
    max-width: 90vw;
  }

  .dialog__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    color: var(--md-sys-color-on-surface);
  }

  .dialog__content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .dialog__group-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface-variant);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    padding-bottom: var(--spacing-xs);
  }

  .dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }

  .dialog__button {
    padding: var(--spacing-sm) var(--spacing-lg);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 2.5rem;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .dialog__button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .dialog__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dialog__button--secondary {
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    color: var(--md-sys-color-on-surface);
  }

  .dialog__button--secondary:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container);
  }

  .dialog__button--primary {
    background: var(--md-sys-color-primary);
    border: 2px solid transparent;
    color: var(--md-sys-color-on-primary);
  }

  .dialog__button--primary:hover:not(:disabled) {
    background: var(--md-sys-color-on-primary-fixed-variant);
    border-color: var(--md-sys-color-outline);
  }
</style>
