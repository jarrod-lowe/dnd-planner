<script lang="ts">
  import DamageTypeIcon from './DamageTypeIcon.svelte';
  import { t } from '$lib/i18n';
  import type { RollResult } from './types';

  interface Props {
    title: string;
    rollType: string;
    result: RollResult;
    modifiers?: string[];
    damageTypeKey?: string;
  }

  let { title, rollType, result, modifiers, damageTypeKey }: Props = $props();

  function natClass(natural: number): string {
    if (result.sides === 20 && natural === 20) return 'dice-toast__nat--crit';
    if (result.sides === 20 && natural === 1) return 'dice-toast__nat--fumble';
    return '';
  }

  const isAdvDisadv = $derived(result.mode === 'advantage' || result.mode === 'disadvantage');
  const isGWF = $derived(result.gwfFloor !== undefined);
  const hasBonus = $derived(result.bonus !== undefined && result.bonus !== 0);
</script>

<div class="dice-toast" role="status">
  <div class="dice-toast__title">
    <span class="dice-toast__name">{title}</span>
    <span class="dice-toast__separator"> — </span>
    <span class="dice-toast__roll-type">{rollType}</span>
  </div>

  <div class="dice-toast__detail">
    {#if isAdvDisadv}
      <span class="dice-toast__paren">(</span>
      <span class="dice-toast__kept"
        ><span class={natClass(result.natural)}>{result.natural}</span></span
      >
      <span class="dice-toast__paren"> | </span>
      <span class="dice-toast__dropped"
        ><s><span class={natClass(result.droppedRoll!)}>{result.droppedRoll}</span></s></span
      >
      <span class="dice-toast__paren">)</span>
      {#if hasBonus}
        {#if result.bonus! > 0}
          <span class="dice-toast__bonus"> + {result.bonus}</span>
        {:else}
          <span class="dice-toast__bonus"> − {Math.abs(result.bonus!)}</span>
        {/if}
      {/if}
      <span class="dice-toast__equals"> = </span>
      <span class="dice-toast__total">{result.total}</span>
    {:else if isGWF}
      <span class="dice-toast__paren">(</span>
      <span class="dice-toast__dropped"><s>{result.gwfFloor}</s></span>
      <span class="dice-toast__paren"> | </span>
      <span class="dice-toast__kept">{result.natural}</span>
      <span class="dice-toast__paren">)</span>
      {#if hasBonus}
        {#if result.bonus! > 0}
          <span class="dice-toast__bonus"> + {result.bonus}</span>
        {:else}
          <span class="dice-toast__bonus"> − {Math.abs(result.bonus!)}</span>
        {/if}
      {/if}
      <span class="dice-toast__equals"> = </span>
      <span class="dice-toast__total">{result.total}</span>
    {:else if hasBonus}
      <span class={natClass(result.natural)}
        >{result.rolls ? result.rolls.join(' + ') : result.natural}</span
      >
      {#if result.bonus! > 0}
        <span class="dice-toast__bonus"> + {result.bonus}</span>
      {:else}
        <span class="dice-toast__bonus"> − {Math.abs(result.bonus!)}</span>
      {/if}
      <span class="dice-toast__equals"> = </span>
      <span class="dice-toast__total">{result.total}</span>
    {:else}
      <span class={natClass(result.natural)}
        >{result.rolls ? result.rolls.join(' + ') : result.natural}</span
      >
    {/if}

    {#if damageTypeKey}
      <span class="dice-toast__damage-icon">
        <DamageTypeIcon type={damageTypeKey} />
      </span>
      <span class="dice-toast__damage-name">{$t(`damage-type.${damageTypeKey}`)}</span>
    {/if}
  </div>

  {#if modifiers && modifiers.length > 0}
    <div class="dice-toast__modifiers">{modifiers.join('; ')}</div>
  {/if}
</div>

<style>
  .dice-toast {
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-body);
    min-width: 200px;
  }

  .dice-toast__title {
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    font-size: var(--font-size-sm);
  }

  .dice-toast__separator {
    color: var(--md-sys-color-on-surface-variant);
  }

  .dice-toast__roll-type {
    color: var(--md-sys-color-on-surface-variant);
  }

  .dice-toast__detail {
    color: var(--md-sys-color-on-surface-variant);
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-xs);
    display: flex;
    align-items: center;
    gap: 0;
    flex-wrap: wrap;
  }

  .dice-toast__total {
    font-weight: 700;
    color: var(--md-sys-color-primary);
  }

  .dice-toast__bonus {
    color: var(--md-sys-color-on-surface-variant);
  }

  .dice-toast__equals {
    color: var(--md-sys-color-on-surface-variant);
  }

  .dice-toast__dropped s {
    opacity: 0.5;
  }

  .dice-toast__nat--crit {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border-radius: 999px;
    padding: 0 0.375rem;
    font-weight: 700;
  }

  .dice-toast__nat--fumble {
    background: var(--md-sys-color-error);
    color: var(--md-sys-color-on-error);
    border-radius: 999px;
    padding: 0 0.375rem;
    font-weight: 700;
  }

  .dice-toast__modifiers {
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-on-surface-variant);
    font-style: italic;
    margin-top: var(--spacing-xs);
  }

  .dice-toast__damage-icon {
    display: inline-flex;
    align-items: center;
    width: 1rem;
    height: 1rem;
    color: var(--md-sys-color-primary);
    margin-left: var(--spacing-xs);
  }

  .dice-toast__damage-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .dice-toast__damage-name {
    color: var(--md-sys-color-on-surface-variant);
    font-size: var(--font-size-xs);
    margin-left: 0.15rem;
  }

  .dice-toast__paren {
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
