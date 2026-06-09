import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

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
});
