<script lang="ts">
  import { t } from '$lib/i18n';
  import WarningIndicator from './WarningIndicator.svelte';
  import type { AvailableRuleEntry, Facts, RangeEntry, Followup } from '$lib/rules-engine';
  import { evaluateCondition } from '$lib/rules-engine/conditions';

  interface Props {
    entry: AvailableRuleEntry;
    onTap?: () => void;
    editable?: boolean;
    facts?: Facts;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    // Control buttons (for planned items)
    showControls?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onRemove?: () => void;
    onFollowup?: (rule: import('$lib/rules-engine').Rule) => void;
  }

  let {
    entry,
    onTap,
    editable = false,
    facts = {},
    onSelectionChange,
    showControls = false,
    canMoveUp = true,
    canMoveDown = true,
    onMoveUp,
    onMoveDown,
    onRemove,
    onFollowup
  }: Props = $props();

  const hasWarning = $derived(!entry.legal || !entry.applicable);
  const warningType = $derived(
    !entry.legal ? 'illegal' : !entry.applicable ? 'inapplicable' : null
  );

  // Get specific diagnostic messages from entry.diagnostics
  // Multiple diagnostics are joined with newlines for multi-line display
  const warningMessage = $derived.by(() => {
    if (!hasWarning || entry.diagnostics.length === 0) return undefined;
    const messages = entry.diagnostics.map((d) => $t(d.code));
    return messages.join('\n');
  });

  const warningLabel = $derived.by(() => {
    if (!hasWarning || !warningType) return '';
    // Use specific message if available, otherwise generic
    if (warningMessage) return ` (${warningMessage})`;
    const key = warningType === 'illegal' ? 'play.choices.illegal' : 'play.choices.inapplicable';
    return ` (${$t(key)})`;
  });

  const ariaLabel = $derived(`${entry.rule.description || entry.rule.id}${warningLabel}`);

  // Extract UI config from rule
  const uiSection = $derived(entry.rule.ui?.section as string | undefined);
  const uiName = $derived(entry.rule.ui?.name as string | undefined);
  const uiModel = $derived(entry.rule.ui?.model as string | undefined);

  // Helper to resolve a var's default value from facts
  function resolveVarDefault(varName: string): number | undefined {
    // Check for captured value first (for planned rules with capture: true)
    if (entry.rule.selections?.[varName] !== undefined) {
      return entry.rule.selections[varName] as number;
    }

    const varDef = entry.rule.vars?.[varName];
    if (!varDef) return undefined;

    const defaultSource = varDef.default;
    if (defaultSource.number !== undefined) {
      return defaultSource.number;
    }
    if (defaultSource.fact !== undefined) {
      return facts[defaultSource.fact] as number | undefined;
    }
    return undefined;
  }

  // Move model specific values
  const moveMaxDistance = $derived(
    uiModel === 'move' ? resolveVarDefault('maxDistance') : undefined
  );
  const moveCurrentDistance = $derived(
    uiModel === 'move' ? resolveVarDefault('distance') : undefined
  );

  // Auto-detect the var name for ability-score model (e.g. "score" or "modifier")
  const abilityScoreVarName = $derived.by(() => {
    if (uiModel !== 'ability-score' || !entry.rule.vars) return undefined;
    const varNames = Object.keys(entry.rule.vars);
    return varNames.length === 1 ? varNames[0] : varNames.find((v) => entry.rule.vars![v].capture);
  });

  // Ability score model specific values
  const abilityScoreValue = $derived(
    uiModel === 'ability-score' && abilityScoreVarName
      ? resolveVarDefault(abilityScoreVarName)
      : undefined
  );

  // Configurable slider range - max comes from maxValue var or sliderMax UI property
  const sliderMin = $derived(
    uiModel === 'ability-score' ? ((entry.rule.ui?.sliderMin as number | undefined) ?? 1) : 1
  );
  const sliderMax = $derived.by(() => {
    if (uiModel !== 'ability-score') return undefined;
    const dynamicMax = resolveVarDefault('maxValue');
    if (dynamicMax !== undefined) return dynamicMax;
    return entry.rule.ui?.sliderMax as number | undefined;
  });

  // Skill proficiency model specific values
  const proficiencyLevel = $derived(
    uiModel === 'skill-proficiency' ? resolveVarDefault('level') : undefined
  );

  // Attack model specific values
  const attackRanges = $derived.by(() => {
    if (uiModel !== 'attack') return undefined;
    const varDef = entry.rule.vars?.ranges;
    if (!varDef) return undefined;
    return varDef.default.array as RangeEntry[] | undefined;
  });
  const attackHitBonus = $derived(uiModel === 'attack' ? resolveVarDefault('hitBonus') : undefined);
  const attackDamageDie = $derived(
    uiModel === 'attack' ? resolveVarDefault('damageDie') : undefined
  );
  const attackDamageBonus = $derived(
    uiModel === 'attack' ? resolveVarDefault('damageBonus') : undefined
  );

  // Followup actions: conditional buttons on planned rules (e.g., mastery effects)
  const visibleFollowups = $derived.by(() => {
    if (!editable) return [];
    const followups = entry.rule.ui?.followups as Followup[] | undefined;
    if (!followups) return [];
    return followups.filter((f) => {
      if (f.type === 'attack-line' && cleaveActive) return false;
      return evaluateCondition(f.condition, facts, new Set());
    });
  });

  function handleFollowup(followup: Followup): void {
    if (followup.type === 'effect' && onFollowup) {
      onFollowup(followup.addRule.rule);
    } else if (followup.type === 'attack-line') {
      cleaveActive = true;
    }
  }

  // Contested action model specific values (grapple, shove, etc.)
  const contestedDc = $derived(
    uiModel === 'contested-action' ? resolveVarDefault('dc') : undefined
  );
  const contestedOutcomeKey = $derived(
    uiModel === 'contested-action' ? (entry.rule.ui?.outcomeKey as string | undefined) : undefined
  );
  const contestedVsKey = $derived(
    uiModel === 'contested-action' ? (entry.rule.ui?.vsKey as string | undefined) : undefined
  );

  // Rules-engine disadvantage: read from ui.disadvantageFact (data-driven, works with instance IDs)
  const hasRulesDisadvantage = $derived.by(() => {
    const disadvFact = entry.rule.ui?.disadvantageFact as string | undefined;
    if (disadvFact) return facts[disadvFact] === 1;
    return false;
  });

  // Initiative roll model specific values
  const rollBonus = $derived(uiModel === 'd20-roll' ? resolveVarDefault('rollBonus') : undefined);

  // Dice roll state and functions
  let hitRollResult: number | null = $state(null);
  let damageRollResult: number | null = $state(null);
  let initiativeRollResult: number | null = $state(null);

  // Cleave attack-line followup state
  let cleaveActive = $state(false);
  let cleaveHitRollResult: number | null = $state(null);
  let cleaveDamageRollResult: number | null = $state(null);
  let cleaveHitRollMode: RollMode = $state('normal');

  // Cleave derived values
  const cleaveDamageBonus = $derived(Math.min(0, attackDamageBonus ?? 0));
  const cleaveHitTotal = $derived(
    cleaveHitRollResult !== null ? cleaveHitRollResult + (attackHitBonus ?? 0) : null
  );
  const cleaveDamageTotal = $derived(
    cleaveDamageRollResult !== null ? cleaveDamageRollResult + cleaveDamageBonus : null
  );
  const cleaveIsNat20 = $derived(cleaveHitRollResult === 20);
  const cleaveIsNat1 = $derived(cleaveHitRollResult === 1);

  function rollCleaveHit(event: MouseEvent, mode: RollMode = 'normal'): void {
    cleaveHitRollResult = rollD20(mode, `Cleave hit @ ${selectedRange?.distance ?? '?'}ft`);
    cleaveHitRollMode = mode;
    cleaveDamageRollResult = null;
    playRollAnimation(event.currentTarget as HTMLElement);
  }

  function rollCleaveDamage(event: MouseEvent): void {
    const die = attackDamageDie ?? 0;
    if (die > 0) {
      if (cleaveIsNat20) {
        const r1 = Math.floor(Math.random() * die) + 1;
        const r2 = Math.floor(Math.random() * die) + 1;
        cleaveDamageRollResult = r1 + r2;
        console.log(
          `[damage] Cleave (crit): [${r1}, ${r2}] + ${formatBonus(cleaveDamageBonus)} = ${r1 + r2 + cleaveDamageBonus}`
        );
      } else {
        cleaveDamageRollResult = Math.floor(Math.random() * die) + 1;
        console.log(
          `[damage] Cleave: ${cleaveDamageRollResult} + ${formatBonus(cleaveDamageBonus)} = ${cleaveDamageRollResult + cleaveDamageBonus}`
        );
      }
      playRollAnimation(event.currentTarget as HTMLElement);
    }
  }

  // Range selection state - restored from selections if available
  let selectedRangeIndex = $state((entry.rule.selections?.rangeIndex as number | undefined) ?? 0);

  // Derived: currently selected range entry
  const selectedRange = $derived(
    attackRanges && attackRanges.length > 0 ? attackRanges[selectedRangeIndex] : undefined
  );

  // Cycle to next range, reset rolls
  function cycleRange(): void {
    if (!attackRanges || attackRanges.length <= 1) return;
    selectedRangeIndex = (selectedRangeIndex + 1) % attackRanges.length;
    hitRollResult = null;
    damageRollResult = null;
    if (onSelectionChange) {
      onSelectionChange({ rangeIndex: selectedRangeIndex });
    }
  }

  // Advantage/disadvantage state
  type RollMode = 'normal' | 'advantage' | 'disadvantage';
  // Default roll modes derived from rules engine + range disadvantage
  // These are used for regular taps (reset each time)
  const defaultHitRollMode = $derived.by(() => {
    if (hasRulesDisadvantage) return 'disadvantage';
    if (selectedRange?.disadvantage) return 'disadvantage';
    return 'normal';
  });
  const defaultD20RollMode = $derived(hasRulesDisadvantage ? 'disadvantage' : 'normal');

  // Stored roll modes track what was last rolled (for inside-arrow display)
  let hitRollMode: RollMode = $state('normal');
  let initiativeRollMode: RollMode = $state('normal');
  type PopoverTarget = 'hit' | 'cleave-hit' | 'initiative' | null;
  let activePopover: PopoverTarget = $state(null);
  const showHitPopover = $derived(activePopover === 'hit');
  const showInitiativePopover = $derived(activePopover === 'initiative');
  const showCleaveHitPopover = $derived(activePopover === 'cleave-hit');
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let didOpenPopover = false;
  let hitTriggerRef: HTMLButtonElement | undefined = $state();
  let initiativeTriggerRef: HTMLButtonElement | undefined = $state();
  let cleaveHitTriggerRef: HTMLButtonElement | undefined = $state();

  // Derived roll totals and crit detection
  const hitTotal = $derived(hitRollResult !== null ? hitRollResult + (attackHitBonus ?? 0) : null);
  const damageTotal = $derived(
    damageRollResult !== null ? damageRollResult + (attackDamageBonus ?? 0) : null
  );
  const isNat20 = $derived(hitRollResult === 20);
  const isNat1 = $derived(hitRollResult === 1);
  const initiativeTotal = $derived(
    initiativeRollResult !== null ? initiativeRollResult + (rollBonus ?? 0) : null
  );
  const initiativeNat20 = $derived(initiativeRollResult === 20);
  const initiativeNat1 = $derived(initiativeRollResult === 1);

  function formatBonus(val: number | undefined): string {
    if (val === undefined) return '';
    return val >= 0 ? `+${val}` : `${val}`;
  }

  function playRollAnimation(element: HTMLElement): void {
    element.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }],
      { duration: 150, easing: 'ease-out' }
    );
  }

  function rollD20(mode: RollMode, label?: string): number {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    if (mode === 'normal') {
      console.log(`[d20] ${label ?? 'roll'}: ${roll1}`);
      return roll1;
    }
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const result = mode === 'advantage' ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
    console.log(`[d20] ${label ?? 'roll'} (${mode}): [${roll1}, ${roll2}] → ${result}`);
    return result;
  }

  function rollHit(event: MouseEvent, mode: RollMode = 'normal'): void {
    hitRollResult = rollD20(mode, `${uiName ?? 'hit'} @ ${selectedRange?.distance ?? '?'}ft`);
    hitRollMode = mode;
    damageRollResult = null;
    playRollAnimation(event.currentTarget as HTMLElement);
  }

  function rollDamage(event: MouseEvent): void {
    const die = attackDamageDie ?? 0;
    if (die > 0) {
      if (isNat20) {
        const r1 = Math.floor(Math.random() * die) + 1;
        const r2 = Math.floor(Math.random() * die) + 1;
        damageRollResult = r1 + r2;
        console.log(
          `[damage] ${uiName ?? 'roll'} (crit): [${r1}, ${r2}] + ${formatBonus(attackDamageBonus)} = ${r1 + r2 + (attackDamageBonus ?? 0)}`
        );
      } else {
        damageRollResult = Math.floor(Math.random() * die) + 1;
        console.log(
          `[damage] ${uiName ?? 'roll'}: ${damageRollResult} + ${formatBonus(attackDamageBonus)} = ${damageRollResult + (attackDamageBonus ?? 0)}`
        );
      }
      playRollAnimation(event.currentTarget as HTMLElement);
    }
  }

  function rollInitiative(event: MouseEvent, mode: RollMode = 'normal'): void {
    initiativeRollResult = rollD20(mode, uiName ?? 'd20-roll');
    initiativeRollMode = mode;
    playRollAnimation(event.currentTarget as HTMLElement);
  }

  // Long-press detection for advantage/disadvantage popover
  const LONG_PRESS_MS = 300;

  function startLongPress(target: 'hit' | 'cleave-hit' | 'initiative'): void {
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      didOpenPopover = true;
      activePopover = target;
    }, LONG_PRESS_MS);
  }

  function cancelLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function selectHitMode(event: MouseEvent, mode: RollMode): void {
    activePopover = null;
    rollHit(event, mode);
  }

  function selectInitiativeMode(event: MouseEvent, mode: RollMode): void {
    activePopover = null;
    rollInitiative(event, mode);
  }

  function selectCleaveHitMode(event: MouseEvent, mode: RollMode): void {
    activePopover = null;
    rollCleaveHit(event, mode);
  }

  // Click-outside dismissal for popovers
  $effect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (activePopover === null) return;
      const selector =
        activePopover === 'hit'
          ? '.roll-popover'
          : activePopover === 'initiative'
            ? '.roll-popover--initiative'
            : '.roll-popover--cleave-hit';
      const triggerRef =
        activePopover === 'hit'
          ? hitTriggerRef
          : activePopover === 'initiative'
            ? initiativeTriggerRef
            : cleaveHitTriggerRef;
      const popover = document.querySelector(selector);
      if (
        popover &&
        !popover.contains(e.target as Node) &&
        triggerRef &&
        !triggerRef.contains(e.target as Node)
      ) {
        activePopover = null;
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  // Keyboard navigation for popover focus trap
  function popoverSelector(target: PopoverTarget): string {
    return target === 'hit'
      ? '.roll-popover'
      : target === 'initiative'
        ? '.roll-popover--initiative'
        : '.roll-popover--cleave-hit';
  }

  function popoverTriggerRef(target: PopoverTarget): HTMLButtonElement | undefined {
    return target === 'hit'
      ? hitTriggerRef
      : target === 'initiative'
        ? initiativeTriggerRef
        : cleaveHitTriggerRef;
  }

  $effect(() => {
    function handlePopoverKeydown(e: KeyboardEvent): void {
      if (activePopover === null) return;
      const popover = document.querySelector(popoverSelector(activePopover));
      if (!popover) return;
      const items = Array.from(popover.querySelectorAll('[role="menuitem"]'));
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (e.key === 'Escape') {
        e.preventDefault();
        const prev = activePopover;
        activePopover = null;
        popoverTriggerRef(prev)?.focus();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[(currentIndex + 1) % items.length];
        (next as HTMLElement)?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        (prev as HTMLElement)?.focus();
      }
    }

    if (activePopover !== null) {
      document.addEventListener('keydown', handlePopoverKeydown);
      // Auto-focus first menuitem
      const popover = document.querySelector(popoverSelector(activePopover));
      const firstItem = popover?.querySelector('[role="menuitem"]') as HTMLElement;
      firstItem?.focus();

      return () => document.removeEventListener('keydown', handlePopoverKeydown);
    }
  });

  const proficiencyOptions = [
    { value: 0.5, label: '\u25CB', ariaLabel: $t('play.choices.skillProficiency.half') },
    { value: 1, label: '\u25CF', ariaLabel: $t('play.choices.skillProficiency.full') },
    { value: 2, label: '\u25CF\u25CF', ariaLabel: $t('play.choices.skillProficiency.double') }
  ] as const;

  // Slider state - initialized from current/max distance, controlled by user
  // Using writable derived pattern for slider value
  let sliderValue = $derived.by(() => {
    if (uiModel === 'ability-score') {
      if (abilityScoreVarName && entry.rule.selections?.[abilityScoreVarName] !== undefined) {
        return entry.rule.selections[abilityScoreVarName] as number;
      }
      return abilityScoreValue ?? 10;
    }
    if (uiModel === 'skill-proficiency') {
      if (entry.rule.selections?.level !== undefined) {
        return entry.rule.selections.level as number;
      }
      return proficiencyLevel ?? 1;
    }
    // For display, use the selection from the rule if it exists
    if (entry.rule.selections?.distance !== undefined) {
      return entry.rule.selections.distance as number;
    }
    return moveCurrentDistance ?? moveMaxDistance ?? 0;
  });

  // Handle slider change
  function handleSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);

    if (onSelectionChange) {
      if (uiModel === 'ability-score' && abilityScoreVarName) {
        onSelectionChange({ [abilityScoreVarName]: value });
      } else if (uiModel === 'skill-proficiency') {
        onSelectionChange({ level: value });
      } else {
        onSelectionChange({ distance: value });
      }
    }
  }

  function handleProficiencyChange(value: number): void {
    if (onSelectionChange) {
      onSelectionChange({ level: value });
    }
  }
</script>

{#if editable}
  <!-- Editable mode: div container with interactive controls -->
  <div
    class="choice-panel choice-panel--editable"
    class:choice-panel--warning={hasWarning}
    aria-label={ariaLabel}
    role="group"
  >
    {#if hasWarning && warningType}
      <WarningIndicator type={warningType} message={warningMessage} />
    {/if}
    {#if uiSection}
      <div class="choice-panel__header">
        <span class="choice-panel__type">{$t(`play.choices.sections.${uiSection}`)}</span>
      </div>
    {/if}
    <div class="choice-panel__body">
      {#if uiName}
        <span class="choice-panel__title">{$t(uiName)}</span>
      {:else}
        <span class="choice-panel__description">
          {entry.rule.description || entry.rule.id}
        </span>
      {/if}

      {#if uiModel === 'move' && moveMaxDistance !== undefined}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min="0"
            max={moveMaxDistance}
            step="5"
            value={sliderValue}
            aria-label={$t('play.choices.move.distance')}
            oninput={handleSliderChange}
          />
          <span class="move-value">{sliderValue} ft</span>
        </div>
      {/if}
      {#if uiModel === 'ability-score' && sliderMax !== undefined}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min={sliderMin}
            max={sliderMax}
            step="1"
            value={sliderValue}
            aria-label={$t(uiName ?? '')}
            oninput={handleSliderChange}
          />
          <span class="ability-score-value">{sliderValue}</span>
        </div>
      {/if}
      {#if uiModel === 'skill-proficiency'}
        <div class="choice-panel__model" role="radiogroup" aria-label={$t(uiName ?? '')}>
          {#each proficiencyOptions as option (option.value)}
            <button
              type="button"
              class="choice-panel__radio"
              class:choice-panel__radio--active={proficiencyLevel === option.value}
              role="radio"
              aria-checked={proficiencyLevel === option.value}
              aria-label={option.ariaLabel}
              disabled={!editable}
              onclick={() => handleProficiencyChange(option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {/if}
      {#if uiModel === 'attack' && selectedRange !== undefined}
        <div class="choice-panel__model choice-panel__attack">
          {#if attackRanges && attackRanges.length > 1}
            <button
              type="button"
              class="attack-range attack-range--multi"
              class:attack-range--disadvantage={selectedRange.disadvantage}
              onclick={cycleRange}
              aria-label="{$t(
                'play.choices.attack.range'
              )}: {selectedRange.distance} ft ({selectedRange.type}){selectedRange.disadvantage
                ? `. ${$t('play.choices.attack.rangeDisadvantage')}`
                : ''}. {$t('play.choices.attack.rangeCycle', {
                distance: selectedRange.distance,
                type: selectedRange.type
              })}"
              >{selectedRange.distance} ft{#if selectedRange.disadvantage}<span
                  class="attack-range__disadv"
                  aria-hidden="true"
                >
                  &#9660;</span
                >{/if}</button
            >
          {:else}
            <span class="attack-range">{selectedRange.distance} ft</span>
          {/if}
          <span class="attack-sep" aria-hidden="true">|</span>
          {#if hasRulesDisadvantage}
            <svg
              class="roll-disadv-indicator"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-label={$t('play.choices.disadvantageApplies')}
              ><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" /></svg
            >
          {/if}
          <button
            type="button"
            class="attack-chip attack-chip--rollable"
            class:attack-chip--crit={hitRollResult !== null && isNat20}
            class:attack-chip--fumble={hitRollResult !== null && isNat1}
            bind:this={hitTriggerRef}
            aria-haspopup="menu"
            aria-expanded={showHitPopover}
            onclick={(e) => {
              cancelLongPress();
              if (didOpenPopover) {
                didOpenPopover = false;
                return;
              }
              rollHit(e, defaultHitRollMode);
            }}
            onpointerdown={() => startLongPress('hit')}
            onpointerup={() => cancelLongPress()}
            onpointerleave={() => cancelLongPress()}
            onkeydown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                activePopover = 'hit';
              }
            }}
            aria-label={hitRollResult !== null
              ? `${$t('play.choices.attack.reroll')} ${$t('play.choices.attack.hit')}: ${hitTotal}${hitRollMode === 'advantage' ? ` — ${$t('play.choices.attack.advantageResult')}` : ''}${hitRollMode === 'disadvantage' ? ` — ${$t('play.choices.attack.disadvantageResult')}` : ''}${isNat20 ? ` — ${$t('play.choices.attack.nat20')}` : ''}${isNat1 ? ` — ${$t('play.choices.attack.nat1')}` : ''}`
              : `${$t('play.choices.attack.roll')} ${$t('play.choices.attack.hit')}: d20{formatBonus(attackHitBonus)}`}
          >
            {#if hitRollResult !== null}{#if hitRollMode === 'advantage'}<svg
                  class="roll-mode-icon roll-mode-icon--advantage"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label={$t('play.choices.attack.advantageResult')}
                  ><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" /></svg
                >{/if}{#if hitRollMode === 'disadvantage'}<svg
                  class="roll-mode-icon roll-mode-icon--disadvantage"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label={$t('play.choices.attack.disadvantageResult')}
                  ><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" /></svg
                >{/if}{#if isNat20}<span class="attack-crit-icon" aria-hidden="true">&#10004;</span
                >{/if}{#if isNat1}<span class="attack-crit-icon" aria-hidden="true">&#10008;</span
                >{/if}{hitTotal}{:else}d20{formatBonus(attackHitBonus)}{/if}
          </button>
          {#if showHitPopover}
            <div class="roll-popover" role="menu" aria-label={$t('play.choices.attack.roll')}>
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectHitMode(e, 'advantage')}
              >
                {$t('play.choices.attack.advantage')}
              </button>
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectHitMode(e, 'normal')}
              >
                {$t('play.choices.attack.normal')}
              </button>
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectHitMode(e, 'disadvantage')}
              >
                {$t('play.choices.attack.disadvantage')}
              </button>
            </div>
          {/if}
          <span class="attack-sep" aria-hidden="true">|</span>
          <button
            type="button"
            class="attack-chip attack-chip--rollable"
            class:attack-chip--crit={isNat20 && damageRollResult !== null}
            onclick={rollDamage}
            disabled={!attackDamageDie || attackDamageDie <= 0}
            aria-label={damageRollResult !== null
              ? `${$t('play.choices.attack.reroll')} ${$t('play.choices.attack.damage')}: ${damageTotal}`
              : `${$t('play.choices.attack.roll')} ${$t('play.choices.attack.damage')}: ${attackDamageDie && attackDamageDie > 0 ? `${isNat20 ? '2' : ''}d${attackDamageDie}${formatBonus(attackDamageBonus)}` : formatBonus(attackDamageBonus) || '0'}`}
          >
            {#if damageRollResult !== null}
              {damageTotal}
            {:else if attackDamageDie && attackDamageDie > 0}
              {isNat20 ? '2' : ''}d{attackDamageDie}{formatBonus(attackDamageBonus)}
            {:else}
              {formatBonus(attackDamageBonus) || '0'}
            {/if}
          </button>
        </div>
      {/if}
      {#if uiModel === 'attack' && cleaveActive && selectedRange !== undefined}
        <div class="choice-panel__model choice-panel__attack">
          <span class="attack-range">{selectedRange.distance} ft</span>
          <span class="attack-sep" aria-hidden="true">|</span>
          <button
            type="button"
            class="attack-chip attack-chip--rollable"
            class:attack-chip--crit={cleaveHitRollResult !== null && cleaveIsNat20}
            class:attack-chip--fumble={cleaveHitRollResult !== null && cleaveIsNat1}
            bind:this={cleaveHitTriggerRef}
            aria-haspopup="menu"
            aria-expanded={showCleaveHitPopover}
            onclick={(e) => {
              cancelLongPress();
              if (didOpenPopover) {
                didOpenPopover = false;
                return;
              }
              rollCleaveHit(e, defaultHitRollMode);
            }}
            onpointerdown={() => startLongPress('cleave-hit')}
            onpointerup={() => cancelLongPress()}
            onpointerleave={() => cancelLongPress()}
            onkeydown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                activePopover = 'cleave-hit';
              }
            }}
            aria-label={cleaveHitRollResult !== null
              ? `${$t('play.choices.attack.reroll')} ${$t('play.choices.attack.hit')}: ${cleaveHitTotal}`
              : `${$t('play.choices.attack.roll')} ${$t('play.choices.attack.hit')}: d20${formatBonus(attackHitBonus)}`}
          >
            {#if cleaveHitRollResult !== null}{#if cleaveHitRollMode === 'advantage'}<svg
                  class="roll-mode-icon roll-mode-icon--advantage"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label={$t('play.choices.attack.advantageResult')}
                  ><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" /></svg
                >{/if}{#if cleaveHitRollMode === 'disadvantage'}<svg
                  class="roll-mode-icon roll-mode-icon--disadvantage"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label={$t('play.choices.attack.disadvantageResult')}
                  ><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" /></svg
                >{/if}{#if cleaveIsNat20}<span class="attack-crit-icon" aria-hidden="true"
                  >&#10004;</span
                >{/if}{#if cleaveIsNat1}<span class="attack-crit-icon" aria-hidden="true"
                  >&#10008;</span
                >{/if}{cleaveHitTotal}{:else}d20{formatBonus(attackHitBonus)}{/if}
          </button>
          {#if showCleaveHitPopover}
            <div
              class="roll-popover roll-popover--cleave-hit"
              role="menu"
              aria-label={$t('play.choices.attack.roll')}
            >
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectCleaveHitMode(e, 'advantage')}
              >
                {$t('play.choices.attack.advantage')}
              </button>
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectCleaveHitMode(e, 'normal')}
              >
                {$t('play.choices.attack.normal')}
              </button>
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectCleaveHitMode(e, 'disadvantage')}
              >
                {$t('play.choices.attack.disadvantage')}
              </button>
            </div>
          {/if}
          <span class="attack-sep" aria-hidden="true">|</span>
          <button
            type="button"
            class="attack-chip attack-chip--rollable"
            class:attack-chip--crit={cleaveIsNat20 && cleaveDamageRollResult !== null}
            onclick={rollCleaveDamage}
            disabled={!attackDamageDie || attackDamageDie <= 0}
            aria-label={cleaveDamageRollResult !== null
              ? `${$t('play.choices.attack.reroll')} ${$t('play.choices.attack.damage')}: ${cleaveDamageTotal}`
              : `${$t('play.choices.attack.roll')} ${$t('play.choices.attack.damage')}: ${attackDamageDie && attackDamageDie > 0 ? `${cleaveIsNat20 ? '2' : ''}d${attackDamageDie}${formatBonus(cleaveDamageBonus)}` : formatBonus(cleaveDamageBonus) || '0'}`}
          >
            {#if cleaveDamageRollResult !== null}
              {cleaveDamageTotal}
            {:else if attackDamageDie && attackDamageDie > 0}
              {cleaveIsNat20 ? '2' : ''}d{attackDamageDie}{formatBonus(cleaveDamageBonus)}
            {:else}
              {formatBonus(cleaveDamageBonus) || '0'}
            {/if}
          </button>
        </div>
      {/if}
      {#if uiModel === 'contested-action' && contestedDc !== undefined}
        <div class="choice-panel__model choice-panel__attack">
          <span class="contested-dc"
            >DC {contestedDc} {contestedVsKey ? $t(contestedVsKey) : ''}</span
          >
          <span class="attack-sep" aria-hidden="true">|</span>
          <span class="contested-result"
            >→ {contestedOutcomeKey ? $t(contestedOutcomeKey) : ''}</span
          >
        </div>
      {/if}
      {#if uiModel === 'd20-roll' && rollBonus !== undefined}
        <div class="choice-panel__model choice-panel__attack">
          {#if hasRulesDisadvantage}
            <svg
              class="roll-disadv-indicator"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-label={$t('play.choices.disadvantageApplies')}
              ><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" /></svg
            >
          {/if}
          <button
            type="button"
            class="attack-chip attack-chip--rollable"
            class:attack-chip--crit={initiativeRollResult !== null && initiativeNat20}
            class:attack-chip--fumble={initiativeRollResult !== null && initiativeNat1}
            bind:this={initiativeTriggerRef}
            aria-haspopup="menu"
            aria-expanded={showInitiativePopover}
            onclick={(e) => {
              cancelLongPress();
              if (didOpenPopover) {
                didOpenPopover = false;
                return;
              }
              rollInitiative(e, defaultD20RollMode);
            }}
            onpointerdown={() => startLongPress('initiative')}
            onpointerup={() => cancelLongPress()}
            onpointerleave={() => cancelLongPress()}
            onkeydown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                activePopover = 'initiative';
              }
            }}
            aria-label={initiativeRollResult !== null
              ? `${$t('play.choices.initiative.reroll')}: ${initiativeTotal}${initiativeRollMode === 'advantage' ? ` — ${$t('play.choices.initiative.advantageResult')}` : ''}${initiativeRollMode === 'disadvantage' ? ` — ${$t('play.choices.initiative.disadvantageResult')}` : ''}${initiativeNat20 ? ` — ${$t('play.choices.initiative.nat20')}` : ''}${initiativeNat1 ? ` — ${$t('play.choices.initiative.nat1')}` : ''}`
              : `${$t('play.choices.initiative.roll')}: d20${formatBonus(rollBonus)}`}
          >
            {#if initiativeRollResult !== null}{#if initiativeRollMode === 'advantage'}<svg
                  class="roll-mode-icon roll-mode-icon--advantage"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label={$t('play.choices.initiative.advantageResult')}
                  ><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" /></svg
                >{/if}{#if initiativeRollMode === 'disadvantage'}<svg
                  class="roll-mode-icon roll-mode-icon--disadvantage"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label={$t('play.choices.initiative.disadvantageResult')}
                  ><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" /></svg
                >{/if}{#if initiativeNat20}<span class="attack-crit-icon" aria-hidden="true"
                  >&#10004;</span
                >{/if}{#if initiativeNat1}<span class="attack-crit-icon" aria-hidden="true"
                  >&#10008;</span
                >{/if}{initiativeTotal}{:else}d20{formatBonus(rollBonus)}{/if}
          </button>
          {#if showInitiativePopover}
            <div
              class="roll-popover roll-popover--initiative"
              role="menu"
              aria-label={$t('play.choices.initiative.roll')}
            >
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectInitiativeMode(e, 'advantage')}
              >
                {$t('play.choices.initiative.advantage')}
              </button>
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectInitiativeMode(e, 'normal')}
              >
                {$t('play.choices.initiative.normal')}
              </button>
              <button
                type="button"
                class="roll-popover__item"
                role="menuitem"
                onclick={(e) => selectInitiativeMode(e, 'disadvantage')}
              >
                {$t('play.choices.initiative.disadvantage')}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    {#if visibleFollowups.length > 0}
      <div
        class="choice-panel__followups"
        role="group"
        aria-label={$t('play.effects.followupActions')}
      >
        {#each visibleFollowups as followup (followup.button)}
          <button
            type="button"
            class="choice-panel__followup-button"
            onclick={() => handleFollowup(followup)}
          >
            {$t(followup.button)}
          </button>
        {/each}
      </div>
    {/if}
    {#if showControls}
      <div class="choice-panel__actions" role="group" aria-label="Item controls">
        <button
          type="button"
          class="choice-panel__button choice-panel__button--move-up"
          disabled={!canMoveUp}
          onclick={onMoveUp}
          aria-label={$t('play.plan.moveUp')}
          title={$t('play.plan.moveUp')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
        <button
          type="button"
          class="choice-panel__button choice-panel__button--move-down"
          disabled={!canMoveDown}
          onclick={onMoveDown}
          aria-label={$t('play.plan.moveDown')}
          title={$t('play.plan.moveDown')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
        <button
          type="button"
          class="choice-panel__button choice-panel__button--remove"
          onclick={onRemove}
          aria-label={$t('play.plan.remove')}
          title={$t('play.plan.remove')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>
    {/if}
  </div>
{:else}
  <!-- Read-only mode: button to add to plan -->
  <button
    type="button"
    class="choice-panel"
    class:choice-panel--warning={hasWarning}
    onclick={onTap}
    aria-label={ariaLabel}
  >
    {#if hasWarning && warningType}
      <WarningIndicator type={warningType} message={warningMessage} />
    {/if}
    {#if uiSection}
      <div class="choice-panel__header">
        <span class="choice-panel__type">{$t(`play.choices.sections.${uiSection}`)}</span>
      </div>
    {/if}
    <div class="choice-panel__body">
      {#if uiName}
        <span class="choice-panel__title">{$t(uiName)}</span>
      {:else}
        <span class="choice-panel__description">
          {entry.rule.description || entry.rule.id}
        </span>
      {/if}

      {#if uiModel === 'move' && moveMaxDistance !== undefined}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min="0"
            max={moveMaxDistance}
            step="5"
            value={sliderValue}
            disabled
            aria-label={$t('play.choices.move.distance')}
          />
          <span class="move-value">{sliderValue} ft</span>
        </div>
      {/if}
      {#if uiModel === 'ability-score' && sliderMax !== undefined}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min={sliderMin}
            max={sliderMax}
            step="1"
            value={sliderValue}
            disabled
            aria-label={$t(uiName ?? '')}
          />
          <span class="ability-score-value">{sliderValue}</span>
        </div>
      {/if}
      {#if uiModel === 'skill-proficiency'}
        <div class="choice-panel__model" role="radiogroup" aria-label={$t(uiName ?? '')}>
          {#each proficiencyOptions as option (option.value)}
            <span
              class="choice-panel__radio choice-panel__radio--readonly"
              class:choice-panel__radio--active={proficiencyLevel === option.value}
              role="radio"
              aria-checked={proficiencyLevel === option.value}
              aria-label={option.ariaLabel}
            >
              {option.label}
            </span>
          {/each}
        </div>
      {/if}
      {#if uiModel === 'attack' && selectedRange !== undefined}
        <div class="choice-panel__model choice-panel__attack">
          <span class="attack-range" class:attack-range--disadvantage={selectedRange.disadvantage}
            >{selectedRange.distance} ft{#if selectedRange.disadvantage}<span
                class="attack-range__disadv"
                aria-hidden="true"
              >
                &#9660;</span
              >{/if}</span
          >
          <span class="attack-sep" aria-hidden="true">|</span>
          <span class="attack-chip">
            {#if attackDamageDie && attackDamageDie > 0}
              d{attackDamageDie}{formatBonus(attackDamageBonus)}
            {:else}
              {formatBonus(attackDamageBonus) || '0'}
            {/if}
          </span>
        </div>
      {/if}
      {#if uiModel === 'contested-action' && contestedDc !== undefined}
        <div class="choice-panel__model choice-panel__attack">
          <span class="contested-dc"
            >DC {contestedDc} {contestedVsKey ? $t(contestedVsKey) : ''}</span
          >
          <span class="attack-sep" aria-hidden="true">|</span>
          <span class="contested-result"
            >→ {contestedOutcomeKey ? $t(contestedOutcomeKey) : ''}</span
          >
        </div>
      {/if}
      {#if uiModel === 'd20-roll' && rollBonus !== undefined}
        <div class="choice-panel__model choice-panel__attack">
          <span class="attack-chip">d20{formatBonus(rollBonus)}</span>
        </div>
      {/if}
    </div>
  </button>
{/if}

<style>
  .choice-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-md);
    padding-bottom: 0; /* Body handles bottom padding */
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    line-height: var(--line-height-md);
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  /* Eliminate top gap - first content element doesn't need it */
  .choice-panel > .choice-panel__header:first-of-type,
  .choice-panel > .choice-panel__body:first-of-type {
    margin-top: calc(-1 * var(--spacing-xs));
  }

  .choice-panel:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .choice-panel:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .choice-panel:active {
    background: var(--md-sys-color-surface-container-highest);
    transform: scale(0.98);
  }

  .choice-panel--warning {
    border-color: var(--md-sys-color-error-container);
  }

  .choice-panel--editable {
    cursor: default;
  }

  .choice-panel--editable:active {
    transform: none;
  }

  .choice-panel__header {
    padding-bottom: var(--spacing-xs);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }

  .choice-panel__type {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--md-sys-color-on-surface-variant);
    letter-spacing: var(--letter-spacing-wide);
  }

  .choice-panel__body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-bottom: var(--spacing-md); /* Add back bottom padding here */
  }

  .choice-panel__title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  .choice-panel__description {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
  }

  .choice-panel__model {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .move-slider {
    flex: 1;
    accent-color: var(--md-sys-color-primary);
  }

  .move-slider:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .move-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    min-width: 3rem;
    text-align: right;
  }

  .ability-score-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    min-width: 2rem;
    text-align: right;
  }

  .choice-panel__radio {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-align: center;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .choice-panel__radio:hover:not(:disabled):not(.choice-panel__radio--readonly) {
    background: var(--md-sys-color-surface-container-high);
  }

  .choice-panel__radio:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .choice-panel__radio--active {
    background: var(--md-sys-color-primary-container);
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary-container);
  }

  .choice-panel__radio:disabled,
  .choice-panel__radio--readonly {
    opacity: 0.6;
    cursor: default;
  }

  /* Actions positioned at top-right inside panel */
  .choice-panel__actions {
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

  .choice-panel__button {
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

  .choice-panel__button:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
  }

  .choice-panel__button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .choice-panel__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .choice-panel__button svg {
    width: 1rem;
    height: 1rem;
  }

  .choice-panel__button--remove:hover:not(:disabled) {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    border-color: var(--md-sys-color-error);
  }

  /* Warning indicator positioned at top-left as overlay */
  .choice-panel :global(.warning-indicator) {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 2;
  }

  .choice-panel__attack {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
    position: relative;
  }

  .attack-chip {
    display: inline-flex;
    align-items: center;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
  }

  .contested-dc {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .contested-result {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--md-sys-color-primary);
  }

  .attack-chip--rollable {
    min-width: 3.5rem;
    min-height: 2.75rem;
    justify-content: center;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    border-color: var(--md-sys-color-outline-variant);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .attack-chip--rollable:hover:not(:disabled) {
    background: var(--md-sys-color-secondary);
    color: var(--md-sys-color-on-secondary);
  }

  .attack-chip--rollable:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .attack-chip--rollable:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .attack-sep {
    color: var(--md-sys-color-outline);
    font-size: var(--font-size-sm);
  }

  .attack-range {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }
  .attack-range--multi {
    background: none;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: 0.125rem 0.375rem;
    cursor: pointer;
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    touch-action: manipulation;
    &:hover {
      background: var(--md-sys-color-surface-container-highest);
    }
    &:active {
      background: var(--md-sys-color-surface-container-high);
    }
    &:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 2px;
    }
  }
  .attack-range--disadvantage {
    border-color: var(--md-sys-color-error);
    color: var(--md-sys-color-error);
  }
  .attack-range__disadv {
    font-size: 0.7em;
    vertical-align: middle;
  }

  .attack-crit-icon {
    margin-right: var(--spacing-xs);
  }

  .attack-chip--crit {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border-color: var(--md-sys-color-primary);
  }

  .attack-chip--fumble {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-error);
    border-color: var(--md-sys-color-error);
  }

  /* Roll mode indicator SVGs */
  .roll-mode-icon {
    width: 1rem;
    height: 1rem;
    margin-right: var(--spacing-xs);
  }

  .roll-mode-icon--advantage {
    color: var(--md-sys-color-primary);
  }

  .roll-mode-icon--disadvantage {
    color: var(--md-sys-color-error);
  }

  /* Rules-engine disadvantage indicator (before roll chip) */
  .roll-disadv-indicator {
    width: 1rem;
    height: 1rem;
    color: var(--md-sys-color-error);
    flex-shrink: 0;
  }

  /* Override arrow colors when inside crit/fumble chips so they remain visible */
  .attack-chip--crit .roll-mode-icon--advantage,
  .attack-chip--crit .roll-mode-icon--disadvantage {
    color: var(--md-sys-color-on-primary);
  }

  .attack-chip--fumble .roll-mode-icon--advantage,
  .attack-chip--fumble .roll-mode-icon--disadvantage {
    color: var(--md-sys-color-on-error-container);
  }

  /* Popover menu */
  .roll-popover {
    position: absolute;
    top: calc(100% + var(--spacing-xs));
    left: 0;
    z-index: var(--z-dropdown);
    min-width: 8rem;
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-xs);
    animation: popoverSlide 0.15s ease-out;
  }

  .roll-popover__item {
    display: block;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    text-align: left;
    min-height: 2.75rem;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .roll-popover__item:hover,
  .roll-popover__item:focus-visible {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline);
  }

  .roll-popover__item:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -2px;
  }

  @keyframes popoverSlide {
    from {
      opacity: 0;
      transform: translateY(-0.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .roll-popover {
      animation: none;
    }
  }

  .choice-panel__followups {
    display: flex;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-md) var(--spacing-md);
  }

  .choice-panel__followup-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs) var(--spacing-sm);
    min-height: 2.75rem;
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .choice-panel__followup-button:hover {
    background: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline);
  }

  .choice-panel__followup-button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }
</style>
