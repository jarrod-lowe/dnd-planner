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

  it('uses specific message for aria-label when provided', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    expect(indicator?.getAttribute('aria-label')).toBe('Out of movement');
  });

  it('uses specific message for title when provided', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    expect(indicator?.getAttribute('title')).toBe('Out of movement');
  });

  it('falls back to generic label when no message provided', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal' }
    });

    const indicator = container.querySelector('.warning-indicator');
    // The generic label from i18n (test env returns the key)
    expect(indicator?.getAttribute('aria-label')).toBeTruthy();
    expect(indicator?.getAttribute('aria-label')).not.toBe('Out of movement');
  });
});
