<script lang="ts">
  import { t } from '$lib/i18n';
  import type { StatEntry, StatEntryUsedMax } from '$lib/play/extractStats';
  import type { Facts, Status } from '$lib/rules-engine';

  interface Props {
    stats: StatEntry[];
    facts: Facts;
    status?: Status;
  }

  let { stats, facts, status }: Props = $props();

  const RESOURCE_SECTIONS = new Set(['resources']);

  const resourceEntries = $derived(
    stats.filter(
      (s): s is StatEntryUsedMax => s.type === 'usedMax' && RESOURCE_SECTIONS.has(s.section)
    )
  );

  const isOverBudget = $derived(status !== undefined && status.legal === false);

  function getValues(stat: StatEntryUsedMax) {
    const total = Number(facts[stat.total] ?? 0);
    const remaining = Number(facts[stat.remaining] ?? 0);
    return { total, remaining };
  }

  function labelFor(stat: StatEntry): string {
    const params = stat.nameParams ?? {};
    return $t(stat.name, params);
  }
</script>

<div class="ledger" role="region" aria-label={$t('play.ledger.title')}>
  <span class="ledger__header">{$t('play.ledger.title')}</span>

  {#if isOverBudget}
    <span class="ledger__warn-badge" role="alert">
      {$t('play.ledger.overBudget')}
    </span>
  {/if}

  <div class="ledger__cells">
    {#each resourceEntries as stat (stat.name + JSON.stringify(stat.nameParams))}
      {@const values = getValues(stat)}
      <div
        class="ledger__cell"
        class:ledger__cell--muted={values.remaining === values.total && !isOverBudget}
        class:ledger__cell--warn={isOverBudget && values.remaining < values.total}
        aria-label="{labelFor(stat)}: {values.remaining} of {values.total}"
      >
        <span class="ledger__cell-label">{labelFor(stat)}</span>
        <span class="ledger__cell-value">{values.remaining}/{values.total}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .ledger {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container);
    border-top: 1px solid var(--md-sys-color-outline-variant);
    flex-wrap: wrap;
  }

  .ledger__header {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--md-sys-color-on-surface-variant);
    flex-shrink: 0;
  }

  .ledger__warn-badge {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--md-sys-color-on-error-container);
    background: var(--md-sys-color-error-container);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .ledger__cells {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .ledger__cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.5rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-md);
  }

  .ledger__cell--muted {
    opacity: 0.4;
  }

  .ledger__cell--warn {
    background: var(--md-sys-color-error-container);
  }

  .ledger__cell--warn .ledger__cell-label,
  .ledger__cell--warn .ledger__cell-value {
    color: var(--md-sys-color-on-error-container);
  }

  .ledger__cell-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .ledger__cell-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }
</style>
