import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import WarningIndicator from '$lib/components/play/WarningIndicator.svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';

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
    expect(indicator?.tagName).toBe('BUTTON');
    expect(indicator?.getAttribute('aria-label')).toBeTruthy();
  });

  it('uses specific message for aria-label when provided', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    expect(indicator?.getAttribute('aria-label')).toBe('Out of movement');
  });

  it('does not use native title attribute', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    expect(indicator?.getAttribute('title')).toBeNull();
  });

  it('falls back to generic label when no message provided', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal' }
    });

    const indicator = container.querySelector('.warning-indicator');
    expect(indicator?.getAttribute('aria-label')).toBeTruthy();
    expect(indicator?.getAttribute('aria-label')).not.toBe('Out of movement');
  });

  it('does not show tooltip initially', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    expect(container.querySelector('.warning-tooltip')).toBeNull();
  });

  it('shows tooltip after clicking the indicator', async () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);

    const tooltip = container.querySelector('.warning-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip?.textContent).toBe('Out of movement');
  });

  it('tooltip is aria-hidden to avoid double announcement', async () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);

    const tooltip = container.querySelector('.warning-tooltip');
    expect(tooltip?.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides tooltip when clicking the indicator again', async () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);
    expect(container.querySelector('.warning-tooltip')).toBeTruthy();

    await fireEvent.click(indicator!);
    expect(container.querySelector('.warning-tooltip')).toBeNull();
  });

  it('clicking the indicator does not close the tooltip via window handler', async () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);
    expect(container.querySelector('.warning-tooltip')).toBeTruthy();

    // Clicking the indicator again should toggle off, not close via window
    await fireEvent.click(indicator!);
    expect(container.querySelector('.warning-tooltip')).toBeNull();
  });

  it('closes tooltip when clicking outside', async () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Out of movement' }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);
    expect(container.querySelector('.warning-tooltip')).toBeTruthy();

    // Simulate click outside by dispatching on document
    await fireEvent.click(document.body);
    expect(container.querySelector('.warning-tooltip')).toBeNull();
  });

  it('tooltip has illegal styling class for illegal type', async () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Error' }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);

    const tooltip = container.querySelector('.warning-tooltip');
    expect(tooltip?.classList.contains('warning-tooltip--illegal')).toBe(true);
  });

  it('tooltip has inapplicable styling class for inapplicable type', async () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'inapplicable', message: 'Not applicable' }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);

    const tooltip = container.querySelector('.warning-tooltip');
    expect(tooltip?.classList.contains('warning-tooltip--inapplicable')).toBe(true);
  });

  it('button has no native title attribute', () => {
    const { container } = render(WarningIndicator, {
      props: { type: 'illegal' }
    });

    const indicator = container.querySelector('.warning-indicator');
    // <button> should not have default title
    expect(indicator?.getAttribute('title')).toBeNull();
  });

  it('clicking indicator does not trigger panel tap', async () => {
    const onTap = vi.fn();
    const entry = {
      rule: { id: 'test', activities: [] },
      legal: false,
      applicable: true,
      diagnostics: [{ code: 'some.error', severity: 'error' as const }]
    };
    const { container } = render(PanelRenderer, {
      props: { entry, onTap }
    });

    const indicator = container.querySelector('.warning-indicator');
    await fireEvent.click(indicator!);

    // The panel's onTap should NOT be called — only the tooltip toggles
    expect(onTap).not.toHaveBeenCalled();
    // But the tooltip should be open
    expect(container.querySelector('.warning-tooltip')).toBeTruthy();
  });

  it('clicking another indicator closes the previous tooltip', async () => {
    const { container: containerA } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Error A' }
    });
    const { container: containerB } = render(WarningIndicator, {
      props: { type: 'illegal', message: 'Error B' }
    });

    const indicatorA = containerA.querySelector('.warning-indicator');
    const indicatorB = containerB.querySelector('.warning-indicator');

    // Open A's tooltip
    await fireEvent.click(indicatorA!);
    expect(containerA.querySelector('.warning-tooltip')).toBeTruthy();

    // Click B — A should close
    await fireEvent.click(indicatorB!);
    expect(containerA.querySelector('.warning-tooltip')).toBeNull();
    expect(containerB.querySelector('.warning-tooltip')?.textContent).toBe('Error B');
  });
});
