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
  if (source.number !== undefined) return source.number;
  if (source.string !== undefined) return source.string;
  if (source.fact !== undefined) return facts[source.fact];
  if (source.var !== undefined) {
    if (selections && selections[source.var] !== undefined) {
      return selections[source.var];
    }
    const varDef = vars[source.var];
    if (!varDef) return undefined;
    const def = varDef.default;
    if (def.number !== undefined) return def.number;
    if (def.fact !== undefined) return facts[def.fact];
    if (def.array !== undefined) return def.array;
    return undefined;
  }
  if (source.array !== undefined) return source.array;
  return undefined;
}

export function resolveExpression(
  expression: string | { var: string },
  facts: Facts,
  vars: VarDefs,
  selections?: Selections
): string | number | undefined {
  if (typeof expression === 'string') return expression;
  return resolveValueSource({ var: expression.var }, facts, vars, selections) as number | undefined;
}
