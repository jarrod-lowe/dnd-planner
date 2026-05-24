<script lang="ts">
  import { t } from '$lib/i18n';
  import SectionCollapsible from './SectionCollapsible.svelte';
  import { adaptEffectsAsEntries } from '$lib/play/adaptEffects';
  import { groupChoicesBySection } from '$lib/play/groupChoicesBySection';
  import { SECTION_ORDER } from '$lib/play/sectionConfig';
  import { isHiddenEffect } from '$lib/play/effectUtils';
  import type { Facts, Rule } from '$lib/rules-engine';

  interface Props {
    effects: Rule[];
    facts?: Facts;
    committedCount?: number;
    showHiddenEffects?: boolean;
    onRemoveEffect?: (ruleId: string) => void;
    onToggleHiddenEffects?: () => void;
  }

  let {
    effects,
    facts = {},
    committedCount,
    showHiddenEffects = false,
    onRemoveEffect,
    onToggleHiddenEffects
  }: Props = $props();

  const visibleEffects = $derived(
    showHiddenEffects ? effects : effects.filter((e) => !isHiddenEffect(e))
  );

  const deletableRuleIds = $derived(
    committedCount && onRemoveEffect
      ? new Set(effects.slice(0, committedCount).map((e) => e.id))
      : new Set<string>()
  );

  // Adapt effects into entries, then group by section
  const sectionGroups = $derived(
    groupChoicesBySection(adaptEffectsAsEntries(visibleEffects), SECTION_ORDER)
  );
</script>

<div class="effects-column">
  {#if onToggleHiddenEffects}
    <div class="effects-column__header">
      <button
        type="button"
        class="effects-column__toggle-hidden"
        onclick={onToggleHiddenEffects}
        aria-pressed={showHiddenEffects}
        aria-label={showHiddenEffects
          ? $t('play.activeState.hideHidden')
          : $t('play.activeState.showHidden')}
      >
        {#if showHiddenEffects}
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
            />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.35-3.01-3.01-3.01l-.16.02z"
            />
          </svg>
        {/if}
      </button>
    </div>
  {/if}
  {#if visibleEffects.length === 0}
    <div class="effects-column__empty">
      {$t('play.effects.empty')}
    </div>
  {:else}
    <div class="effects-column__list">
      {#each sectionGroups as sectionGroup (sectionGroup.section)}
        <SectionCollapsible
          section={sectionGroup.section}
          packedGroups={sectionGroup.packedGroups}
          hasLegalEntries={sectionGroup.hasLegalEntries}
          {facts}
          onChoiceTap={() => {}}
          mode="effect"
          {deletableRuleIds}
          {onRemoveEffect}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .effects-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .effects-column__header {
    display: flex;
    justify-content: flex-end;
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .effects-column__toggle-hidden {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    color: var(--md-sys-color-on-surface-variant);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .effects-column__toggle-hidden svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .effects-column__toggle-hidden:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .effects-column__toggle-hidden:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .effects-column__toggle-hidden[aria-pressed='true'] {
    color: var(--md-sys-color-primary);
  }

  .effects-column__list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .effects-column__empty {
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
