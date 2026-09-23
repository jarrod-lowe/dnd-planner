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
  import PanelDiceLine from './panel-renderer/PanelDiceLine.svelte';
  import { showDiceRollToast } from './panel-renderer/diceRollToast';
  import type { DiceLineControl } from './panel-renderer/types';
  import type { Annotation, AnnotationRoll } from '$lib/rules-engine';

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

  /**
   * A notice's structured roll (see `AnnotationRoll`), mapped onto the dice
   * line the panels already own — the chip, its roll and its toast are the
   * shared machinery, re-mounted here rather than re-implemented. The dice
   * are engine-authored literals (facts/vars play no part), and a notice
   * roll can never be crit-doubled (a burn is not a weapon attack's hit),
   * hence `criticalOption={false}`.
   */
  function noticeRollControl(roll: AnnotationRoll): DiceLineControl {
    return {
      type: 'dice-line',
      dice: [
        {
          sides: roll.sides,
          count: roll.count,
          purpose: roll.purpose,
          damageType: roll.damageType ? { string: roll.damageType } : undefined,
          unit: roll.unit
        }
      ]
    };
  }

  /**
   * A cell's identity. One notice arrives PER committed burn, all sharing one
   * i18n key, and Svelte 5 hard-errors on duplicate each-keys — so the
   * effect-instance id (`Annotation.id`) keys when present, falling back to
   * the key for notices without an instance.
   */
  function cellKey(notice: Annotation): string {
    return notice.id ?? notice.key;
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
          {#each notices as notice (cellKey(notice))}
            <!-- Text left, roller right: the strip is squeezed for vertical
                 space (density is its whole design), so the chip rides beside
                 the sentence instead of under it. -->
            <li class="notice-strip__cell">
              <div class="notice-strip__content">
                {#if notice.source}
                  <span class="notice-strip__source">{$t(notice.source)}</span>
                {/if}
                <span class="notice-strip__label">{$t(notice.key)}</span>
                {#if notice.body}
                  <span class="notice-strip__body">{$t(notice.body, notice.values)}</span>
                {/if}
              </div>
              {#if notice.roll}
                {@const control = noticeRollControl(notice.roll)}
                <!-- Ephemeral, freely re-rollable: no writeBack, no plan
                     recording — the toast is the whole record. The toast's
                     roll key names the CELL (`cellKey`: the effect instance
                     id, falling back to the shared key) and the die, so a
                     re-roll replaces its own log entry and never a sibling
                     burn's — two committed burns share one sentence (and so
                     one `key`), but their dice are not each other's
                     re-rolls. -->
                <div class="notice-strip__roll">
                  <PanelDiceLine
                    {control}
                    editable={true}
                    facts={{}}
                    vars={{}}
                    criticalOption={false}
                    onRoll={(result, dieIndex) =>
                      showDiceRollToast(
                        $t(notice.source ?? notice.key),
                        result,
                        undefined,
                        `notice:${cellKey(notice)}:${dieIndex}`
                      )}
                  />
                </div>
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

  /* A row: text on the left, the roller (when present) on the right. With
     only the text block as a child the direction is moot — no-roll cells
     render exactly as they always have. The gap governs text-to-chip
     spacing only; single-child cells see none of it. */
  .notice-strip__cell {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    background: var(--md-sys-color-surface-container-lowest);
  }

  /* The text half of the cell: the column the cell itself used to be, same
     0.125rem rhythm between eyebrow, label and body. It yields to the chip
     (flex: 1) and, with min-width: 0, long bodies wrap inside it instead of
     squeezing the chip out of the cell. */
  .notice-strip__content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
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

  /* The notice's roller (a PanelDiceLine): the cell's row centers it
     against the text block. Chip styling, focus and roll states are the
     dice line's own — nothing re-specified here. */
  .notice-strip__roll {
    flex-shrink: 0;
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
