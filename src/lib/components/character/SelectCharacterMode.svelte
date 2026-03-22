<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Character } from '$lib/character/types';
  import CharacterCard from './CharacterCard.svelte';

  interface Props {
    characters: Character[];
    isLoading: boolean;
    canCreateCharacter: boolean;
    onSelect: (character: Character) => void;
    onCreateCharacter: () => void;
  }

  let { characters, isLoading, canCreateCharacter, onSelect, onCreateCharacter }: Props = $props();
</script>

<div class="select-character-mode">
  <h1 class="select-character-mode__title">{$t('character.selectTitle')}</h1>

  {#if isLoading}
    <p class="select-character-mode__loading">{$t('character.loading')}</p>
  {:else if characters.length === 0}
    <p class="select-character-mode__empty">{$t('character.noCharacters')}</p>
  {:else}
    <div class="select-character-mode__grid">
      {#each characters as character (character.characterId)}
        <CharacterCard {character} {onSelect} />
      {/each}
    </div>
  {/if}

  {#if canCreateCharacter}
    <button
      type="button"
      class="select-character-mode__create-button"
      onclick={() => onCreateCharacter()}
    >
      {$t('character.createNew')}
    </button>
  {/if}
</div>

<style>
  .select-character-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xl);
    width: 100%;
    max-width: 36rem;
  }

  .select-character-mode__title {
    font-family: var(--font-display);
    font-size: var(--font-size-2xl);
    color: var(--md-sys-color-primary);
    margin: 0;
    text-align: center;
  }

  .select-character-mode__loading {
    font-family: var(--font-body);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
  }

  .select-character-mode__empty {
    font-family: var(--font-body);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
    text-align: center;
  }

  .select-character-mode__grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    width: 100%;
    max-width: 32rem;
  }

  .select-character-mode__create-button {
    padding: var(--spacing-md) var(--spacing-xl);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    cursor: pointer;
    min-height: 3rem;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }

  .select-character-mode__create-button:hover {
    background: var(--md-sys-color-on-primary-fixed-variant);
    border-color: var(--md-sys-color-outline);
  }

  .select-character-mode__create-button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }
</style>
