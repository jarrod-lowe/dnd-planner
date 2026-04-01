import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EffectPanel from '$lib/components/play/EffectPanel.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createMockEntry = (
  id: string,
  options?: {
    description?: string;
    uiName?: string;
    uiSection?: string;
  }
): AvailableRuleEntry => {
  const rule: Rule = {
    id,
    description: options?.description,
    activities: [],
    ui: {
      ...(options?.uiName ? { name: options.uiName } : {}),
      ...(options?.uiSection ? { section: options.uiSection } : {})
    }
  };
  return {
    rule,
    legal: true,
    applicable: true,
    diagnostics: []
  };
};

describe('EffectPanel', () => {
  it('renders as a div with role=status (not a button)', () => {
    const entry = createMockEntry('effect-1', { description: 'Test Effect' });
    const { container } = render(EffectPanel, { props: { entry } });

    const panel = container.querySelector('.effect-panel');
    expect(panel).toBeTruthy();
    expect(panel?.tagName).toBe('DIV');
    expect(panel?.getAttribute('role')).toBe('status');
  });

  it('has proper container structure', () => {
    const entry = createMockEntry('effect-1', { description: 'Test Effect' });
    const { container } = render(EffectPanel, { props: { entry } });

    expect(container.querySelector('.effect-panel')).toBeTruthy();
  });

  it('renders description when no ui.name', () => {
    const entry = createMockEntry('effect-1', { description: 'Slot consumed' });
    const { container } = render(EffectPanel, { props: { entry } });

    expect(container.textContent).toContain('Slot consumed');
  });

  it('renders rule id when no ui.name and no description', () => {
    const entry = createMockEntry('effect-slot-consumed-1');
    const { container } = render(EffectPanel, { props: { entry } });

    expect(container.textContent).toContain('effect-slot-consumed-1');
  });

  it('renders ui.name translation key when present', () => {
    const entry = createMockEntry('effect-1', { uiName: 'rule.effect.test-name' });
    const { container } = render(EffectPanel, { props: { entry } });

    // Should render the translation key (since no translations are loaded in test)
    expect(container.textContent).toContain('rule.effect.test-name');
  });

  it('renders without error when rule has ui.name and selections', () => {
    const entry = createMockEntry('effect-strength-1', {
      uiName: 'rule.dnd-5e-2024.ability-scores.effect-strength.name'
    });
    entry.rule.selections = { score: 15 };
    const { container } = render(EffectPanel, { props: { entry } });

    // In test env, $t() returns the key; selections are passed for interpolation in production
    expect(container.textContent).toContain('rule.dnd-5e-2024.ability-scores.effect-strength.name');
  });

  it('does not render delete button by default', () => {
    const entry = createMockEntry('effect-1', { description: 'Test Effect' });
    const { container } = render(EffectPanel, { props: { entry } });

    expect(container.querySelector('.effect-panel__button--remove')).toBeNull();
  });

  it('renders delete button when deletable is true', () => {
    const entry = createMockEntry('effect-1', { description: 'Test Effect' });
    const { container } = render(EffectPanel, {
      props: { entry, deletable: true, onRemove: vi.fn() }
    });

    expect(container.querySelector('.effect-panel__button--remove')).toBeTruthy();
  });

  it('delete button has accessible aria-label', () => {
    const entry = createMockEntry('effect-1', { description: 'Test Effect' });
    const { container } = render(EffectPanel, {
      props: { entry, deletable: true, onRemove: vi.fn() }
    });

    const button = container.querySelector('.effect-panel__button--remove');
    expect(button?.getAttribute('aria-label')).toBeTruthy();
  });

  it('calls onRemove when delete button is clicked', async () => {
    const entry = createMockEntry('effect-1', { description: 'Test Effect' });
    const onRemove = vi.fn();
    const { container } = render(EffectPanel, {
      props: { entry, deletable: true, onRemove }
    });

    const button = container.querySelector('.effect-panel__button--remove');
    await fireEvent.click(button!);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
