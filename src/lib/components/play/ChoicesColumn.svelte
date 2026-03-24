<script lang="ts">
  import { t } from '$lib/i18n';
  import ChoicePanel from './ChoicePanel.svelte';
  import type { AvailableRuleEntry } from '$lib/rules-engine';

  interface Props {
    entries: AvailableRuleEntry[];
    isLoading?: boolean;
    onChoiceTap: (entry: AvailableRuleEntry) => void;
  }

  let { entries, isLoading = false, onChoiceTap }: Props = $props();
</script>

<div class="choices-column">
  {#if isLoading}
    <div class="choices-column__loading">
      {$t('play.choices.loading')}
    </div>
  {:else if entries.length === 0}
    <div class="choices-column__empty">
      {$t('play.choices.empty')}
    </div>
  {:else}
    <div class="choices-column__list">
      {#each entries as entry (entry.rule.id)}
        <ChoicePanel {entry} onTap={() => onChoiceTap(entry)} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .choices-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .choices-column__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    flex: 1;
    overflow-y: auto;
  }

  .choices-column__loading,
  .choices-column__empty {
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
