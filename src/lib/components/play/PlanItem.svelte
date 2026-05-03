<script lang="ts">
  import { t } from '$lib/i18n';
  import PanelRenderer from './PanelRenderer.svelte';
  import type { PlannedItem } from '$lib/play/types';
  import type { Facts, Rule } from '$lib/rules-engine';
  import type { AnnotationDef } from '$lib/play/annotations';

  interface Props {
    item: PlannedItem;
    facts?: Facts;
    activeAnnotations?: AnnotationDef[];
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onFollowup?: (rule: Rule) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
  }

  let {
    item,
    facts = {},
    activeAnnotations = [],
    canMoveUp = true,
    canMoveDown = true,
    onSelectionChange,
    onFollowup: _onFollowup,
    onMoveUp,
    onMoveDown,
    onRemove
  }: Props = $props();

  void _onFollowup;

  // Get errors array from varsRuntime
  const errors = $derived((item.rule.varsRuntime?.errors as string[] | undefined) || []);

  // Check if rule has errors (illegal state)
  const isIllegal = $derived(errors.length > 0);

  // Build diagnostics from error strings
  const diagnostics = $derived(errors.map((code) => ({ code, severity: 'error' as const })));
</script>

<div class="plan-item">
  <div class="plan-item__actions" role="group" aria-label="Item controls">
    <button
      type="button"
      class="plan-item__button plan-item__button--move-up"
      disabled={!canMoveUp}
      onclick={onMoveUp}
      aria-label={$t('play.plan.moveUp')}
      title={$t('play.plan.moveUp')}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
      </svg>
    </button>
    <button
      type="button"
      class="plan-item__button plan-item__button--move-down"
      disabled={!canMoveDown}
      onclick={onMoveDown}
      aria-label={$t('play.plan.moveDown')}
      title={$t('play.plan.moveDown')}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
      </svg>
    </button>
  </div>
  <PanelRenderer
    entry={{ rule: item.rule, legal: !isIllegal, applicable: true, diagnostics }}
    editable={true}
    {facts}
    {activeAnnotations}
    {onSelectionChange}
    {onRemove}
  />
</div>

<style>
  .plan-item {
    position: relative;
    width: 100%;
    /* No background, border, padding - PanelRenderer handles visuals */
  }

  .plan-item__actions {
    position: absolute;
    top: var(--spacing-sm);
    left: var(--spacing-sm);
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    z-index: 1;
  }

  .plan-item__button {
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

  .plan-item__button:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
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
    width: 1rem;
    height: 1rem;
  }
</style>
