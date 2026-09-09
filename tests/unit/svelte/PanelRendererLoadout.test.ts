import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// PanelRenderer's roll handler reaches for toast.custom on import; the loadout
// panel never rolls, but the module still has to resolve.
vi.mock('svelte-sonner', () => ({ toast: { custom: vi.fn() } }));

import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry } from '$lib/rules-view';
import type { RuleModule } from '$lib/rules-engine/types';

const dagger: RuleModule = {
  id: 'dagger',
  equip: {
    hands: 1,
    stackable: true,
    nameKey: 'rule.test.dagger.name',
    state: { 'weapon.dagger.equipped': 1 }
  }
};

const entry: AvailableRuleEntry = {
  rule: {
    id: 'set-loadout',
    activities: [],
    ui: {
      name: 'rule.dnd-5e-2024.loadout.set-loadout.name',
      section: 'equip',
      primaryControl: { type: 'loadout', var: 'loadout' }
    }
  },
  legal: true,
  applicable: true,
  diagnostics: []
};

describe('PanelRenderer loadout control', () => {
  it('renders the loadout picker for a loadout primaryControl', () => {
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, modules: [dagger] }
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    // empty, dagger, dagger+dagger
    expect(group?.querySelectorAll('[role="radio"]')).toHaveLength(3);
  });

  it('passes the chosen configuration up through onSelectionChange', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, modules: [dagger], onSelectionChange }
    });
    const row = container.querySelector<HTMLElement>('[role="radio"][data-loadout-id="dagger"]');
    await fireEvent.click(row!);
    expect(onSelectionChange).toHaveBeenCalledWith({
      loadout: expect.objectContaining({ id: 'dagger', hands: 1, handsFree: 1 })
    });
  });

  it('renders no picker when the panel has no loadout control', () => {
    const other: AvailableRuleEntry = {
      ...entry,
      rule: { id: 'x', activities: [], ui: { name: 'rule.x.name' } }
    };
    const { container } = render(PanelRenderer, {
      props: { entry: other, editable: true, modules: [dagger] }
    });
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });
});
