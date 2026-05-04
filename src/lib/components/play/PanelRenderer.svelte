<script lang="ts">
  import { t } from '$lib/i18n';
  import WarningIndicator from './WarningIndicator.svelte';
  import { extractPanelDescriptor } from './panel-renderer/extractPanelDescriptor';
  import { resolveValueSource } from './panel-renderer/resolveValueSource';
  import PanelSlider from './panel-renderer/PanelSlider.svelte';
  import PanelDiceLine from './panel-renderer/PanelDiceLine.svelte';
  import PanelSelect from './panel-renderer/PanelSelect.svelte';
  import { evaluateCondition } from '$lib/rules-engine/conditions';
  import { getMatchingAnnotations } from '$lib/play/annotations';
  import type { AvailableRuleEntry, Facts, Annotation, Rule } from '$lib/rules-engine';
  import type { TextInformation, CountdownInformation } from './panel-renderer/types';

  interface Props {
    entry: AvailableRuleEntry;
    editable?: boolean;
    onTap?: () => void;
    facts?: Facts;
    selections?: Record<string, unknown>;
    activeAnnotations?: Annotation[];
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRemove?: () => void;
    removeLabel?: string;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onFollowup?: (rule: Rule) => void;
  }

  let {
    entry,
    editable = false,
    onTap,
    facts = {},
    selections = {},
    activeAnnotations = [],
    onSelectionChange,
    onRemove,
    removeLabel = 'play.plan.remove',
    canMoveUp = true,
    canMoveDown = true,
    onMoveUp,
    onMoveDown,
    onFollowup
  }: Props = $props();

  const descriptor = $derived(extractPanelDescriptor(entry.rule));

  const displayName = $derived(
    descriptor.name ? $t(descriptor.name) : entry.rule.description || entry.rule.id
  );

  const hasWarning = $derived(!entry.legal || !entry.applicable);
  const warningType = $derived(
    !entry.legal ? ('illegal' as const) : !entry.applicable ? ('inapplicable' as const) : null
  );

  const vars = $derived(entry.rule.vars ?? {});

  const primarySlider = $derived(
    descriptor.primaryControl?.type === 'slider' ? descriptor.primaryControl : undefined
  );
  const primaryDiceLine = $derived(
    descriptor.primaryControl?.type === 'dice-line' ? descriptor.primaryControl : undefined
  );
  const primarySelect = $derived(
    descriptor.primaryControl?.type === 'select' ? descriptor.primaryControl : undefined
  );
  const secondarySlider = $derived(
    descriptor.secondaryControl?.type === 'slider' ? descriptor.secondaryControl : undefined
  );

  let secondaryActivated = $state(false);

  const secondaryConditionMet = $derived(
    !descriptor.secondaryControl?.enabled
      ? true
      : evaluateCondition(descriptor.secondaryControl.enabled.condition, facts, new Set())
  );

  const secondaryShouldRender = $derived(
    descriptor.secondaryControl
      ? secondaryConditionMet
        ? descriptor.secondaryControl.enabled
          ? secondaryActivated
          : true
        : false
      : false
  );

  const secondaryShowEnableButton = $derived(
    descriptor.secondaryControl?.enabled ? secondaryConditionMet && !secondaryActivated : false
  );

  const secondaryDiceLine = $derived(
    descriptor.secondaryControl?.type === 'dice-line' ? descriptor.secondaryControl : undefined
  );
  const secondarySelect = $derived(
    descriptor.secondaryControl?.type === 'select' ? descriptor.secondaryControl : undefined
  );

  const textInfos = $derived(
    (
      descriptor.information?.filter((info): info is TextInformation => info.type === 'text') ?? []
    ).map((info) => {
      let text = $t(info.label);
      if (info.labelValues) {
        const resolvedValues: string[] = [];
        for (const [key, source] of Object.entries(info.labelValues)) {
          const resolved = resolveValueSource(source, facts, vars, selections);
          if (resolved !== undefined) {
            const placeholder = `{{${key}}}`;
            const value = String(resolved);
            if (text.includes(placeholder)) {
              text = text.replace(placeholder, value);
            } else {
              resolvedValues.push(value);
            }
          }
        }
        if (resolvedValues.length > 0) {
          text = text + ' ' + resolvedValues.join(' ');
        }
      }
      return text;
    })
  );

  const countdownInfos = $derived(
    (
      descriptor.information?.filter(
        (info): info is CountdownInformation => info.type === 'countdown'
      ) ?? []
    )
      .map((info, index) => {
        const filled = resolveValueSource(info.filled, facts, vars, selections);
        const total = resolveValueSource(info.total, facts, vars, selections);
        if (typeof filled !== 'number' || typeof total !== 'number') return null;
        const empty = total - filled;
        return {
          index,
          filledIndices: Array.from({ length: filled }, (_, i) => i),
          emptyIndices: Array.from({ length: empty }, (_, i) => i),
          filled,
          total
        };
      })
      .filter(
        (
          v
        ): v is {
          index: number;
          filledIndices: number[];
          emptyIndices: number[];
          filled: number;
          total: number;
        } => v !== null
      )
  );

  const annotationLabels = $derived([
    ...(descriptor.primaryControl?.annotationLabels ?? []),
    ...(descriptor.secondaryControl?.annotationLabels ?? [])
  ]);

  const matchingAnnotations = $derived(getMatchingAnnotations(annotationLabels, activeAnnotations));

  const visibleFollowups = $derived(
    editable && onFollowup
      ? (descriptor.followups ?? []).filter(
          (f) => f.type === 'effect' && evaluateCondition(f.condition, facts, new Set())
        )
      : []
  );

  const hasActions = $derived(!!onRemove || !!onMoveUp || !!onMoveDown);

  function handleRemoveClick(e: MouseEvent) {
    e.stopPropagation();
    onRemove?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="panel-renderer"
  class:panel-renderer--editable={editable}
  role={!editable ? 'button' : undefined}
  tabindex={!editable ? 0 : undefined}
  aria-label={!editable
    ? displayName +
      (hasWarning && warningType
        ? ` (${$t(warningType === 'illegal' ? 'play.choices.illegal' : 'play.choices.inapplicable')})`
        : '')
    : undefined}
  onclick={onTap}
>
  {#if hasWarning && warningType}
    <WarningIndicator type={warningType} />
  {/if}
  <div class="panel-renderer__header">
    <span class="panel-renderer__title">{displayName}</span>
  </div>
  {#if primarySlider}
    <div class="panel-renderer__control">
      <PanelSlider
        control={primarySlider}
        {editable}
        {facts}
        {vars}
        {selections}
        {onSelectionChange}
      />
    </div>
  {/if}
  {#if primaryDiceLine}
    <div class="panel-renderer__control">
      <PanelDiceLine
        control={primaryDiceLine}
        {editable}
        {facts}
        {vars}
        {selections}
        {onSelectionChange}
      />
    </div>
  {/if}
  {#if primarySelect}
    <div class="panel-renderer__control">
      <PanelSelect
        control={primarySelect}
        {editable}
        {facts}
        {vars}
        {selections}
        {onSelectionChange}
      />
    </div>
  {/if}
  {#if secondaryShowEnableButton}
    <div class="panel-renderer__control panel-renderer__control--secondary">
      <button
        class="panel-renderer__enable-button"
        type="button"
        onclick={() => {
          secondaryActivated = true;
        }}
      >
        {$t(descriptor.secondaryControl!.enabled!.button)}
      </button>
    </div>
  {/if}
  {#if secondaryShouldRender && secondarySlider}
    <div class="panel-renderer__control panel-renderer__control--secondary">
      <PanelSlider
        control={secondarySlider}
        {editable}
        {facts}
        {vars}
        {selections}
        {onSelectionChange}
      />
    </div>
  {/if}
  {#if secondaryShouldRender && secondaryDiceLine}
    <div class="panel-renderer__control panel-renderer__control--secondary">
      <PanelDiceLine
        control={secondaryDiceLine}
        {editable}
        {facts}
        {vars}
        {selections}
        {onSelectionChange}
      />
    </div>
  {/if}
  {#if secondaryShouldRender && secondarySelect}
    <div class="panel-renderer__control panel-renderer__control--secondary">
      <PanelSelect
        control={secondarySelect}
        {editable}
        {facts}
        {vars}
        {selections}
        {onSelectionChange}
      />
    </div>
  {/if}
  {#each textInfos as text, i (i)}
    <div class="panel-renderer__information panel-renderer__information--text">{text}</div>
  {/each}
  {#each countdownInfos as info (info.index)}
    <div
      class="panel-renderer__markers"
      role="img"
      aria-label="{info.filled} of {info.total} remaining"
    >
      {#each info.filledIndices as i (i)}
        <span class="panel-renderer__marker panel-renderer__marker--filled" aria-hidden="true"
        ></span>
      {/each}
      {#each info.emptyIndices as i (i)}
        <span class="panel-renderer__marker panel-renderer__marker--empty" aria-hidden="true"
        ></span>
      {/each}
    </div>
  {/each}
  {#if matchingAnnotations.length > 0}
    <div class="panel-renderer__annotations" role="note">
      {#each matchingAnnotations as annotation (annotation.key)}
        <span class="panel-renderer__annotation">{$t(annotation.key)}</span>
      {/each}
    </div>
  {/if}
  {#if visibleFollowups.length > 0}
    <div class="panel-renderer__followups" role="group">
      {#each visibleFollowups as followup (followup.button)}
        <button
          type="button"
          class="panel-renderer__followup-button"
          onclick={() => {
            if (followup.type === 'effect') onFollowup?.(followup.addRule.rule);
          }}
        >
          {$t(followup.button)}
        </button>
      {/each}
    </div>
  {/if}
  {#if hasActions}
    <div class="panel-renderer__actions" role="group" aria-label={$t('play.plan.actions')}>
      {#if onMoveUp}
        <button
          type="button"
          class="panel-renderer__button panel-renderer__button--move-up"
          disabled={!canMoveUp}
          onclick={onMoveUp}
          aria-label={$t('play.plan.moveUp')}
          title={$t('play.plan.moveUp')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
      {/if}
      {#if onMoveDown}
        <button
          type="button"
          class="panel-renderer__button panel-renderer__button--move-down"
          disabled={!canMoveDown}
          onclick={onMoveDown}
          aria-label={$t('play.plan.moveDown')}
          title={$t('play.plan.moveDown')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      {/if}
      {#if onRemove}
        <button
          type="button"
          class="panel-renderer__button panel-renderer__button--remove"
          onclick={handleRemoveClick}
          aria-label={$t(removeLabel)}
          title={$t(removeLabel)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .panel-renderer {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .panel-renderer:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer--editable {
    cursor: default;
  }

  .panel-renderer--editable:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  /* Warning indicator positioned at top-left as overlay */
  .panel-renderer :global(.warning-indicator) {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 2;
  }

  .panel-renderer__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .panel-renderer__title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  /* Actions positioned at top-right inside panel */
  .panel-renderer__actions {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    z-index: 1;
  }

  .panel-renderer__button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer__button:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .panel-renderer__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .panel-renderer__button svg {
    width: 1rem;
    height: 1rem;
  }

  .panel-renderer__button--remove:hover:not(:disabled) {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    border-color: var(--md-sys-color-error);
  }

  .panel-renderer__control {
    padding-top: var(--spacing-xs);
  }

  .panel-renderer__control--secondary {
    border-top: 1px solid var(--md-sys-color-outline-variant);
    margin-top: var(--spacing-xs);
    padding-top: var(--spacing-sm);
  }

  .panel-renderer__enable-button {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-primary);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer__enable-button:hover {
    background: var(--md-sys-color-surface-container);
  }

  .panel-renderer__markers {
    display: flex;
    flex-direction: row;
    gap: var(--spacing-xs);
  }

  .panel-renderer__marker {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .panel-renderer__marker--filled {
    background: var(--md-sys-color-primary);
  }

  .panel-renderer__marker--empty {
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
  }

  .panel-renderer__annotations {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xs);
  }

  .panel-renderer__annotation {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--md-sys-color-on-primary-container);
    background: var(--md-sys-color-primary-container);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    line-height: var(--line-height-md);
  }

  .panel-renderer__followups {
    display: flex;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xs);
  }

  .panel-renderer__followup-button {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-primary);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer__followup-button:hover {
    background: var(--md-sys-color-surface-container);
  }
</style>
