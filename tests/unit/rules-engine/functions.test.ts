import { describe, it, expect } from 'vitest';
import { statToModifierHandler, createBuiltinFunctionRegistry } from '$lib/rules-engine/functions';

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

  it('statToModifier in registry converts stat 18 to modifier 4', () => {
    const registry = createBuiltinFunctionRegistry();
    const handler = registry.get('statToModifier');

    expect(handler).toBeDefined();
    expect(handler!([18])).toBe(4);
  });
});
