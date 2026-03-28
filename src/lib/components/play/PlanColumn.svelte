<script lang="ts">
  import { t } from '$lib/i18n';
  import PlanItem from './PlanItem.svelte';
  import type { PlannedItem } from '$lib/play/types';
  import type { Facts } from '$lib/rules-engine';

  interface Props {
    items: PlannedItem[];
    facts?: Facts;
    onSelectionChange?: (instanceId: string, selections: Record<string, unknown>) => void;
    onMoveUp: (instanceId: string) => void;
    onMoveDown: (instanceId: string) => void;
    onRemove: (instanceId: string) => void;
    onEndTurn: () => void;
  }

  let {
    items,
    facts = {},
    onSelectionChange,
    onMoveUp,
    onMoveDown,
    onRemove,
    onEndTurn
  }: Props = $props();
</script>

<div class="plan-column">
  {#if items.length === 0}
    <div class="plan-column__empty">
      {$t('play.plan.empty')}
    </div>
  {:else}
    <div class="plan-column__list" aria-live="polite">
      {#each items as item, index (item.instanceId)}
        <PlanItem
          {item}
          {facts}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onSelectionChange={onSelectionChange
            ? (selections) => onSelectionChange(item.instanceId, selections)
            : undefined}
          onMoveUp={() => onMoveUp(item.instanceId)}
          onMoveDown={() => onMoveDown(item.instanceId)}
          onRemove={() => onRemove(item.instanceId)}
        />
      {/each}
    </div>
  {/if}
  <div class="plan-column__footer">
    <button class="plan-column__end-turn" onclick={onEndTurn}>
      {$t('play.plan.endTurn')}
    </button>
  </div>
</div>

<style>
  .plan-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .plan-column__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    flex: 1;
    overflow-y: auto;
  }

  .plan-column__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
    padding: var(--spacing-xl);
  }

  .plan-column__footer {
    padding: var(--spacing-md);
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }

  .plan-column__end-turn {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .plan-column__end-turn:hover {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .plan-column__end-turn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }
</style>
