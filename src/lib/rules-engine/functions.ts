/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: Remove eslint-disable when implementing functions
import type { NamedFunction } from './types';

/**
 * Handler function type for named functions in the rules engine.
 *
 * Takes an array of fact values (resolved from fact references) and returns a number.
 * Undefined values indicate the referenced fact didn't exist.
 *
 * Example: statToModifier([18]) returns 4 (Math.floor((18 - 10) / 2))
 */
export type NamedFunctionHandler = (args: (number | undefined)[]) => number;

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
 *
 * @returns Map of function names to handlers
 *
 * @calledBy evaluate (evaluate.ts) - during initialization
 */
export function createBuiltinFunctionRegistry(): FunctionRegistry {
  throw new Error('Not implemented');
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
 * @param args - Array containing the stat value (args[0])
 * @returns The modifier value, or 0 if stat is undefined
 *
 * @calledBy createBuiltinFunctionRegistry (to register this handler)
 */
export function statToModifierHandler(args: (number | undefined)[]): number {
  throw new Error('Not implemented');
}
