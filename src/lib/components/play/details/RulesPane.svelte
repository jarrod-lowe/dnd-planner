<script lang="ts">
  import type { ItemDetail } from '$lib/details/types';
  import LineRenderer from './LineRenderer.svelte';
  import { t } from '$lib/i18n';

  interface Props {
    detail: ItemDetail;
    onFlip: () => void;
    name?: string;
    switcher?: import('svelte').Snippet;
  }

  let { detail, onFlip, name, switcher }: Props = $props();
</script>

<div class="rules-shell">
  <div
    class="rules-rail"
    role="button"
    tabindex="0"
    aria-pressed="true"
    onclick={onFlip}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onFlip();
    }}
  >
    <span class="rules-rail__label">
      {#if name}{name}{:else}{$t('rules.mode')}{/if}
    </span>
    <span class="rules-rail__return" role="button" tabindex="0"> ↺ Flip </span>
  </div>

  <div class="rules-pane">
    {#if detail.meta}
      <em class="rules-meta">{detail.meta}</em>
    {/if}

    {#if detail.fields && detail.fields.length > 0}
      <dl class="rules-fields">
        {#each detail.fields as field, i (i)}
          <dt>{$t(field.labelKey)}</dt>
          <dd>{field.value}</dd>
        {/each}
      </dl>
    {/if}

    <LineRenderer lines={detail.body} />

    {#if switcher}
      {@render switcher()}
    {/if}
  </div>
</div>
