<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    type: string;
  }

  let { type }: Props = $props();

  const paths: Record<string, string> = {
    bludgeoning: 'M12 2L9 9H2l6 4.5L5.5 22 12 17l6.5 5L16 13.5 22 9h-7z',
    piercing: 'M12 2L8 10h3v12h2V10h3z',
    slashing:
      'M3.4 6.4l2.1-2.1L20.6 19.4l-2.1 2.1z M4 8.5L6.5 6l2.5 2.5L6.5 11z M17 17.5l2.5-2.5 2.5 2.5-2.5 2.5z',
    acid: 'M12 2C8.5 2 6 5.5 6 9c0 3 2 5.5 4 7.5l2 5.5 2-5.5c2-2 4-4.5 4-7.5 0-3.5-2.5-7-6-7z',
    cold: 'M12 2l2.5 5.5L20 6.5l-4 4.5 4 4.5-5.5-1L12 20l-2.5-5.5L4 15l4-4.5L4 6l5.5 1z',
    fire: 'M12 22c3.5 0 6-2.5 6-6 0-2.5-1.5-4.5-2.5-6-.5 1.5-1.5 2.5-2.5 2.5s-2-1.5-3-3.5c-1 2.5-2.5 4.5-2.5 7 0 3.5 2 6 4.5 6z',
    lightning: 'M13 2L4 14h7l-2 8 9-12h-7z',
    thunder:
      'M3 8h3c0-2 .5-4 2-4s2 2 2 4h3c0-2 .5-4 2-4s2 2 2 4h3v2h-3c0 2-.5 4-2 4s-2-2-2-4H10c0 2-.5 4-2 4s-2-2-2-4H3z',
    force: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z',
    necrotic: 'M12 2C8 2 5 5 5 9c0 3 1 4 2 6l1 4h8l1-4c1-2 2-3 2-6 0-4-3-7-7-7z',
    radiant: 'M12 2l1.5 5H18l-4 3 1.5 5-3.5-2.5L8.5 15 10 10l-4-3h4.5z',
    poison: 'M12 2C9.5 2 8 4.5 8 7c0 3.5 4 7.5 4 13 0-5.5 4-9.5 4-13 0-2.5-1.5-5-4-5z',
    psychic: 'M12 3C8 3 5 6 5 9.5S8 16 12 16s7-3 7-6.5S16 3 12 3z'
  };

  const ariaLabel = $derived(paths[type] ? $t(`damage-type.${type}`) : undefined);
</script>

{#if paths[type]}
  <svg viewBox="0 0 24 24" fill="currentColor" aria-label={ariaLabel}>
    <path d={paths[type]} />
  </svg>
{/if}
