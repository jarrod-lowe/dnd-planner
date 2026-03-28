import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/svelte';
import StatsColumn from '$lib/components/play/StatsColumn.svelte';

describe('StatsColumn', () => {
  it('renders movement stat when provided', () => {
    const { getByText } = render(StatsColumn, {
      props: {
        movement: { used: 5, max: 30 }
      }
    });

    expect(getByText('play.stats.movement')).toBeTruthy();
  });

  it('shows TODO placeholder when no movement data', () => {
    const { getByText } = render(StatsColumn, {
      props: {
        movement: undefined
      }
    });

    expect(getByText('play.stats.todo')).toBeTruthy();
  });

  it('displays used/max format for movement', () => {
    const { container } = render(StatsColumn, {
      props: {
        movement: { used: 5, max: 30 }
      }
    });

    // The i18n mock returns keys, so just check the key is used
    expect(container.textContent).toContain('play.stats.usedMax');
  });

  it('renders turn counter when turnCounter prop is provided', () => {
    const { getByText } = render(StatsColumn, {
      props: {
        turnCounter: 1
      }
    });

    expect(getByText('play.stats.turnCounter')).toBeTruthy();
  });

  it('does not show TODO when only turnCounter is provided', () => {
    const { container } = render(StatsColumn, {
      props: {
        turnCounter: 1
      }
    });

    expect(within(container).queryByText('play.stats.todo')).toBeNull();
  });

  it('has proper accessibility structure', () => {
    const { container } = render(StatsColumn, {
      props: {
        movement: { used: 5, max: 30 }
      }
    });

    const statItems = container.querySelectorAll('.stats-column__item');
    expect(statItems.length).toBeGreaterThan(0);
  });
});
