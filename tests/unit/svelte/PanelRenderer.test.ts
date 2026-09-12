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

describe('PanelRenderer actionable annotations', () => {
  const diceEntry = makeEntry({
    name: 'rule.check.name',
    annotationLabels: ['dice.any'],
    primaryControl: {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { number: 2 }, purpose: 'check' }]
    }
  });

  const hiAnnotation: Annotation[] = [
    {
      key: 'rule.dnd-5e-2024.heroic-inspiration.annotation',
      targets: ['dice.any'],
      addsToPlan: { offer: 'use-hi' }
    }
  ];

  const advisoryAnnotation: Annotation[] = [
    { key: 'rule.dnd-5e-2024.attacks.extra-attack.annotation', targets: ['dice.any'] }
  ];

  /** The addable catalog the annotation shortcut resolves against. */
  const catalog = new Set(['use-hi']);

  it('renders an annotation that names an offer as a button', () => {
    const { container } = render(PanelRenderer, {
      props: {
        entry: diceEntry,
        editable: true,
        activeAnnotations: hiAnnotation,
        addableOfferIds: catalog,
        onAddOfferToPlan: vi.fn()
      }
    });
    const action = container.querySelector('button.panel-renderer__annotation--action');
    expect(action).not.toBeNull();
    expect(action?.textContent).toContain('rule.dnd-5e-2024.heroic-inspiration.annotation');
    // The accessible name says what the tap DOES, not just what is available.
    expect(action?.getAttribute('aria-label')).toBe(
      'Add to plan: rule.dnd-5e-2024.heroic-inspiration.annotation'
    );
  });

  it('adds the named offer to the plan when tapped', async () => {
    const onAddOfferToPlan = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: diceEntry,
        editable: true,
        activeAnnotations: hiAnnotation,
        addableOfferIds: catalog,
        onAddOfferToPlan
      }
    });
    await fireEvent.click(container.querySelector('button.panel-renderer__annotation--action')!);
    expect(onAddOfferToPlan).toHaveBeenCalledWith('use-hi', undefined);
  });

  it('leaves an annotation with no offer as plain text', () => {
    const { container } = render(PanelRenderer, {
      props: {
        entry: diceEntry,
        editable: true,
        activeAnnotations: advisoryAnnotation,
        addableOfferIds: catalog,
        onAddOfferToPlan: vi.fn()
      }
    });
    expect(container.querySelector('button.panel-renderer__annotation--action')).toBeNull();
    expect(container.querySelector('span.panel-renderer__annotation')).not.toBeNull();
  });

  it('leaves a named offer absent from the addable catalog as plain text', () => {
    // The offer's `when` gate has closed post-plan, so the store's lookup would
    // miss and the tap would do nothing. A dead button is worse than no button.
    const { container } = render(PanelRenderer, {
      props: {
        entry: diceEntry,
        editable: true,
        activeAnnotations: hiAnnotation,
        addableOfferIds: new Set(['something-else']),
        onAddOfferToPlan: vi.fn()
      }
    });
    expect(container.querySelector('button.panel-renderer__annotation--action')).toBeNull();
    expect(container.querySelector('span.panel-renderer__annotation')).not.toBeNull();
  });

  it('leaves the annotation as plain text when no catalog is wired through', () => {
    // Deny by default: a caller that forgot to pass the catalog shows a missing
    // button (visible) rather than a dead one (silent).
    const { container } = render(PanelRenderer, {
      props: {
        entry: diceEntry,
        editable: true,
        activeAnnotations: hiAnnotation,
        onAddOfferToPlan: vi.fn()
      }
    });
    expect(container.querySelector('button.panel-renderer__annotation--action')).toBeNull();
    expect(container.querySelector('span.panel-renderer__annotation')).not.toBeNull();
  });

  it('leaves the annotation as plain text on a non-editable picker panel', () => {
    // Picker panels are one big tap target that adds the panel's OWN offer; a
    // nested button there would be a second, conflicting action.
    const { container } = render(PanelRenderer, {
      props: {
        entry: diceEntry,
        editable: false,
        activeAnnotations: hiAnnotation,
        addableOfferIds: catalog,
        onAddOfferToPlan: vi.fn()
      }
    });
    expect(container.querySelector('button.panel-renderer__annotation--action')).toBeNull();
    expect(container.querySelector('span.panel-renderer__annotation')).not.toBeNull();
  });

  it('does not let the tap bubble into the panel-level tap handler', async () => {
    const onTap = vi.fn();
    const onAddOfferToPlan = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: diceEntry,
        editable: true,
        activeAnnotations: hiAnnotation,
        addableOfferIds: catalog,
        onAddOfferToPlan,
        onTap
      }
    });
    await fireEvent.click(container.querySelector('button.panel-renderer__annotation--action')!);
    expect(onAddOfferToPlan).toHaveBeenCalledWith('use-hi', undefined);
    expect(onTap).not.toHaveBeenCalled();
  });
});

describe('PanelRenderer "again" annotations', () => {
  // Extra Attack's reminder lands on every Attack-action panel the character
  // has, so it names no offer — it repeats whichever panel it is rendered on.
  const extraAttack: Annotation[] = [
    {
      key: 'rule.dnd-5e-2024.attacks.extra-attack.annotation',
      targets: ['attack.action'],
      addsToPlan: 'again'
    }
  ];

  const attackEntry = (id: string): AvailableRuleEntry => ({
    rule: {
      id,
      activities: [],
      ui: {
        name: 'rule.attack.name',
        annotationLabels: ['attack.any', 'attack.action'],
        primaryControl: {
          type: 'dice-line',
          dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'to-hit' }]
        }
      }
    },
    legal: true,
    applicable: true,
    diagnostics: []
  });

  /** Both weapons still wielded post-plan, so both attacks remain addable. */
  const catalog = new Set(['greataxe-use-action', 'spear-use-action']);

  it("re-plans the panel's own offer, so the swing reuses the same weapon", async () => {
    const onAddOfferToPlan = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: attackEntry('greataxe-use-action'),
        editable: true,
        activeAnnotations: extraAttack,
        addableOfferIds: catalog,
        onAddOfferToPlan
      }
    });
    await fireEvent.click(container.querySelector('button.panel-renderer__annotation--action')!);
    expect(onAddOfferToPlan).toHaveBeenCalledWith('greataxe-use-action', undefined);
  });

  it('resolves against the panel it is on, not a fixed offer', async () => {
    // The same annotation on a different weapon's panel must add THAT weapon.
    const onAddOfferToPlan = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: attackEntry('spear-use-action'),
        editable: true,
        activeAnnotations: extraAttack,
        addableOfferIds: catalog,
        onAddOfferToPlan
      }
    });
    await fireEvent.click(container.querySelector('button.panel-renderer__annotation--action')!);
    expect(onAddOfferToPlan).toHaveBeenCalledWith('spear-use-action', undefined);
  });

  it('stays plain text once a later row has stowed the weapon', () => {
    // The greataxe swing RAN at its own step, so its row is applicable — but a
    // later set-loadout row stowed the weapon, so `greataxe-use-action` is gated
    // out of the post-plan addable catalog and the store's lookup would miss.
    // Applicability cannot see this; only the catalog can.
    const { container } = render(PanelRenderer, {
      props: {
        entry: attackEntry('greataxe-use-action'),
        editable: true,
        activeAnnotations: extraAttack,
        addableOfferIds: new Set(['spear-use-action']),
        onAddOfferToPlan: vi.fn()
      }
    });
    expect(container.querySelector('button.panel-renderer__annotation--action')).toBeNull();
    expect(container.querySelector('span.panel-renderer__annotation')).not.toBeNull();
  });

  it('stays plain text on a skipped row, whose id is an instance id', () => {
    // A row the engine SKIPPED is rendered from the planned item itself, whose
    // rule id is the INSTANCE id — never a member of the offer catalog, so the
    // same membership test that covers the stowed weapon covers this too.
    const skipped = attackEntry('inst-42');
    skipped.applicable = false;
    const { container } = render(PanelRenderer, {
      props: {
        entry: skipped,
        editable: true,
        activeAnnotations: extraAttack,
        addableOfferIds: catalog,
        onAddOfferToPlan: vi.fn()
      }
    });
    expect(container.querySelector('button.panel-renderer__annotation--action')).toBeNull();
    expect(container.querySelector('span.panel-renderer__annotation')).not.toBeNull();
  });
});

describe('PanelRenderer annotation seeds', () => {
  // Life Bond: the reminder rides the player's Record Healing panel and adds
  // the steed's own heal row, which should open on the amount already set here.
  const healEntry: AvailableRuleEntry = {
    rule: {
      id: 'record-heal',
      activities: [],
      ui: {
        name: 'planner.record.heal',
        annotationLabels: ['healing.any'],
        primaryControl: { type: 'slider', var: 'amount', min: { number: 0 }, max: { number: 50 } }
      },
      vars: { amount: { capture: true, default: { number: 0 } } }
    },
    legal: true,
    applicable: true,
    diagnostics: []
  };

  const lifeBond: Annotation[] = [
    {
      key: 'rule.spell-find-steed.annotate-life-bond.text',
      targets: ['healing.any'],
      addsToPlan: {
        offer: 'steed-record-heal',
        seed: { amount: { effect: 'hp.modifier.current' } }
      }
    }
  ];

  const catalog = new Set(['steed-record-heal']);

  it('hands the seed SPEC to the store rather than resolving it here', async () => {
    const onAddOfferToPlan = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: healEntry,
        editable: true,
        selections: { amount: 7 },
        activeAnnotations: lifeBond,
        addableOfferIds: catalog,
        onAddOfferToPlan
      }
    });
    await fireEvent.click(container.querySelector('button.panel-renderer__annotation--action')!);
    expect(onAddOfferToPlan).toHaveBeenCalledWith('steed-record-heal', {
      amount: { effect: 'hp.modifier.current' }
    });
  });

  it('passes the same spec whatever this panel currently has selected', async () => {
    // The spec is authored by the rule, not derived from panel state — the
    // store resolves it after flushing, so nothing here depends on selections.
    const onAddOfferToPlan = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: healEntry,
        editable: true,
        selections: {},
        activeAnnotations: lifeBond,
        addableOfferIds: catalog,
        onAddOfferToPlan
      }
    });
    await fireEvent.click(container.querySelector('button.panel-renderer__annotation--action')!);
    expect(onAddOfferToPlan).toHaveBeenCalledWith('steed-record-heal', {
      amount: { effect: 'hp.modifier.current' }
    });
  });

  it('passes no seed at all for an annotation that declares none', async () => {
    const onAddOfferToPlan = vi.fn();
    const noSeed: Annotation[] = [
      {
        key: 'rule.spell-find-steed.annotate-life-bond.text',
        targets: ['healing.any'],
        addsToPlan: { offer: 'steed-record-heal' }
      }
    ];
    const { container } = render(PanelRenderer, {
      props: {
        entry: healEntry,
        editable: true,
        selections: { amount: 7 },
        activeAnnotations: noSeed,
        addableOfferIds: catalog,
        onAddOfferToPlan
      }
    });
    await fireEvent.click(container.querySelector('button.panel-renderer__annotation--action')!);
    expect(onAddOfferToPlan).toHaveBeenCalledWith('steed-record-heal', undefined);
  });
});
