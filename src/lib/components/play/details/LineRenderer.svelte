<script lang="ts">
  import type { Line } from '$lib/details/types';

  interface Props {
    lines: Line[];
  }

  let { lines }: Props = $props();

  type LineGroup = { type: 'paragraph'; line: Line } | { type: 'bullets'; lines: Line[] };

  let groups = $derived.by(() => {
    const result: LineGroup[] = [];
    let bulletBuffer: Line[] = [];

    const flushBullets = () => {
      if (bulletBuffer.length > 0) {
        result.push({ type: 'bullets', lines: [...bulletBuffer] });
        bulletBuffer = [];
      }
    };

    for (const line of lines) {
      if (line.bullet) {
        bulletBuffer.push(line);
      } else {
        flushBullets();
        result.push({ type: 'paragraph', line });
      }
    }
    flushBullets();
    return result;
  });
</script>

<div class="rules-body">
  {#each groups as group, gi (gi)}
    {#if group.type === 'bullets'}
      <ul>
        {#each group.lines as line, li (li)}
          <li>
            {#each line.text as span, si (si)}
              {#if typeof span === 'string'}{span}
              {:else if 'strong' in span}<strong>{span.strong}</strong>
              {:else if 'em' in span}<em>{span.em}</em>
              {/if}
            {/each}
          </li>
        {/each}
      </ul>
    {:else}
      <p>
        {#each group.line.text as span, si (si)}
          {#if typeof span === 'string'}{span}
          {:else if 'strong' in span}<strong>{span.strong}</strong>
          {:else if 'em' in span}<em>{span.em}</em>
          {/if}
        {/each}
      </p>
    {/if}
  {/each}
</div>
