<script lang="ts">
  import type { Character } from '$lib/character/types';

  interface Props {
    character: Character;
    onSelect: (character: Character) => void;
  }

  let { character, onSelect }: Props = $props();
</script>

<button class="character-card" onclick={() => onSelect(character)} type="button">
  <span class="character-card__name">{character.name}</span>
  <span class="character-card__race">{character.race}</span>
</button>

<style>
  .character-card {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    cursor: pointer;
    min-height: 5rem;
    width: 100%;
    text-align: left;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .character-card:hover {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline);
    box-shadow: var(--shadow-sm);
  }

  .character-card:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .character-card:active {
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
</style>
