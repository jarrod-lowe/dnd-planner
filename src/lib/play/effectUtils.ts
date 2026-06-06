import type { Facts, NumberIncrementActivity, Rule } from '$lib/rules-engine';

export interface DurationState {
  remaining: number;
  total: number;
  nearExpiry: boolean;
}

export type EffectKind =
  | 'CONC'
  | 'ONGOING'
  | 'SENSE'
  | 'BUFF'
  | 'DEBUFF'
  | 'ITEM'
  | 'BUILD'
  | 'MOUNT';
export type ChipState = 'rest' | 'pending' | 'expiring';

/**
 * Reads duration state from an effect rule's ui.countDown and ui.duration fields.
 * Returns null for effects without duration tracking.
 */
export function getDurationState(rule: Rule): DurationState | null {
  const ui = rule.ui as Record<string, unknown> | undefined;
  if (!ui) return null;

  const countDown = ui.countDown;
  const duration = ui.duration;

  if (typeof countDown !== 'number' || typeof duration !== 'number') return null;

  return {
    remaining: countDown,
    total: duration,
    nearExpiry: countDown === 1
  };
}

/**
 * Detects if a rule has an activity that decrements concentration.remaining,
 * indicating it is a concentration spell effect.
 */
function hasConcentrationActivity(activities: Rule['activities']): boolean {
  for (const activity of activities) {
    if (
      activity.type === 'numberIncrement' &&
      'target' in activity &&
      'fact' in (activity.target as object) &&
      (activity.target as { fact: string }).fact === 'concentration.remaining' &&
      (activity as NumberIncrementActivity).subtract === true
    ) {
      return true;
    }
    // Recurse into generateRule's nested rule activities
    if (activity.type === 'generateRule' && 'rule' in activity) {
      const nested = (activity as { rule: Rule }).rule;
      if (hasConcentrationActivity(nested.activities)) return true;
    }
  }
  return false;
}

/**
 * Derives the effect kind from existing rule fields.
 * CONC  -> has activity decrementing concentration.remaining
 * SENSE -> ui.section === 'senses'
 * ITEM  -> ui.section === 'configuration'
 * ONGOING -> default
 */
export function getEffectKind(rule: Rule): EffectKind {
  if (hasConcentrationActivity(rule.activities)) return 'CONC';
  if (hasBuildGroup(rule)) return 'BUILD';

  const ui = rule.ui as Record<string, unknown> | undefined;
  if (!ui) return 'ONGOING';

  if (ui.section === 'senses') return 'SENSE';
  if (ui.section === 'configuration') return 'ITEM';
  if (ui.section === 'mount') return 'MOUNT';
  return 'ONGOING';
}

const BUILD_GROUPS = new Set(['Stats', 'Proficiency']);

function hasBuildGroup(rule: Rule): boolean {
  if (!rule.group) return false;
  return rule.group.some((g) => BUILD_GROUPS.has(g));
}

/**
 * Checks if the effect requires concentration.
 */
export function isConcentrationEffect(rule: Rule): boolean {
  return hasConcentrationActivity(rule.activities);
}

/**
 * Finds the concentration effect among all effects and returns its ui.name (i18n key).
 * Returns null if no concentration effect exists.
 */
export function getConcentrationEffectName(effects: Rule[]): string | null {
  for (const effect of effects) {
    if (isConcentrationEffect(effect)) {
      const ui = effect.ui as Record<string, unknown> | undefined;
      if (ui && typeof ui.name === 'string') {
        return ui.name;
      }
    }
  }
  return null;
}

/**
 * Checks if an effect rule is marked as hidden from the active state display.
 * Hidden effects still function in the rules engine but are suppressed from
 * the strip/column by default (toggled via eye icon).
 */
export function isHiddenEffect(rule: Rule): boolean {
  const ui = rule.ui as Record<string, unknown> | undefined;
  return ui?.hidden === true;
}

/**
 * Checks if an effect rule represents a mount/companion (steed).
 */
export function isMountEffect(rule: Rule): boolean {
  const ui = rule.ui as Record<string, unknown> | undefined;
  return ui?.section === 'mount';
}

/**
 * Determines the visual chip state from the effect rule and current facts.
 * Priority: expiring > pending > rest.
 */
export function getChipState(effect: Rule, facts: Facts): ChipState {
  const duration = getDurationState(effect);
  if (duration?.nearExpiry) return 'expiring';

  if (isConcentrationEffect(effect) && facts['concentration.damage-taken'] === 1) {
    return 'pending';
  }

  return 'rest';
}

export function getEffectDisplayValue(rule: Rule, facts: Facts): string | null {
  const ui = rule.ui as Record<string, unknown> | undefined;
  if (!ui) return null;

  if (typeof ui.displayFact === 'string') {
    const value = facts[ui.displayFact];
    if (value !== undefined && value !== null) return String(value);
  }

  if (typeof ui.displaySelection === 'string' && rule.selections) {
    const value = (rule.selections as Record<string, unknown>)[ui.displaySelection];
    if (value !== undefined && value !== null) return String(value);
  }

  return null;
}

export function getEffectLevel(rule: Rule, facts: Facts): number | null {
  const ui = rule.ui as Record<string, unknown> | undefined;
  if (!ui || typeof ui.levelFact !== 'string') return null;

  const value = facts[ui.levelFact];
  if (value === undefined || value === null) return null;
  return Number(value);
}
