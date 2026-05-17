<script lang="ts">
  import { t } from '$lib/i18n';
  import EffectChip from './EffectChip.svelte';
  import ReminderPopover from './ReminderPopover.svelte';
  import { getChipState, isConcentrationEffect } from '$lib/play/effectUtils';
  import type { Rule } from '$lib/rules-engine';
  import type { Facts } from '$lib/rules-engine';

  interface Props {
    effects: Rule[];
    facts: Facts;
    concentrationEffectName?: string;
    committedEffectIds: string[];
    onDismissEffect?: (ruleId: string) => void;
  }

  let { effects, facts, concentrationEffectName, committedEffectIds, onDismissEffect }: Props =
    $props();

  let reminderEffect: Rule | null = $state(null);
  let reminderAnchor: DOMRect | null = $state(null);

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
  <h2 class="active-state-strip__header">
    <span class="active-state-strip__title">{$t('play.activeState.title')}</span>
    {#if effects.length > 0}
      <span class="active-state-strip__count">
        {$t('play.activeState.standing', { count: effects.length })}
      </span>
    {/if}
  </h2>

  {#if effects.length === 0}
    <p class="active-state-strip__placeholder">{$t('play.activeState.placeholder')}</p>
  {:else}
    <div class="active-state-strip__chips" role="list">
      {#each effects as effect (effect.id)}
        {@const chipState = getChipState(effect, facts)}
        {@const isConcLink = concentrationEffectName != null && isConcentrationEffect(effect)}
        <EffectChip
          {effect}
          {facts}
          state={chipState}
          isConcentrationLink={isConcLink}
          onDismiss={onDismissEffect && committedEffectIds.includes(effect.id)
            ? () => onDismissEffect(effect.id)
            : undefined}
          onReminder={chipState === 'pending'
            ? (e: MouseEvent) => handleReminder(effect, e)
            : undefined}
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
</style>
