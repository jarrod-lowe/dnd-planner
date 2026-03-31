<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { playStore } from '$lib/play/playStore.svelte';
  import PlayLayout from '../play/PlayLayout.svelte';
  import StatsColumn from '../play/StatsColumn.svelte';
  import ChoicesColumn from '../play/ChoicesColumn.svelte';
  import PlanColumn from '../play/PlanColumn.svelte';
  import EffectsColumn from '../play/EffectsColumn.svelte';
  import type { Character } from '$lib/character/types';
  import type { AvailableRuleEntry } from '$lib/rules-engine';

  interface Props {
    character: Character;
    onBack: () => void;
  }

  let { character, onBack }: Props = $props();

  // Get available rules from engine output
  const availableRules = $derived(playStore.state.engineOutput?.availableRules ?? []);

  // Get current effects (committed + newly advertised)
  const currentEffects = $derived([
    ...playStore.state.effects,
    ...(playStore.state.engineOutput?.effects ?? [])
  ]);

  // Handle choice tap - add to plan
  function handleChoiceTap(entry: AvailableRuleEntry): void {
    playStore.addToPlan(entry.rule);
  }

  // Handle plan item controls
  function handleMoveUp(instanceId: string): void {
    playStore.movePlanItem(instanceId, 'up');
  }

  function handleMoveDown(instanceId: string): void {
    playStore.movePlanItem(instanceId, 'down');
  }

  function handleRemove(instanceId: string): void {
    playStore.removeFromPlan(instanceId);
  }

  // Handle selection changes from planned items
  function handleSelectionChange(instanceId: string, selections: Record<string, unknown>): void {
    playStore.updateSelections(instanceId, selections);
  }

  // Load rule groups on mount
  onMount(() => {
    playStore.loadRuleGroups(character.characterId);
  });
</script>

<div class="play-character">
  <button
    class="play-character__back"
    onclick={() => onBack()}
    aria-label={$t('play.backToSelection')}
  >
    {$t('play.backToSelection')}
  </button>

  {#if playStore.state.isLoadingRuleGroups}
    <div class="play-character__loading">{$t('play.choices.loading')}</div>
  {:else if playStore.state.ruleGroupError}
    <div class="play-character__error">{$t('play.error.loadRuleGroups')}</div>
  {:else}
    <PlayLayout>
      {#snippet stats()}
        <StatsColumn stats={playStore.state.stats} facts={playStore.state.facts} />
      {/snippet}
      {#snippet choices()}
        <ChoicesColumn
          entries={availableRules}
          facts={playStore.state.facts}
          isLoading={playStore.state.isEvaluating}
          onChoiceTap={handleChoiceTap}
        />
      {/snippet}
      {#snippet plan()}
        <PlanColumn
          items={playStore.state.plannedItems}
          facts={playStore.state.facts}
          onSelectionChange={handleSelectionChange}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onRemove={handleRemove}
          onEndTurn={() => playStore.endTurn()}
        />
      {/snippet}
      {#snippet effects()}
        <EffectsColumn effects={currentEffects} />
      {/snippet}
    </PlayLayout>
  {/if}
</div>

<style>
  .play-character {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .play-character__back {
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md);
    min-height: 2.5rem;
    transition: background-color var(--transition-fast);
  }

  .play-character__back:hover {
    background: var(--md-sys-color-surface-container);
  }

  .play-character__back:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .play-character__loading,
  .play-character__error {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
  }

  .play-character__error {
    color: var(--md-sys-color-error);
  }
</style>
