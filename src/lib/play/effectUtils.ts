import type { Rule } from '$lib/rules-engine';

export interface DurationState {
  remaining: number;
  total: number;
  nearExpiry: boolean;
}

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
