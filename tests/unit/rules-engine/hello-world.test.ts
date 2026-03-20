import { describe, it, expect } from 'vitest';
import { getHelloWorld } from '$lib/rules-engine';

describe('getHelloWorld', () => {
  it('returns the translation key for hello world', () => {
    expect(getHelloWorld()).toBe('rulesEngine.helloWorld');
  });
});
