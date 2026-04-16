import type { Rule } from '$lib/rules-engine';

/**
 * Decrement countDown on timed effects and remove expired ones.
 * Called during endTurn before committing effects.
 */
export function decrementCountDowns(effects: Rule[]): Rule[] {
  return effects
    .map((e) => {
      if (e.ui?.countDown != null && typeof e.ui.countDown === 'number') {
        return { ...e, ui: { ...e.ui, countDown: e.ui.countDown - 1 } };
      }
      return e;
    })
    .filter((e) => e.ui?.countDown == null || e.ui.countDown > 0);
}
