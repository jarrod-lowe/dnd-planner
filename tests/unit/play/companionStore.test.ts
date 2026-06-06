import { describe, it, expect } from 'vitest';
import { getCompanionView, setCompanionView, isSteedView, resetCompanionView } from '$lib/play/companionStore.svelte';

describe('companionStore', () => {
  it('defaults to player view', () => {
    resetCompanionView();
    expect(getCompanionView()).toBe('player');
    expect(isSteedView()).toBe(false);
  });

  it('switches to steed view', () => {
    resetCompanionView();
    setCompanionView('steed');
    expect(getCompanionView()).toBe('steed');
    expect(isSteedView()).toBe(true);
  });

  it('switches back to player view', () => {
    resetCompanionView();
    setCompanionView('steed');
    setCompanionView('player');
    expect(getCompanionView()).toBe('player');
    expect(isSteedView()).toBe(false);
  });
});
