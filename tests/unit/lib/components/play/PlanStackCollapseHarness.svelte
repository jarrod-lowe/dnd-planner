<script lang="ts">
  import PlanStack from '$lib/components/play/PlanStack.svelte';
  import type { PlannedItem } from '$lib/play/types';
  import type { AvailableRuleEntry, Facts, Annotation } from '$lib/rules-view';

  interface Props {
    entries: AvailableRuleEntry[];
  }

  let { entries }: Props = $props();

  // The plan the player is building: it starts empty, and the test pushes rows
  // onto it the way PlayCharacterMode does when a picker adds a step.
  let items = $state<PlannedItem[]>([]);

  export function addItem(item: PlannedItem) {
    items = [...items, item];
  }

  const noop = () => {};
</script>

<PlanStack
  {items}
  {entries}
  facts={{} as Facts}
  activeAnnotations={[] as Annotation[]}
  onAddToPlan={noop}
  onRemoveFromPlan={noop}
  onMovePlanItem={noop}
  onSelectionChange={noop}
  onSwapPlanItemRule={noop}
  onEndTurn={noop}
/>
