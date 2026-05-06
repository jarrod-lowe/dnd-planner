<script lang="ts">
  import { t } from '$lib/i18n';
  import { tick } from 'svelte';

  // Available species options (hardcoded for now, will expand later)
  const SPECIES_OPTIONS = ['human'] as const;
  type Species = (typeof SPECIES_OPTIONS)[number];

  type DialogMode = 'create' | 'import';

  interface Props {
    isOpen: boolean;
    isCreating: boolean;
    isImporting?: boolean;
    onCreate: (name: string, species: Species) => void;
    onImport?: (parsedJson: unknown, chosenName: string) => void;
    onClose: () => void;
    errorMessage?: string | null;
    onClearError?: () => void;
  }

  let {
    isOpen,
    isCreating,
    isImporting = false,
    onCreate,
    onImport,
    onClose,
    errorMessage = null,
    onClearError
  }: Props = $props();

  let activeMode = $state<DialogMode>('create');
  let characterName = $state('');
  let selectedSpecies = $state<Species>('human');
  let importName = $state('');
  let parsedFileData: unknown = $state(null);
  let importError = $state<string | null>(null);

  function resetImportState() {
    importName = '';
    parsedFileData = null;
    importError = null;
  }

  function switchMode(mode: DialogMode) {
    activeMode = mode;
    onClearError?.();
    resetImportState();
  }

  function handleSubmit() {
    const trimmedName = characterName.trim();
    if (trimmedName) {
      onCreate(trimmedName, selectedSpecies);
    }
  }

  function handleImport() {
    const trimmedName = importName.trim();
    if (parsedFileData && trimmedName) {
      onImport?.(parsedFileData, trimmedName);
    }
  }

  function handleCancel() {
    onClose();
  }

  function handleTabKeydown(event: KeyboardEvent) {
    const modes: DialogMode[] = ['create', 'import'];
    const idx = modes.indexOf(activeMode);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      switchMode(modes[(idx + 1) % modes.length]);
      document.getElementById('tab-' + modes[(idx + 1) % modes.length])?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      switchMode(modes[(idx - 1 + modes.length) % modes.length]);
      document.getElementById('tab-' + modes[(idx - 1 + modes.length) % modes.length])?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      switchMode(modes[0]);
      document.getElementById('tab-create')?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      switchMode(modes[modes.length - 1]);
      document.getElementById('tab-import')?.focus();
    }
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    onClearError?.();
    importError = null;

    if (!file) {
      parsedFileData = null;
      importName = '';
      return;
    }

    if (!file.name.endsWith('.json')) {
      importError = $t('character.importInvalidJson');
      parsedFileData = null;
      importName = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          importError = $t('character.importInvalidJson');
          parsedFileData = null;
          importName = '';
          return;
        }
        parsedFileData = parsed;
        const name = (parsed as Record<string, unknown>).name;
        importName = typeof name === 'string' ? name : '';
        importError = null;
      } catch {
        importError = $t('character.importInvalidJson');
        parsedFileData = null;
        importName = '';
      }
    };
    reader.onerror = () => {
      importError = $t('character.importInvalidJson');
      parsedFileData = null;
      importName = '';
    };
    reader.readAsText(file);
  }

  let dialogEl: HTMLDivElement | undefined = $state();

  // Focus the dialog when it opens
  $effect(() => {
    if (isOpen) {
      tick().then(() => dialogEl?.focus());
    }
  });

  // Close on Escape key, trap Tab focus
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isCreating && !isImporting) {
      onClose();
      return;
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

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="dialog-overlay" onclick={handleCancel} role="presentation">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      bind:this={dialogEl}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <h2 id="dialog-title" class="dialog__title">
        {activeMode === 'create' ? $t('character.createNew') : $t('character.importTitle')}
      </h2>

      {#if onImport}
        <div class="dialog__mode-toggle" role="tablist" aria-label="Dialog mode" onkeydown={handleTabKeydown}>
          <button
            type="button"
            role="tab"
            id="tab-create"
            class="dialog__mode-button"
            class:dialog__mode-button--active={activeMode === 'create'}
            aria-selected={activeMode === 'create'}
            aria-controls="dialog-tabpanel"
            onclick={() => switchMode('create')}
            disabled={isCreating || isImporting}
          >
            {$t('character.modeCreate')}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-import"
            class="dialog__mode-button"
            class:dialog__mode-button--active={activeMode === 'import'}
            aria-selected={activeMode === 'import'}
            aria-controls="dialog-tabpanel"
            onclick={() => switchMode('import')}
            disabled={isCreating || isImporting}
          >
            {$t('character.modeImport')}
          </button>
        </div>
      {/if}

      <div
        role="tabpanel"
        id="dialog-tabpanel"
        aria-labelledby={activeMode === 'create' ? 'tab-create' : 'tab-import'}
        tabindex="0"
      >
        {#if activeMode === 'create'}
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
            {$t('species.label')}
            <select
              class="dialog__select"
              bind:value={selectedSpecies}
              disabled={isCreating}
            >
              {#each SPECIES_OPTIONS as species (species)}
                <option value={species}>{$t(`species.${species}`)}</option>
              {/each}
            </select>
          </label>
        {:else}
          <label class="dialog__label">
            {$t('character.importSelectFile')}
            <input
              type="file"
              accept=".json"
              class="dialog__file-input"
              onchange={handleFileChange}
              disabled={isImporting}
            />
          </label>

          <input
            type="text"
            class="dialog__input"
            placeholder={$t('character.enterName')}
            bind:value={importName}
            disabled={isImporting || !parsedFileData}
            aria-label={$t('character.enterName')}
            oninput={() => onClearError?.()}
          />
        {/if}
      </div>

      {#if errorMessage}
        <p class="dialog__error" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      {/if}

      {#if importError}
        <p class="dialog__error" role="alert" aria-live="polite">
          {importError}
        </p>
      {/if}

      <div class="dialog__actions">
        <button
          type="button"
          class="dialog__button dialog__button--secondary"
          onclick={handleCancel}
          disabled={isCreating || isImporting}
        >
          {$t('character.cancel')}
        </button>
        {#if activeMode === 'create'}
          <button
            type="button"
            class="dialog__button dialog__button--primary"
            onclick={handleSubmit}
            disabled={isCreating || !characterName.trim()}
          >
            {isCreating ? $t('character.creating') : $t('character.create')}
          </button>
        {:else}
          <button
            type="button"
            class="dialog__button dialog__button--primary"
            onclick={handleImport}
            disabled={isImporting || !parsedFileData || !importName.trim()}
          >
            {isImporting ? $t('character.importing') : $t('character.modeImport')}
          </button>
        {/if}
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

  .dialog__mode-toggle {
    display: flex;
    gap: var(--spacing-xs);
    border-radius: var(--radius-md);
    background: var(--md-sys-color-surface-container);
    padding: var(--spacing-xs);
  }

  .dialog__mode-button {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .dialog__mode-button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .dialog__mode-button--active {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }

  .dialog__mode-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    min-height: 5.25rem;
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

  .dialog__select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dialog__file-input {
    width: 100%;
    padding: var(--spacing-md);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }

  .dialog__file-input:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
  }

  .dialog__file-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
</style>
