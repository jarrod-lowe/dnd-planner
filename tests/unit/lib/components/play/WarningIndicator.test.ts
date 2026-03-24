import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import WarningIndicator from '$lib/components/play/WarningIndicator.svelte';

describe('WarningIndicator', () => {
  it('renders for illegal choice', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal' }
    });

    expect(container.querySelector('.warning-indicator')).toBeTruthy();
    expect(container.querySelector('.warning-indicator--illegal')).toBeTruthy();
  });

  it('renders for inapplicable choice', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'inapplicable' }
    });

    expect(container.querySelector('.warning-indicator')).toBeTruthy();
    expect(container.querySelector('.warning-indicator--inapplicable')).toBeTruthy();
  });

  it('has accessible label', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal' }
    });

    const indicator = container.querySelector('.warning-indicator');
    expect(indicator?.getAttribute('role')).toBe('img');
    expect(indicator?.getAttribute('aria-label')).toBeTruthy();
  });
});
