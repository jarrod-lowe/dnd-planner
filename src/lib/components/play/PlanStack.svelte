<script lang="ts">
  import { t } from '$lib/i18n';
  import { SvelteMap } from 'svelte/reactivity';
  import { playStore } from '$lib/play/playStore.svelte';
  import { correctEntryForPlanItem } from '$lib/play/correctedEntry';
  import PlanRow from './PlanRow.svelte';
  import AddRowPicker from './AddRowPicker.svelte';
  import { groupChoicesByVerb } from '$lib/play/groupChoicesByVerb';
  import { getSubject } from '$lib/play/subjectUtils';
  import type { PlannedItem } from '$lib/play/types';
  import type { AvailableRuleEntry, Annotation, Facts, Verb } from '$lib/rules-engine';

  interface Props {
    items: PlannedItem[];
    entries: AvailableRuleEntry[];
    facts: Facts;
    activeAnnotations: Annotation[];
    onAddToPlan: (entry: AvailableRuleEntry) => void;
    onRemoveFromPlan: (instanceId: string) => void;
    onMovePlanItem: (instanceId: string, direction: 'up' | 'down') => void;
    onSelectionChange: (instanceId: string, selections: Record<string, unknown>) => void;
    onSwapPlanItemRule: (instanceId: string, entry: AvailableRuleEntry) => void;
    onEndTurn: () => void;
  }

  let {
    items,
    entries,
    facts,
    activeAnnotations,
    onAddToPlan,
    onRemoveFromPlan,
    onMovePlanItem,
    onSelectionChange,
    onSwapPlanItemRule,
    onEndTurn
  }: Props = $props();

  const entryById = $derived.by(() => {
    const result: Record<string, AvailableRuleEntry> = {};
    for (const entry of entries) {
      result[entry.rule.id] = entry;
    }
    return result;
  });

  const itemsWithEntries = $derived(
    items.map((item) => {
      const entry = entryById[item.originalRuleId ?? item.rule.id];
      if (!entry) return { item, entry: null };

      const hypothetical = playStore.getAlternativeEntries(item.instanceId);
      const hypEntry = hypothetical.find(
        (e) => e.rule.id === (item.originalRuleId ?? item.rule.id)
      );
      const baseEntry = hypEntry
        ? { ...entry, legal: hypEntry.legal, diagnostics: hypEntry.diagnostics }
        : entry;

      return { item, entry: correctEntryForPlanItem(baseEntry, item) };
    })
  );

  // Group entries by verb for computing alternatives
  const verbGroups = $derived(groupChoicesByVerb(entries));
  const verbGroupMap = $derived(new Map(verbGroups.map((g) => [g.verb, g])));

  // Group entries by subject for dynamic +ADD pickers
  const entriesBySubject = $derived.by(() => {
    const groups = new SvelteMap<string | undefined, AvailableRuleEntry[]>();
    for (const entry of entries) {
      const subject = getSubject(entry.rule);
      if (!groups.has(subject)) groups.set(subject, []);
      groups.get(subject)!.push(entry);
    }
    // Sort: undefined (player) first, then alphabetically
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      if (a === undefined) return -1;
      if (b === undefined) return 1;
      return a.localeCompare(b);
    });
    return sorted;
  });

  function getAlternatives(
    verb: Verb,
    currentRuleId: string,
    currentSubject: string | undefined
  ): AvailableRuleEntry[] {
    const group = verbGroupMap.get(verb);
    if (!group) return [];
    return group.entries.filter(
      (e) => e.rule.id !== currentRuleId && getSubject(e.rule) === currentSubject
    );
  }

  function correctedAlternatives(
    item: PlannedItem,
    baseAlts: AvailableRuleEntry[]
  ): AvailableRuleEntry[] {
    if (baseAlts.length === 0) return baseAlts;
    const hypothetical = playStore.getAlternativeEntries(item.instanceId);
    const hypById = new Map(hypothetical.map((e) => [e.rule.id, e]));
    return baseAlts.map((alt) => {
      const hypEntry = hypById.get(alt.rule.id);
      return hypEntry ? { ...alt, legal: hypEntry.legal, diagnostics: hypEntry.diagnostics } : alt;
    });
  }
</script>

<section class="plan-stack" aria-label={$t('play.planStack.title')}>
  <h2 class="plan-stack__title">{$t('play.planStack.title')}</h2>

  <div class="plan-stack__rows" role="list">
    {#each itemsWithEntries as { item, entry }, i (item.instanceId)}
      {#if entry}
        <div role="listitem">
          <PlanRow
            {item}
            {entry}
            {facts}
            {activeAnnotations}
            alternatives={correctedAlternatives(
              item,
              getAlternatives(item.verb, item.originalRuleId ?? '', getSubject(item.rule))
            )}
            canMoveUp={i > 0}
            canMoveDown={i < items.length - 1}
            onSelectionChange={(selections) => onSelectionChange(item.instanceId, selections)}
            onRemove={() => onRemoveFromPlan(item.instanceId)}
            onMoveUp={() => onMovePlanItem(item.instanceId, 'up')}
            onMoveDown={() => onMovePlanItem(item.instanceId, 'down')}
            onSwapAlternative={(alt) => onSwapPlanItemRule(item.instanceId, alt)}
          />
        </div>
      {/if}
    {/each}
  </div>

  {#each entriesBySubject as [subject, subjectEntries] (subject ?? 'player')}
    {#if subjectEntries.length > 0}
      <AddRowPicker
        entries={subjectEntries}
        onAddStep={onAddToPlan}
        sublabel={subject ? `play.addRow.${subject}Sublabel` : undefined}
      />
    {/if}
  {/each}

  <div class="plan-stack__footer">
    <button
      type="button"
      class="plan-stack__end-turn"
      disabled={items.length === 0}
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
