import type { ValueSource } from './types';
import type { Facts, VarDefinition } from '$lib/rules-view';

type VarDefs = Record<string, VarDefinition>;
type Selections = Record<string, unknown>;

export function resolveValueSource(
  source: ValueSource | undefined,
  facts: Facts,
  vars: VarDefs,
  selections?: Selections
): number | string | unknown[] | undefined {
  if (!source) return undefined;
  // Facts and selections are dynamically shaped; this function's declared
  // return union is the panel contract, so the reads narrow to it.
  let result: number | string | unknown[] | undefined;
  if (source.number !== undefined) result = source.number;
  else if (source.string !== undefined) result = source.string;
  else if (source.fact !== undefined) result = facts[source.fact] as number | string | undefined;
  else if (source.var !== undefined) {
    if (selections && selections[source.var] !== undefined) {
      result = selections[source.var] as number | string | unknown[] | undefined;
    } else {
      const varDef = vars[source.var];
      if (!varDef) return undefined;
      const def = varDef.default;
      if (def.number !== undefined) result = def.number;
      else if (def.string !== undefined) result = def.string;
      else if (def.fact !== undefined) result = facts[def.fact] as number | string | undefined;
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

  // The mapping form: turn the resolved value into a string (an i18n key). An
  // unset source reads as 0 — an absent numeric fact is zero everywhere else in
  // the engine — so `{ fact, map: { 0: …, 1: … } }` covers a flag fact that is
  // only written in its "on" state, such as a versatile weapon's grip.
  if (source.map !== undefined) {
    if (Array.isArray(result)) return undefined;
    return source.map[String(result ?? 0)];
  }

  return result;
}
