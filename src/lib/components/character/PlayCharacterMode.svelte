<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { t } from '$lib/i18n';
  import { playStore } from '$lib/play/playStore.svelte';
  import IntentTopBar from '../play/IntentTopBar.svelte';
  import ActiveStateStrip from '../play/ActiveStateStrip.svelte';
  import PlanStack from '../play/PlanStack.svelte';
  import Ledger from '../play/Ledger.svelte';
  import type { Character } from '$lib/character/types';
  import type { AvailableRuleEntry } from '$lib/rules-view';
  import { getConcentrationEffectName, mergeActiveEffects } from '$lib/play/effectUtils';
  import { getCompanionView, setCompanionView } from '$lib/play/companionStore.svelte';
  import { getSubject } from '$lib/play/subjectUtils';

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

  let showHiddenEffects = $state(false);

  // Get available rules from engine output
  const availableRules = $derived(playStore.state.engineOutput?.availableRules ?? []);

  // Check for engine-level errors (cycles, evaluation failures)
  const hasEngineErrors = $derived(
    (playStore.state.engineOutput?.diagnostics.errors.length ?? 0) > 0
  );
  // The store puts the specific i18n code on the first error diagnostic.
  const engineErrorCode = $derived(
    playStore.state.engineOutput?.diagnostics.errors[0]?.code ?? 'play.error.engineCycle'
  );

  // Collect active annotations from engine output
  const activeAnnotations = $derived(playStore.state.engineOutput?.annotations ?? []);

  // Current effects: committed + this turn's advertised, deduped by id AND by
  // replacement key (mergeActiveEffects), so a planned key-replacement suppresses
  // the stale committed chip — mirroring the engine's key dedupe.
  const currentEffects = $derived.by(() =>
    mergeActiveEffects(playStore.state.effects, playStore.state.engineOutput?.effects ?? [])
  );

  const concentrationName = $derived.by(() => {
    const key = getConcentrationEffectName(currentEffects);
    return key ? $t(key) : undefined;
  });

  // Steed / companion detection
  const companionView = $derived(getCompanionView());
  const activeSubject = $derived(companionView === 'player' ? undefined : companionView);

  // Compute available subjects dynamically from entries and effects
  const availableSubjects = $derived.by(() => {
    const subjects = new SvelteSet<string>();
    for (const entry of availableRules) {
      const subject = getSubject(entry.rule);
      if (subject) subjects.add(subject);
    }
    for (const effect of currentEffects) {
      const subject = getSubject(effect);
      if (subject) subjects.add(subject);
    }
    return [...subjects];
  });

  // Auto-switch to player view when current subject is no longer available
  $effect(() => {
    if (activeSubject && !availableSubjects.includes(activeSubject)) {
      setCompanionView('player');
    }
  });

  const committedEffectIds = $derived(playStore.state.effects.map((e) => e.id));

  // Handle choice tap - add to plan
  function handleChoiceTap(entry: AvailableRuleEntry): void {
    playStore.addToPlan(entry.rule);
  }

  // Handle plan item controls
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
  <IntentTopBar
    {character}
    topBarEntries={playStore.state.topBarEntries}
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
    concentrationEffectName={concentrationName}
    {availableSubjects}
    {activeSubject}
    onSwitchSubject={(subject) => {
      if (subject === undefined) {
        setCompanionView('player');
      } else {
        setCompanionView(subject);
      }
    }}
  />
  {#if playStore.state.isLoadingRuleGroups}
    <div class="play-character__loading">{$t('play.choices.loading')}</div>
  {:else if playStore.state.ruleGroupError}
    <div class="play-character__error">{$t('play.error.loadRuleGroups')}</div>
  {:else}
    <div class="play-character__intent-body">
      {#if hasEngineErrors}
        <div class="play-character__engine-error" role="alert">{$t(engineErrorCode)}</div>
      {/if}
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
        onFollowup={(effect) => playStore.addFollowupEffect(effect)}
        onEndTurn={() => playStore.endTurn()}
      />
      <Ledger
        resourceEntries={playStore.state.resourceEntries}
        facts={playStore.state.facts}
        status={playStore.state.engineOutput?.status}
        effects={playStore.state.advertised}
        viewLabel={activeSubject ? `play.companion.${activeSubject}` : undefined}
        {activeSubject}
      />
    </div>
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

  .play-character__engine-error {
    flex-shrink: 0;
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-error-container);
    background: var(--md-sys-color-error-container);
    border-radius: var(--radius-sm);
    text-align: center;
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
</style>
