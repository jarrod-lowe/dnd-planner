<script lang="ts">
  import { slide } from 'svelte/transition';
  import { t } from '$lib/i18n';
  import { STAT_SECTION_ORDER } from '$lib/play/sectionConfig';
  import type { StatEntry } from '$lib/play/extractStats';
  import type { Facts } from '$lib/rules-engine';

  interface Props {
    stats: StatEntry[];
    facts: Facts;
  }

  let { stats, facts }: Props = $props();

  // Per-section expanded state, keyed by section name
  let expandedState: Record<string, boolean> = $state({});

  // Group stats by section, sort sections by STAT_SECTION_ORDER, sort stats alphabetically within
  const sections = $derived.by(() => {
    const grouped: Record<string, StatEntry[]> = {};
    for (const stat of stats) {
      const section = stat.section;
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(stat);
    }

    // Sort sections: known order first, then unknown alphabetically
    const sorted = Object.entries(grouped).sort(([a], [b]) => {
      const ai = STAT_SECTION_ORDER.indexOf(a);
      const bi = STAT_SECTION_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    return sorted.map(([section, entries]) => ({
      section,
      stats: [...entries].sort((a, b) => a.name.localeCompare(b.name))
    }));
  });

  // Check visibility of a stat based on current facts
  function isVisible(stat: StatEntry): boolean {
    if (stat.type === 'usedMax' || stat.type === 'hitDie') {
      const total = facts[stat.total];
      return total !== undefined && Number(total) !== 0;
    }
    if (stat.type === 'value') {
      return facts[stat.fact] !== undefined;
    }
    if (stat.type === 'modifier') {
      return facts[stat.fact] !== undefined;
    }
    return false;
  }

  // Whether any stats are visible at all
  const hasVisibleStats = $derived(stats.some((s) => isVisible(s)));

  // Unique key for each stat (name alone isn't unique for spell slots)
  function statKey(stat: StatEntry): string {
    if (stat.nameParams) {
      return `${stat.name}:${JSON.stringify(stat.nameParams)}`;
    }
    return stat.name;
  }

  // Resolve the display label for a stat entry
  function labelFor(stat: StatEntry): string {
    const params = stat.nameParams ?? {};
    return $t(stat.name, params);
  }

  // Resolve the display value for a stat entry (only called when visible)
  function valueFor(stat: StatEntry): string {
    if (stat.type === 'value') {
      const raw = String(facts[stat.fact]);
      if (stat.modifierFact && stat.saveFact) {
        const mod = Number(facts[stat.modifierFact]);
        const save = Number(facts[stat.saveFact]);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const saveStr = save >= 0 ? `+${save}` : `${save}`;
        return `${raw}/${modStr}/${saveStr}`;
      }
      return raw;
    }
    if (stat.type === 'modifier') {
      const n = Number(facts[stat.fact]);
      const base = `${n >= 0 ? '+' : ''}${n}`;
      if (stat.proficiencyFact) {
        const prof = Number(facts[stat.proficiencyFact]);
        if (prof > 0) {
          const badge = prof >= 2 ? '\u25CF\u25CF' : prof >= 1 ? '\u25CF' : '\u25CB';
          return `${base} ${badge}`;
        }
      }
      return base;
    }
    if (stat.type === 'usedMax') {
      const total = Number(facts[stat.total]);
      const remaining = Number(facts[stat.remaining] ?? 0);
      const used = total - remaining;
      return $t('play.stats.usedMax', { used, max: total });
    }
    if (stat.type === 'hitDie') {
      const total = Number(facts[stat.total]);
      const remaining = Number(facts[stat.remaining] ?? 0);
      const used = total - remaining;
      return $t('play.stats.hitDieValue', { used, max: total, dieSize: stat.dieSize });
    }
    return '';
  }

  // Compute section title with i18n fallback
  function sectionTitle(section: string): string {
    const key = `play.stats.sections.${section}`;
    const translated = $t(key);
    if (translated === key) {
      return section.charAt(0).toUpperCase() + section.slice(1);
    }
    return translated;
  }

  // Whether a section has any visible stats
  function sectionHasVisible(sectionStats: StatEntry[]): boolean {
    return sectionStats.some((s) => isVisible(s));
  }

  // Whether a section is expanded
  function isExpanded(section: string, sectionStats: StatEntry[]): boolean {
    if (section in expandedState) {
      return expandedState[section];
    }
    return sectionHasVisible(sectionStats);
  }

  function toggleSection(section: string, sectionStats: StatEntry[]): void {
    const current = isExpanded(section, sectionStats);
    expandedState[section] = !current;
  }
</script>

<div class="stats-column">
  {#if hasVisibleStats}
    {#each sections as sectionGroup (sectionGroup.section)}
      <div class="stats-column__section">
        <button
          type="button"
          class="stats-column__section-header"
          onclick={() => toggleSection(sectionGroup.section, sectionGroup.stats)}
          aria-expanded={isExpanded(sectionGroup.section, sectionGroup.stats)}
          aria-label={sectionTitle(sectionGroup.section)}
        >
          <span class="stats-column__section-title">{sectionTitle(sectionGroup.section)}</span>
          <span
            class="stats-column__section-chevron"
            class:stats-column__section-chevron--expanded={isExpanded(
              sectionGroup.section,
              sectionGroup.stats
            )}
          >
            {#if isExpanded(sectionGroup.section, sectionGroup.stats)}
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
              </svg>
            {/if}
          </span>
        </button>

        {#if isExpanded(sectionGroup.section, sectionGroup.stats)}
          <div class="stats-column__section-content" transition:slide={{ duration: 200 }}>
            {#each sectionGroup.stats as stat (statKey(stat))}
              {#if isVisible(stat)}
                <div class="stats-column__item">
                  <span class="stats-column__label">{labelFor(stat)}</span>
                  <span class="stats-column__value">{valueFor(stat)}</span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="stats-column__todo">{$t('play.stats.todo')}</div>
  {/if}
</div>

<style>
  .stats-column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .stats-column__section {
    display: flex;
    flex-direction: column;
  }

  .stats-column__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: none;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    cursor: pointer;
    font-family: var(--font-body);
    width: 100%;
    text-align: left;
  }

  .stats-column__section-header:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .stats-column__section-title {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .stats-column__section-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--md-sys-color-on-surface-variant);
    transition: transform var(--transition-fast);
  }

  .stats-column__section-chevron--expanded {
    transform: rotate(180deg);
  }

  .stats-column__section-chevron svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .stats-column__section-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md) 0;
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
