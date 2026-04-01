<script lang="ts">
  import { t } from '$lib/i18n';
  import type { AvailableRuleEntry } from '$lib/rules-engine';

  interface Props {
    entry: AvailableRuleEntry;
    deletable?: boolean;
    onRemove?: () => void;
  }

  let { entry, deletable = false, onRemove }: Props = $props();

  const uiName = $derived(entry.rule.ui?.name as string | undefined);

  const displayName = $derived(
    uiName
      ? $t(uiName, (entry.rule.selections as Record<string, unknown>) ?? {})
      : entry.rule.description || entry.rule.id
  );
</script>

<div class="effect-panel" role="status" aria-label={displayName}>
  {#if deletable}
    <div class="effect-panel__actions" role="group" aria-label="Effect controls">
      <button
        type="button"
        class="effect-panel__button effect-panel__button--remove"
        onclick={onRemove}
        aria-label={$t('play.effects.remove')}
        title={$t('play.effects.remove')}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>
    </div>
  {/if}
  <div class="effect-panel__body">
    <span class="effect-panel__title">{displayName}</span>
  </div>
</div>

<style>
  .effect-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
  }

  .effect-panel__body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .effect-panel__title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  .effect-panel__actions {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    z-index: 1;
  }

  .effect-panel {
    position: relative;
  }

  .effect-panel__button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .effect-panel__button:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .effect-panel__button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .effect-panel__button svg {
    width: 1rem;
    height: 1rem;
  }

  .effect-panel__button--remove:hover {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    border-color: var(--md-sys-color-error);
  }
</style>
