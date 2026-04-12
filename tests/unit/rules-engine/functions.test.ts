import { describe, it, expect } from 'vitest';
import {
  statToModifierHandler,
  multiplyHandler,
  maxHandler,
  createBuiltinFunctionRegistry
} from '$lib/rules-engine/functions';

describe('statToModifierHandler', () => {
  it('returns 0 for stat 10 (neutral)', () => {
    expect(statToModifierHandler([10])).toBe(0);
  });

  it('returns 0 when stat is undefined', () => {
    expect(statToModifierHandler([undefined])).toBe(0);
  });

  it('returns +1 for stat 12', () => {
    expect(statToModifierHandler([12])).toBe(1);
  });

  it('returns +4 for stat 18', () => {
    expect(statToModifierHandler([18])).toBe(4);
  });

  it('returns +5 for stat 20', () => {
    expect(statToModifierHandler([20])).toBe(5);
  });

  it('returns -1 for stat 8', () => {
    expect(statToModifierHandler([8])).toBe(-1);
  });

  it('returns -5 for stat 1', () => {
    expect(statToModifierHandler([1])).toBe(-5);
  });
});

describe('createBuiltinFunctionRegistry', () => {
  it('creates a registry with statToModifier function', () => {
    const registry = createBuiltinFunctionRegistry();

    expect(registry.has('statToModifier')).toBe(true);
  });

  it('creates a registry with multiply function', () => {
    const registry = createBuiltinFunctionRegistry();

    expect(registry.has('multiply')).toBe(true);
  });

  it('creates a registry with max function', () => {
    const registry = createBuiltinFunctionRegistry();

    expect(registry.has('max')).toBe(true);
  });

  it('statToModifier in registry converts stat 18 to modifier 4', () => {
    const registry = createBuiltinFunctionRegistry();
    const handler = registry.get('statToModifier');

    expect(handler).toBeDefined();
    expect(handler!([18])).toBe(4);
  });

  it('multiply in registry multiplies value by second source', () => {
    const registry = createBuiltinFunctionRegistry();
    const handler = registry.get('multiply');

    expect(handler).toBeDefined();
    expect(handler!([30, 0.5])).toBe(15);
  });
});

describe('multiplyHandler', () => {
  it('multiplies value by 0.5 (half)', () => {
    expect(multiplyHandler([30, 0.5])).toBe(15);
  });

  it('multiplies value by 2 (double)', () => {
    expect(multiplyHandler([10, 2])).toBe(20);
  });

  it('multiplies value by 3 (triple)', () => {
    expect(multiplyHandler([5, 3])).toBe(15);
  });

  it('returns 0 when value is undefined', () => {
    expect(multiplyHandler([undefined, 2])).toBe(0);
  });

  it('returns value unchanged when multiplier is undefined (identity)', () => {
    expect(multiplyHandler([10])).toBe(10);
  });

  it('handles fractional results correctly', () => {
    expect(multiplyHandler([10, 0.5])).toBe(5);
    expect(multiplyHandler([11, 0.5])).toBe(5.5);
  });
});

describe('maxHandler', () => {
  it('returns max of positive values', () => {
    expect(maxHandler([3, 5, 2])).toBe(5);
  });

  it('returns max with negative values', () => {
    expect(maxHandler([-3, -1, -5])).toBe(-1);
  });

  it('returns max of mixed positive and negative', () => {
    expect(maxHandler([3, -1])).toBe(3);
    expect(maxHandler([-1, 3])).toBe(3);
  });

  it('returns equal values when all are the same', () => {
    expect(maxHandler([2, 2])).toBe(2);
  });

  it('returns 0 when all args are undefined', () => {
    expect(maxHandler([undefined, undefined])).toBe(0);
    expect(maxHandler([])).toBe(0);
  });

  it('returns the single defined value when others are undefined', () => {
    expect(maxHandler([undefined, 4, undefined])).toBe(4);
    expect(maxHandler([undefined, -2])).toBe(-2);
  });
});
