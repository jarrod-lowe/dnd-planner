<script lang="ts">
  import { t } from '$lib/i18n';
  import { tick } from 'svelte';
  import SettingsForm from './SettingsForm.svelte';
  import { ensureCached, getCache } from '$lib/rules/ruleGroupCache.svelte';
  import { discoverSettingsSteps, resolveSettings } from '$lib/rules/resolveSettings';
  import type { SettingDefinition } from '$lib/rules/settingsTypes';

  const SPECIES_OPTIONS = ['human'] as const;
  const CLASS_OPTIONS = ['paladin-level1'] as const;

  interface Props {
    isCreating: boolean;
    onCreate: (options: {
      name: string;
      species: string;
      class: string;
      additionalRuleGroupIds: string[];
      effects: unknown[];
    }) => void;
    onCancel: () => void;
    errorMessage?: string | null;
    onClearError?: () => void;
  }

  let { isCreating, onCreate, onCancel, errorMessage = null, onClearError }: Props = $props();

  let characterName = $state('');
  let selectedSpecies = $state<(typeof SPECIES_OPTIONS)[number]>('human');
  let selectedClass = $state<(typeof CLASS_OPTIONS)[number]>('paladin-level1');
  let currentStep = $state(0);
  let settingsSteps = $state<
    Array<{ ruleGroupId: string; name: string; settings: SettingDefinition[] }>
  >([]);
  let settingsValues = $state<Record<string, Record<string, string>>>({});
  let stepsLoaded = $state(false);
  let dialogEl: HTMLDivElement | undefined = $state();

  const nameFilled = $derived(characterName.trim().length > 0);

  const totalSteps = $derived(1 + settingsSteps.length + 1);

  const isBasicsStep = $derived(currentStep === 0);
  const isConfirmStep = $derived(currentStep === totalSteps - 1);
  const isSettingsStep = $derived(currentStep > 0 && currentStep < totalSteps - 1);

  const currentSettingsIndex = $derived(currentStep - 1);
  const currentSettingsGroup = $derived(
    isSettingsStep && settingsSteps[currentSettingsIndex]
      ? settingsSteps[currentSettingsIndex]
      : null
  );

  async function loadSteps() {
    if (stepsLoaded) return;
    try {
      await ensureCached([`species-${selectedSpecies}`, `class-${selectedClass}`], 'en');
      const cache = getCache();
      const newSteps = discoverSettingsSteps(
        [`species-${selectedSpecies}`, `class-${selectedClass}`],
        (id) => {
          const meta = cache.get(id);
          return meta
            ? {
                name: meta.name,
                description: meta.description,
                requires: meta.requires,
                settings: meta.settings
              }
            : undefined;
        }
      );
      settingsSteps = newSteps;
      stepsLoaded = true;
    } catch {
      // If metadata isn't available, skip settings steps
      settingsSteps = [];
      stepsLoaded = true;
    }
  }

  async function handleNext() {
    if (isBasicsStep) {
      await loadSteps();
    }
    if (currentStep < totalSteps - 1) {
      currentStep++;
      onClearError?.();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  function handleCreate() {
    const cache = getCache();
    const groups = settingsSteps.map((step) => ({
      ruleGroupId: step.ruleGroupId,
      settings: step.settings,
      values: settingsValues[step.ruleGroupId] ?? {}
    }));

    const { additionalRuleGroupIds, effects } = resolveSettings(groups, (id) => {
      const meta = cache.get(id);
      return meta ? { requires: meta.requires } : undefined;
    });

    onCreate({
      name: characterName.trim(),
      species: selectedSpecies,
      class: selectedClass,
      additionalRuleGroupIds,
      effects
    });
  }

  function handleSettingsChange(ruleGroupId: string, newValues: Record<string, string>) {
    settingsValues = { ...settingsValues, [ruleGroupId]: newValues };
  }

  function handleCancel() {
    onCancel();
  }

  $effect(() => {
    if (dialogEl) {
      tick().then(() => dialogEl?.focus());
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isCreating) {
      onCancel();
    }
    if (event.key === 'Tab' && dialogEl) {
      trapFocus(event, dialogEl);
    }
  }

  function trapFocus(event: KeyboardEvent, container: HTMLElement) {
    const focusable = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="dialog-overlay" onclick={handleCancel} role="presentation">
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="wizard-title"
    bind:this={dialogEl}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
  >
    <h2 id="wizard-title" class="dialog__title">
      {isConfirmStep
        ? $t('wizard.stepConfirm')
        : isBasicsStep
          ? $t('wizard.stepBasics')
          : $t('wizard.stepSettings', {
              values: { name: currentSettingsGroup?.name ?? '' }
            } as Record<string, unknown>)}
    </h2>

    <div class="wizard__steps" role="navigation" aria-label="Wizard progress">
      {#each Array.from({ length: totalSteps }, (_, i) => i) as i (i)}
        <span
          class="wizard__step-dot"
          class:wizard__step-dot--active={i === currentStep}
          class:wizard__step-dot--completed={i < currentStep}
          aria-current={i === currentStep ? 'step' : undefined}
        ></span>
      {/each}
    </div>

    <div class="dialog__content">
      {#if isBasicsStep}
        <input
          type="text"
          class="dialog__input"
          placeholder={$t('character.enterName')}
          bind:value={characterName}
          disabled={isCreating}
          aria-label={$t('character.enterName')}
          oninput={() => onClearError?.()}
        />

        <label class="dialog__label">
          <span>{$t('species.label')}</span>
          <select class="dialog__select" bind:value={selectedSpecies} disabled={isCreating}>
            {#each SPECIES_OPTIONS as species (species)}
              <option value={species}>{$t(`species.${species}`)}</option>
            {/each}
          </select>
        </label>

        <label class="dialog__label">
          <span>{$t('class.label')}</span>
          <select class="dialog__select" bind:value={selectedClass} disabled={isCreating}>
            {#each CLASS_OPTIONS as cls (cls)}
              <option value={cls}>{$t(`class.${cls}`)}</option>
            {/each}
          </select>
        </label>
      {:else if isSettingsStep && currentSettingsGroup}
        <SettingsForm
          settings={currentSettingsGroup.settings}
          values={settingsValues[currentSettingsGroup.ruleGroupId] ?? {}}
          onchange={(newValues) =>
            handleSettingsChange(currentSettingsGroup.ruleGroupId, newValues)}
          disabled={isCreating}
        />
      {:else if isConfirmStep}
        <div class="wizard__confirm">
          <p class="wizard__confirm-name">{characterName.trim()}</p>
          <p class="wizard__confirm-detail">
            {$t(`species.${selectedSpecies}`)}
            {$t(`class.${selectedClass}`)}
          </p>
        </div>
      {/if}
    </div>

    {#if errorMessage}
      <p class="dialog__error" role="alert" aria-live="polite">
        {errorMessage}
      </p>
    {/if}

    <div class="dialog__actions">
      {#if currentStep > 0}
        <button
          type="button"
          class="dialog__button dialog__button--secondary"
          onclick={handleBack}
          disabled={isCreating}
        >
          {$t('wizard.back')}
        </button>
      {:else}
        <button
          type="button"
          class="dialog__button dialog__button--secondary"
          onclick={handleCancel}
          disabled={isCreating}
        >
          {$t('character.cancel')}
        </button>
      {/if}

      {#if isConfirmStep}
        <button
          type="button"
          class="dialog__button dialog__button--primary"
          onclick={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? $t('wizard.creating') : $t('wizard.create')}
        </button>
      {:else}
        <button
          type="button"
          class="dialog__button dialog__button--primary"
          onclick={handleNext}
          disabled={isCreating || !nameFilled}
        >
          {$t('wizard.next')}
        </button>
      {/if}
    </div>
  </div>
</div>

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

  .dialog__input {
    width: 100%;
    padding: var(--spacing-md);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    transition: border-color var(--transition-fast);
  }

  .dialog__input:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
  }

  .dialog__input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dialog__input::placeholder {
    color: var(--md-sys-color-on-surface-variant);
  }

  .dialog__label {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }

  .dialog__select {
    width: 100%;
    padding: var(--spacing-md);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 2.75rem;
    transition: border-color var(--transition-fast);
  }

  .dialog__select:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
  }

  .dialog__error {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-error);
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

  .wizard__steps {
    display: flex;
    gap: var(--spacing-xs);
    justify-content: center;
  }

  .wizard__step-dot {
    width: var(--spacing-md);
    height: var(--spacing-xs);
    border-radius: var(--radius-sm);
    background: var(--md-sys-color-outline-variant);
    transition:
      background-color var(--transition-fast),
      width var(--transition-fast);
  }

  .wizard__step-dot--active {
    background: var(--md-sys-color-primary);
    width: calc(var(--spacing-md) * 2);
  }

  .wizard__step-dot--completed {
    background: var(--md-sys-color-primary);
  }

  .wizard__confirm {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    text-align: center;
    padding: var(--spacing-lg) 0;
  }

  .wizard__confirm-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    color: var(--md-sys-color-on-surface);
  }

  .wizard__confirm-detail {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
