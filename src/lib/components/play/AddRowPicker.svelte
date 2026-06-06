<script lang="ts">
  import { t } from '$lib/i18n';
  import { PLAN_VERBS, RECORD_VERBS, BUILD_VERBS } from '$lib/play/verbConfig';
  import {
    groupChoicesByVerb,
    findDefaultEntryForVerb,
    verbLabelKey
  } from '$lib/play/groupChoicesByVerb';
  import { closeActiveTooltip, registerTooltipClose } from './tooltipSingleton';
  import type { AvailableRuleEntry, Verb } from '$lib/rules-engine';

  interface Props {
    entries: AvailableRuleEntry[];
    onAddStep: (entry: AvailableRuleEntry) => void;
    sublabel?: string;
  }

  let { entries, onAddStep, sublabel }: Props = $props();

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
  let mainEl: HTMLDivElement | undefined = $state();
  let tooltipStyle = $state('');

  function closeLocalTooltip() {
    openTooltipVerb = null;
    tooltipStyle = '';
    registerTooltipClose(null);
  }

  function handleVerbClick(verb: Verb, hasLegal: boolean, e: MouseEvent) {
    const target = e.target as Element;
    if (!hasLegal && target.closest('.add-row-picker__illegal-tag')) {
      e.stopPropagation();
      if (openTooltipVerb === verb) {
        closeLocalTooltip();
      } else {
        closeActiveTooltip();
        openTooltipVerb = verb;
        registerTooltipClose(closeLocalTooltip);
        requestAnimationFrame(() => {
          const icon = target.closest('.add-row-picker__illegal-tag') as HTMLElement;
          if (!mainEl || !icon) return;
          const iconRect = icon.getBoundingClientRect();
          const containerRect = mainEl.getBoundingClientRect();
          const left = iconRect.left + iconRect.width / 2 - containerRect.left;
          const top = iconRect.bottom - containerRect.top + 4;
          tooltipStyle = `left:${left}px;top:${top}px;transform:translateX(-50%)`;
        });
      }
    } else {
      if (openTooltipVerb) {
        closeLocalTooltip();
      }
      handleVerbTap(verb);
    }
  }

  function handleWindowClick() {
    if (openTooltipVerb) {
      closeLocalTooltip();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div
  class="add-row-picker"
  class:add-row-picker--tooltip-open={openTooltipVerb !== null}
  role="region"
  aria-label={$t('play.addRow.title')}
>
  <div class="add-row-picker__stripe" aria-hidden="true">
    <span class="add-row-picker__stripe-label">{$t('play.addRow.label')}</span>
    {#if sublabel}
      <span class="add-row-picker__stripe-sublabel">{$t(sublabel)}</span>
    {/if}
  </div>
  <div class="add-row-picker__main" bind:this={mainEl}>
    {#each verbGroupDefs as groupDef (groupDef.labelKey)}
      {@const hasAny = groupDef.verbs.some((v) => verbGroupMap.has(v))}
      {#if hasAny}
        <div class="add-row-picker__group">
          <span class="add-row-picker__group-label">{$t(groupDef.labelKey)}</span>
          <div class="add-row-picker__verbs" role="group" aria-label={$t(groupDef.labelKey)}>
            {#each groupDef.verbs as verb (verb)}
              {@const group = verbGroupMap.get(verb)}
              {#if group}
                {@const hasLegal = group.entries.some((e) => e.legal)}
                <button
                  type="button"
                  class="add-row-picker__verb"
                  class:add-row-picker__verb--illegal={!hasLegal}
                  onclick={(e) => handleVerbClick(verb, hasLegal, e)}
                  aria-label={hasLegal
                    ? $t(verbLabelKey(verb))
                    : `${$t(verbLabelKey(verb))} — ${$t('play.addRow.illegalTag')}`}
                >
                  {$t(verbLabelKey(verb))}
                  {#if !hasLegal}
                    <span class="add-row-picker__illegal-tag" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                        />
                      </svg>
                    </span>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    {/each}
    {#if openTooltipVerb && tooltipStyle}
      <span class="add-row-picker__tooltip" style={tooltipStyle}
        >{$t('play.addRow.illegalTag')}</span
      >
    {/if}
  </div>
</div>

<style>
  .add-row-picker {
    display: flex;
    border-radius: var(--radius-md);
    overflow: visible;
    border: 1.5px dashed var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container);
  }

  .add-row-picker__stripe {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
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

  .add-row-picker__stripe-sublabel {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--md-sys-color-primary);
    margin-top: 2px;
  }

  .add-row-picker__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    min-width: 0;
    position: relative;
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
    position: relative;
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

  .add-row-picker--tooltip-open {
    z-index: var(--z-dropdown);
  }

  .add-row-picker__illegal-tag {
    position: absolute;
    top: 50%;
    left: var(--spacing-md);
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }

  .add-row-picker__illegal-tag svg {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--md-sys-color-error);
  }

  .add-row-picker__tooltip {
    position: absolute;
    white-space: pre;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--md-sys-color-outline);
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-md);
    text-transform: none;
    z-index: var(--z-dropdown);
    pointer-events: none;
  }
</style>
