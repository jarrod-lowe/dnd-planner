import { describe, it, expect } from 'vitest';
import { getHelloWorld } from '$lib/rules-engine';

describe('rules engine integration', () => {
  it('returns translation key for hello world', () => {
    // The rules engine returns translation keys, not hardcoded strings
    // The Svelte layer handles translation via $t()
    const result = getHelloWorld();
    expect(result).toBe('rulesEngine.helloWorld');
  });
});
