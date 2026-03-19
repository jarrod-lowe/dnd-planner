import { describe, it, expect } from 'vitest';
import { APP_NAME } from '$lib';

describe('App Constants', () => {
  it('should have the correct app name', () => {
    expect(APP_NAME).toBe('D&D Planner');
  });
});
