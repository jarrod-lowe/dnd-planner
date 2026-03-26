<script lang="ts">
  import ChoicePanel from './ChoicePanel.svelte';
  import type { PlannedItem } from '$lib/play/types';
  import type { Facts } from '$lib/rules-engine';

  interface Props {
    item: PlannedItem;
    facts?: Facts;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
  }

  let {
    item,
    facts = {},
    canMoveUp = true,
    canMoveDown = true,
    onSelectionChange,
    onMoveUp,
    onMoveDown,
    onRemove
  }: Props = $props();

  // Check if rule has illegal state set by activities
  const isIllegal = $derived(item.rule.varsRuntime?.illegal === 1);

  // Build diagnostics for illegal state
  const diagnostics = $derived(
    isIllegal ? [{ code: 'play.choices.illegal', severity: 'error' as const }] : []
  );
</script>

<div class="plan-item">
  <ChoicePanel
    entry={{ rule: item.rule, legal: !isIllegal, applicable: true, diagnostics }}
    editable={true}
    {facts}
    {onSelectionChange}
    showControls={true}
    {canMoveUp}
    {canMoveDown}
    {onMoveUp}
    {onMoveDown}
    {onRemove}
  />
</div>

<style>
  .plan-item {
    width: 100%;
    /* No background, border, padding - ChoicePanel handles visuals */
  }
</style>
