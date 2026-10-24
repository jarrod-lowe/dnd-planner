<script lang="ts">
  import { t } from '$lib/i18n';
  import UserDropdown from '$lib/components/UserDropdown.svelte';
  import type { Character } from '$lib/character/types';
  import type {
    UiEntry,
    UiEntryUsedMax,
    UiEntryValue,
    UiEntryConcentration,
    UiEntryAbility
  } from '$lib/play/extractTopBar';
  import type { Facts } from '$lib/rules-view';

  interface Props {
    character: Character;
    topBarEntries: UiEntry[];
    facts: Facts;
    email: string | null;
    onLogout: () => void;
    version?: string;
    onBack?: () => void;
    onManageRules?: () => void;
    showManageRules?: boolean;
    onViewFacts?: () => void;
    showViewFacts?: boolean;
    onDownloadCharacter?: () => void;
    showDownloadCharacter?: boolean;
    concentrationEffectName?: string;
    availableSubjects?: string[];
    activeSubject?: string;
    onSwitchSubject?: (subject: string | undefined) => void;
  }

  let {
    character,
    topBarEntries,
    facts,
    email,
    onLogout,
    version = 'v0.0.0',
    onBack,
    onManageRules,
    showManageRules = false,
    onViewFacts,
    showViewFacts = false,
    onDownloadCharacter,
    showDownloadCharacter = false,
    concentrationEffectName,
    availableSubjects = [],
    activeSubject,
    onSwitchSubject
  }: Props = $props();

  // Filter entries by active subject (undefined = player)
  const subjectFiltered = $derived(topBarEntries.filter((e) => e.subject === activeSubject));

  // Derive entries by type from subject-filtered list
  const hpEntry = $derived(subjectFiltered.find((e): e is UiEntryUsedMax => e.type === 'usedMax'));
  const valueEntries = $derived(
    subjectFiltered.filter((e): e is UiEntryValue => e.type === 'value')
  );
  const concEntry = $derived(
    subjectFiltered.find((e): e is UiEntryConcentration => e.type === 'concentration')
  );
  const abilityEntry = $derived(
    subjectFiltered.find((e): e is UiEntryAbility => e.type === 'ability')
  );

  // HP resolved values
  const hpCurrent = $derived(hpEntry ? Number(facts[hpEntry.remaining] ?? 0) : undefined);
  const hpMax = $derived(hpEntry ? Number(facts[hpEntry.total] ?? 0) : undefined);
  const hpPercent = $derived(
    hpCurrent !== undefined && hpMax !== undefined && hpMax > 0
      ? Math.round((hpCurrent / hpMax) * 100)
      : undefined
  );
  const hpVisible = $derived(
    hpEntry !== undefined &&
      facts[hpEntry.remaining] !== undefined &&
      facts[hpEntry.total] !== undefined
  );

  // Concentration state
  const concActive = $derived(!!concentrationEffectName);
</script>

<header class="intent-top-bar">
  <div class="intent-top-bar__row">
    <div class="intent-top-bar__identity">
      {#if onBack}
        <button
          type="button"
          class="intent-top-bar__back"
          aria-label={$t('play.backToSelection')}
          onclick={onBack}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
        </button>
      {/if}
      <div class="intent-top-bar__info">
        <span class="intent-top-bar__name">{character.name}</span>
        <span class="intent-top-bar__species">{$t(`species.${character.species}`)}</span>
      </div>
    </div>

    <div class="intent-top-bar__chips">
      {#if availableSubjects.length > 0 && onSwitchSubject}
        <div
          class="intent-top-bar__seg"
          role="radiogroup"
          aria-label={$t('play.topBar.viewPlayer') +
            ' / ' +
            availableSubjects.map((s) => $t(`play.companion.${s}`)).join(' / ')}
        >
          <button
            type="button"
            class="intent-top-bar__seg-btn"
            class:intent-top-bar__seg-btn--active={!activeSubject}
            role="radio"
            aria-checked={!activeSubject}
            title={$t('play.topBar.viewPlayer')}
            onclick={() => onSwitchSubject(undefined)}>{$t('play.topBar.viewPlayer')}</button
          >
          {#each availableSubjects as subject (subject)}
            <button
              type="button"
              class="intent-top-bar__seg-btn"
              class:intent-top-bar__seg-btn--active={activeSubject === subject}
              role="radio"
              aria-checked={activeSubject === subject}
              title={$t(`play.companion.${subject}`)}
              onclick={() => onSwitchSubject(subject)}>{$t(`play.companion.${subject}`)}</button
            >
          {/each}
        </div>
      {/if}

      {#if hpEntry && hpVisible}
        {@const entry = hpEntry}
        <div
          class="intent-top-bar__chip intent-top-bar__chip--stack intent-top-bar__chip--hp"
          aria-label="{$t(entry.label)} {$t('play.topBar.hpValue', {
            current: hpCurrent,
            max: hpMax
          })}"
          title="{$t(entry.label)} {$t('play.topBar.hpValue', {
            current: hpCurrent,
            max: hpMax
          })}"
        >
          <span class="intent-top-bar__chip-label">{$t(entry.label)}</span>
          <span class="intent-top-bar__chip-value">{hpCurrent}/{hpMax}</span>
          {#if hpPercent !== undefined}
            <div
              class="intent-top-bar__hp-bar"
              role="progressbar"
              aria-label={$t('play.topBar.hpBarLabel')}
              aria-valuenow={hpCurrent}
              aria-valuemin={0}
              aria-valuemax={hpMax}
            >
              <div class="intent-top-bar__hp-fill" style="width: {hpPercent}%"></div>
            </div>
          {/if}
        </div>
      {/if}

      {#each valueEntries as entry (entry.label)}
        {@const value = facts[entry.fact]}
        {#if value !== undefined}
          <div
            class="intent-top-bar__chip intent-top-bar__chip--stack"
            aria-label="{$t(entry.label)} {value}"
            title="{$t(entry.label)} {value}"
          >
            <span class="intent-top-bar__chip-label">{$t(entry.label)}</span>
            <span class="intent-top-bar__chip-value">{value}</span>
          </div>
        {/if}
      {/each}

      {#if concEntry}
        {@const entry = concEntry}
        <div
          class="intent-top-bar__chip intent-top-bar__chip--stack intent-top-bar__chip--conc"
          class:intent-top-bar__chip--conc-active={concActive}
          aria-label="{$t(entry.label)}: {concActive
            ? (concentrationEffectName ?? $t(entry.activeLabel))
            : $t(entry.noneLabel)}"
          title="{$t(entry.label)}: {concActive
            ? (concentrationEffectName ?? $t(entry.activeLabel))
            : $t(entry.noneLabel)}"
        >
          <span class="intent-top-bar__chip-label">
            <svg
              class="intent-top-bar__conc-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
              />
            </svg>
            {$t(entry.label)}
          </span>
          <span class="intent-top-bar__chip-value">
            {#if concActive && concentrationEffectName}
              {concentrationEffectName}
            {:else if concActive}
              {$t(entry.activeLabel)}
            {:else}
              {$t(entry.noneLabel)}
            {/if}
          </span>
        </div>
      {/if}

      {#if abilityEntry}
        {@const abilitiesName = `${$t(abilityEntry.label)}: ${abilityEntry.abilities
          .map((a) => {
            const mod = Number(facts[a.fact] ?? 0);
            const save = a.saveFact !== undefined ? Number(facts[a.saveFact] ?? 0) : undefined;
            const modStr = `${mod >= 0 ? '+' : ''}${mod}`;
            const saveStr = save !== undefined ? `/${save >= 0 ? '+' : ''}${save}` : '';
            return `${$t(a.name)} ${modStr}${saveStr}`;
          })
          .join(' ')}`}
        <div
          class="intent-top-bar__chip intent-top-bar__chip--abilities"
          aria-label={abilitiesName}
          title={abilitiesName}
        >
          {#each abilityEntry.abilities as ability, i (ability.name)}
            {@const mod = Number(facts[ability.fact] ?? 0)}
            {@const save =
              ability.saveFact !== undefined ? Number(facts[ability.saveFact] ?? 0) : undefined}
            <div
              class="intent-top-bar__ability-col"
              class:intent-top-bar__ability-col--last={i === abilityEntry.abilities.length - 1}
            >
              <span class="intent-top-bar__ability-name">{$t(ability.name)}</span>
              <span class="intent-top-bar__ability-stat">
                {mod >= 0 ? '+' : ''}{mod}{save !== undefined
                  ? `/${save >= 0 ? '+' : ''}${save}`
                  : ''}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <nav class="intent-top-bar__menu" aria-label={$t('auth.userMenu')}>
      <UserDropdown
        {email}
        {onLogout}
        {version}
        {onManageRules}
        {showManageRules}
        {onViewFacts}
        {showViewFacts}
        {onDownloadCharacter}
        {showDownloadCharacter}
      />
    </nav>
  </div>
</header>

<style>
  .intent-top-bar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--md-sys-color-surface);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    box-shadow: var(--shadow-sm);
    z-index: var(--z-dropdown);
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .intent-top-bar__row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .intent-top-bar__identity {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }

  .intent-top-bar__back {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: var(--spacing-xs);
    border-radius: var(--radius-md);
    transition: background-color var(--transition-fast);
  }

  .intent-top-bar__back:hover {
    background: var(--md-sys-color-surface-container);
  }

  .intent-top-bar__back:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .intent-top-bar__back svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .intent-top-bar__info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .intent-top-bar__name {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface);
    letter-spacing: var(--letter-spacing-wide);
  }

  .intent-top-bar__species {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }

  .intent-top-bar__chips {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }

  /* Long labels (vehicle subjects, their stats) clamp here and scroll inside
     the chip — never ellipsised, never wrapped: the full name stays in the
     text content and is repeated on title/aria-label, so nothing is lost to
     assistive tech or hover. 14rem clears every current chip's natural width,
     so short labels render exactly as before. */
  .intent-top-bar__chip {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    white-space: nowrap;
    max-width: 14rem;
    overflow-x: auto;
  }

  .intent-top-bar__chip-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--md-sys-color-on-surface-variant);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .intent-top-bar__chip-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  /* `safe` center: a centered line wider than the clamped chip must fall back
     to start alignment, or its left half would sit outside the scrollable
     area and be unreachable. */
  .intent-top-bar__chip--stack {
    flex-direction: column;
    align-items: safe center;
    gap: 2px;
  }

  .intent-top-bar__chip--hp {
    min-width: 5rem;
  }

  .intent-top-bar__hp-bar {
    height: 4px;
    background: var(--md-sys-color-surface-container);
    border-radius: 2px;
    overflow: hidden;
    align-self: stretch;
  }

  .intent-top-bar__hp-fill {
    height: 100%;
    background: var(--md-sys-color-primary);
    border-radius: 2px;
    transition: width var(--transition-normal);
  }

  .intent-top-bar__conc-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .intent-top-bar__chip--conc-active .intent-top-bar__conc-icon {
    color: var(--md-sys-color-primary);
  }

  .intent-top-bar__seg {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  /* Subject names ("Tormentor (Damage Control)") clamp here and scroll inside
     the button — same contract as the chips: whole text in the content, full
     name on title, no ellipsis, no wrap. `safe` keeps the start of a clamped
     label reachable (see the stacked-chip note). */
  .intent-top-bar__seg-btn {
    display: flex;
    align-items: center;
    justify-content: safe center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    border: none;
    background: transparent;
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
    white-space: nowrap;
    max-width: 14rem;
    overflow-x: auto;
  }

  .intent-top-bar__seg-btn:not(:first-child) {
    border-top: 1px solid var(--md-sys-color-outline);
  }

  .intent-top-bar__seg-btn--active {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .intent-top-bar__seg-btn:not(.intent-top-bar__seg-btn--active):hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .intent-top-bar__seg-btn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -2px;
  }

  /* Exempt from the chip clamp: this chip's width is six structural columns
     (STR…CHA), not a label — clamping it would scroll a chip that already
     fits wherever it fits today. */
  .intent-top-bar__chip--abilities {
    padding: 0;
    gap: 0;
    align-items: stretch;
    max-width: none;
  }

  .intent-top-bar__ability-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-right: 1px solid var(--md-sys-color-outline-variant);
  }

  .intent-top-bar__ability-col--last {
    border-right: none;
  }

  .intent-top-bar__ability-name {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .intent-top-bar__ability-stat {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
  }

  .intent-top-bar__menu {
    flex-shrink: 0;
    margin-left: auto;
  }
</style>
