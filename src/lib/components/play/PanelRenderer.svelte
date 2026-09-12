<script lang="ts">
  import { t } from '$lib/i18n';
  import { toast } from 'svelte-sonner';
  import WarningIndicator from './WarningIndicator.svelte';
  import { extractPanelDescriptor } from './panel-renderer/extractPanelDescriptor';
  import { resolveValueSource } from './panel-renderer/resolveValueSource';
  import { rollTypeKey } from './panel-renderer/rollType';
  import PanelSlider from './panel-renderer/PanelSlider.svelte';
  import PanelDiceLine, { diceLineIsEmpty } from './panel-renderer/PanelDiceLine.svelte';
  import PanelHitDice, { hitDiceIsEmpty } from './panel-renderer/PanelHitDice.svelte';
  import PanelSelect, { selectIsEmpty } from './panel-renderer/PanelSelect.svelte';
  import PanelTextInput, { textInputIsEmpty } from './panel-renderer/PanelTextInput.svelte';
  import PanelSegmented, { segmentedIsEmpty } from './panel-renderer/PanelSegmented.svelte';
  import PanelLoadout, { loadoutIsEmpty } from './panel-renderer/PanelLoadout.svelte';
  import DiceRollToast from './panel-renderer/DiceRollToast.svelte';
  import { evaluateCondition } from '$lib/play/panelCondition';
  import { getMatchingAnnotations } from '$lib/play/annotations';
  import type {
    AvailableRuleEntry,
    Facts,
    Annotation,
    AnnotationAction,
    RiderValue
  } from '$lib/rules-view';
  import type { EffectInstance } from '$lib/rules-engine';
  import type { RuleModule } from '$lib/rules-engine/types';
  import type {
    TextInformation,
    CountdownInformation,
    RollResult,
    RollModifier
  } from './panel-renderer/types';

  interface Props {
    entry: AvailableRuleEntry;
    editable?: boolean;
    onTap?: () => void;
    facts?: Facts;
    /**
     * The character's resolved modules. Only the loadout control needs them:
     * its rows are enumerated from the items the character actually has, so
     * they cannot be authored into the offer.
     */
    modules?: RuleModule[];
    selections?: Record<string, unknown>;
    activeAnnotations?: Annotation[];
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRemove?: () => void;
    removeLabel?: string;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onFollowup?: (effect: EffectInstance) => void;
    /**
     * Plans the offer an annotation advises (`annotation.addsToPlan`, resolved
     * by `resolveAnnotationOffer`). Most annotations are advisory — "Heroic
     * Inspiration available", "Extra Attack: you can attack again" — and one
     * that says what it is advising becomes a tap-to-plan shortcut instead of a
     * reminder the player then has to act on by hand. Absent (or a non-editable
     * picker panel) → every annotation stays read-only text.
     */
    onAddOfferToPlan?: (offerId: string, seed?: Record<string, unknown>) => void;
    /**
     * The offer ids currently addable — the post-plan catalog the store resolves
     * a tap against. An annotation is only actionable when the offer it advises
     * is in here, so the button can never outlive the offer behind it. Absent
     * means deny, not allow: a caller that forgets to wire it shows a missing
     * button, which is visible, rather than a dead one, which is silent.
     */
    addableOfferIds?: Set<string>;
    onRoll?: (data: RollResult, dieIndex: number) => void;
    /**
     * Renders the collapsed-row short form: header, description, followups,
     * the secondary enable button, and any secondary control still gated
     * behind `enabled.button` (not yet activated) are all suppressed. The
     * control components themselves keep rendering — they stay mounted so
     * per-control state (e.g. `PanelDiceLine`'s rolled results) survives the
     * collapse/expand toggle — and grow their own short forms separately.
     */
    summary?: boolean;
  }

  let {
    entry,
    editable = false,
    onTap,
    facts = {},
    modules = [],
    selections = {},
    activeAnnotations = [],
    onSelectionChange,
    onRemove,
    removeLabel = 'play.plan.remove',
    canMoveUp = true,
    canMoveDown = true,
    onMoveUp,
    onMoveDown,
    onFollowup,
    onAddOfferToPlan,
    addableOfferIds,
    onRoll,
    summary = false
  }: Props = $props();

  const descriptor = $derived(extractPanelDescriptor(entry.rule));

  const displayName = $derived(
    descriptor.name ? $t(descriptor.name) : entry.rule.description || entry.rule.id
  );

  const displayDescription = $derived.by(() => {
    if (!descriptor.description) return undefined;
    if (descriptor.descriptionValues) {
      const params: Record<string, string> = {};
      for (const [key, source] of Object.entries(descriptor.descriptionValues)) {
        const resolved = resolveValueSource(source, facts, vars, selections);
        if (resolved !== undefined) {
          // Resolve through $t() first (the value is typically an i18n key)
          params[key] = typeof resolved === 'string' ? $t(resolved) : String(resolved);
        }
      }
      return $t(descriptor.description, params);
    }
    return $t(descriptor.description);
  });

  const hasWarning = $derived(!entry.legal || !entry.applicable);
  const warningType = $derived(
    !entry.legal ? ('illegal' as const) : !entry.applicable ? ('inapplicable' as const) : null
  );

  const warningMessage = $derived.by(() => {
    if (!hasWarning || !entry.diagnostics?.length) return undefined;
    return entry.diagnostics.map((d) => $t(d.code)).join('\n');
  });

  const vars = $derived(entry.rule.vars ?? {});

  const primarySlider = $derived(
    descriptor.primaryControl?.type === 'slider' ? descriptor.primaryControl : undefined
  );
  const primaryDiceLine = $derived(
    descriptor.primaryControl?.type === 'dice-line' ? descriptor.primaryControl : undefined
  );
  const primaryHitDice = $derived(
    descriptor.primaryControl?.type === 'hit-dice' ? descriptor.primaryControl : undefined
  );
  const primarySelect = $derived(
    descriptor.primaryControl?.type === 'select' ? descriptor.primaryControl : undefined
  );
  const primaryTextInput = $derived(
    descriptor.primaryControl?.type === 'text' ? descriptor.primaryControl : undefined
  );
  const primaryLoadout = $derived(
    descriptor.primaryControl?.type === 'loadout' ? descriptor.primaryControl : undefined
  );
  const secondarySlider = $derived(
    descriptor.secondaryControl?.type === 'slider' ? descriptor.secondaryControl : undefined
  );

  // A control that renders nothing in summary mode (an empty text input, an
  // unselected loadout, a select with no matching option) must not get a
  // `.panel-renderer__control` wrapper — the separator (see `showsPrimary*`/
  // `before*` below) is only ever emitted next to a wrapper that actually
  // renders, so an empty-but-present wrapper would still leave a separator
  // with nothing real beside it: dangling if it's first/last, doubled if two
  // sit together. Resolved here, from the same facts/vars/selections the
  // control itself would read, so the wrapper's presence is decided WITHOUT
  // mounting the control first — a mount-then-discover-it's-empty approach
  // would either duplicate this same resolution logic again or force an
  // unmount right after mount.
  const primarySelectEmpty = $derived(
    primarySelect ? selectIsEmpty(primarySelect, facts, vars, selections) : false
  );
  const primaryTextInputEmpty = $derived(
    primaryTextInput ? textInputIsEmpty(primaryTextInput, facts, vars, selections) : false
  );
  const primaryLoadoutEmpty = $derived(
    primaryLoadout ? loadoutIsEmpty(primaryLoadout, modules, selections) : false
  );
  const primaryHitDiceEmpty = $derived(
    primaryHitDice ? hitDiceIsEmpty(primaryHitDice, facts, vars, selections) : false
  );
  const primaryDiceLineEmpty = $derived(
    primaryDiceLine ? diceLineIsEmpty(primaryDiceLine, facts, vars, selections) : false
  );

  let secondaryActivated = $state(false);

  const secondaryConditionMet = $derived(
    !descriptor.secondaryControl?.enabled
      ? true
      : evaluateCondition(descriptor.secondaryControl.enabled.condition, facts, new Set())
  );

  const secondaryShouldRender = $derived(
    descriptor.secondaryControl
      ? secondaryConditionMet
        ? descriptor.secondaryControl.enabled
          ? descriptor.secondaryControl.enabled.button
            ? secondaryActivated
            : true
          : true
        : false
      : false
  );

  const secondaryShowEnableButton = $derived(
    descriptor.secondaryControl?.enabled
      ? secondaryConditionMet && !secondaryActivated && !!descriptor.secondaryControl.enabled.button
      : false
  );

  const secondaryDiceLine = $derived(
    descriptor.secondaryControl?.type === 'dice-line' ? descriptor.secondaryControl : undefined
  );
  const secondaryHitDice = $derived(
    descriptor.secondaryControl?.type === 'hit-dice' ? descriptor.secondaryControl : undefined
  );
  const secondarySelect = $derived(
    descriptor.secondaryControl?.type === 'select' ? descriptor.secondaryControl : undefined
  );
  const secondaryTextInput = $derived(
    descriptor.secondaryControl?.type === 'text' ? descriptor.secondaryControl : undefined
  );
  const secondarySegmented = $derived(
    descriptor.secondaryControl?.type === 'segmented' ? descriptor.secondaryControl : undefined
  );

  // See the primary-side comment above `primarySelectEmpty`.
  const secondarySelectEmpty = $derived(
    secondarySelect ? selectIsEmpty(secondarySelect, facts, vars, selections) : false
  );
  const secondaryTextInputEmpty = $derived(
    secondaryTextInput ? textInputIsEmpty(secondaryTextInput, facts, vars, selections) : false
  );
  const secondaryHitDiceEmpty = $derived(
    secondaryHitDice ? hitDiceIsEmpty(secondaryHitDice, facts, vars, selections) : false
  );
  const secondarySegmentedEmpty = $derived(
    secondarySegmented ? segmentedIsEmpty(secondarySegmented, facts, vars, selections) : false
  );
  const secondaryDiceLineEmpty = $derived(
    secondaryDiceLine ? diceLineIsEmpty(secondaryDiceLine, facts, vars, selections) : false
  );

  const textInfos = $derived(
    (
      descriptor.information?.filter((info): info is TextInformation => info.type === 'text') ?? []
    ).map((info) => {
      if (info.labelValues) {
        const params: Record<string, string> = {};
        for (const [key, source] of Object.entries(info.labelValues)) {
          const resolved = resolveValueSource(source, facts, vars, selections);
          if (resolved !== undefined) {
            params[key] = String(resolved);
          }
        }
        return $t(info.label, params);
      }
      return $t(info.label);
    })
  );

  const countdownInfos = $derived(
    (
      descriptor.information?.filter(
        (info): info is CountdownInformation => info.type === 'countdown'
      ) ?? []
    )
      .map((info, index) => {
        const filled =
          entry.rule.ui?.countDown != null
            ? entry.rule.ui.countDown
            : resolveValueSource(info.filled, facts, vars, selections);
        const total =
          entry.rule.ui?.duration != null
            ? entry.rule.ui.duration
            : resolveValueSource(info.total, facts, vars, selections);
        if (typeof filled !== 'number' || typeof total !== 'number') return null;
        const empty = total - filled;
        return {
          index,
          filledIndices: Array.from({ length: filled }, (_, i) => i),
          emptyIndices: Array.from({ length: empty }, (_, i) => i),
          filled,
          total
        };
      })
      .filter(
        (
          v
        ): v is {
          index: number;
          filledIndices: number[];
          emptyIndices: number[];
          filled: number;
          total: number;
        } => v !== null
      )
  );

  // Whether each summary-mode item actually renders — mirrors the template's
  // `{#if}` gates for that same control exactly, so there is one source of
  // truth for both "does this control's `.panel-renderer__control` wrapper
  // appear" and "does a separator sit in front of it" (see the `before*`
  // flags below). A control that is empty-and-suppressed (see the
  // `*Empty` derivations above) contributes `false` here, same as it
  // contributes no wrapper.
  const showsPrimarySlider = $derived(!!primarySlider);
  const showsPrimaryDiceLine = $derived(!!primaryDiceLine && !primaryDiceLineEmpty);
  const showsPrimaryHitDice = $derived(!!primaryHitDice && !primaryHitDiceEmpty);
  const showsPrimarySelect = $derived(!!primarySelect && !primarySelectEmpty);
  const showsPrimaryTextInput = $derived(!!primaryTextInput && !primaryTextInputEmpty);
  const showsPrimaryLoadout = $derived(!!primaryLoadout && !primaryLoadoutEmpty);
  const showsSecondarySlider = $derived(secondaryShouldRender && !!secondarySlider);
  const showsSecondaryDiceLine = $derived(
    secondaryShouldRender && !!secondaryDiceLine && !secondaryDiceLineEmpty
  );
  const showsSecondaryHitDice = $derived(
    secondaryShouldRender && !!secondaryHitDice && !secondaryHitDiceEmpty
  );
  const showsSecondarySelect = $derived(
    secondaryShouldRender && !!secondarySelect && !secondarySelectEmpty
  );
  const showsSecondaryTextInput = $derived(
    secondaryShouldRender && !!secondaryTextInput && !secondaryTextInputEmpty
  );
  const showsSecondarySegmented = $derived(
    secondaryShouldRender && !!secondarySegmented && !secondarySegmentedEmpty
  );

  // The separator between collapsed controls is a REAL `aria-hidden` element
  // (see `.panel-renderer__separator` below), not CSS-generated `::before`
  // content — a pseudo-element cannot carry `aria-hidden`, and several
  // screen readers DO expose ::before/::after generated text in the
  // accessibility tree, so a CSS dot would be announced mid-value. Its
  // presence is decided here, in script, rather than a `:not(:first-child)`
  // selector: each `before*` flag below is "has anything already rendered
  // ahead of me in the strip", threaded through in template source order.
  // `primarySlider` is always structurally first, so nothing ever precedes
  // it. This makes a leading, trailing or doubled separator impossible by
  // construction — a separator is only ever emitted immediately before a
  // control block we already know is about to render, and only when we
  // already know at least one earlier control rendered too; nothing ever
  // appends a separator *after* the last item, so there is never a trailing
  // one to hide.
  const beforePrimaryDiceLine = $derived(showsPrimarySlider);
  const beforePrimaryHitDice = $derived(beforePrimaryDiceLine || showsPrimaryDiceLine);
  const beforePrimarySelect = $derived(beforePrimaryHitDice || showsPrimaryHitDice);
  const beforePrimaryTextInput = $derived(beforePrimarySelect || showsPrimarySelect);
  const beforePrimaryLoadout = $derived(beforePrimaryTextInput || showsPrimaryTextInput);
  const beforeSecondarySlider = $derived(beforePrimaryLoadout || showsPrimaryLoadout);
  const beforeSecondaryDiceLine = $derived(beforeSecondarySlider || showsSecondarySlider);
  const beforeSecondaryHitDice = $derived(beforeSecondaryDiceLine || showsSecondaryDiceLine);
  const beforeSecondarySelect = $derived(beforeSecondaryHitDice || showsSecondaryHitDice);
  const beforeSecondaryTextInput = $derived(beforeSecondarySelect || showsSecondarySelect);
  const beforeSecondarySegmented = $derived(beforeSecondaryTextInput || showsSecondaryTextInput);
  const beforeTextInfos = $derived(beforeSecondarySegmented || showsSecondarySegmented);
  const beforeCountdownInfos = $derived(beforeTextInfos || textInfos.length > 0);

  const annotationLabels = $derived(descriptor.annotationLabels ?? []);

  const matchingAnnotations = $derived(getMatchingAnnotations(annotationLabels, activeAnnotations));

  const gwfRiderLabel = 'rule.dnd-5e-2024.fighting-style-great-weapon.rider';

  // Whether Great Weapon Fighting applies to THIS panel is settled upstream: the
  // rule targets `property.versatile` only while the loadout grips two-handed, so a
  // one-handed spear's panel never matches the annotation in the first place. This
  // used to re-decide it here from a per-attack `extraHands` selection — which the
  // loadout change stopped writing, silently killing GWF for every versatile
  // weapon. Deciding which grip earns the reroll is a rule; the panel only renders.
  const gwfActive = $derived(matchingAnnotations.some((ann) => ann.rider?.label === gwfRiderLabel));

  // Resolves a rider's numeric contribution. Only the `flat` kind exists today;
  // `dice` and `floor` are filed follow-ups. An unrecognised kind resolves to
  // undefined so the caller below drops that modifier entirely — no chip is
  // safer than a chip that renders "+0" and looks active while doing nothing.
  // (`RiderValue` is a single-variant type rather than a real discriminated
  // union yet, so TypeScript can't flag a missing case by narrowing to
  // `never` here; when a second kind lands, add its case above and consider
  // an exhaustiveness check then.)
  function resolveRiderValue(value: RiderValue): number | undefined {
    return value.kind === 'flat' ? value.bonus : undefined;
  }

  // A valued rider is REPRESENTED by its dice-line toggle chip, so it must not
  // also appear as a static text chip or in the toast's rider list — it would
  // show twice, and the static copy would still read as present after the
  // toggle is switched off. Everything downstream of the dice line uses this
  // list rather than matchingAnnotations.
  const informationalAnnotations = $derived(
    matchingAnnotations.filter((ann) => ann.rider?.value === undefined)
  );

  // Annotations whose rider carries a value become toggleable chips on the dice
  // line; valueless riders stay the text chips they have always been.
  const rollModifiers = $derived<RollModifier[]>(
    matchingAnnotations
      .filter((ann) => ann.rider?.value !== undefined && ann.rider?.appliesTo !== undefined)
      .map((ann): RollModifier | undefined => {
        const value = resolveRiderValue(ann.rider!.value!);
        if (value === undefined) return undefined;
        return {
          key: ann.key,
          label: ann.rider!.label,
          appliesTo: ann.rider!.appliesTo!,
          value,
          defaultOn: ann.rider!.defaultOn ?? true
        };
      })
      .filter((m): m is RollModifier => m !== undefined)
  );

  const visibleFollowups = $derived(
    editable && onFollowup
      ? (descriptor.followups ?? []).filter(
          (f) => f.type === 'effect' && evaluateCondition(f.condition, facts, new Set())
        )
      : []
  );

  // An annotation is tappable only where a tap is unambiguous: an editable plan
  // panel with a handler. A picker panel is one big tap target that adds its OWN
  // offer, so a nested add-this-other-thing button there would fight it.
  const annotationsActionable = $derived(editable && !!onAddOfferToPlan);

  /**
   * The offer an annotation's tap should plan, or undefined when there is no
   * addable offer behind it — in which case the annotation renders as plain
   * text rather than as a button that would do nothing.
   *
   * `again` means "another of this panel's own offer" (Extra Attack: swing
   * again with the weapon already on the row), so it resolves to `entry.rule.id`.
   *
   * Membership of the addable catalog is the whole test, for both forms, because
   * that catalog is exactly what the store's lookup will consult. Two distinct
   * ways to end up with a row whose offer is not in it, both covered by the one
   * check:
   *  - the offer RAN at its step and a later row closed its gate (a set-loadout
   *    that stows the weapon) — the row still reads `applicable`, since that is
   *    step-time, but the offer is gone from the post-plan catalog;
   *  - the engine SKIPPED the row, so PlanStack renders it from the planned item
   *    itself, whose id is the instance id and is never a catalog member.
   */
  function resolveAnnotationOffer(adds: AnnotationAction): string | undefined {
    const offerId = adds === 'again' ? entry.rule.id : adds.offer;
    return addableOfferIds?.has(offerId) ? offerId : undefined;
  }

  /**
   * The values the new row should open on, read from THIS panel's selections
   * under the names the target offer uses. Life Bond heals the steed for the
   * same number of hit points, so the steed's heal row starts on the amount
   * already set here instead of on zero.
   *
   * A var the player has not set is left out rather than sent as undefined, so
   * the target keeps its own `default` instead of being overridden with nothing.
   */
  function resolveAnnotationSeed(adds: AnnotationAction): Record<string, unknown> | undefined {
    if (adds === 'again' || !adds.seed) return undefined;
    const seeded: Record<string, unknown> = {};
    for (const [targetVar, sourceVar] of Object.entries(adds.seed)) {
      const value = selections[sourceVar];
      if (value !== undefined) seeded[targetVar] = value;
    }
    return seeded;
  }

  function addAnnotationOffer(
    e: MouseEvent,
    offerId: string,
    seed: Record<string, unknown> | undefined
  ) {
    e.stopPropagation();
    onAddOfferToPlan?.(offerId, seed);
  }

  const hasActions = $derived(!!onRemove || !!onMoveUp || !!onMoveDown);

  function handleRemoveClick(e: MouseEvent) {
    e.stopPropagation();
    onRemove?.();
  }

  function handleDiceRoll(result: RollResult, _dieIndex: number) {
    onRoll?.(result, _dieIndex);

    const rollType = $t(rollTypeKey(result.purpose, result));

    const modifiers: string[] = [];
    if (result.mode === 'advantage') modifiers.push($t('play.toast.modifier.advantage'));
    if (result.mode === 'disadvantage') modifiers.push($t('play.toast.modifier.disadvantage'));
    for (const ann of informationalAnnotations) {
      if (ann.rider?.type === 'dice' || ann.rider?.type === 'modifier') {
        modifiers.push($t(ann.rider.label));
      }
    }
    for (const m of result.modifiers ?? []) {
      modifiers.push(`${$t(m.label)} ${m.value >= 0 ? '+' : ''}${m.value}`);
    }

    toast.custom(DiceRollToast, {
      componentProps: {
        title: displayName,
        rollType,
        result,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
        damageTypeKey: result.damageType,
        unitKey: result.unit
      },
      duration: 4000,
      unstyled: true
    });
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="panel-renderer"
  class:panel-renderer--editable={editable}
  class:panel-renderer--summary={summary}
  role={!editable && !summary ? 'button' : undefined}
  tabindex={!editable && !summary ? 0 : undefined}
  aria-label={!editable && !summary
    ? displayName +
      (displayDescription ? `. ${displayDescription}` : '') +
      (hasWarning && warningType
        ? ` (${warningMessage ?? $t(warningType === 'illegal' ? 'play.choices.illegal' : 'play.choices.inapplicable')})`
        : '')
    : undefined}
  onclick={summary ? undefined : onTap}
>
  {#if hasWarning && warningType}
    <WarningIndicator type={warningType} message={warningMessage} />
  {/if}
  <div class="panel-renderer__header">
    <span class="panel-renderer__title">{displayName}</span>
  </div>
  {#if !summary && displayDescription}
    <p class="panel-renderer__description">{displayDescription}</p>
  {/if}
  <div class="panel-renderer__body">
    {#if primarySlider}
      <div class="panel-renderer__control">
        <PanelSlider
          control={primarySlider}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#if primaryDiceLine && (!summary || !primaryDiceLineEmpty)}
      {#if summary && beforePrimaryDiceLine}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control">
        <PanelDiceLine
          control={primaryDiceLine}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          onRoll={handleDiceRoll}
          {gwfActive}
          modifiers={rollModifiers}
          {summary}
        />
      </div>
    {/if}
    {#if primaryHitDice && (!summary || !primaryHitDiceEmpty)}
      {#if summary && beforePrimaryHitDice}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control">
        <PanelHitDice
          control={primaryHitDice}
          {editable}
          {facts}
          {vars}
          {selections}
          advertisedEffects={entry.advertisedEffects}
          {onSelectionChange}
          onRoll={handleDiceRoll}
          {summary}
        />
      </div>
    {/if}
    {#if primarySelect && (!summary || !primarySelectEmpty)}
      {#if summary && beforePrimarySelect}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control">
        <PanelSelect
          control={primarySelect}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#if primaryTextInput && (!summary || !primaryTextInputEmpty)}
      {#if summary && beforePrimaryTextInput}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control">
        <PanelTextInput
          control={primaryTextInput}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#if primaryLoadout && (!summary || !primaryLoadoutEmpty)}
      {#if summary && beforePrimaryLoadout}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control">
        <PanelLoadout
          control={primaryLoadout}
          {editable}
          {modules}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#if secondaryShowEnableButton && !summary}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <button
          class="panel-renderer__enable-button"
          type="button"
          onclick={() => {
            secondaryActivated = true;
          }}
        >
          {$t(descriptor.secondaryControl!.enabled!.button!)}
        </button>
      </div>
    {/if}
    {#if secondaryShouldRender && secondarySlider}
      {#if summary && beforeSecondarySlider}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelSlider
          control={secondarySlider}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#if secondaryShouldRender && secondaryDiceLine && (!summary || !secondaryDiceLineEmpty)}
      {#if summary && beforeSecondaryDiceLine}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelDiceLine
          control={secondaryDiceLine}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          onRoll={handleDiceRoll}
          {gwfActive}
          modifiers={rollModifiers}
          {summary}
        />
      </div>
    {/if}
    {#if secondaryShouldRender && secondaryHitDice && (!summary || !secondaryHitDiceEmpty)}
      {#if summary && beforeSecondaryHitDice}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelHitDice
          control={secondaryHitDice}
          {editable}
          {facts}
          {vars}
          {selections}
          advertisedEffects={entry.advertisedEffects}
          {onSelectionChange}
          onRoll={handleDiceRoll}
          {summary}
        />
      </div>
    {/if}
    {#if secondaryShouldRender && secondarySelect && (!summary || !secondarySelectEmpty)}
      {#if summary && beforeSecondarySelect}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelSelect
          control={secondarySelect}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#if secondaryShouldRender && secondaryTextInput && (!summary || !secondaryTextInputEmpty)}
      {#if summary && beforeSecondaryTextInput}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelTextInput
          control={secondaryTextInput}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#if secondaryShouldRender && secondarySegmented && (!summary || !secondarySegmentedEmpty)}
      {#if summary && beforeSecondarySegmented}
        <span class="panel-renderer__separator" aria-hidden="true">·</span>
      {/if}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelSegmented
          control={secondarySegmented}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
          {summary}
        />
      </div>
    {/if}
    {#each textInfos as text, i (i)}
      {#if summary}
        {#if beforeTextInfos || i > 0}
          <span class="panel-renderer__separator" aria-hidden="true">·</span>
        {/if}
        <span
          class="panel-renderer__control panel-renderer__information panel-renderer__information--text"
          >{text}</span
        >
      {:else}
        <div class="panel-renderer__information panel-renderer__information--text">{text}</div>
      {/if}
    {/each}
    {#each countdownInfos as info, i (info.index)}
      {#if summary}
        <!--
        `filled/total` replaces the marker-dot row: the dots are decorative
        (aria-hidden) and the row's only accessible content is the
        role="img" aria-label below, so plain visible text carrying the same
        two numbers is the equivalent information, not a reduction of it.
      -->
        {#if beforeCountdownInfos || i > 0}
          <span class="panel-renderer__separator" aria-hidden="true">·</span>
        {/if}
        <span class="panel-renderer__control panel-renderer__markers-summary"
          >{info.filled}/{info.total}</span
        >
      {:else}
        <div
          class="panel-renderer__markers"
          role="img"
          aria-label="{info.filled} of {info.total} remaining"
        >
          {#each info.filledIndices as i (i)}
            <span class="panel-renderer__marker panel-renderer__marker--filled" aria-hidden="true"
            ></span>
          {/each}
          {#each info.emptyIndices as i (i)}
            <span class="panel-renderer__marker panel-renderer__marker--empty" aria-hidden="true"
            ></span>
          {/each}
        </div>
      {/if}
    {/each}
    {#if informationalAnnotations.length > 0 && !summary}
      <!--
      Informational annotations (e.g. the Great Weapon Fighting reroll
      reminder) are valueless riders with no number to fold into the strip —
      unlike valued riders, which become dice-line toggle chips. The block
      below is a stacked (flex-column) list, not an inline "word", so
      rendering it in summary mode would add a second line under the strip.
      Summary mode is one line; expand to see the reminder text.
    -->
      <div class="panel-renderer__annotations" role="note">
        {#each informationalAnnotations as annotation (annotation.key)}
          {@const addsOffer =
            annotation.addsToPlan && annotationsActionable
              ? resolveAnnotationOffer(annotation.addsToPlan)
              : undefined}
          {#if addsOffer}
            <!--
              An advisory annotation that names an offer is a shortcut: tapping
              it plans that action exactly as the add-row picker would. The
              accessible name says what the tap does; the plus icon is decorative.
            -->
            <button
              type="button"
              class="panel-renderer__annotation panel-renderer__annotation--action"
              aria-label={$t('play.annotation.addToPlan', { annotation: $t(annotation.key) })}
              onclick={(e) =>
                addAnnotationOffer(e, addsOffer, resolveAnnotationSeed(annotation.addsToPlan!))}
            >
              <span class="panel-renderer__annotation-text">{$t(annotation.key)}</span>
              <span class="panel-renderer__annotation-add" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </span>
            </button>
          {:else}
            <span class="panel-renderer__annotation">{$t(annotation.key)}</span>
          {/if}
        {/each}
      </div>
    {/if}
    {#if visibleFollowups.length > 0 && !summary}
      <div class="panel-renderer__followups" role="group">
        {#each visibleFollowups as followup (followup.button)}
          <button
            type="button"
            class="panel-renderer__followup-button"
            onclick={() => {
              if (followup.type === 'effect') onFollowup?.(followup.addRule.effect);
            }}
          >
            {$t(followup.button)}
          </button>
        {/each}
      </div>
    {/if}
    {#if hasActions && !summary}
      <div class="panel-renderer__actions" role="group" aria-label={$t('play.plan.actions')}>
        {#if onMoveUp}
          <button
            type="button"
            class="panel-renderer__button panel-renderer__button--move-up"
            disabled={!canMoveUp}
            onclick={onMoveUp}
            aria-label={$t('play.plan.moveUp')}
            title={$t('play.plan.moveUp')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
        {/if}
        {#if onMoveDown}
          <button
            type="button"
            class="panel-renderer__button panel-renderer__button--move-down"
            disabled={!canMoveDown}
            onclick={onMoveDown}
            aria-label={$t('play.plan.moveDown')}
            title={$t('play.plan.moveDown')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
        {/if}
        {#if onRemove}
          <button
            type="button"
            class="panel-renderer__button panel-renderer__button--remove"
            onclick={handleRemoveClick}
            aria-label={$t(removeLabel)}
            title={$t(removeLabel)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .panel-renderer {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .panel-renderer:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer--editable {
    cursor: default;
  }

  .panel-renderer--editable:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  /* Collapsed-row short form. The header (title + warning) renders through
     the exact same markup as the expanded row — see the template above,
     which no longer branches on `summary` for either — so this block only
     covers what sits BELOW the header: `.panel-renderer__body`, unconditionally
     wrapping every control/information item, becomes a single line of
     one-word-per-item text (see its own rule below). Padding/border reset to
     zero here so the row reads as plain stacked text, not a card. */
  .panel-renderer--summary {
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    cursor: default;
  }

  .panel-renderer--summary:hover {
    background: transparent;
  }

  /* Non-summary: `display: contents` removes this wrapper from the box model
     entirely, so its children (the controls) lay out as direct flex items of
     `.panel-renderer` exactly as before this wrapper existed — zero visual
     change from introducing it. */
  .panel-renderer__body {
    display: contents;
  }

  /* Summary: every control/information item becomes one inline-flex "word" on
     a single line, in source order (primary control, secondary control, then
     information lines). `PlanRow` renders this as the third of three stacked
     lines (pills / name / this strip) and clips it with ellipsis.

     display stays block deliberately. inline-flex was tried here so this box
     could sit inline next to adjacent text, but an inline-flex box whose
     width resolves from a percentage (100%/max-100%, needed to give
     descendant ellipsis a definite containing-block width) reproducibly
     failed to paint its own text content in Chromium while every
     layout/accessibility signal (getBoundingClientRect, elementFromPoint, the
     a11y tree) reported it laid out correctly — a real browser rendering
     defect, not a logic bug. block + this rule's implicit full-width fill
     sidesteps it. Don't reintroduce inline-flex here. */
  .panel-renderer--summary .panel-renderer__body {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* Codex P2: this was `display: inline-flex`, which clips its own
     overflowing content with no ellipsis — `text-overflow` does not apply
     to a flex container's own overflow the way it does to a block
     container's. When this control is the ONLY child of
     `.panel-renderer__body` (a long loadout label, say), its `max-width:
     100%` caps it at exactly the body's width, so it never overflows the
     body box either — the ancestor's own `text-overflow: ellipsis` (see
     `.panel-renderer__body` above) never gets a chance to fire, and the
     text was hard-clipped mid-character. `inline-block` is still an atomic
     inline-level box for `.panel-renderer__body`'s line layout — so the
     multi-control case is unchanged: a control that doesn't fit at all
     next to its siblings is still dropped whole, with `…` after the last
     one that fits, same as before. What changes is the single-control case:
     an `inline-block` (unlike a flex container) applies `text-overflow` to
     its OWN overflowing inline content, so a lone too-long control now
     ellipsizes itself instead of vanishing past its own hidden edge. */
  .panel-renderer--summary .panel-renderer__control {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    vertical-align: bottom;
    padding-top: 0;
    margin-top: 0;
    border-top: none;
  }

  /* The separator is a REAL `aria-hidden` element (see the template), never
     CSS-generated `::before` content. Generated content can never leak into
     a copy/paste — that part of the old reasoning here was correct — but a
     pseudo-element cannot carry `aria-hidden`, and several screen readers DO
     expose ::before/::after text in the accessibility tree, so a CSS dot
     would have been announced mid-value. `display: inline-block` on
     `.panel-renderer__control` above means a plain inline `<span>` sibling
     sits on the same line without needing its own `display` override. */
  .panel-renderer__separator {
    margin: 0 var(--spacing-xs);
    color: var(--md-sys-color-on-surface-variant);
  }

  .panel-renderer__markers-summary {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
  }

  /* Warning indicator positioned at top-left as overlay */
  .panel-renderer :global(.warning-indicator) {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 2;
  }

  .panel-renderer__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .panel-renderer__title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  /* Collapsed-row line 2 (pills / name+warning / short forms): the name has
     no separate `PlanRow`-owned copy any more — this IS the name line, so it
     needs its own single-line ellipsis. `min-width: 0` lets the flex item
     (the header is `display: flex`) shrink below its content's natural width
     so the ellipsis has room to apply instead of the header just overflowing. */
  .panel-renderer--summary .panel-renderer__header {
    min-width: 0;
  }

  .panel-renderer--summary .panel-renderer__title {
    display: block;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .panel-renderer__description {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }

  /* Actions positioned at top-right inside panel */
  .panel-renderer__actions {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    z-index: 1;
  }

  .panel-renderer__button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer__button:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .panel-renderer__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .panel-renderer__button svg {
    width: 1rem;
    height: 1rem;
  }

  .panel-renderer__button--remove:hover:not(:disabled) {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    border-color: var(--md-sys-color-error);
  }

  .panel-renderer__control {
    padding-top: var(--spacing-xs);
  }

  .panel-renderer__control--secondary {
    border-top: 1px solid var(--md-sys-color-outline-variant);
    margin-top: var(--spacing-xs);
    padding-top: var(--spacing-sm);
  }

  .panel-renderer__enable-button {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-primary);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer__enable-button:hover {
    background: var(--md-sys-color-surface-container);
  }

  .panel-renderer__markers {
    display: flex;
    flex-direction: row;
    gap: var(--spacing-xs);
  }

  .panel-renderer__marker {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .panel-renderer__marker--filled {
    background: var(--md-sys-color-primary);
  }

  .panel-renderer__marker--empty {
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
  }

  .panel-renderer__annotations {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xs);
  }

  /* Sizing lives on the base chip, not on the actionable variant, so the two
     forms stack at the same height. The tappable one needs the 2.75rem touch
     target every other tappable control uses (its own type scale only adds up
     to 28px, well under a thumb), and a reminder sitting beside it at 28px
     reads as a rendering fault rather than as a different kind of thing. It is
     a minimum, not a height: either form still grows when its text wraps, and
     align-items keeps a single line centred in the taller box. `box-sizing:
     border-box` (base.css) is what lets the bordered variant match the
     borderless one exactly. */
  .panel-renderer__annotation {
    display: flex;
    align-items: center;
    min-height: 2.75rem;
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--md-sys-color-on-primary-container);
    background: var(--md-sys-color-primary-container);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    line-height: var(--line-height-md);
  }

  /* The actionable form of the same chip: identical surface and size, plus an
     add affordance and the interactive states a button needs. */
  .panel-renderer__annotation--action {
    justify-content: space-between;
    gap: var(--spacing-sm);
    width: 100%;
    text-align: left;
    border: 1px solid var(--md-sys-color-outline-variant);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .panel-renderer__annotation--action:hover {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }

  .panel-renderer__annotation--action:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .panel-renderer__annotation-add {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
  }

  .panel-renderer__annotation-add svg {
    width: 1rem;
    height: 1rem;
  }

  .panel-renderer__followups {
    display: flex;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xs);
  }

  .panel-renderer__followup-button {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-primary);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer__followup-button:hover {
    background: var(--md-sys-color-surface-container);
  }
</style>
