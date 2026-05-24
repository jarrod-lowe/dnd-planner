<script lang="ts">
  import { t } from '$lib/i18n';
  import PanelRenderer from './PanelRenderer.svelte';
  import ModChip from './ModChip.svelte';
  import { VERB_STRIPE_COLORS, isRecordVerb, isBuildVerb } from '$lib/play/verbConfig';
  import { getMatchingAnnotations } from '$lib/play/annotations';
  import { extractPanelDescriptor } from './panel-renderer/extractPanelDescriptor';
  import { getSubBucket, subBucketLabelKey } from '$lib/play/groupChoicesByVerb';
  import type { PlannedItem } from '$lib/play/types';
  import type { AvailableRuleEntry, Annotation, Facts, ActionCostTag } from '$lib/rules-engine';

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
    onSwapAlternative
  }: Props = $props();

  let collapsed = $state(false);

  const verb = $derived(item.verb);
  const rule = $derived(item.rule);
  const descriptor = $derived(extractPanelDescriptor(rule));
  const displayName = $derived(descriptor.name ? $t(descriptor.name) : rule.id);

  const stripeColor = $derived(VERB_STRIPE_COLORS[verb]);

  const costTags = $derived(
    ((rule.ui as Record<string, unknown>)?.actionCost as ActionCostTag[] | undefined) ?? []
  );

  const annotationLabels = $derived(descriptor.annotationLabels ?? []);
  const matchingAnnotations = $derived(getMatchingAnnotations(annotationLabels, activeAnnotations));
  const riderAnnotations = $derived(matchingAnnotations.filter((a) => a.rider));

  const variantClass = $derived.by(() => {
    if (isRecordVerb(verb)) return 'plan-row--event';
    if (isBuildVerb(verb)) return 'plan-row--build';
    return '';
  });

  const verbLabel = $derived($t(`play.verbs.${verb}`));

  const verbSub = $derived(isRecordVerb(verb) ? $t('play.planRow.recorded') : '');

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
</script>

<div
  class="plan-row {variantClass}"
  class:plan-row--collapsed={collapsed}
  style="--plan-row-stripe: {stripeColor};"
>
  <div class="plan-row__left">
    <span class="plan-row__verb-label">{verbLabel}</span>
    {#if verbSub}
      <span class="plan-row__verb-sub">{verbSub}</span>
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

  <div class="plan-row__right">
    {#if !collapsed}
      <div class="plan-row__cost-chips">
        {#each costTags as tag (tag)}
          <span class="plan-row__cost-tag">{formatCostTag(tag)}</span>
        {/each}
      </div>

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

      <div class="plan-row__content">
        <PanelRenderer
          {entry}
          editable={true}
          {facts}
          selections={item.rule.selections}
          {activeAnnotations}
          {onSelectionChange}
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
                  {altName}
                  {#if !alt.legal}
                    <span class="plan-row__alt-illegal-tag" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                      </svg>
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
        </div>
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
    overflow: hidden;
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
    background: color-mix(in srgb, var(--plan-row-stripe) 8%, transparent);
    border-right: 2px solid var(--plan-row-stripe);
  }

  .plan-row__verb-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--plan-row-stripe);
    text-align: center;
  }

  .plan-row__verb-sub {
    font-family: var(--font-body);
    font-size: 0.5625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
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
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
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

  .plan-row__alt-illegal-tag {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .plan-row__alt-illegal-tag svg {
    width: 0.75rem;
    height: 0.75rem;
    color: var(--md-sys-color-error);
  }

  /* Event variant */
  .plan-row--event {
    background: color-mix(
      in srgb,
      var(--md-sys-color-error-container) 30%,
      var(--md-sys-color-surface-container-high)
    );
  }

  /* Build variant */
  .plan-row--build {
    opacity: 0.7;
    background: var(--md-sys-color-surface-container);
  }
</style>
