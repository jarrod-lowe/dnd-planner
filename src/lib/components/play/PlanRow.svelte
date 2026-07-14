<script lang="ts">
  import { t } from '$lib/i18n';
  import PanelRenderer from './PanelRenderer.svelte';
  import ModChip from './ModChip.svelte';
  import WarningIndicator from './WarningIndicator.svelte';
  import RulesPane from './details/RulesPane.svelte';
  import { getMatchingAnnotations } from '$lib/play/annotations';
  import { extractPanelDescriptor } from './panel-renderer/extractPanelDescriptor';
  import { getSubBucket, subBucketLabelKey } from '$lib/play/groupChoicesByVerb';
  import { getSubject } from '$lib/play/subjectUtils';
  import { closeActiveTooltip, registerTooltipClose } from './tooltipSingleton';
  import { peekDetail, getDetail } from '$lib/details/index';
  import type { ItemDetail } from '$lib/details/types';
  import type { PlannedItem } from '$lib/play/types';
  import type { AvailableRuleEntry, Annotation, Facts, ActionCostTag } from '$lib/rules-view';
  import type { EffectInstance } from '$lib/rules-engine';

  interface Props {
    item: PlannedItem;
    entry: AvailableRuleEntry;
    facts: Facts;
    activeAnnotations: Annotation[];
    alternatives?: AvailableRuleEntry[];
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRemove?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onSwapAlternative?: (entry: AvailableRuleEntry) => void;
    onFollowup?: (effect: EffectInstance) => void;
  }

  let {
    item,
    entry,
    facts,
    activeAnnotations,
    alternatives = [],
    canMoveUp = true,
    canMoveDown = true,
    onSelectionChange,
    onRemove,
    onMoveUp,
    onMoveDown,
    onSwapAlternative,
    onFollowup
  }: Props = $props();

  let collapsed = $state(false);
  let openTooltipAltId: string | null = $state(null);
  let rightEl: HTMLDivElement | undefined = $state();
  let tooltipStyle = $state('');
  let rulesMode = $state(false);
  let rulesDetail = $state<ItemDetail | null | undefined>(undefined);
  let rulesLoading = $state(false);

  function closeLocalTooltip() {
    openTooltipAltId = null;
    tooltipStyle = '';
    registerTooltipClose(null);
  }

  function toggleAltTooltip(altId: string, e: MouseEvent) {
    e.stopPropagation();
    if (openTooltipAltId === altId) {
      closeLocalTooltip();
    } else {
      closeActiveTooltip();
      openTooltipAltId = altId;
      registerTooltipClose(closeLocalTooltip);
      const icon = e.currentTarget as HTMLElement;
      requestAnimationFrame(() => {
        if (!rightEl || !icon) return;
        const iconRect = icon.getBoundingClientRect();
        const containerRect = rightEl.getBoundingClientRect();
        const left = iconRect.left + iconRect.width / 2 - containerRect.left;
        const top = iconRect.bottom - containerRect.top + 4;
        tooltipStyle = `left:${left}px;top:${top}px;transform:translateX(-50%)`;
      });
    }
  }

  function handleWindowClick() {
    if (openTooltipAltId) {
      closeLocalTooltip();
    }
  }

  const verb = $derived(item.verb);
  const rule = $derived(item.rule);
  const descriptor = $derived(extractPanelDescriptor(rule));
  const displayName = $derived(descriptor.name ? $t(descriptor.name) : rule.id);

  const costTags = $derived.by(() => {
    const tags =
      ((rule.ui as Record<string, unknown>)?.actionCost as ActionCostTag[] | undefined) ?? [];
    // A live slot-level selection re-labels the authored slot chip with what the
    // cast will actually spend: 0 is the class feature's free use, any other
    // level the (possibly upcast) slot. Rules without a slotLevel selection —
    // and levels outside the tag vocabulary — keep the authored tag.
    const slotLevel = rule.selections?.slotLevel;
    if (typeof slotLevel !== 'number') return tags;
    return tags.map((tag) => {
      if (!/^L[1-5]$/.test(tag)) return tag;
      if (slotLevel === 0) return 'free' as ActionCostTag;
      return slotLevel >= 1 && slotLevel <= 5 ? (`L${slotLevel}` as ActionCostTag) : tag;
    });
  });

  const annotationLabels = $derived(descriptor.annotationLabels ?? []);
  const matchingAnnotations = $derived(getMatchingAnnotations(annotationLabels, activeAnnotations));
  const riderAnnotations = $derived(matchingAnnotations.filter((a) => a.rider));

  const hasWarning = $derived(!entry.legal || !entry.applicable);
  const warningType = $derived(
    !entry.legal ? ('illegal' as const) : !entry.applicable ? ('inapplicable' as const) : null
  );
  const warningMessage = $derived(
    hasWarning && entry.diagnostics?.length
      ? entry.diagnostics.map((d) => $t(d.code)).join('\n')
      : undefined
  );

  const verbLabel = $derived($t(`play.verbs.${verb}`));

  const subjectLabel = $derived.by(() => {
    const subject = getSubject(rule);
    if (!subject) return undefined;
    return $t(`play.addRow.${subject}Sublabel`);
  });

  const groupedAlternatives = $derived.by(() => {
    const buckets: Record<string, AvailableRuleEntry[]> = {};
    for (const alt of alternatives) {
      const bucket = getSubBucket(alt.rule, verb);
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(alt);
    }
    return Object.entries(buckets);
  });

  function formatCostTag(tag: ActionCostTag): string {
    return $t(`play.costTags.${tag}`);
  }

  function toggleCollapse() {
    collapsed = !collapsed;
  }

  const detailKey = $derived(
    ((rule.ui as Record<string, unknown>)?.detailKey as string | undefined) ?? ''
  );

  const hasDetail = $derived(detailKey !== '' && peekDetail(detailKey) !== null);

  function toggleRulesMode() {
    if (rulesMode) {
      rulesMode = false;
      rulesDetail = undefined;
      rulesLoading = false;
      return;
    }
    const cached = peekDetail(detailKey);
    if (cached === null) return; // known-absent
    if (cached) {
      rulesDetail = cached;
      rulesMode = true;
    } else {
      rulesLoading = true;
      rulesMode = true;
      const capturedKey = detailKey;
      getDetail(detailKey).then((d) => {
        if (detailKey !== capturedKey) return;
        rulesDetail = d;
        rulesLoading = false;
        if (!d) {
          rulesMode = false;
        }
      });
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

{#snippet modChips()}
  {#if riderAnnotations.length > 0}
    <div class="plan-row__mod-chips">
      {#each riderAnnotations as ann (ann.key)}
        {@const rider = ann.rider!}
        <ModChip
          variant={rider.legal === false ? 'illegal' : 'effect'}
          label={rider.label ? $t(rider.label) : $t(ann.key)}
          illegalReason={rider.illegalReason}
        />
      {/each}
    </div>
  {/if}
{/snippet}

<div
  class="plan-row"
  class:plan-row--collapsed={collapsed}
  class:plan-row--tooltip-open={openTooltipAltId !== null}
>
  <div class="plan-row__left">
    <span class="plan-row__verb-label">
      {verbLabel}
    </span>
    {#if subjectLabel}
      <span class="plan-row__subject-label">{subjectLabel}</span>
    {/if}
    {#if hasDetail}
      <button
        type="button"
        class="plan-row__flip-btn"
        data-rules-toggle
        aria-pressed={rulesMode}
        aria-label={rulesMode ? $t('play.planRow.flipToPlan') : $t('play.planRow.flipToRules')}
        onclick={toggleRulesMode}
      >
        {$t('play.planRow.flipLabel')}
      </button>
    {/if}
    <div class="plan-row__left-controls">
      {#if onMoveUp}
        <button
          type="button"
          class="plan-row__control-btn"
          disabled={!canMoveUp}
          aria-label={$t('play.plan.moveUp')}
          onclick={onMoveUp}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
      {/if}
      {#if onMoveDown}
        <button
          type="button"
          class="plan-row__control-btn"
          disabled={!canMoveDown}
          aria-label={$t('play.plan.moveDown')}
          onclick={onMoveDown}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      {/if}
      <button
        type="button"
        class="plan-row__control-btn"
        aria-label={collapsed ? $t('play.planRow.expandAria') : $t('play.planRow.collapseAria')}
        onclick={toggleCollapse}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {#if collapsed}
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          {:else}
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          {/if}
        </svg>
      </button>
      {#if onRemove}
        <button
          type="button"
          class="plan-row__control-btn plan-row__control-btn--undo"
          aria-label={$t('play.planRow.undoAria')}
          onclick={onRemove}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M2.5 2v6h6" stroke-linecap="round" stroke-linejoin="round" />
            <path
              d="M2.5 8C4.93 4.01 9.55 2.35 13.87 3.61c4.32 1.26 7.21 5.26 7.13 9.74-.08 4.48-3.12 8.37-7.48 9.47-4.36 1.1-8.93-.87-11.02-4.82"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="plan-row__right" bind:this={rightEl}>
    {#if rulesMode}
      {#if rulesLoading}
        <div class="plan-row__rules-loading" aria-live="polite">{$t('rules.loadingDetails')}</div>
      {:else if rulesDetail}
        <RulesPane detail={rulesDetail} name={displayName} onFlip={toggleRulesMode} />
      {/if}
      {#if hasWarning && warningType}
        <WarningIndicator type={warningType} message={warningMessage} />
      {/if}
      {@render modChips()}
    {:else if !collapsed}
      <div class="plan-row__cost-chips">
        {#each costTags as tag (tag)}
          <span class="plan-row__cost-tag">{formatCostTag(tag)}</span>
        {/each}
      </div>

      {@render modChips()}

      <div class="plan-row__content">
        <PanelRenderer
          {entry}
          editable={true}
          {facts}
          selections={item.rule.selections}
          {activeAnnotations}
          {onSelectionChange}
          {onFollowup}
        />
      </div>

      {#if alternatives.length > 0}
        <div class="plan-row__alternatives">
          <span class="plan-row__alternatives-label">{$t('play.planRow.orInstead')}</span>
          {#each groupedAlternatives as [bucket, alts] (bucket)}
            <div class="plan-row__alt-bucket">
              <span class="plan-row__alt-bucket-label">{$t(subBucketLabelKey(verb, bucket))} →</span
              >
              {#each alts as alt (alt.rule.id)}
                {@const altDescriptor = extractPanelDescriptor(alt.rule)}
                {@const altName = altDescriptor.name ? $t(altDescriptor.name) : alt.rule.id}
                {@const altIllegalMsg = !alt.legal
                  ? alt.diagnostics.map((d) => $t(d.code)).join('\n')
                  : ''}
                <button
                  type="button"
                  class="plan-row__alt-btn"
                  class:plan-row__alt-btn--illegal={!alt.legal}
                  aria-label={!alt.legal && altIllegalMsg
                    ? `${altName} — ${altIllegalMsg}`
                    : altName}
                  onclick={() => onSwapAlternative?.(alt)}
                >
                  {#if !alt.legal}
                    <span
                      class="plan-row__alt-illegal-tag"
                      aria-hidden="true"
                      onclick={(e) => toggleAltTooltip(alt.rule.id, e)}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                        />
                      </svg>
                    </span>
                  {/if}
                  {altName}
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
      {#if openTooltipAltId && tooltipStyle}
        <span class="plan-row__alt-tooltip" style={tooltipStyle}>
          {(() => {
            const alt = alternatives.find((a) => a.rule.id === openTooltipAltId);
            return alt ? alt.diagnostics.map((d) => $t(d.code)).join('\n') : '';
          })()}
        </span>
      {/if}
    {:else}
      <span class="plan-row__collapsed-name">{displayName}</span>
    {/if}
  </div>
</div>

<style>
  .plan-row {
    position: relative;
    display: flex;
    border-radius: var(--radius-md);
    overflow: visible;
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  /* Left column — verb label + controls */
  .plan-row__left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    width: 7rem;
    flex-shrink: 0;
    padding: var(--spacing-sm) var(--spacing-xs);
    background: var(--md-sys-color-surface-container-low);
    border-right: 2px solid var(--md-sys-color-outline-variant);
  }

  .plan-row__verb-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
  }

  .plan-row__subject-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--md-sys-color-primary);
    text-align: center;
  }

  .plan-row__flip-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .plan-row__flip-btn:hover {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .plan-row__flip-btn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .plan-row__rules-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
  }

  .plan-row__left-controls {
    display: flex;
    gap: var(--spacing-xs);
    align-items: center;
    margin-top: auto;
  }

  .plan-row__control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .plan-row__control-btn:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .plan-row__control-btn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .plan-row__control-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .plan-row__control-btn--undo:hover {
    color: var(--md-sys-color-error);
  }

  /* Right column — content */
  .plan-row__right {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: var(--spacing-sm);
    gap: var(--spacing-xs);
    position: relative;
  }

  .plan-row__right > :global(.warning-indicator) {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 2;
  }

  .plan-row__cost-chips {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .plan-row__cost-tag {
    font-family: var(--font-body);
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    padding: 0.0625rem var(--spacing-xs);
    border-radius: var(--radius-sm);
  }

  .plan-row__mod-chips {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .plan-row__content {
    min-width: 0;
  }

  .plan-row__content > :global(.panel-renderer) {
    border: none;
    padding: var(--spacing-xs) 0 0 0;
    background: transparent;
  }

  .plan-row__content > :global(.panel-renderer:hover) {
    background: transparent;
  }

  .plan-row__collapsed-name {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  /* Alternatives */
  .plan-row__alternatives {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xs);
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }

  .plan-row__alternatives-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--md-sys-color-outline);
  }

  .plan-row__alt-bucket {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .plan-row__alt-bucket-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--md-sys-color-on-surface-variant);
    flex-shrink: 0;
  }

  .plan-row__alt-btn {
    position: relative;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .plan-row__alt-btn:hover {
    background: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline);
  }

  .plan-row__alt-btn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .plan-row__alt-btn--illegal {
    border-style: dashed;
  }

  .plan-row--tooltip-open {
    z-index: var(--z-dropdown);
  }

  .plan-row__alt-illegal-tag {
    position: absolute;
    top: 50%;
    left: var(--spacing-sm);
    transform: translate(-50%, -50%);
  }

  .plan-row__alt-illegal-tag svg {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--md-sys-color-error);
  }

  .plan-row__alt-tooltip {
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
