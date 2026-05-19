<script lang="ts">
  import { t } from '$lib/i18n';
  import { PLAN_VERBS, RECORD_VERBS, BUILD_VERBS } from '$lib/play/verbConfig';
  import {
    groupChoicesByVerb,
    findDefaultEntryForVerb,
    verbLabelKey
  } from '$lib/play/groupChoicesByVerb';
  import type { AvailableRuleEntry, Verb } from '$lib/rules-engine';

  interface Props {
    entries: AvailableRuleEntry[];
    showIllegal: boolean;
    onAddStep: (entry: AvailableRuleEntry) => void;
    onToggleShowIllegal: () => void;
  }

  let { entries, showIllegal, onAddStep, onToggleShowIllegal }: Props = $props();

  const verbGroupDefs = [
    { labelKey: 'play.addRow.planGroup', verbs: PLAN_VERBS },
    { labelKey: 'play.addRow.recordGroup', verbs: RECORD_VERBS },
    { labelKey: 'play.addRow.buildGroup', verbs: BUILD_VERBS }
  ];

  const allVerbs = [...PLAN_VERBS, ...RECORD_VERBS, ...BUILD_VERBS];
  const verbGroups = $derived(groupChoicesByVerb(entries, allVerbs, showIllegal));
  const verbGroupMap = $derived(new Map(verbGroups.map((g) => [g.verb, g])));

  function handleVerbTap(verb: Verb) {
    const defaultEntry = findDefaultEntryForVerb(entries, verb);
    if (defaultEntry) {
      onAddStep(defaultEntry);
    }
  }
</script>

<div class="add-row-picker" role="region" aria-label={$t('play.addRow.title')}>
  <div class="add-row-picker__stripe" aria-hidden="true">
    <span class="add-row-picker__stripe-label">+ ADD</span>
  </div>
  <div class="add-row-picker__main">
    {#each verbGroupDefs as groupDef (groupDef.labelKey)}
      <div class="add-row-picker__group">
        <span class="add-row-picker__group-label">{$t(groupDef.labelKey)}</span>
        <div class="add-row-picker__verbs" role="group" aria-label={$t(groupDef.labelKey)}>
          {#each groupDef.verbs as verb (verb)}
            {@const group = verbGroupMap.get(verb)}
            {@const hasLegal = group ? group.entries.some((e) => e.legal) : false}
            <button
              type="button"
              class="add-row-picker__verb"
              class:add-row-picker__verb--disabled={!hasLegal}
              disabled={!hasLegal}
              onclick={() => handleVerbTap(verb)}
            >
              {$t(verbLabelKey(verb))}
            </button>
          {/each}
        </div>
      </div>
    {/each}
    <button
      type="button"
      class="add-row-picker__toggle-illegal"
      aria-pressed={showIllegal}
      aria-label={showIllegal ? $t('play.choices.hideIllegal') : $t('play.choices.showIllegal')}
      onclick={onToggleShowIllegal}
    >
      {#if showIllegal}
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
</div>

<style>
  .add-row-picker {
    display: flex;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1.5px dashed var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container);
  }

  .add-row-picker__stripe {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    width: 6.875rem;
    flex-shrink: 0;
    padding: var(--spacing-sm);
    border-right: 1px dashed var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container-low);
  }

  .add-row-picker__stripe-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .add-row-picker__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    min-width: 0;
  }

  .add-row-picker__group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .add-row-picker__group-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--md-sys-color-on-surface-variant);
    flex-shrink: 0;
  }

  .add-row-picker__verbs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .add-row-picker__verb {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
    min-height: 2.75rem;
  }

  .add-row-picker__verb:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline);
  }

  .add-row-picker__verb:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .add-row-picker__verb--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .add-row-picker__toggle-illegal {
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
    align-self: flex-end;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .add-row-picker__toggle-illegal svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .add-row-picker__toggle-illegal:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .add-row-picker__toggle-illegal:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .add-row-picker__toggle-illegal[aria-pressed='true'] {
    color: var(--md-sys-color-primary);
  }
</style>
