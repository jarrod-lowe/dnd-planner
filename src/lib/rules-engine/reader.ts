import type { Facts, FactReader } from './types';

/**
 * A read-only FactReader over an already-settled fact map (post-sheet /
 * post-plan). Unset facts read as 0; `has` distinguishes an unset
 * fact from an explicit 0.
 *
 * The sheet pass uses its own dependency-tracking reader (it settles facts on
 * first read); this plain reader is for passes that read facts that are already
 * fully derived — offers and annotate.
 */
export function plainReader(facts: Facts): FactReader {
  return {
    num: (name) => facts[name] ?? 0,
    has: (name) => Object.prototype.hasOwnProperty.call(facts, name)
  };
}
