<script lang="ts">
  import PlanStack from '$lib/components/play/PlanStack.svelte';
  import { playStore } from '$lib/play/playStore.svelte';

  const noop = () => {};
</script>

<!-- Mirrors PlayCharacterMode's wiring: items/entries/facts read straight off the
     store's $state, so the test exercises the real reactivity path from
     performEvaluation()'s state replacement down to the plan rows. Annotations
     and the follow-up channel ride the same wiring — the Frightened LoS chip's
     committed gate is pinned through this path. -->
<PlanStack
  items={playStore.state.plannedItems}
  entries={playStore.state.engineOutput?.availableRules ?? []}
  facts={playStore.state.facts}
  activeAnnotations={playStore.state.engineOutput?.annotations ?? []}
  onAddToPlan={noop}
  onRemoveFromPlan={noop}
  onMovePlanItem={noop}
  onSelectionChange={noop}
  onSwapPlanItemRule={noop}
  onEndTurn={noop}
  onFollowup={noop}
/>
