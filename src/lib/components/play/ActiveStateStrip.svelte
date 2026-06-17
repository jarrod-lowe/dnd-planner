<script lang="ts">
  import { t } from '$lib/i18n';
  import EffectChip from './EffectChip.svelte';
  import ReminderPopover from './ReminderPopover.svelte';
  import RulesPane from './details/RulesPane.svelte';
  import { getChipState, isConcentrationEffect, isHiddenEffect } from '$lib/play/effectUtils';
  import { EYE_OPEN_PATH, EYE_OFF_PATH } from '$lib/icons';
  import { peekDetail, getDetail } from '$lib/details/index';
  import type { ItemDetail } from '$lib/details/types';
  import type { Rule } from '$lib/rules-engine';
  import type { Facts } from '$lib/rules-engine';

  interface Props {
    effects: Rule[];
    facts: Facts;
    concentrationEffectName?: string;
    committedEffectIds: string[];
    showHiddenEffects?: boolean;
    onDismissEffect?: (ruleId: string) => void;
    onToggleHiddenEffects?: () => void;
  }

  let {
    effects,
    facts,
    concentrationEffectName,
    committedEffectIds,
    showHiddenEffects = false,
    onDismissEffect,
    onToggleHiddenEffects
  }: Props = $props();

  const visibleEffects = $derived(
    showHiddenEffects ? effects : effects.filter((e) => !isHiddenEffect(e))
  );

  let reminderEffect: Rule | null = $state(null);
  let reminderAnchor: DOMRect | null = $state(null);

  let rulesEffect: Rule | null = $state(null);
  let rulesDetail: ItemDetail | null | undefined = $state(undefined);
  let rulesLoading = $state(false);

  $effect(() => {
    if (rulesEffect && !visibleEffects.some((e) => e.id === rulesEffect!.id)) {
      rulesEffect = null;
      rulesDetail = undefined;
      rulesLoading = false;
    }
  });

  function getDetailKey(effect: Rule): string {
    const ui = effect.ui as Record<string, unknown> | undefined;
    return (ui?.detailKey as string | undefined) ?? '';
  }

  function hasDetail(effect: Rule): boolean {
    const key = getDetailKey(effect);
    return key !== '' && peekDetail(key) !== null;
  }

  function getEffectName(effect: Rule): string {
    const ui = effect.ui as Record<string, unknown> | undefined;
    const nameKey = ui?.name;
    if (typeof nameKey !== 'string') return effect.id;
    return $t(nameKey);
  }

  function handleChipClick(effect: Rule) {
    const key = getDetailKey(effect);
    if (!key) return;
    const cached = peekDetail(key);
    if (cached === null) return; // known-absent
    if (cached) {
      rulesDetail = cached;
      rulesEffect = effect;
      rulesLoading = false;
    } else {
      rulesEffect = effect;
      rulesLoading = true;
      const capturedEffect = effect;
      getDetail(key).then((d) => {
        if (rulesEffect !== capturedEffect) return;
        rulesDetail = d;
        rulesLoading = false;
        if (!d) {
          rulesEffect = null;
        }
      });
    }
  }

  function exitRulesMode() {
    rulesEffect = null;
    rulesDetail = undefined;
    rulesLoading = false;
  }

  function handleReminder(effect: Rule, event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    reminderAnchor = target.getBoundingClientRect();
    reminderEffect = effect;
  }

  function handleReminderOutcome(_outcome: 'pass' | 'fail') {
    void _outcome;
    reminderEffect = null;
    reminderAnchor = null;
  }

  function handleReminderClose() {
    reminderEffect = null;
    reminderAnchor = null;
  }
</script>

<section class="active-state-strip" aria-label={$t('play.activeState.title')}>
  {#if !rulesEffect}
    <h2 class="active-state-strip__header">
      <span class="active-state-strip__title">{$t('play.activeState.title')}</span>
      {#if visibleEffects.length > 0}
        <span class="active-state-strip__count">
          {$t('play.activeState.standing', { count: visibleEffects.length })}
        </span>
      {/if}
      {#if onToggleHiddenEffects}
        <button
          type="button"
          class="active-state-strip__toggle-hidden"
          onclick={onToggleHiddenEffects}
          aria-pressed={showHiddenEffects}
          aria-label={showHiddenEffects
            ? $t('play.activeState.hideHidden')
            : $t('play.activeState.showHidden')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={showHiddenEffects ? EYE_OPEN_PATH : EYE_OFF_PATH} />
          </svg>
        </button>
      {/if}
    </h2>
  {/if}

  {#if visibleEffects.length === 0}
    <p class="active-state-strip__placeholder">{$t('play.activeState.placeholder')}</p>
  {:else if rulesEffect}
    {#if rulesLoading}
      <div class="rules-shell">
        <button type="button" class="rules-rail" aria-pressed="true" onclick={exitRulesMode}>
          <span class="rules-rail__label">
            {getEffectName(rulesEffect)}
          </span>
          <span class="rules-rail__return">
            {$t('play.planRow.flipReturn')}
          </span>
        </button>
        <div class="active-state-strip__rules-loading" aria-live="polite">
          {$t('rules.loadingDetails')}
        </div>
      </div>
    {:else if rulesDetail}
      <RulesPane detail={rulesDetail} name={getEffectName(rulesEffect)} onFlip={exitRulesMode} />
    {/if}
  {:else}
    <div class="active-state-strip__chips" role="list">
      {#each visibleEffects as effect (effect.id)}
        {@const chipState = getChipState(effect, facts)}
        {@const isConcLink = concentrationEffectName != null && isConcentrationEffect(effect)}
        {@const canFlip = hasDetail(effect)}
        <EffectChip
          {effect}
          {facts}
          state={chipState}
          isConcentrationLink={isConcLink}
          {canFlip}
          onDismiss={onDismissEffect && committedEffectIds.includes(effect.id)
            ? () => onDismissEffect(effect.id)
            : undefined}
          onReminder={chipState === 'pending'
            ? (e: MouseEvent) => handleReminder(effect, e)
            : undefined}
          onShowRules={canFlip ? () => handleChipClick(effect) : undefined}
        />
      {/each}
    </div>
  {/if}

  {#if reminderEffect && reminderAnchor}
    <ReminderPopover
      effect={reminderEffect}
      {facts}
      anchorRect={reminderAnchor}
      onOutcome={handleReminderOutcome}
      onClose={handleReminderClose}
    />
  {/if}
</section>

<style>
  .active-state-strip {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    min-height: 3rem;
  }

  .active-state-strip :global(.rules-shell) {
    overflow-y: auto;
    max-height: calc(50vh - 3rem);
  }

  .active-state-strip :global(.rules-rail) {
    flex-shrink: 1;
  }

  .active-state-strip :global(.rules-pane) {
    max-height: none;
    overflow-y: visible;
  }

  .active-state-strip__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
  }

  .active-state-strip__count {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--md-sys-color-on-surface-variant);
  }

  .active-state-strip__toggle-hidden {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-left: auto;
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

  .active-state-strip__toggle-hidden svg {
    width: 1rem;
    height: 1rem;
  }

  .active-state-strip__toggle-hidden:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .active-state-strip__toggle-hidden:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .active-state-strip__toggle-hidden[aria-pressed='true'] {
    color: var(--md-sys-color-primary);
  }

  .active-state-strip__chips {
    display: flex;
    gap: var(--spacing-sm);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    padding-bottom: var(--spacing-xs);
  }

  .active-state-strip__chips > :global(*) {
    scroll-snap-align: start;
  }

  .active-state-strip__placeholder {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-outline);
    margin: 0;
    font-style: italic;
  }

  .active-state-strip__rules-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
  }
</style>
