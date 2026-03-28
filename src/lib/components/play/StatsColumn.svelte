<script lang="ts">
  import { t } from '$lib/i18n';

  interface Movement {
    current: number;
    max: number;
  }

  interface Actions {
    remaining: number;
    max: number;
  }

  interface SpellSlots {
    current: number;
    max: number;
  }

  interface Props {
    movement?: Movement;
    actions?: Actions;
    proficiency?: number;
    spellcasting?: { remaining: number; max: number };
    spellSlots?: Record<number, SpellSlots>;
  }

  let { movement, actions, proficiency, spellcasting, spellSlots }: Props = $props();
</script>

<div class="stats-column">
  {#if movement}
    <div class="stats-column__item">
      <span class="stats-column__label">{$t('play.stats.movement')}</span>
      <span class="stats-column__value"
        >{$t('play.stats.currentMax', { current: movement.current, max: movement.max })}</span
      >
    </div>
  {/if}
  {#if actions}
    <div class="stats-column__item">
      <span class="stats-column__label">{$t('play.stats.actions')}</span>
      <span class="stats-column__value"
        >{$t('play.stats.currentMax', { current: actions.remaining, max: actions.max })}</span
      >
    </div>
  {/if}
  {#if proficiency != null}
    <div class="stats-column__item">
      <span class="stats-column__label">{$t('play.stats.proficiency')}</span>
      <span class="stats-column__value">{proficiency >= 0 ? '+' : ''}{proficiency}</span>
    </div>
  {/if}
  {#if spellcasting}
    <div class="stats-column__item">
      <span class="stats-column__label">{$t('play.stats.spellcasting')}</span>
      <span class="stats-column__value"
        >{$t('play.stats.currentMax', { current: spellcasting.remaining, max: spellcasting.max })}</span
      >
    </div>
  {/if}
  {#if spellSlots && Object.keys(spellSlots).length > 0}
    {#each Object.entries(spellSlots).sort(([a], [b]) => Number(a) - Number(b)) as [level, slots] (level)}
      <div class="stats-column__item">
        <span class="stats-column__label">{$t('play.stats.spellLevel', { level })}</span>
        <span class="stats-column__value"
          >{$t('play.stats.currentMax', { current: slots.current, max: slots.max })}</span
        >
      </div>
    {/each}
  {/if}
  {#if !movement && !actions && proficiency == null && !spellcasting && (!spellSlots || Object.keys(spellSlots).length === 0)}
    <div class="stats-column__todo">{$t('play.stats.todo')}</div>
  {/if}
</div>

<style>
  .stats-column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .stats-column__item {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  .stats-column__label {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stats-column__value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  .stats-column__todo {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--md-sys-color-outline);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-align: center;
    padding: var(--spacing-xl);
  }
</style>
