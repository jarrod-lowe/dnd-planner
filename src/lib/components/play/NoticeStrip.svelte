<script module lang="ts">
  // Per-instance id source, so the disclosure's `aria-controls` can point at
  // this strip's collapsible region without colliding with another strip.
  // SSR-safe for the same reason as panel-renderer/diceLineId.ts: the module
  // loads once per side and instances mount in a deterministic order.
  let instanceCount = 0;

  function nextCollapsibleId(): string {
    return `notice-strip-collapsible-${instanceCount++}`;
  }
</script>

<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Annotation } from '$lib/rules-engine';

  interface Props {
    notices: Annotation[];
  }

  let { notices }: Props = $props();

  // The count drives expansion until the player first touches the chevron:
  // zero notices keep the section collapsed, anything else shows it. The play
  // screen mounts this strip before the store's first engine output lands
  // (the effects fetch precedes performEvaluation), so "first render" is
  // always a zero-notices render — a state captured there would hide every
  // notice behind a tap on every load. A manual choice (`manualExpanded`)
  // overrides the count from then on and sticks for the life of the screen
  // (in-memory, like the plan rows' collapse state), so notices arriving or
  // leaving mid-session never yank the section open or shut.
  let manualExpanded = $state<boolean | null>(null);
  const expanded = $derived(manualExpanded ?? notices.length > 0);

  const collapsibleId = nextCollapsibleId();

  function toggleExpanded() {
    manualExpanded = !expanded;
  }
</script>

<section class="notice-strip" aria-label={$t('play.notices.title')}>
  <h2 class="notice-strip__header">
    <button
      type="button"
      class="notice-strip__disclosure"
      aria-expanded={expanded}
      aria-controls={collapsibleId}
      aria-label={expanded
        ? $t('play.notices.collapse', { count: notices.length })
        : $t('play.notices.expand', { count: notices.length })}
      onclick={toggleExpanded}
    >
      <span class="notice-strip__title">{$t('play.notices.title')}</span>
      <span class="notice-strip__count">{$t('play.notices.count', { count: notices.length })}</span>
      <svg
        class="notice-strip__chevron"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  </h2>

  <!-- The controlled region stays mounted in both states, so the button's
       aria-controls IDREF never dangles — collapsed (including the initial
       zero-notice render) still points at a real element. It hides via the
       hidden attribute, which only works because this wrapper is a plain
       block: any display rule here would override the UA's
       [hidden] { display: none }. The {#if} inside keeps the cells (or the
       placeholder) out of the DOM while collapsed. -->
  <div class="notice-strip__collapsible" id={collapsibleId} hidden={!expanded}>
    {#if expanded}
      {#if notices.length === 0}
        <p class="notice-strip__placeholder">{$t('play.notices.placeholder')}</p>
      {:else}
        <ul class="notice-strip__grid">
          {#each notices as notice (notice.key)}
            <li class="notice-strip__cell">
              {#if notice.source}
                <span class="notice-strip__source">{$t(notice.source)}</span>
              {/if}
              <span class="notice-strip__label">{$t(notice.key)}</span>
              {#if notice.body}
                <span class="notice-strip__body">{$t(notice.body, notice.values)}</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
</section>

<style>
  .notice-strip {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container-low);
  }

  .notice-strip__header {
    margin: 0;
  }

  /* The whole header is the disclosure: one 2.75rem row collapsed, and the
     count badge is what says there is anything to know. */
  .notice-strip__disclosure {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    min-height: 2.75rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-wide);
    cursor: pointer;
    text-align: left;
  }

  .notice-strip__count {
    font-weight: 600;
    color: var(--md-sys-color-on-tertiary-container);
    background: var(--md-sys-color-tertiary-container);
    border-radius: var(--radius-full);
    padding: 0 var(--spacing-sm);
    min-width: 1.5rem;
    text-align: center;
  }

  .notice-strip__chevron {
    margin-left: auto;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    color: var(--md-sys-color-on-surface-variant);
    transition: transform var(--transition-fast);
  }

  .notice-strip__disclosure[aria-expanded='false'] .notice-strip__chevron {
    transform: rotate(-90deg);
  }

  /* .notice-strip__collapsible deliberately has no rule: the disclosure
     hides that wrapper via the hidden attribute, and any display
     declaration on it (grid, flex…) would override the attribute. */
  /* Variant D: a dense two-column grid. Cells size to their content and heights
     stay ragged on purpose — a clamp here would hide exactly the sentences
     that carry a DC. */
  .notice-strip__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    align-items: start;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .notice-strip__cell {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    background: var(--md-sys-color-surface-container-lowest);
  }

  /* The eyebrow: where a notice comes from (the feat or spell name). */
  .notice-strip__source {
    align-self: flex-start;
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1.4;
    color: var(--md-sys-color-on-tertiary-container);
  }

  .notice-strip__label {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .notice-strip__body {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-md);
    color: var(--md-sys-color-on-surface-variant);
  }

  .notice-strip__placeholder {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-style: italic;
    color: var(--md-sys-color-on-surface-variant);
  }

  @media (max-width: 600px) {
    .notice-strip__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
