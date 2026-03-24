<script lang="ts">
  import { t } from '$lib/i18n';
  import type { PlannedItem } from '$lib/play/types';

  interface Props {
    item: PlannedItem;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
  }

  let { item, canMoveUp = true, canMoveDown = true, onMoveUp, onMoveDown, onRemove }: Props = $props();

  const moveUpLabel = $derived($t('play.plan.moveUp'));
  const moveDownLabel = $derived($t('play.plan.moveDown'));
  const removeLabel = $derived($t('play.plan.remove'));
</script>

<div class="plan-item">
  <div class="plan-item__content">
    <span class="plan-item__order">{item.order + 1}</span>
    <span class="plan-item__description">{item.rule.description || item.rule.id}</span>
  </div>
  <div class="plan-item__controls">
    <button
      type="button"
      class="plan-item__button plan-item__move-up"
      disabled={!canMoveUp}
      onclick={onMoveUp}
      aria-label={moveUpLabel}
      title={moveUpLabel}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
      </svg>
    </button>
    <button
      type="button"
      class="plan-item__button plan-item__move-down"
      disabled={!canMoveDown}
      onclick={onMoveDown}
      aria-label={moveDownLabel}
      title={moveDownLabel}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
      </svg>
    </button>
    <button
      type="button"
      class="plan-item__button plan-item__remove"
      onclick={onRemove}
      aria-label={removeLabel}
      title={removeLabel}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </button>
  </div>
</div>

<style>
  .plan-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
  }

  .plan-item__content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
    min-width: 0;
  }

  .plan-item__order {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--md-sys-color-primary);
    min-width: 1.5rem;
    text-align: center;
  }

  .plan-item__description {
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    color: var(--md-sys-color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .plan-item__controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  .plan-item__button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }

  .plan-item__button:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
  }

  .plan-item__button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .plan-item__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .plan-item__button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .plan-item__remove:hover:not(:disabled) {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    border-color: var(--md-sys-color-error);
  }
</style>
