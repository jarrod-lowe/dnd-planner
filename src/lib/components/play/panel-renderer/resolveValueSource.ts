import type { ValueSource } from './types';
import type { Facts, VarDefinition } from '$lib/rules-engine';

type VarDefs = Record<string, VarDefinition>;
type Selections = Record<string, unknown>;

export function resolveValueSource(
  source: ValueSource | undefined,
  facts: Facts,
  vars: VarDefs,
  selections?: Selections
): number | string | unknown[] | undefined {
  if (!source) return undefined;
  let result: number | string | unknown[] | undefined;
  if (source.number !== undefined) result = source.number;
  else if (source.string !== undefined) result = source.string;
  else if (source.fact !== undefined) result = facts[source.fact];
  else if (source.var !== undefined) {
    if (selections && selections[source.var] !== undefined) {
      result = selections[source.var];
    } else {
      const varDef = vars[source.var];
      if (!varDef) return undefined;
      const def = varDef.default;
      if (def.number !== undefined) result = def.number;
      else if (def.string !== undefined) result = def.string;
      else if (def.fact !== undefined) result = facts[def.fact];
      else if (def.array !== undefined) result = def.array;
      else return undefined;
    }
  } else if (source.array !== undefined) result = source.array;
  else return undefined;

  if (
    typeof result === 'number' &&
    (source.scale !== undefined ||
      source.offset !== undefined ||
      source.min !== undefined ||
      source.max !== undefined)
  ) {
    result = result * (source.scale ?? 1) + (source.offset ?? 0);
    if (source.min !== undefined && result < source.min) result = source.min;
    if (source.max !== undefined && result > source.max) result = source.max;
  }

  return result;
}
