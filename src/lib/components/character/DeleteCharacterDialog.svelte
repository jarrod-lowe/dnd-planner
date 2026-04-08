<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    isOpen: boolean;
    isDeleting: boolean;
    characterName: string;
    onConfirm: () => void;
    onClose: () => void;
    errorMessage?: string | null;
  }

  let {
    isOpen,
    isDeleting,
    characterName,
    onConfirm,
    onClose,
    errorMessage = null
  }: Props = $props();

  function handleCancel() {
    onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isDeleting) {
      onClose();
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
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <h2 id="dialog-title" class="dialog__title">
        {$t('character.deleteConfirm').replace('{name}', characterName)}
      </h2>

      <p class="dialog__warning">{$t('character.deleteWarning')}</p>

      {#if errorMessage}
        <p class="dialog__error" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      {/if}

      <div class="dialog__actions">
        <button
          type="button"
          class="dialog__button dialog__button--secondary"
          onclick={handleCancel}
          disabled={isDeleting}
        >
          {$t('character.cancel')}
        </button>
        <button
          type="button"
          class="dialog__button dialog__button--danger"
          onclick={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? $t('character.deleting') : $t('character.delete')}
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
    max-width: 90vw;
  }

  .dialog__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    color: var(--md-sys-color-on-surface);
  }

  .dialog__warning {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
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

  .dialog__button--danger {
    background: var(--md-sys-color-error);
    border: 2px solid transparent;
    color: var(--md-sys-color-on-error);
  }

  .dialog__button--danger:hover:not(:disabled) {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    border-color: var(--md-sys-color-outline);
  }
</style>
