<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { playStore } from '$lib/play/playStore.svelte';
  import { uiPrefsStore } from '$lib/ui/uiPrefsStore.svelte';
  import PlayLayout from '../play/PlayLayout.svelte';
  import IntentTopBar from '../play/IntentTopBar.svelte';
  import ActiveStateStrip from '../play/ActiveStateStrip.svelte';
  import PlanStack from '../play/PlanStack.svelte';
  import Ledger from '../play/Ledger.svelte';
  import StatsColumn from '../play/StatsColumn.svelte';
  import ChoicesColumn from '../play/ChoicesColumn.svelte';
  import PlanColumn from '../play/PlanColumn.svelte';
  import EffectsColumn from '../play/EffectsColumn.svelte';
  import type { Character } from '$lib/character/types';
  import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';
  import { getConcentrationEffectName } from '$lib/play/effectUtils';

  interface Props {
    character: Character;
    email: string | null;
    onLogout: () => void;
    version?: string;
    onBack?: () => void;
    onManageRules?: () => void;
    showManageRules?: boolean;
    onViewFacts?: () => void;
    showViewFacts?: boolean;
    onDownloadCharacter?: () => void;
    showDownloadCharacter?: boolean;
  }

  let {
    character,
    email,
    onLogout,
    version = 'v0.0.0',
    onBack,
    onManageRules,
    showManageRules = false,
    onViewFacts,
    showViewFacts = false,
    onDownloadCharacter,
    showDownloadCharacter = false
  }: Props = $props();

  let showIllegal = $state(false);
  let showHiddenEffects = $state(false);

  // Get available rules from engine output
  const availableRules = $derived(playStore.state.engineOutput?.availableRules ?? []);

  // Collect active annotations from engine output
  const activeAnnotations = $derived(playStore.state.engineOutput?.annotations ?? []);

  // Get current effects (committed + newly advertised), deduplicated by id.
  // Committed-first ordering; advertised version preferred (has runtime vars like countDown).
  const currentEffects = $derived.by(() => {
    const committed = playStore.state.effects;
    const advertised = playStore.state.engineOutput?.effects ?? [];
    const advertisedById = new Array<string>();
    for (const e of advertised) {
      advertisedById.push(e.id);
    }
    const result: Rule[] = [];
    for (const effect of committed) {
      const idx = advertisedById.indexOf(effect.id);
      const chosen = idx >= 0 ? advertised[idx] : effect;
      result.push(chosen);
    }
    const committedIds = committed.map((e) => e.id);
    for (const effect of advertised) {
      if (!committedIds.includes(effect.id)) {
        result.push(effect);
      }
    }
    return result;
  });

  const concentrationName = $derived.by(() => {
    const key = getConcentrationEffectName(currentEffects);
    return key ? $t(key) : undefined;
  });

  const committedEffectIds = $derived(playStore.state.effects.map((e) => e.id));

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
  {#if uiPrefsStore.state.layout === 'intent'}
    <IntentTopBar
      {character}
      stats={playStore.state.stats}
      facts={playStore.state.facts}
      {email}
      {onLogout}
      {version}
      {onBack}
      {onManageRules}
      {showManageRules}
      {onViewFacts}
      {showViewFacts}
      {onDownloadCharacter}
      {showDownloadCharacter}
      currentLayout={uiPrefsStore.state.layout}
      onSwitchLayout={(l) => uiPrefsStore.setLayout(l)}
      concentrationEffectName={concentrationName}
    />
    {#if playStore.state.isLoadingRuleGroups}
      <div class="play-character__loading">{$t('play.choices.loading')}</div>
    {:else if playStore.state.ruleGroupError}
      <div class="play-character__error">{$t('play.error.loadRuleGroups')}</div>
    {:else}
      <div class="play-character__intent-body">
        <ActiveStateStrip
          effects={currentEffects}
          facts={playStore.state.facts}
          concentrationEffectName={concentrationName}
          {committedEffectIds}
          {showHiddenEffects}
          onDismissEffect={handleRemoveEffect}
          onToggleHiddenEffects={() => (showHiddenEffects = !showHiddenEffects)}
        />
        <PlanStack
          items={playStore.state.plannedItems}
          entries={availableRules}
          facts={playStore.state.facts}
          {activeAnnotations}
          onAddToPlan={handleChoiceTap}
          onRemoveFromPlan={handleRemove}
          onMovePlanItem={(id, dir) => playStore.movePlanItem(id, dir)}
          onSelectionChange={handleSelectionChange}
          onSwapPlanItemRule={(id, entry) => playStore.swapPlanItemRule(id, entry)}
          onEndTurn={() => playStore.endTurn()}
        />
        <Ledger
          stats={playStore.state.stats}
          facts={playStore.state.facts}
          status={playStore.state.engineOutput?.status}
        />
      </div>
    {/if}
  {:else if playStore.state.isLoadingRuleGroups}
    <div class="play-character__loading">{$t('play.choices.loading')}</div>
  {:else if playStore.state.ruleGroupError}
    <div class="play-character__error">{$t('play.error.loadRuleGroups')}</div>
  {:else}
    <PlayLayout>
      {#snippet stats()}
        <StatsColumn stats={playStore.state.stats} facts={playStore.state.facts} />
      {/snippet}
      {#snippet choicesHeaderAction()}
        <button
          type="button"
          class="play-character__toggle-illegal"
          onclick={() => (showIllegal = !showIllegal)}
          aria-pressed={showIllegal}
          aria-label={showIllegal ? $t('play.choices.hideIllegal') : $t('play.choices.showIllegal')}
        >
          {#if showIllegal}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
              />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.35-3.01-3.01-3.01l-.16.02z"
              />
            </svg>
          {/if}
        </button>
      {/snippet}
      {#snippet choices()}
        <ChoicesColumn
          entries={availableRules}
          facts={playStore.state.facts}
          isLoading={playStore.state.isEvaluating}
          {showIllegal}
          {activeAnnotations}
          onChoiceTap={handleChoiceTap}
        />
      {/snippet}
      {#snippet plan()}
        <PlanColumn
          items={playStore.state.plannedItems}
          facts={playStore.state.facts}
          {activeAnnotations}
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
          facts={playStore.state.facts}
          committedCount={playStore.state.effects.length}
          {showHiddenEffects}
          onRemoveEffect={handleRemoveEffect}
          onToggleHiddenEffects={() => (showHiddenEffects = !showHiddenEffects)}
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

  .play-character__intent-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .play-character__intent-body > :global(.active-state-strip) {
    flex-shrink: 0;
    max-height: 8.5rem;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .play-character__intent-body > :global(.plan-stack) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .play-character__intent-body > :global(.ledger) {
    flex-shrink: 0;
  }

  .play-character__toggle-illegal {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
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

  .play-character__toggle-illegal svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .play-character__toggle-illegal:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .play-character__toggle-illegal:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .play-character__toggle-illegal[aria-pressed='true'] {
    color: var(--md-sys-color-primary);
  }
</style>
