import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createMockEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: { id: 'test-rule', description: 'Test Rule', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelRenderer', () => {
  describe('basic rendering', () => {
    it('renders rule description as title when no ui.name', () => {
      const entry = createMockEntry();
      const { getByText } = render(PanelRenderer, { props: { entry } });
      expect(getByText('Test Rule')).toBeTruthy();
    });

    it('calls onTap when clicked in read-only mode', async () => {
      const entry = createMockEntry();
      const onTap = vi.fn();
      const { container } = render(PanelRenderer, { props: { entry, onTap } });
      const button = container.querySelector('button.panel-renderer');
      button?.click();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('shows warning indicator for illegal choice', () => {
      const entry = createMockEntry({ legal: false });
      const { container } = render(PanelRenderer, { props: { entry } });
      expect(container.querySelector('.warning-indicator--illegal')).toBeTruthy();
    });

    it('shows warning indicator for inapplicable choice', () => {
      const entry = createMockEntry({ applicable: false });
      const { container } = render(PanelRenderer, { props: { entry } });
      expect(container.querySelector('.warning-indicator--inapplicable')).toBeTruthy();
    });

    it('renders as div when editable', () => {
      const entry = createMockEntry();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true }
      });
      const panel = container.querySelector('.panel-renderer');
      expect(panel?.tagName).toBe('DIV');
    });

    it('renders as button when not editable', () => {
      const entry = createMockEntry();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: false }
      });
      const panel = container.querySelector('.panel-renderer');
      expect(panel?.tagName).toBe('BUTTON');
    });

    it('renders rule id as fallback when no description and no ui.name', () => {
      const entry = createMockEntry({
        rule: { id: 'my-rule-id', activities: [] }
      });
      const { container } = render(PanelRenderer, { props: { entry } });
      expect(container.textContent).toContain('my-rule-id');
    });

    it('renders ui.name translation key when present', () => {
      const entry = createMockEntry({
        rule: {
          id: 'test-rule',
          description: 'Fallback',
          activities: [],
          ui: { name: 'rule.dnd-5e-2024.some-rule.name' }
        }
      });
      const { container } = render(PanelRenderer, { props: { entry } });
      expect(container.textContent).toContain('rule.dnd-5e-2024.some-rule.name');
    });

    it('does not show warning indicator when legal and applicable', () => {
      const entry = createMockEntry();
      const { container } = render(PanelRenderer, { props: { entry } });
      expect(container.querySelector('.warning-indicator')).toBeNull();
    });

    it('has panel-renderer--editable class when editable', () => {
      const entry = createMockEntry();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true }
      });
      expect(container.querySelector('.panel-renderer--editable')).toBeTruthy();
    });

    it('does not have panel-renderer--editable class when not editable', () => {
      const entry = createMockEntry();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: false }
      });
      expect(container.querySelector('.panel-renderer--editable')).toBeNull();
    });
  });
});
