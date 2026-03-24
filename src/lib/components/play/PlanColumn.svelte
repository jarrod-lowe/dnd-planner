<script lang="ts">
  import { t } from '$lib/i18n';
  import PlanItem from './PlanItem.svelte';
  import type { PlannedItem } from '$lib/play/types';

  interface Props {
    items: PlannedItem[];
    onMoveUp: (instanceId: string) => void;
    onMoveDown: (instanceId: string) => void;
    onRemove: (instanceId: string) => void;
  }

  let { items, onMoveUp, onMoveDown, onRemove }: Props = $props();
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
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onMoveUp={() => onMoveUp(item.instanceId)}
          onMoveDown={() => onMoveDown(item.instanceId)}
          onRemove={() => onRemove(item.instanceId)}
        />
      {/each}
    </div>
  {/if}
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
</style>
