<script lang="ts">
  import { slide } from 'svelte/transition';
  import { t } from '$lib/i18n';
  import ChoicePanel from './ChoicePanel.svelte';
  import EffectPanel from './EffectPanel.svelte';
  import PackedChoiceGroup from './PackedChoiceGroup.svelte';
  import type { Facts, AvailableRuleEntry } from '$lib/rules-engine';
  import type { ChoiceGroup } from '$lib/play/groupPackedChoices';

  interface Props {
    section: string | undefined;
    packedGroups: ChoiceGroup[];
    hasLegalEntries: boolean;
    facts: Facts;
    onChoiceTap: (entry: AvailableRuleEntry) => void;
    mode?: 'choice' | 'effect';
  }

  let {
    section,
    packedGroups,
    hasLegalEntries,
    facts,
    onChoiceTap,
    mode = 'choice'
  }: Props = $props();

  // Expanded by default if there are legal entries (captures initial value intentionally)
  let expanded = $state(() => hasLegalEntries);

  // Compute section title with i18n fallback
  const sectionTitle = $derived.by(() => {
    const key = section ? `play.choices.sections.${section}` : 'play.choices.sections.other';
    const translated = $t(key);
    // If translation key doesn't exist, capitalize the section name
    if (translated === key && section) {
      return section.charAt(0).toUpperCase() + section.slice(1);
    }
    return translated;
  });

  function toggleExpanded() {
    expanded = !expanded;
  }
</script>

<div class="section-collapsible">
  <button
    type="button"
    class="section-collapsible__header"
    onclick={toggleExpanded}
    aria-expanded={expanded}
    aria-label={sectionTitle}
  >
    <span class="section-collapsible__title">{sectionTitle}</span>
    <span
      class="section-collapsible__chevron"
      class:section-collapsible__chevron--expanded={expanded}
    >
      {#if expanded}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      {/if}
    </span>
  </button>

  {#if expanded}
    <div class="section-collapsible__content" transition:slide={{ duration: 200 }}>
      {#each packedGroups as group (group.type === 'packed' ? group.leader.rule.id : group.entry.rule.id)}
        {#if group.type === 'single'}
          {#if mode === 'effect'}
            <EffectPanel entry={group.entry} />
          {:else}
            <ChoicePanel
              entry={group.entry}
              {facts}
              editable={false}
              onTap={() => onChoiceTap(group.entry)}
            />
          {/if}
        {:else if group.type === 'packed'}
          <PackedChoiceGroup
            leader={group.leader}
            followers={group.followers}
            {facts}
            onAddToPlan={onChoiceTap}
            readOnly={mode === 'effect'}
          />
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .section-collapsible {
    display: flex;
    flex-direction: column;
    margin-top: var(--spacing-sm);
  }

  .section-collapsible:first-child {
    margin-top: 0;
  }

  .section-collapsible__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: none;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    cursor: pointer;
    font-family: var(--font-body);
    width: 100%;
    text-align: left;
  }

  .section-collapsible__header:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .section-collapsible__title {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .section-collapsible__chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--md-sys-color-on-surface-variant);
    transition: transform var(--transition-fast);
  }

  .section-collapsible__chevron--expanded {
    transform: rotate(180deg);
  }

  .section-collapsible__chevron svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .section-collapsible__content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md) 0;
  }
</style>
