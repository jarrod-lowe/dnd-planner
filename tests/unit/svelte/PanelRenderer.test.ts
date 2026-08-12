import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// PanelRenderer's handleDiceRoll calls toast.custom directly; mock it so we can
// inspect the componentProps it was called with instead of rendering a real toast.
vi.mock('svelte-sonner', () => ({
  toast: {
    custom: vi.fn()
  }
}));

import { toast } from 'svelte-sonner';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Annotation } from '$lib/rules-view';

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

describe('PanelRenderer roll toast', () => {
  const saveEntry = makeEntry({
    name: 'rule.save.name',
    annotationLabels: ['save.any'],
    primaryControl: {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'save' }]
    }
  });

  // Values here match what Task 4's Aura of Protection annotation will look
  // like: a rider with both a `value` (folded into the roll total) and a
  // label (used for the toast breakdown).
  const valuedAnnotations: Annotation[] = [
    {
      key: 'aura',
      targets: ['save.any'],
      rider: {
        label: 'rule.demo.aura',
        type: 'modifier',
        value: { kind: 'flat', bonus: 3 },
        appliesTo: 'save'
      }
    }
  ];

  const rollDie = async (container: HTMLElement) => {
    const die = container.querySelector('.panel-renderer__die-chip--main[data-die-index="0"]');
    await fireEvent.click(die!);
  };

  const lastToastModifiers = (): unknown => {
    const mock = vi.mocked(toast.custom);
    const call = mock.mock.calls[mock.mock.calls.length - 1];
    return (call[1] as { componentProps: { modifiers?: string[] } }).componentProps.modifiers;
  };

  it('lists a valued rider exactly once, in its resolved label +N form', async () => {
    vi.mocked(toast.custom).mockClear();
    const { container } = render(PanelRenderer, {
      props: { entry: saveEntry, editable: true, activeAnnotations: valuedAnnotations }
    });
    await rollDie(container);
    expect(toast.custom).toHaveBeenCalledTimes(1);
    // Regression: the bare-label loop and the resolved-value loop must not
    // both emit an entry for the same rider (that would show "Aura of
    // Protection" AND "Aura of Protection +3" in one toast).
    expect(lastToastModifiers()).toEqual(['rule.demo.aura +3']);
  });

  it('still lists a valueless (informational) rider by its bare label', async () => {
    vi.mocked(toast.custom).mockClear();
    const infoAnnotations: Annotation[] = [
      { key: 'info', targets: ['save.any'], rider: { label: 'rule.demo.info', type: 'dice' } }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry: saveEntry, editable: true, activeAnnotations: infoAnnotations }
    });
    await rollDie(container);
    expect(lastToastModifiers()).toEqual(['rule.demo.info']);
  });
});
