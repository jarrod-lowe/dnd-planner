import type { Facts, NumberIncrementActivity, Rule } from '$lib/rules-view';

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

/**
 * Extracts the base ID from an effect ID that may have a counter suffix.
 * The rules engine appends `-{counter}` when advertising effects.
 */
export function getBaseEffectId(effectId: string): string {
  const match = effectId.match(/^(.+)-(\d+)$/);
  return match ? match[1] : effectId;
}

/**
 * Collapse advertised effects that share a replacement key (`group[0]`), keeping
 * the LAST (newest) — mirroring the engine's `dedupeByKey`. Two planned actions
 * touching the same key this turn (Cast then Dismiss Steed; the same HP modifier
 * set twice) both land in `advertised`, but the engine keeps only the newest for
 * facts/commit, so the strip must too. Keyless effects are all kept; each
 * surviving keyed effect stays at its last position.
 */
function dedupeAdvertisedByKey(advertised: Rule[]): Rule[] {
  const lastIndexByKey = new Map<string, number>();
  advertised.forEach((e, i) => {
    const key = e.group?.[0];
    if (key !== undefined) lastIndexByKey.set(key, i);
  });
  return advertised.filter((e, i) => {
    const key = e.group?.[0];
    return key === undefined || lastIndexByKey.get(key) === i;
  });
}

/**
 * Merge committed effects with this turn's advertised (planned) effects for the
 * active-effects strip. A committed effect is replaced by an advertised one that
 * shares its `id` (the fresher copy — carries runtime vars like `countDown`) OR
 * its replacement key (`group[0]`). The engine dedupes by key (newest wins) both
 * among the advertised effects and across committed/advertised, so the strip
 * mirrors that in two steps: first collapse same-key advertised duplicates
 * (`dedupeAdvertisedByKey`), then drop any committed effect a surviving advertised
 * key replaces — else a planned replacement (Dismiss Steed's steed-keyed effect
 * superseding the committed mount chip, or a re-cast superseding an earlier
 * planned steed) leaves a stale chip visible until End Turn. Committed-first
 * ordering; keyless effects (no `group`) are never key-deduped.
 */
export function mergeActiveEffects(committed: Rule[], advertised: Rule[]): Rule[] {
  const deduped = dedupeAdvertisedByKey(advertised);
  const advById = new Map(deduped.map((e) => [e.id, e]));
  const advKeys = new Set(
    deduped.map((e) => e.group?.[0]).filter((k): k is string => k !== undefined)
  );
  const result: Rule[] = [];
  const placed = new Set<string>();
  for (const effect of committed) {
    const fresher = advById.get(effect.id);
    if (fresher) {
      result.push(fresher); // same id → prefer the advertised (runtime vars)
      placed.add(effect.id);
      continue;
    }
    const key = effect.group?.[0];
    if (key !== undefined && advKeys.has(key)) continue; // replaced by a same-key advertised effect
    result.push(effect);
  }
  for (const effect of deduped) {
    if (!placed.has(effect.id)) result.push(effect);
  }
  return result;
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
