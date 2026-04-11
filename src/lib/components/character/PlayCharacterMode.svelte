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
  }

  let { character }: Props = $props();

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

  function handleRemoveEffect(ruleId: string): void {
    playStore.removeEffect(ruleId);
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
          onFollowup={(rule) => playStore.addFollowupEffect(rule)}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onRemove={handleRemove}
          onEndTurn={() => playStore.endTurn()}
        />
      {/snippet}
      {#snippet effects()}
        <EffectsColumn
          effects={currentEffects}
          committedCount={playStore.state.effects.length}
          onRemoveEffect={handleRemoveEffect}
        />
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
    min-height: 0;
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
