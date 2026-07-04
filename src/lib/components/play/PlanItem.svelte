<script lang="ts">
  import PanelRenderer from './PanelRenderer.svelte';
  import type { PlannedItem } from '$lib/play/types';
  import type { Facts } from '$lib/rules-engine';
  import type { EffectInstance } from '$lib/rules-engine-v2';
  import type { AnnotationDef } from '$lib/play/annotations';

  interface Props {
    item: PlannedItem;
    facts?: Facts;
    activeAnnotations?: AnnotationDef[];
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onFollowup?: (effect: EffectInstance) => void;
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
  <PanelRenderer
    entry={{ rule: item.rule, legal: !isIllegal, applicable: true, diagnostics }}
    editable={true}
    {facts}
    selections={item.rule.selections ?? {}}
    {activeAnnotations}
    {onSelectionChange}
    {onRemove}
    {canMoveUp}
    {canMoveDown}
    {onMoveUp}
    {onMoveDown}
    {onFollowup}
  />
</div>

<style>
  .plan-item {
    position: relative;
    width: 100%;
    /* No background, border, padding - PanelRenderer handles visuals */
  }
</style>
