import { describe, it, expect } from 'vitest';
import { getHelloWorld } from '$lib/rules-engine';

describe('rules engine integration', () => {
  it('returns expected output for hello world request', () => {
    // Pattern: input → output (will expand for JSON-based tests later)
    const result = getHelloWorld();
    expect(result).toBe('Hello from the rules engine');
  });
});
