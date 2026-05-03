<script lang="ts">
  import ChoicePanel from './ChoicePanel.svelte';
  import type { PlannedItem } from '$lib/play/types';
  import type { Facts, Rule } from '$lib/rules-engine';
  import type { AnnotationDef } from '$lib/play/annotations';

  interface Props {
    item: PlannedItem;
    facts?: Facts;
    activeAnnotations?: AnnotationDef[];
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onFollowup?: (rule: Rule) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
  }

  let {
    item,
    facts = {},
    activeAnnotations = [],
    canMoveUp = true,
    canMoveDown = true,
    onSelectionChange,
    onFollowup,
    onMoveUp,
    onMoveDown,
    onRemove
  }: Props = $props();

  // Get errors array from varsRuntime
  const errors = $derived((item.rule.varsRuntime?.errors as string[] | undefined) || []);

  // Check if rule has errors (illegal state)
  const isIllegal = $derived(errors.length > 0);

  // Build diagnostics from error strings
  const diagnostics = $derived(errors.map((code) => ({ code, severity: 'error' as const })));
</script>

<div class="plan-item">
  <ChoicePanel
    entry={{ rule: item.rule, legal: !isIllegal, applicable: true, diagnostics }}
    editable={true}
    {facts}
    {activeAnnotations}
    {onSelectionChange}
    {onFollowup}
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
