import { describe, it, expect } from 'vitest';
import { getHelloWorld } from '$lib/rules-engine';

describe('getHelloWorld', () => {
  it('returns the expected message', () => {
    expect(getHelloWorld()).toBe('Hello from the rules engine');
  });
});
