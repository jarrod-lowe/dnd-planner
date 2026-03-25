import type { NamedFunction } from './types';

/**
 * Handler function type for named functions in the rules engine.
 *
 * Takes an array of fact values (resolved from fact references) and optional activity args,
 * and returns a number.
 * Undefined values indicate the referenced fact didn't exist.
 *
 * Example: statToModifier([18]) returns 4 (Math.floor((18 - 10) / 2))
 * Example: multiply([30], { multiplier: 0.5 }) returns 15
 */
export type NamedFunctionHandler = (
  sourceArgs: (number | undefined)[],
  activityArgs?: Record<string, unknown>
) => number;

/**
 * Registry mapping function names to their handler implementations.
 *
 * The registry is closed for v1 - only built-in functions are available.
 * Functions are looked up by name during number_function activity execution.
 */
export type FunctionRegistry = Map<NamedFunction, NamedFunctionHandler>;

/**
 * Creates the built-in function registry with all named functions.
 *
 * Currently includes:
 * - statToModifier: D&D 5e formula for converting ability score to modifier
 * - multiply: Multiplies a value by a multiplier (from args)
 *
 * @returns Map of function names to handlers
 *
 * @calledBy evaluate (evaluate.ts) - during initialization
 */
export function createBuiltinFunctionRegistry(): FunctionRegistry {
  const registry = new Map<NamedFunction, NamedFunctionHandler>();
  registry.set('statToModifier', statToModifierHandler);
  registry.set('multiply', multiplyHandler);
  return registry;
}

/**
 * D&D 5e stat-to-modifier conversion: Math.floor((stat - 10) / 2)
 *
 * Examples:
 * - stat 1 -> modifier -5
 * - stat 10 -> modifier 0
 * - stat 18 -> modifier 4
 * - stat 20 -> modifier 5
 *
 * @param sourceArgs - Array containing the stat value (args[0])
 * @returns The modifier value, or 0 if stat is undefined
 *
 * @calledBy createBuiltinFunctionRegistry (to register this handler)
 */
export function statToModifierHandler(sourceArgs: (number | undefined)[]): number {
  const stat = sourceArgs[0];
  if (stat === undefined) return 0;
  return Math.floor((stat - 10) / 2);
}

/**
 * Multiplies a value by a multiplier.
 *
 * Examples:
 * - multiply([30], { multiplier: 0.5 }) -> 15 (half)
 * - multiply([10], { multiplier: 2 }) -> 20 (double)
 * - multiply([5], { multiplier: 3 }) -> 15 (triple)
 *
 * @param sourceArgs - Array containing the value to multiply (args[0])
 * @param activityArgs - Object containing the multiplier (args.multiplier)
 * @returns The multiplied value, or 0 if value is undefined
 *
 * @calledBy createBuiltinFunctionRegistry (to register this handler)
 */
export function multiplyHandler(
  sourceArgs: (number | undefined)[],
  activityArgs?: Record<string, unknown>
): number {
  const value = sourceArgs[0];
  if (value === undefined) return 0;

  const multiplier = (activityArgs?.multiplier as number) ?? 1;
  return value * multiplier;
}
