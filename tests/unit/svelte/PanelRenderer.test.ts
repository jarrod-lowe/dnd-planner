import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry } from '$lib/rules-view';

const makeEntry = (ui: Record<string, unknown>): AvailableRuleEntry => ({
  rule: { id: 'cast-sanctuary', activities: [], ui },
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer description', () => {
  it('renders a description element under the title when ui.description is set', () => {
    const { container } = render(PanelRenderer, {
      props: { entry: makeEntry({ name: 'rule.x.name', description: 'rule.x.description' }) }
    });
    expect(container.querySelector('.panel-renderer__description')).not.toBeNull();
  });

  it('renders no description element when ui.description is absent', () => {
    const { container } = render(PanelRenderer, {
      props: { entry: makeEntry({ name: 'rule.x.name' }) }
    });
    expect(container.querySelector('.panel-renderer__description')).toBeNull();
  });

  it('includes the description in the picker accessible name (non-editable)', () => {
    const { container } = render(PanelRenderer, {
      props: { entry: makeEntry({ name: 'rule.x.name', description: 'rule.x.description' }) }
    });
    const panel = container.querySelector('.panel-renderer');
    const descriptionText = container.querySelector('.panel-renderer__description')!.textContent!;
    expect(panel?.getAttribute('role')).toBe('button');
    expect(panel?.getAttribute('aria-label')).toContain(descriptionText);
  });

  it('omits a description fragment from the accessible name when absent', () => {
    const { container } = render(PanelRenderer, {
      props: { entry: makeEntry({ name: 'rule.x.name' }) }
    });
    const panel = container.querySelector('.panel-renderer');
    expect(panel?.getAttribute('aria-label')).not.toContain('. ');
  });
});
