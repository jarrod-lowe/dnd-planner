<script module lang="ts">
  let activeTooltipClose: (() => void) | null = null;
</script>

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
    onAddStep: (entry: AvailableRuleEntry) => void;
  }

  let { entries, onAddStep }: Props = $props();

  const verbGroupDefs = [
    { labelKey: 'play.addRow.planGroup', verbs: PLAN_VERBS },
    { labelKey: 'play.addRow.recordGroup', verbs: RECORD_VERBS },
    { labelKey: 'play.addRow.buildGroup', verbs: BUILD_VERBS }
  ];

  const allVerbs = [...PLAN_VERBS, ...RECORD_VERBS, ...BUILD_VERBS];
  const verbGroups = $derived(groupChoicesByVerb(entries, allVerbs));
  const verbGroupMap = $derived(new Map(verbGroups.map((g) => [g.verb, g])));

  function handleVerbTap(verb: Verb) {
    const defaultEntry = findDefaultEntryForVerb(entries, verb);
    if (defaultEntry) {
      onAddStep(defaultEntry);
    }
  }

  let openTooltipVerb: Verb | null = $state(null);

  function closeTooltip() {
    openTooltipVerb = null;
    if (activeTooltipClose === closeTooltip) {
      activeTooltipClose = null;
    }
  }

  function handleVerbClick(verb: Verb, hasLegal: boolean, e: MouseEvent) {
    const target = e.target as Element;
    if (!hasLegal && target.closest('.add-row-picker__illegal-tag')) {
      e.stopPropagation();
      if (activeTooltipClose && activeTooltipClose !== closeTooltip) {
        activeTooltipClose();
      }
      if (openTooltipVerb === verb) {
        closeTooltip();
      } else {
        openTooltipVerb = verb;
        activeTooltipClose = closeTooltip;
      }
    } else {
      if (openTooltipVerb) {
        closeTooltip();
      }
      handleVerbTap(verb);
    }
  }

  function handleWindowClick() {
    if (openTooltipVerb) {
      closeTooltip();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

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
            {#if group}
              {@const hasLegal = group.entries.some((e) => e.legal)}
              {@const illegalMessage = !hasLegal
                ? [...new Set(group.entries.flatMap((e) => e.diagnostics.map((d) => $t(d.code))))].join('\n')
                : ''}
              <button
                type="button"
                class="add-row-picker__verb"
                class:add-row-picker__verb--illegal={!hasLegal}
                onclick={(e) => handleVerbClick(verb, hasLegal, e)}
                aria-label={hasLegal ? $t(verbLabelKey(verb)) : `${$t(verbLabelKey(verb))} — ${$t('play.addRow.illegalTag')}`}
              >
                {$t(verbLabelKey(verb))}
                {#if !hasLegal}
                  <span class="add-row-picker__illegal-tag" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                      />
                    </svg>
                    {#if openTooltipVerb === verb && illegalMessage}
                      <span class="add-row-picker__tooltip">{illegalMessage}</span>
                    {/if}
                  </span>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
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
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
    min-height: 2.75rem;
  }

  .add-row-picker__verb:hover {
    background: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline);
  }

  .add-row-picker__verb:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .add-row-picker__verb--illegal {
    border-style: dashed;
  }

  .add-row-picker__illegal-tag {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .add-row-picker__illegal-tag svg {
    width: 0.75rem;
    height: 0.75rem;
    color: var(--md-sys-color-error);
  }

  .add-row-picker__tooltip {
    position: absolute;
    top: calc(100% + var(--spacing-xs));
    right: 0;
    white-space: pre;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--md-sys-color-outline);
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-md);
    z-index: var(--z-dropdown);
    pointer-events: none;
  }
</style>
