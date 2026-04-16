<script lang="ts">
  import { t } from '$lib/i18n';
  import type { AvailableRuleEntry, Facts } from '$lib/rules-engine';

  interface Props {
    entry: AvailableRuleEntry;
    facts?: Facts;
    deletable?: boolean;
    onRemove?: () => void;
  }

  let { entry, facts = {}, deletable = false, onRemove }: Props = $props();

  const uiName = $derived(entry.rule.ui?.name as string | undefined);

  const displayName = $derived(
    uiName
      ? $t(uiName, (entry.rule.selections as Record<string, unknown>) ?? {})
      : entry.rule.description || entry.rule.id
  );

  const isTimedSaveEffect = $derived(entry.rule.ui?.model === 'timed-save-effect');

  const saveType = $derived(entry.rule.ui?.saveType as string | undefined);
  const saveFact = $derived(entry.rule.ui?.saveFact as string | undefined);
  const saveDC = $derived(saveFact ? (facts[saveFact] as number | undefined) : undefined);
  const countDown = $derived(entry.rule.ui?.countDown as number | undefined);
  const duration = $derived(entry.rule.ui?.duration as number | undefined);

  const emptyCount = $derived(
    countDown !== undefined && duration !== undefined ? duration - countDown : 0
  );

  const filledIndices = $derived(countDown ? Array.from({ length: countDown }, (_, i) => i) : []);
  const emptyIndices = $derived(emptyCount ? Array.from({ length: emptyCount }, (_, i) => i) : []);
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
    {#if isTimedSaveEffect && saveType && saveDC !== undefined}
      <span class="effect-panel__save">{saveType} Save DC {saveDC}</span>
    {/if}
    {#if isTimedSaveEffect && countDown !== undefined && duration !== undefined}
      <div
        class="effect-panel__markers"
        role="img"
        aria-label="{countDown} of {duration} rounds remaining"
      >
        {#each filledIndices as i (i)}
          <span class="effect-panel__marker effect-panel__marker--filled" aria-hidden="true"></span>
        {/each}
        {#each emptyIndices as i (i)}
          <span class="effect-panel__marker effect-panel__marker--empty" aria-hidden="true"></span>
        {/each}
      </div>
    {/if}
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

  .effect-panel__save {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface-variant);
  }

  .effect-panel__markers {
    display: flex;
    flex-direction: row;
    gap: var(--spacing-xs);
  }

  .effect-panel__marker {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .effect-panel__marker--filled {
    background: var(--md-sys-color-primary);
  }

  .effect-panel__marker--empty {
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
  }
</style>
