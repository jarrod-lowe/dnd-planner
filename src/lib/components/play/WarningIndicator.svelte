<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    type: 'illegal' | 'inapplicable';
  }

  let { type }: Props = $props();

  const label = $derived(
    type === 'illegal' ? $t('play.choices.illegal') : $t('play.choices.inapplicable')
  );
</script>

<span
  class="warning-indicator warning-indicator--{type}"
  role="img"
  aria-label={label}
  title={label}
>
  <svg
    class="warning-indicator__icon"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
    />
  </svg>
</span>

<style>
  .warning-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  .warning-indicator__icon {
    width: 100%;
    height: 100%;
  }

  .warning-indicator--illegal .warning-indicator__icon {
    color: var(--md-sys-color-error);
  }

  .warning-indicator--inapplicable .warning-indicator__icon {
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
