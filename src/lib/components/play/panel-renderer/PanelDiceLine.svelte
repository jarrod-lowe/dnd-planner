<script lang="ts">
  import { resolveValueSource } from './resolveValueSource';
  import { rollTypeKey } from './rollType';
  import DamageTypeIcon from './DamageTypeIcon.svelte';
  import { nextDiceLineId } from './diceLineId';
  import type { CritMode, DiceLineControl, DiceEntry, RollModifier, RollResult } from './types';
  import type { Facts, VarDefinition } from '$lib/rules-view';
  import { t } from '$lib/i18n';

  interface Props {
    control: DiceLineControl;
    editable: boolean;
    facts: Facts;
    vars: Record<string, VarDefinition>;
    selections?: Record<string, unknown>;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRoll?: (data: RollResult, dieIndex: number) => void;
    gwfActive?: boolean;
    modifiers?: RollModifier[];
  }

  let {
    control,
    editable,
    facts,
    vars,
    selections = {},
    onSelectionChange: _onSelectionChange,
    onRoll,
    gwfActive = false,
    modifiers = []
  }: Props = $props();

  void _onSelectionChange;

  // Unique per component instance so two dice-line panels on the same page don't
  // collide on popover/trigger ids (which would also break aria-controls).
  const uid = nextDiceLineId();

  type RollMode = 'normal' | 'advantage' | 'disadvantage';

  interface RangeEntry {
    distance: number;
    type: string;
    disadvantage?: boolean;
    label?: string;
    damageDie?: number;
    extraHands?: number;
  }

  let rangeIndex = $state(
    selections && typeof selections.rangeIndex === 'number' ? selections.rangeIndex : 0
  );
  // Ephemeral, exactly like rangeIndex: a modifier switched off for one
  // situational roll (an Aura of Protection save while Incapacitated) must not
  // stay off for the rest of the session. Keyed by annotation key; an absent
  // entry means "as authored", so a changing `modifiers` prop needs no syncing.
  let modifierState = $state<Record<string, boolean>>({});

  const modifierOn = (m: RollModifier): boolean => modifierState[m.key] ?? m.defaultOn;

  function toggleModifier(m: RollModifier): void {
    if (!editable) return;
    modifierState = { ...modifierState, [m.key]: !modifierOn(m) };
  }

  // A modifier is only shown when some die on this line has its purpose —
  // otherwise a save bonus would appear on a weapon panel with nothing to modify.
  const shownModifiers = $derived(
    modifiers.filter((m) => control.dice.some((d) => d.purpose === m.appliesTo))
  );

  const activeModifiersFor = (die: DiceEntry): RollModifier[] =>
    shownModifiers.filter((m) => m.appliesTo === die.purpose && modifierOn(m));

  function formatModifier(m: RollModifier): string {
    return `${$t(m.label)} ${m.value >= 0 ? '+' : ''}${m.value}`;
  }
  let rollResults = $state<Record<number, RollResult>>({});
  let rollMode = $state<RollMode>('normal');
  let openDieIndex = $state(-1);
  // The Popover API methods are absent in jsdom and older browsers; typed as
  // optional so the guarded calls below compile and no-op where unsupported.
  type PopoverElement = HTMLElement & {
    showPopover?: () => void;
    hidePopover?: () => void;
  };
  const popoverRefs: Record<number, PopoverElement> = $state({});
  const triggerRefs: Record<number, HTMLElement> = $state({});
  let openedByKeyboard = false;
  // Which end of the menu to focus when a keyboard open lands (ArrowDown → first,
  // ArrowUp → last). Set by onTriggerKeydown, consumed by the toggle handler.
  let pendingFocusEnd: 'first' | 'last' = 'first';

  const chipRefs: Record<number, HTMLElement> = $state({});

  const ranges = $derived(
    control.ranges
      ? (resolveValueSource(control.ranges, facts, vars, selections) as RangeEntry[] | undefined)
      : undefined
  );

  const currentRange = $derived(
    ranges && ranges.length > 0 ? ranges[rangeIndex % ranges.length] : undefined
  );

  const rulesDisadvantage = $derived(
    control.advantage ? !!resolveValueSource(control.advantage, facts, vars, selections) : false
  );

  const defaultRollMode = $derived<RollMode>(
    rulesDisadvantage || currentRange?.disadvantage ? 'disadvantage' : 'normal'
  );

  const effectiveRollMode = $derived<RollMode>(
    defaultRollMode !== 'normal' && rollMode === 'normal' ? defaultRollMode : rollMode
  );

  // Signature of every die's resolved sides x count. Changes whenever the
  // dice you would roll change (slot-level slider, versatile range switch,
  // etc.). Used to invalidate stale roll results below.
  const diceSignature = $derived(
    control.dice.map((d) => `${getDieSides(d) ?? ''}x${getDieCount(d)}`).join('|')
  );
  // A roll total is only meaningful for the dice that produced it; clear stale
  // results when the resolved dice change so a chip never shows a total that no
  // longer matches its current expression.
  $effect(() => {
    void diceSignature;
    rollResults = {};
  });

  function handleRangeTap(): void {
    if (!editable || !ranges || ranges.length <= 1) return;
    rangeIndex = (rangeIndex + 1) % ranges.length;
    const range = ranges[rangeIndex];
    if (_onSelectionChange) {
      _onSelectionChange({
        rangeIndex,
        extraHands: range?.extraHands ?? 0
      });
    }
  }

  function formatRangeText(range: RangeEntry): string {
    if (range.label) return `${range.distance}ft ${range.label}`;
    return `${range.distance}ft`;
  }

  function formatBonus(die: DiceEntry): string {
    if (die.bonus === undefined) return '';
    const value = resolveValueSource(die.bonus, facts, vars, selections) as number | undefined;
    if (value === undefined) return '';
    if (value >= 0) return `+${value}`;
    return `${value}`;
  }

  function getDieCount(die: DiceEntry): number {
    if (die.count === undefined) return 1;
    if (typeof die.count === 'number') return die.count;
    const resolved = resolveValueSource(die.count, facts, vars, selections) as number | undefined;
    return typeof resolved === 'number' && resolved > 0 ? Math.floor(resolved) : 1;
  }

  function formatDieExpression(die: DiceEntry): string {
    const count = getDieCount(die);
    const ct = count > 1 ? `${count}` : '';
    // Check for range-based damage die override (versatile weapons)
    if (die.damageType && currentRange?.damageDie) {
      return `${ct}d${currentRange.damageDie}`;
    }
    let sides: number | undefined;
    if (typeof die.sides === 'number') sides = die.sides;
    else sides = resolveValueSource(die.sides, facts, vars, selections) as number | undefined;
    if (typeof sides !== 'number') return '';
    return `${ct}d${sides}`;
  }

  function formatDamageType(die: DiceEntry): string {
    if (!die.damageType) return '';
    const value = resolveValueSource(die.damageType, facts, vars, selections) as string | undefined;
    return value ?? '';
  }

  function formatDieChip(die: DiceEntry, dieIndex: number): string {
    const result = rollResults[dieIndex];
    if (result !== undefined) {
      const prefix =
        result.mode === 'advantage' ? '▲ ' : result.mode === 'disadvantage' ? '▼ ' : '';
      return `${prefix}${result.total}`;
    }
    let text = formatDieExpression(die);
    text += formatBonus(die);
    return text;
  }

  /**
   * Accessible name for a die chip. Leads with the roll's purpose label (e.g.
   * "To-Hit") when authored, followed by any cosmetic label, then the chip text.
   * Returns undefined when there is nothing to prefix so the button falls back
   * to its text content as the accessible name.
   */
  function dieAriaLabel(die: DiceEntry, dieIndex: number): string | undefined {
    const prefix = [
      die.purpose ? $t(rollTypeKey(die.purpose)) : undefined,
      die.label ? $t(die.label) : undefined,
      rollResults[dieIndex]?.critical ? $t('play.choices.attack.critical') : undefined
    ]
      .filter(Boolean)
      .join(' ');
    if (!prefix) return undefined;
    return `${prefix} ${formatDieChip(die, dieIndex)}`;
  }

  function getDieSides(die: DiceEntry): number | undefined {
    // Check for range-based damage die override (versatile weapons)
    if (die.damageType && currentRange?.damageDie) {
      return currentRange.damageDie;
    }
    if (typeof die.sides === 'number') return die.sides;
    const resolved = resolveValueSource(die.sides, facts, vars, selections) as number | undefined;
    if (typeof resolved === 'number') return resolved;
    return undefined;
  }

  function isD20(die: DiceEntry): boolean {
    return getDieSides(die) === 20;
  }

  // A damage die is eligible for the Normal/Critical selector: not a d20, and
  // either authored as damage or carrying a damage type. Excludes healing dice
  // (purpose 'healing' / unit 'hp', no damageType).
  function isDamageDie(die: DiceEntry): boolean {
    return !isD20(die) && (die.purpose === 'damage' || !!formatDamageType(die));
  }

  // A die earns a split-button options trigger only when it has meaningful roll
  // modes: d20 rolls offer advantage/disadvantage, damage dice offer
  // normal/critical. Healing and other utility dice just roll.
  function hasOptions(die: DiceEntry): boolean {
    return isD20(die) || isDamageDie(die);
  }

  function rollMultiple(sides: number, count: number): number[] {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    return rolls;
  }

  function handleRoll(dieIndex: number, mode?: RollMode, crit?: CritMode): void {
    if (!editable) return;
    const die = control.dice[dieIndex];
    const sides = getDieSides(die);
    if (sides === undefined || sides < 0) return;
    const count = getDieCount(die);
    // Critical hits double the dice rolled, not the modifier. Adv/disadv only
    // apply to the d20 (never crit), so rolledCount === count there.
    const isCrit = crit === 'critical';
    const rolledCount = isCrit ? count * 2 : count;
    const bonus = (resolveValueSource(die.bonus, facts, vars, selections) as number) ?? 0;
    const activeModifiers = activeModifiersFor(die);
    const modifierTotal = activeModifiers.reduce((sum, m) => sum + m.value, 0);
    const rollModeToUse = mode ?? (sides === 20 ? effectiveRollMode : 'normal');
    let natural: number;
    let rolls: number[] | undefined;
    let droppedRoll: number | undefined;
    let gwfFloor: number | undefined;
    if (sides === 0) {
      natural = 0;
    } else if (rollModeToUse === 'advantage') {
      const r1 = rollMultiple(sides, rolledCount);
      const r2 = rollMultiple(sides, rolledCount);
      const s1 = r1.reduce((a, b) => a + b, 0);
      const s2 = r2.reduce((a, b) => a + b, 0);
      natural = Math.max(s1, s2);
      droppedRoll = Math.min(s1, s2);
      rolls = s1 >= s2 ? r1 : r2;
    } else if (rollModeToUse === 'disadvantage') {
      const r1 = rollMultiple(sides, rolledCount);
      const r2 = rollMultiple(sides, rolledCount);
      const s1 = r1.reduce((a, b) => a + b, 0);
      const s2 = r2.reduce((a, b) => a + b, 0);
      natural = Math.min(s1, s2);
      droppedRoll = Math.max(s1, s2);
      rolls = s1 <= s2 ? r1 : r2;
    } else {
      rolls = rollMultiple(sides, rolledCount);
      // Apply Great Weapon Fighting per-die: each damage-die roll of 1 or 2
      // counts as 3, floored before summing so crits and other multi-die rolls
      // total correctly. Single-die keeps the (orig | 3) toast format via
      // gwfFloor; multi-die stores the floored rolls for the breakdown.
      if (gwfActive && die.damageType && sides > 2 && rolls.some((r) => r <= 2)) {
        if (rolledCount === 1) {
          gwfFloor = rolls[0];
          rolls = [3];
        } else {
          rolls = rolls.map((r) => (r <= 2 ? 3 : r));
        }
      }
      natural = rolls.reduce((a, b) => a + b, 0);
    }
    const damageTypeStr = formatDamageType(die) || undefined;
    const result: RollResult = {
      total: natural + bonus + modifierTotal,
      natural,
      mode: sides === 20 ? rollModeToUse : undefined,
      critical: isCrit || undefined,
      droppedRoll,
      bonus: bonus !== 0 ? bonus : undefined,
      sides,
      count: rolledCount > 1 ? rolledCount : undefined,
      rolls: rolledCount > 1 ? rolls : undefined,
      damageType: damageTypeStr,
      unit: die.unit,
      purpose: die.purpose,
      gwfFloor,
      modifiers:
        activeModifiers.length > 0
          ? activeModifiers.map(({ label, value }) => ({ label, value }))
          : undefined
    };
    rollResults[dieIndex] = result;
    rollMode = 'normal';
    onRoll?.(result, dieIndex);
    const el = chipRefs[dieIndex];
    if (el) {
      el.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }],
        { duration: 200 }
      );
    }
  }

  function openOptions(dieIndex: number): void {
    openDieIndex = dieIndex;
    const popover = popoverRefs[dieIndex];
    if (popover && typeof popover.showPopover === 'function') {
      try {
        popover.showPopover();
      } catch {
        // Already open, or unsupported (e.g. jsdom) — state still tracks open.
      }
    }
    // Focus + positioning happen in the toggle handler (fires on a real open).
  }

  function closeOptions(dieIndex: number): void {
    const popover = popoverRefs[dieIndex];
    if (popover && typeof popover.hidePopover === 'function') {
      try {
        popover.hidePopover();
      } catch {
        // Unsupported — fall through to the state reset below.
      }
    }
    openDieIndex = -1;
  }

  // The popover is position:fixed, so a scroll of any ancestor container
  // (plan-stack, intent-stack, active-state strip — scroll doesn't bubble, so
  // none of these reach a plain window listener) would leave the menu detached
  // from its trigger. Listen on the capture phase from the window — it descends
  // to every descendant, catching all such containers — and dismiss.
  $effect(() => {
    if (openDieIndex < 0) return;
    const dismiss = (): void => closeOptions(openDieIndex);
    window.addEventListener('scroll', dismiss, true);
    return () => window.removeEventListener('scroll', dismiss, true);
  });

  function selectRollMode(dieIndex: number, mode: RollMode): void {
    closeOptions(dieIndex);
    handleRoll(dieIndex, mode);
    triggerRefs[dieIndex]?.focus();
  }

  function selectCritMode(dieIndex: number, mode: CritMode): void {
    closeOptions(dieIndex);
    handleRoll(dieIndex, undefined, mode);
    triggerRefs[dieIndex]?.focus();
  }

  interface PopoverToggleEvent {
    newState: 'open' | 'closed';
  }

  // `toggle` fires for native open AND close (light-dismiss / Esc), so keep
  // `openDieIndex` in sync with the browser here rather than managing every
  // close path ourselves.
  function handlePopoverToggle(dieIndex: number, event: Event): void {
    const newState = (event as unknown as PopoverToggleEvent).newState;
    if (newState === 'closed') {
      if (openDieIndex === dieIndex) openDieIndex = -1;
    } else if (newState === 'open') {
      openDieIndex = dieIndex;
      positionPopover(dieIndex);
      if (openedByKeyboard) focusMenuItem(dieIndex, pendingFocusEnd);
    }
  }

  // Keyboard handling for the menu trigger. Enter/Space toggle natively via
  // popovertarget (we just flag keyboard activation so the toggle handler focuses
  // the first item). ArrowDown/ArrowUp open the menu and focus the first/last item.
  function onTriggerKeydown(event: KeyboardEvent, dieIndex: number): void {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      openedByKeyboard = true;
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openedByKeyboard = true;
      pendingFocusEnd = event.key === 'ArrowDown' ? 'first' : 'last';
      if (openDieIndex !== dieIndex) {
        openOptions(dieIndex);
      } else {
        focusMenuItem(dieIndex, pendingFocusEnd);
      }
    }
  }

  // ARIA menu keyboard model inside the open popover: arrows cycle, Home/End jump,
  // Escape closes and returns focus to the trigger. Enter/Space select natively.
  function onMenuKeydown(event: KeyboardEvent, dieIndex: number): void {
    const popover = popoverRefs[dieIndex];
    if (!popover) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOptions(dieIndex);
      triggerRefs[dieIndex]?.focus();
      return;
    }
    const items = Array.from(popover.querySelectorAll('[role="menuitem"]'));
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as Element);
    let nextIndex: number;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex =
        currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    (items[nextIndex] as HTMLElement).focus();
  }

  function focusMenuItem(dieIndex: number, end: 'first' | 'last'): void {
    const items = popoverRefs[dieIndex]?.querySelectorAll('[role="menuitem"]');
    if (!items || items.length === 0) return;
    (items[end === 'first' ? 0 : items.length - 1] as HTMLElement).focus();
  }

  function markPointerOpen(): void {
    openedByKeyboard = false;
  }

  function repositionIfOpen(): void {
    if (openDieIndex >= 0) positionPopover(openDieIndex);
  }

  // Native popovers render in the top layer with no inherent anchor; clamp the
  // menu below (or above) its trigger within the viewport. A no-op in jsdom,
  // where getBoundingClientRect is all zeros.
  function positionPopover(dieIndex: number): void {
    const trigger = triggerRefs[dieIndex];
    const popover = popoverRefs[dieIndex];
    if (!trigger || !popover) return;
    const triggerRect = trigger.getBoundingClientRect();
    if (triggerRect.width === 0 && triggerRect.height === 0) return;
    const gap = 4;
    const padding = 6;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    let left = triggerRect.right - width;
    left = Math.max(padding, Math.min(left, window.innerWidth - width - padding));
    let top = triggerRect.bottom + gap;
    if (top + height > window.innerHeight - padding) {
      top = triggerRect.top - height - gap;
    }
    popover.style.left = `${Math.max(padding, left)}px`;
    popover.style.top = `${Math.max(padding, top)}px`;
  }

  const parts = $derived.by<
    {
      type: 'label' | 'range' | 'die' | 'modifier';
      die?: DiceEntry;
      dieIndex?: number;
      modifier?: RollModifier;
    }[]
  >(() => {
    const result: {
      type: 'label' | 'range' | 'die' | 'modifier';
      die?: DiceEntry;
      dieIndex?: number;
      modifier?: RollModifier;
    }[] = [];
    if (control.label) {
      result.push({ type: 'label' });
    }
    if (currentRange) {
      result.push({ type: 'range' });
    }
    for (let di = 0; di < control.dice.length; di++) {
      result.push({ type: 'die', die: control.dice[di], dieIndex: di });
    }
    for (const modifier of shownModifiers) {
      result.push({ type: 'modifier', modifier });
    }
    return result;
  });
</script>

<svelte:window onresize={repositionIfOpen} />

<div class="panel-renderer__dice-line" role="group">
  {#each parts as part, i (i)}
    {#if i > 0}
      <span class="panel-renderer__dice-separator">|</span>
    {/if}
    {#if part.type === 'label'}
      <span class="panel-renderer__range">{$t(control.label!)}</span>
    {:else if part.type === 'range'}
      {#if editable}
        <button
          class="panel-renderer__range"
          class:panel-renderer__range--clickable={ranges && ranges.length > 1}
          type="button"
          onclick={handleRangeTap}
          disabled={!ranges || ranges.length <= 1}
        >
          {formatRangeText(currentRange!)}
        </button>
      {:else}
        <span class="panel-renderer__range">{formatRangeText(currentRange!)}</span>
      {/if}
    {:else if part.type === 'modifier'}
      {@const m = part.modifier!}
      {@const on = modifierOn(m)}
      {#if editable}
        <button
          class="panel-renderer__modifier"
          class:panel-renderer__modifier--on={on}
          type="button"
          aria-pressed={on}
          data-modifier-key={m.key}
          onclick={() => toggleModifier(m)}
        >
          {formatModifier(m)}
        </button>
      {:else}
        <span class="panel-renderer__modifier" data-modifier-key={m.key}>{formatModifier(m)}</span>
      {/if}
    {:else}
      {@const dieIsD20 = isD20(part.die!)}
      {@const dieHasOptions = hasOptions(part.die!)}
      {#if defaultRollMode !== 'normal' && dieIsD20}
        <span class="panel-renderer__disadv-indicator" aria-label="Disadvantage">▼</span>
      {/if}
      <div class="panel-renderer__chip-wrapper">
        {#if part.die!.label}
          <span class="panel-renderer__die-label">{$t(part.die!.label)}</span>
        {/if}
        {#if editable && dieHasOptions}
          <div class="panel-renderer__chip-split">
            <button
              class="panel-renderer__die-chip panel-renderer__die-chip--main"
              aria-label={dieAriaLabel(part.die!, part.dieIndex!)}
              class:panel-renderer__die-chip--crit={rollResults[part.dieIndex!]?.natural === 20}
              class:panel-renderer__die-chip--fumble={rollResults[part.dieIndex!]?.natural === 1}
              class:panel-renderer__die-chip--adv={rollResults[part.dieIndex!]?.mode ===
                'advantage'}
              class:panel-renderer__die-chip--disadv={rollResults[part.dieIndex!]?.mode ===
                'disadvantage'}
              class:panel-renderer__die-chip--crit-damage={rollResults[part.dieIndex!]?.critical}
              type="button"
              data-die-index={part.dieIndex}
              bind:this={chipRefs[part.dieIndex!]}
              onclick={() => handleRoll(part.dieIndex!)}
            >
              {formatDieChip(part.die!, part.dieIndex!)}{#if rollResults[part.dieIndex!]?.critical}
                <span class="panel-renderer__crit-badge" aria-hidden="true">
                  {$t('play.choices.attack.criticalSymbol')}
                </span>
              {/if}
            </button>
            <button
              id="{uid}-trigger-{part.dieIndex}"
              class="panel-renderer__options-trigger"
              type="button"
              data-die-index={part.dieIndex}
              popovertarget="{uid}-popover-{part.dieIndex}"
              aria-haspopup="menu"
              aria-expanded={openDieIndex === part.dieIndex}
              aria-controls="{uid}-popover-{part.dieIndex}"
              aria-label={$t('play.choices.attack.optionsLabel', {
                label:
                  dieAriaLabel(part.die!, part.dieIndex!) ??
                  formatDieChip(part.die!, part.dieIndex!)
              })}
              bind:this={triggerRefs[part.dieIndex!]}
              onpointerdown={markPointerOpen}
              onkeydown={(e) => onTriggerKeydown(e, part.dieIndex!)}
            >
              <svg class="panel-renderer__chevron" aria-hidden="true" viewBox="0 0 16 16">
                <path
                  d="M4 6l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <div
              id="{uid}-popover-{part.dieIndex}"
              class="panel-renderer__popover"
              data-die-index={part.dieIndex}
              popover="auto"
              role="menu"
              tabindex="-1"
              aria-label={$t('play.choices.attack.rollMode')}
              bind:this={popoverRefs[part.dieIndex!]}
              ontoggle={(e) => handlePopoverToggle(part.dieIndex!, e)}
              onkeydown={(e) => onMenuKeydown(e, part.dieIndex!)}
            >
              {#if isDamageDie(part.die!)}
                <button
                  type="button"
                  class="panel-renderer__popover-item"
                  role="menuitem"
                  data-crit-mode="normal"
                  onclick={() => selectCritMode(part.dieIndex!, 'normal')}
                >
                  {$t('play.choices.attack.normal')}
                </button>
                <button
                  type="button"
                  class="panel-renderer__popover-item"
                  role="menuitem"
                  data-crit-mode="critical"
                  aria-label={$t('play.choices.attack.critical')}
                  onclick={() => selectCritMode(part.dieIndex!, 'critical')}
                >
                  {$t('play.choices.attack.criticalSymbol')}
                  {$t('play.choices.attack.critical')}
                </button>
              {:else}
                <button
                  type="button"
                  class="panel-renderer__popover-item"
                  role="menuitem"
                  data-roll-mode="advantage"
                  onclick={() => selectRollMode(part.dieIndex!, 'advantage')}
                >
                  {$t('play.choices.attack.advantage')}
                </button>
                <button
                  type="button"
                  class="panel-renderer__popover-item"
                  role="menuitem"
                  data-roll-mode="normal"
                  onclick={() => selectRollMode(part.dieIndex!, 'normal')}
                >
                  {$t('play.choices.attack.normal')}
                </button>
                <button
                  type="button"
                  class="panel-renderer__popover-item"
                  role="menuitem"
                  data-roll-mode="disadvantage"
                  onclick={() => selectRollMode(part.dieIndex!, 'disadvantage')}
                >
                  {$t('play.choices.attack.disadvantage')}
                </button>
              {/if}
            </div>
          </div>
        {:else if editable}
          <button
            class="panel-renderer__die-chip"
            aria-label={dieAriaLabel(part.die!, part.dieIndex!)}
            class:panel-renderer__die-chip--crit={rollResults[part.dieIndex!]?.natural === 20}
            class:panel-renderer__die-chip--fumble={rollResults[part.dieIndex!]?.natural === 1}
            class:panel-renderer__die-chip--adv={rollResults[part.dieIndex!]?.mode === 'advantage'}
            class:panel-renderer__die-chip--disadv={rollResults[part.dieIndex!]?.mode ===
              'disadvantage'}
            class:panel-renderer__die-chip--crit-damage={rollResults[part.dieIndex!]?.critical}
            type="button"
            data-die-index={part.dieIndex}
            bind:this={chipRefs[part.dieIndex!]}
            onclick={() => handleRoll(part.dieIndex!)}
          >
            {formatDieChip(part.die!, part.dieIndex!)}{#if rollResults[part.dieIndex!]?.critical}
              <span class="panel-renderer__crit-badge" aria-hidden="true">
                {$t('play.choices.attack.criticalSymbol')}
              </span>
            {/if}
          </button>
        {:else}
          <span class="panel-renderer__die-chip">{formatDieChip(part.die!, part.dieIndex!)}</span>
        {/if}
      </div>
      {#if !dieIsD20 && formatDamageType(part.die!)}
        <span class="panel-renderer__damage-type-icon">
          <DamageTypeIcon type={formatDamageType(part.die!)} />
        </span>
      {/if}
    {/if}
  {/each}
</div>

<style>
  .panel-renderer__dice-line {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .panel-renderer__dice-separator {
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
  }

  .panel-renderer__range {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: transparent;
    border: none;
    padding: 0;
    cursor: default;
    white-space: nowrap;
  }

  .panel-renderer__range--clickable {
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
  }

  .panel-renderer__range--clickable:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  /* Shaped like the range chip (same surface, border, radius) but a toggle
     rather than a cycle: modifiers stack independently, so each gets its own
     on/off chip. The on state uses the secondary-container pair so an active
     modifier reads as filled without inventing a colour. */
  .panel-renderer__modifier {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    white-space: nowrap;
  }

  button.panel-renderer__modifier {
    cursor: pointer;
    touch-action: manipulation;
  }

  /* Filled, reusing the same primary pair the nat-20 die chip uses for its
     "active" look. The secondary-container pair was tried first and is a near
     match for surface-container in the light theme (rgb(255 218 216) vs
     rgb(252 234 232)) — the toggle read as inert because its two states were
     indistinguishable. State must be visible, not just announced. */
  .panel-renderer__modifier--on {
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }

  /* Scoped to the off state: an unscoped :hover outranks --on (0,2,1 vs 0,1,0)
     and would repaint a hovered active chip as though it were off. */
  button.panel-renderer__modifier:not(.panel-renderer__modifier--on):hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__die-label {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    margin-right: var(--spacing-xs);
    white-space: nowrap;
  }

  .panel-renderer__disadv-indicator {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-error);
  }

  .panel-renderer__chip-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .panel-renderer__die-chip {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    white-space: nowrap;
  }

  button.panel-renderer__die-chip:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  span.panel-renderer__die-chip {
    cursor: default;
    background: transparent;
    border: none;
    padding: 0;
  }

  .panel-renderer__die-chip--crit {
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }

  .panel-renderer__die-chip--fumble {
    color: var(--md-sys-color-on-error);
    background: var(--md-sys-color-error);
    border-color: var(--md-sys-color-error);
  }

  /* Critical damage: distinct tertiary accent border so it never collides with
     the d20 nat-20 primary-fill crit style. */
  .panel-renderer__die-chip--crit-damage {
    border-color: var(--md-sys-color-tertiary);
  }

  .panel-renderer__crit-badge {
    font-size: var(--font-size-md);
    margin-left: var(--spacing-xs);
  }

  .panel-renderer__chip-split {
    display: inline-flex;
    align-items: stretch;
    isolation: isolate;
  }

  .panel-renderer__die-chip--main {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  /* The right half of a split chip: a distinct element (not a .die-chip) so
     tests and code that expect one die-chip per die keep working. Shares the
     chip's surface styling but is narrower and rounds only its right corners. */
  .panel-renderer__options-trigger {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    margin-inline-start: -1px;
    padding: var(--spacing-xs);
    display: grid;
    place-items: center;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .panel-renderer__options-trigger:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__chevron {
    width: 0.75rem;
    height: 0.75rem;
  }

  /* The trigger sits immediately beside the main chip, so match roll-state
     styling via an adjacent-sibling selector — the chevron fills with the
     crit/fumble colour instead of looking detached. The main chip styles itself
     via the .die-chip--* rules above. */
  .panel-renderer__die-chip--crit + .panel-renderer__options-trigger {
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }

  .panel-renderer__die-chip--fumble + .panel-renderer__options-trigger {
    color: var(--md-sys-color-on-error);
    background: var(--md-sys-color-error);
    border-color: var(--md-sys-color-error);
  }

  .panel-renderer__die-chip--crit-damage + .panel-renderer__options-trigger {
    border-color: var(--md-sys-color-tertiary);
  }

  /* Native popover. Only apply `display` under :popover-open — setting it on the
     base rule would override the UA's display:none for a closed popover and leave
     the menu permanently visible. The ::backdrop stays transparent for
     light-dismiss. */
  .panel-renderer__popover {
    position: fixed;
    inset: auto;
    margin: 0;
    flex-direction: column;
    gap: 1px;
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .panel-renderer__popover:popover-open {
    display: flex;
  }

  .panel-renderer__popover::backdrop {
    background: transparent;
  }

  .panel-renderer__popover-item {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
    background: transparent;
    border: none;
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }

  .panel-renderer__popover-item:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer__damage-type-icon {
    display: inline-flex;
    align-items: center;
    width: 1rem;
    height: 1rem;
    color: var(--md-sys-color-on-surface);
  }

  .panel-renderer__damage-type-icon :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
