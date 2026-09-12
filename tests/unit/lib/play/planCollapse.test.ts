import { describe, it, expect } from 'vitest';
import { PlanCollapseState } from '$lib/play/planCollapse.svelte';

describe('PlanCollapseState', () => {
  it('collapses the rows already in the plan when a new row is added', () => {
    const state = new PlanCollapseState();

    state.sync(['a', 'b']);
    expect(state.isCollapsed('a')).toBe(false);
    expect(state.isCollapsed('b')).toBe(false);

    state.sync(['a', 'b', 'c']);

    expect(state.isCollapsed('a')).toBe(true);
    expect(state.isCollapsed('b')).toBe(true);
    // The row just added is the one the player is working on: it stays open.
    expect(state.isCollapsed('c')).toBe(false);
  });
});

describe('PlanCollapseState manual expansion', () => {
  it('leaves a row the player expanded by hand alone when a new row is added', () => {
    const state = new PlanCollapseState();
    state.sync(['a', 'b']);

    // The player collapses 'a', then expands it again by hand.
    state.setCollapsed('a', true);
    state.setCollapsed('a', false);

    state.sync(['a', 'b', 'c']);

    expect(state.isCollapsed('a')).toBe(false);
    expect(state.isCollapsed('b')).toBe(true);
  });

  it('keeps a hand-expanded row collapsed if the player then collapses it', () => {
    const state = new PlanCollapseState();
    state.sync(['a', 'b']);

    state.setCollapsed('a', false);
    state.setCollapsed('a', true);

    state.sync(['a', 'b', 'c']);

    expect(state.isCollapsed('a')).toBe(true);
  });

  it('forgets a removed row, so a re-used instanceId starts expanded again', () => {
    const state = new PlanCollapseState();
    state.sync(['a', 'b']);
    state.sync(['a', 'b', 'c']);
    expect(state.isCollapsed('a')).toBe(true);

    state.sync(['c']);
    state.sync(['c', 'a']);

    expect(state.isCollapsed('a')).toBe(false);
  });
});

describe('PlanCollapseState across a turn boundary', () => {
  it('drops every row — and its hand-expanded exemption — when End Turn empties the plan', () => {
    const state = new PlanCollapseState();
    state.sync(['a']);
    state.setCollapsed('a', false); // hand-expanded, so exempt this turn
    state.sync(['a', 'b']);
    expect(state.isCollapsed('a')).toBe(false);

    // End Turn commits the plan and leaves plannedItems empty.
    state.sync([]);

    // Next turn re-uses nothing: rows open expanded, and the old exemption is
    // gone, so the row folds like any other when a second row arrives.
    state.sync(['a']);
    expect(state.isCollapsed('a')).toBe(false);
    state.sync(['a', 'c']);
    expect(state.isCollapsed('a')).toBe(true);
  });
});
