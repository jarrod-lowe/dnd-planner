/**
 * Pure numeric helpers usable from rule modules. These are ordinary typed
 * functions (no string-keyed `numberFunction` registry indirection).
 */

/** D&D ability modifier: floor((score - 10) / 2). */
export function statToModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
