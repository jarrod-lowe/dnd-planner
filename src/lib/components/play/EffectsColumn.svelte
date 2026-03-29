<script lang="ts">
  import { t } from '$lib/i18n';
  import SectionCollapsible from './SectionCollapsible.svelte';
  import { adaptEffectsAsEntries } from '$lib/play/adaptEffects';
  import { groupChoicesBySection } from '$lib/play/groupChoicesBySection';
  import { SECTION_ORDER } from '$lib/play/sectionConfig';
  import type { Rule } from '$lib/rules-engine';

  interface Props {
    effects: Rule[];
  }

  let { effects }: Props = $props();

  // Adapt effects into entries, then group by section
  const sectionGroups = $derived(
    groupChoicesBySection(adaptEffectsAsEntries(effects), SECTION_ORDER)
  );
</script>

<div class="effects-column">
  {#if effects.length === 0}
    <div class="effects-column__empty">
      {$t('play.effects.empty')}
    </div>
  {:else}
    <div class="effects-column__list">
      {#each sectionGroups as sectionGroup (sectionGroup.section ?? 'other')}
        <SectionCollapsible
          section={sectionGroup.section}
          packedGroups={sectionGroup.packedGroups}
          hasLegalEntries={sectionGroup.hasLegalEntries}
          facts={{}}
          onChoiceTap={() => {}}
          mode="effect"
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .effects-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .effects-column__list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .effects-column__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    color: var(--md-sys-color-on-surface-variant);
    text-align: center;
    padding: var(--spacing-xl);
  }
</style>
