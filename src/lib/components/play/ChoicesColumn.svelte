<script lang="ts">
  import { t } from '$lib/i18n';
  import ChoicePanel from './ChoicePanel.svelte';
  import PackedChoiceGroup from './PackedChoiceGroup.svelte';
  import { groupPackedChoices } from '$lib/play/groupPackedChoices';
  import type { AvailableRuleEntry, Facts } from '$lib/rules-engine';

  interface Props {
    entries: AvailableRuleEntry[];
    facts?: Facts;
    isLoading?: boolean;
    onChoiceTap: (entry: AvailableRuleEntry) => void;
  }

  let { entries, facts = {}, isLoading = false, onChoiceTap }: Props = $props();

  // Group entries by packBehind
  const choiceGroups = $derived(groupPackedChoices(entries));
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
      {#each choiceGroups as group (group.type === 'packed' ? group.leader.rule.id : group.entry.rule.id)}
        {#if group.type === 'single'}
          <ChoicePanel
            entry={group.entry}
            {facts}
            editable={false}
            onTap={() => onChoiceTap(group.entry)}
          />
        {:else if group.type === 'packed'}
          <PackedChoiceGroup
            leader={group.leader}
            followers={group.followers}
            {facts}
            onAddToPlan={onChoiceTap}
          />
        {/if}
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
