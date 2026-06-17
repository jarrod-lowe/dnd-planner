<script lang="ts">
  import { t } from '$lib/i18n';
  import type { UiEntry, UiEntryUsedMax, UiEntryHitDie } from '$lib/play/extractTopBar';
  import {
    isEntryVisible,
    resolveEntryValue,
    resourceShortLabelKey
  } from '$lib/play/extractTopBar';
  import type { Facts, Status } from '$lib/rules-engine';

  interface Props {
    resourceEntries: UiEntry[];
    facts: Facts;
    status?: Status;
    viewLabel?: string;
    activeSubject?: string;
  }

  let { resourceEntries, facts, status, viewLabel, activeSubject }: Props = $props();

  const visibleEntries = $derived(
    resourceEntries
      .filter((e) => e.subject === activeSubject)
      .filter(
        (e): e is UiEntryUsedMax | UiEntryHitDie =>
          (e.type === 'usedMax' || e.type === 'hitDie') && isEntryVisible(e, facts)
      )
  );

  const isOverBudget = $derived(status !== undefined && status.legal === false);

  function labelFor(entry: UiEntry): string {
    if (entry.nameParams && Object.keys(entry.nameParams).length > 0) {
      return $t(entry.label, entry.nameParams);
    }
    return $t(entry.label);
  }

  // Compact label for the resources panel. Falls back to the full label when no
  // short form exists. The full label is still exposed via aria-label/title.
  function shortLabelFor(entry: UiEntry): string {
    const shortKey = resourceShortLabelKey(entry.label);
    if (!shortKey) return labelFor(entry);
    if (entry.nameParams && Object.keys(entry.nameParams).length > 0) {
      return $t(shortKey, entry.nameParams);
    }
    return $t(shortKey);
  }
</script>

<div class="ledger" role="region" aria-label={$t('play.ledger.title')}>
  <div class="ledger__title">
    <span class="ledger__header">{$t('play.ledger.title')}</span>
    {#if viewLabel}
      <span class="ledger__view-label">{$t(viewLabel)}</span>
    {/if}
  </div>

  {#if isOverBudget}
    <span class="ledger__warn-badge" role="alert">
      {$t('play.ledger.overBudget')}
    </span>
  {/if}

  <div class="ledger__cells">
    {#each visibleEntries as entry (entry.label + JSON.stringify(entry.nameParams))}
      {@const total =
        entry.type === 'hitDie'
          ? Number(facts[entry.total] ?? 0)
          : Number(facts[(entry as UiEntryUsedMax).total] ?? 0)}
      {@const remaining =
        entry.type === 'hitDie'
          ? Number(facts[entry.remaining] ?? 0)
          : Number(facts[(entry as UiEntryUsedMax).remaining] ?? 0)}
      <div
        class="ledger__cell"
        class:ledger__cell--muted={remaining <= 0 && !isOverBudget}
        class:ledger__cell--warn={isOverBudget && remaining < total}
        aria-label="{labelFor(entry)}: {remaining} of {total}"
        title={labelFor(entry)}
      >
        <span class="ledger__cell-label">{shortLabelFor(entry)}</span>
        <span class="ledger__cell-value">{resolveEntryValue(entry, facts)}</span>
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

  .ledger__title {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
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

  .ledger__view-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--md-sys-color-primary);
    letter-spacing: 0.04em;
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
