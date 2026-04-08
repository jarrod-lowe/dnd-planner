<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Character } from '$lib/character/types';

  interface Props {
    character: Character;
    onSelect: (character: Character) => void;
    onDelete: (character: Character) => void;
  }

  let { character, onSelect, onDelete }: Props = $props();
</script>

<div class="character-card">
  <button class="character-card__body" onclick={() => onSelect(character)} type="button">
    <span class="character-card__name">{character.name}</span>
    <span class="character-card__race">{character.race}</span>
  </button>
  <button
    class="character-card__delete"
    onclick={(e) => { e.stopPropagation(); onDelete(character); }}
    type="button"
    aria-label={$t('character.delete')}
    title={$t('character.delete')}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  </button>
</div>

<style>
  .character-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    min-height: 5rem;
    width: 100%;
    text-align: left;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
    position: relative;
  }

  .character-card:hover {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline);
    box-shadow: var(--shadow-sm);
  }

  .character-card__body {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: none;
    border: none;
    cursor: pointer;
    flex: 1;
    min-height: 5rem;
    text-align: left;
    font: inherit;
    color: inherit;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .character-card__body:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-lg);
  }

  .character-card__body:active {
    background: var(--md-sys-color-surface-container-highest);
  }

  .character-card__name {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .character-card__race {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    text-transform: capitalize;
  }

  .character-card__delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    margin-right: var(--spacing-sm);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--md-sys-color-on-surface-variant);
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .character-card__delete:hover {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
  }

  .character-card__delete:focus-visible {
    outline: 2px solid var(--md-sys-color-error);
    outline-offset: 2px;
  }
</style>
