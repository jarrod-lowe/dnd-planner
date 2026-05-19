<script lang="ts">
  import { t } from '$lib/i18n';
  import PlanRow from './PlanRow.svelte';
  import AddRowPicker from './AddRowPicker.svelte';
  import { groupChoicesByVerb } from '$lib/play/groupChoicesByVerb';
  import type { Step } from '$lib/play/types';
  import type { AvailableRuleEntry, Annotation, Facts, Verb } from '$lib/rules-engine';

  interface Props {
    steps: Step[];
    entries: AvailableRuleEntry[];
    facts: Facts;
    activeAnnotations: Annotation[];
    onAddStep: (entry: AvailableRuleEntry) => void;
    onRemoveStep: (id: string) => void;
    onMoveStep: (id: string, direction: 'up' | 'down') => void;
    onUpdateStepSelections: (id: string, selections: Record<string, unknown>) => void;
    onSwapStepRule: (id: string, entry: AvailableRuleEntry) => void;
    onEndTurn: () => void;
  }

  let {
    steps,
    entries,
    facts,
    activeAnnotations,
    onAddStep,
    onRemoveStep,
    onMoveStep,
    onUpdateStepSelections,
    onSwapStepRule,
    onEndTurn
  }: Props = $props();

  let showIllegal = $state(false);

  const entryById = $derived.by(() => {
    const result: Record<string, AvailableRuleEntry> = {};
    for (const entry of entries) {
      result[entry.rule.id] = entry;
    }
    return result;
  });

  const stepsWithRules = $derived(
    steps.map((step) => {
      const entry = entryById[step.ruleId];
      const rule = entry
        ? { ...entry.rule, selections: { ...entry.rule.selections, ...step.modelSelections } }
        : null;
      return { step, rule, entry: entry ?? null };
    })
  );

  // Group entries by verb for computing alternatives
  const verbGroups = $derived(groupChoicesByVerb(entries));
  const verbGroupMap = $derived(new Map(verbGroups.map((g) => [g.verb, g])));

  function getAlternatives(verb: Verb, currentRuleId: string): AvailableRuleEntry[] {
    const group = verbGroupMap.get(verb);
    if (!group) return [];
    return group.entries.filter((e) => e.rule.id !== currentRuleId);
  }
</script>

<section class="plan-stack" aria-label={$t('play.planStack.title')}>
  <h2 class="plan-stack__title">{$t('play.planStack.title')}</h2>

  <div class="plan-stack__rows" role="list">
    {#each stepsWithRules as { step, rule, entry }, i (step.id)}
      {#if rule && entry}
        <div role="listitem">
          <PlanRow
            {step}
            {rule}
            {entry}
            {facts}
            {activeAnnotations}
            alternatives={getAlternatives(step.verb, step.ruleId)}
            canMoveUp={i > 0}
            canMoveDown={i < steps.length - 1}
            onSelectionChange={(selections) => onUpdateStepSelections(step.id, selections)}
            onRemove={() => onRemoveStep(step.id)}
            onMoveUp={() => onMoveStep(step.id, 'up')}
            onMoveDown={() => onMoveStep(step.id, 'down')}
            onSwapAlternative={(alt) => onSwapStepRule(step.id, alt)}
          />
        </div>
      {/if}
    {/each}
  </div>

  <AddRowPicker
    {entries}
    {showIllegal}
    {onAddStep}
    onToggleShowIllegal={() => (showIllegal = !showIllegal)}
  />

  <div class="plan-stack__footer">
    <button
      type="button"
      class="plan-stack__end-turn"
      disabled={steps.length === 0}
      onclick={onEndTurn}
    >
      {$t('play.plan.endTurn')}
    </button>
  </div>
</section>

<style>
  .plan-stack {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
  }

  .plan-stack__title {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    margin: 0;
    letter-spacing: var(--letter-spacing-wide);
  }

  .plan-stack__rows {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .plan-stack__footer {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--spacing-xs);
  }

  .plan-stack__end-turn {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border: none;
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-lg);
    cursor: pointer;
    min-height: 2.75rem;
    transition:
      background-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .plan-stack__end-turn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .plan-stack__end-turn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .plan-stack__end-turn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
