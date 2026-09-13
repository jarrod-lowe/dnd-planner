<script module lang="ts">
  import { enumeratePreparableSpells } from '$lib/rules-engine/preparedSpells';
  import type { PrepareDef, RuleModule } from '$lib/rules-engine/types';
  import type { SpellPrepareControl } from './types';

  /**
   * Whether this control has nothing to show (no preparable spells among the
   * character's modules). Exported so `PanelRenderer` can decide whether to
   * render this control's `.panel-renderer__control` wrapper at all — see
   * `textInputIsEmpty` in `PanelTextInput.svelte` for why this must be
   * resolved before mounting, not signalled back from a mounted instance.
   */
  export function spellPrepareIsEmpty(
    _control: SpellPrepareControl,
    modules: RuleModule[],
    _selections: Record<string, unknown>
  ): boolean {
    return enumeratePreparableSpells(modules).length === 0;
  }
</script>

<script lang="ts">
  import { t } from '$lib/i18n';
  import { SvelteMap } from 'svelte/reactivity';
  import { nextSpellPrepareId } from './spellPrepareId';
  import type { Facts } from '$lib/rules-view';

  /**
   * The prepared-spells picker for `set-prepared-spells`.
   *
   * The unit of choice is the WHOLE prepared set, so every row is one
   * preparable spell and a tick adds/removes that spell's own `PrepareDef`
   * from the selection array — the offer commits the array as one replacement
   * effect. The rows are not authored: `enumeratePreparableSpells` derives
   * them from the spell modules the character has assigned, which is why
   * adding a spell needs no change here.
   *
   * The counter reads the SELECTION, never the derived prepared-count fact:
   * facts lag the plan, so they would disagree with the boxes mid-choice.
   * Always-prepared spells (a grant writing `alwaysPrepared` to 1) render
   * locked — checked and disabled — and never count toward the cap, the same
   * exclusion the count derive applies.
   */

  interface Props {
    control: SpellPrepareControl;
    editable: boolean;
    /** The character's resolved modules — the same array the engine evaluates. */
    modules?: RuleModule[];
    /** Carries `spellcasting.prepared.max` and each spell's `alwaysPrepared` grant. */
    facts?: Facts;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    /** Collapsed-row short form: the counter only — no rows, no fieldsets. */
    summary?: boolean;
  }

  let {
    control,
    editable,
    modules = [],
    facts = {},
    selections = {},
    onSelectionChange,
    summary = false
  }: Props = $props();

  const MAX_FACT = 'spellcasting.prepared.max';

  function readFact(name: string): number {
    const value = facts[name];
    return typeof value === 'number' ? value : 0;
  }

  function isAlwaysPrepared(def: PrepareDef): boolean {
    return readFact(def.alwaysPreparedFact) === 1;
  }

  /** The current selection, read back defensively: persisted selections are
   *  JSON that outlived the evaluation that produced them. */
  const selectedDefs = $derived.by(() => {
    const raw = selections[control.var];
    return Array.isArray(raw) ? (raw as PrepareDef[]) : [];
  });

  function isSelected(def: PrepareDef): boolean {
    return selectedDefs.some((s) => s.spellId === def.spellId);
  }

  const counted = $derived(selectedDefs.filter((def) => !isAlwaysPrepared(def)).length);
  const max = $derived(readFact(MAX_FACT));
  // Over-cap is flagged, never prevented — the same illegal-but-permitted
  // contract the offer's over-cap diagnostic applies on commit.
  const overCap = $derived(counted > max);

  /** One group per spell level, rows alphabetical by TRANSLATED name. */
  const levelGroups = $derived.by(() => {
    const byLevel = new SvelteMap<number, PrepareDef[]>();
    for (const def of enumeratePreparableSpells(modules)) {
      const rows = byLevel.get(def.level) ?? [];
      rows.push(def);
      byLevel.set(def.level, rows);
    }
    return Array.from(byLevel.entries())
      .map(([level, rows]) => ({
        level,
        rows: [...rows].sort((a, b) => $t(a.nameKey).localeCompare($t(b.nameKey)))
      }))
      .sort((a, b) => a.level - b.level);
  });

  // Unique per instance: the group links to its counter via aria-describedby.
  const counterId = nextSpellPrepareId();

  function toggle(def: PrepareDef, checked: boolean): void {
    const others = selectedDefs.filter((s) => s.spellId !== def.spellId);
    onSelectionChange?.({ [control.var]: checked ? [...others, def] : others });
  }
</script>

{#snippet counter()}
  <span
    id={counterId}
    class="spell-prepare__counter"
    class:spell-prepare__counter--illegal={overCap}
    aria-live="polite"
  >
    {$t('play.spellPrepare.counter', { count: String(counted), max: String(max) })}
  </span>
{/snippet}

{#if summary}
  {@render counter()}
{:else}
  <div
    class="spell-prepare"
    role="group"
    aria-label={$t('play.spellPrepare.groupLabel')}
    aria-describedby={counterId}
  >
    {@render counter()}
    {#each levelGroups as group (group.level)}
      <fieldset class="spell-prepare__level">
        <legend class="spell-prepare__legend">
          {$t('play.spellPrepare.level', { level: String(group.level) })}
        </legend>
        {#each group.rows as def (def.spellId)}
          {@const locked = isAlwaysPrepared(def)}
          <label
            class="spell-prepare__row"
            class:spell-prepare__row--locked={locked}
            data-spell-id={def.spellId}
          >
            <input
              type="checkbox"
              data-spell-id={def.spellId}
              checked={locked || isSelected(def)}
              disabled={!editable || locked}
              onchange={(event) => toggle(def, event.currentTarget.checked)}
            />
            <span class="spell-prepare__name">{$t(def.nameKey)}</span>
            {#if locked}
              <span class="spell-prepare__hint">{$t('play.spellPrepare.alwaysPrepared')}</span>
            {/if}
          </label>
        {/each}
      </fieldset>
    {/each}
  </div>
{/if}

<style>
  .spell-prepare {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .spell-prepare__counter {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }

  /* The same illegal treatment every diagnostic in the app wears: the theme's
     error colour (see warning-indicator--illegal, mod-chip__illegal-icon). */
  .spell-prepare__counter--illegal {
    color: var(--md-sys-color-error);
    font-weight: 600;
  }

  .spell-prepare__level {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin: 0;
    padding: 0;
    border: none;
  }

  .spell-prepare__legend {
    padding: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--md-sys-color-on-surface-variant);
  }

  /* One spell. Tablet-sized tap target — the whole row toggles, being a label. */
  .spell-prepare__row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    color: var(--md-sys-color-on-surface);
    font-family: var(--font-body);
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .spell-prepare__row:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .spell-prepare__row:has(input:focus-visible) {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .spell-prepare__row--locked {
    cursor: default;
  }

  .spell-prepare__row--locked:hover {
    background: transparent;
  }

  .spell-prepare__row input[type='checkbox'] {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--md-sys-color-primary);
  }

  .spell-prepare__hint {
    margin-left: auto;
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
