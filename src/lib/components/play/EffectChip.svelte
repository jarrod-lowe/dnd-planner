<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    getDurationState,
    getEffectKind,
    getEffectDisplayValue,
    getEffectLevel
  } from '$lib/play/effectUtils';
  import type { Rule } from '$lib/rules-engine';
  import type { Facts } from '$lib/rules-engine';
  import type { ChipState } from '$lib/play/effectUtils';

  interface Props {
    effect: Rule;
    facts: Facts;
    state: ChipState;
    onDismiss?: () => void;
    onReminder?: (event: MouseEvent) => void;
    onShowRules?: () => void;
    canFlip?: boolean;
    isConcentrationLink?: boolean;
  }

  let {
    effect,
    facts,
    state,
    onDismiss,
    onReminder,
    onShowRules,
    canFlip = false,
    isConcentrationLink = false
  }: Props = $props();

  const kind = $derived(getEffectKind(effect));
  const duration = $derived(getDurationState(effect));

  const displayValue = $derived(getEffectDisplayValue(effect, facts));

  const effectName = $derived.by(() => {
    const ui = effect.ui as Record<string, unknown> | undefined;
    const nameKey = ui?.name;
    if (typeof nameKey !== 'string') return effect.id;
    if (displayValue !== null) return $t(nameKey, { score: displayValue });
    return $t(nameKey);
  });

  const kindLabel = $derived($t(`play.effectChip.kind.${kind}`));

  const pipCount = $derived(duration ? Math.min(duration.total, 10) : 0);

  const pips = $derived(Array.from({ length: pipCount }, (_, i) => i < (duration?.remaining ?? 0)));

  const level = $derived(getEffectLevel(effect, facts));
  const levelDot = $derived(
    level !== null
      ? level >= 2
        ? $t('play.topBar.proficientDotDouble')
        : level >= 1
          ? $t('play.topBar.proficientDotFull')
          : $t('play.topBar.proficientDotHalf')
      : null
  );

  const ariaLabel = $derived.by(() => {
    const durationText = duration
      ? $t('play.effectChip.durationLeft', { count: duration.remaining })
      : '';
    return $t('play.effectChip.ariaLabel', {
      name: effectName,
      kind: kindLabel,
      duration: durationText,
      state
    });
  });

  function handleDismiss(e: MouseEvent) {
    e.stopPropagation();
    onDismiss?.();
  }

  function handleReminder(e: MouseEvent) {
    e.stopPropagation();
    onReminder?.(e);
  }

  const stateClass = $derived(
    state === 'pending'
      ? 'effect-chip--pending'
      : state === 'expiring'
        ? 'effect-chip--expiring'
        : ''
  );
</script>

{#snippet chipContent()}
  {#if state === 'pending'}
    <button
      type="button"
      class="effect-chip__badge effect-chip__badge--pending"
      aria-label={$t('play.effectChip.reminder')}
      onclick={handleReminder}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="var(--md-sys-color-error-container)" />
        <text
          x="12"
          y="17"
          text-anchor="middle"
          fill="var(--md-sys-color-on-error-container)"
          font-size="16"
          font-weight="700"
          font-family="var(--font-body)">!</text
        >
      </svg>
    </button>
  {/if}

  {#if state === 'expiring'}
    <span class="effect-chip__badge effect-chip__badge--expiring" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 2h12v4l-4 4 4 4v4H6v-4l4-4-4-4V2z" />
        <line x1="6" y1="6" x2="18" y2="6" />
        <line x1="6" y1="18" x2="18" y2="18" />
      </svg>
    </span>
  {/if}

  <div class="effect-chip__header">
    <span class="effect-chip__kind-tag">{kindLabel}</span>
    {#if onDismiss}
      <button
        type="button"
        class="effect-chip__dismiss"
        aria-label={$t('play.effectChip.dismiss')}
        onclick={handleDismiss}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    {/if}
  </div>

  <div class="effect-chip__body">
    {#if isConcentrationLink}
      <svg
        class="effect-chip__chain-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
        />
      </svg>
    {/if}
    <span class="effect-chip__name">{effectName}</span>
    {#if canFlip}
      <span class="effect-chip__flip-hint" aria-hidden="true">↺</span>
    {/if}
    {#if levelDot !== null}
      <span class="effect-chip__level-dot" aria-hidden="true">{levelDot}</span>
    {/if}
  </div>

  {#if duration}
    <div class="effect-chip__footer">
      <div class="effect-chip__pips">
        {#each pips as filled, i (i)}
          <span class="effect-chip__pip" class:effect-chip__pip--filled={filled} aria-hidden="true"
          ></span>
        {/each}
      </div>
      <span class="effect-chip__duration-text">
        {$t('play.effectChip.durationLeft', { count: duration.remaining })}
      </span>
    </div>
  {/if}
{/snippet}

{#if canFlip}
  <button
    type="button"
    class="effect-chip {stateClass}"
    class:effect-chip--conc-link={isConcentrationLink}
    class:effect-chip--clickable={true}
    aria-label={ariaLabel}
    onclick={onShowRules}
  >
    {@render chipContent()}
  </button>
{:else}
  <div
    class="effect-chip {stateClass}"
    class:effect-chip--conc-link={isConcentrationLink}
    role="listitem"
    aria-label={ariaLabel}
  >
    {@render chipContent()}
  </div>
{/if}

<style>
  .effect-chip {
    position: relative;
    min-width: 11rem;
    max-width: 12.5rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    font-family: var(--font-body);
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  /* State: pending */
  .effect-chip--pending {
    background: var(--md-sys-color-surface-container-high);
    box-shadow: inset 0 0 0 100px
      color-mix(in srgb, var(--md-sys-color-error-container) 15%, transparent);
  }

  /* State: expiring */
  .effect-chip--expiring {
    background:
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 6px,
        color-mix(in srgb, var(--md-sys-color-outline-variant) 12%, transparent) 6px,
        color-mix(in srgb, var(--md-sys-color-outline-variant) 12%, transparent) 12px
      ),
      var(--md-sys-color-surface-container-high);
  }

  /* Concentration link */
  .effect-chip--conc-link {
    border-left: 3px solid var(--md-sys-color-primary);
  }

  /* Clickable for rules */
  .effect-chip--clickable {
    cursor: pointer;
  }

  .effect-chip--clickable:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .effect-chip--clickable:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  /* Header */
  .effect-chip__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Kind tag pill */
  .effect-chip__kind-tag {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    padding: 0.125rem var(--spacing-sm);
    border-radius: var(--radius-sm);
    line-height: 1.4;
  }

  /* Dismiss button */
  .effect-chip__dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: var(--spacing-xs);
    border-radius: var(--radius-md);
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .effect-chip__dismiss:hover {
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
  }

  .effect-chip__dismiss:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .effect-chip__dismiss svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* Body */
  .effect-chip__body {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-width: 0;
  }

  .effect-chip__chain-icon {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    color: var(--md-sys-color-primary);
  }

  .effect-chip__name {
    flex: 1;
    min-width: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .effect-chip__level-dot {
    flex-shrink: 0;
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-primary);
  }

  .effect-chip__flip-hint {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-outline);
    opacity: 0.7;
  }

  .effect-chip--clickable .effect-chip__flip-hint {
    color: var(--md-sys-color-primary);
    opacity: 1;
  }

  /* Footer */
  .effect-chip__footer {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .effect-chip__pips {
    display: flex;
    gap: 3px;
    align-items: center;
  }

  .effect-chip__pip {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    border: 1.5px solid var(--md-sys-color-outline-variant);
    background: transparent;
    flex-shrink: 0;
  }

  .effect-chip__pip--filled {
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }

  .effect-chip__duration-text {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
  }

  /* Badge (absolute, top-left) */
  .effect-chip__badge {
    position: absolute;
    top: -0.5rem;
    left: -0.5rem;
    z-index: 1;
  }

  .effect-chip__badge--pending {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.25rem;
    border-radius: var(--radius-full);
    transition: transform var(--transition-fast);
  }

  .effect-chip__badge--pending:hover {
    transform: scale(1.1);
  }

  .effect-chip__badge--pending:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .effect-chip__badge--pending svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .effect-chip__badge--expiring {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0.125rem;
    color: var(--md-sys-color-on-error-container);
    border-radius: var(--radius-full);
    background: var(--md-sys-color-error-container);
    pointer-events: none;
  }

  .effect-chip__badge--expiring svg {
    width: 1rem;
    height: 1rem;
  }
</style>
