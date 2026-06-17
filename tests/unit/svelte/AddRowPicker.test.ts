import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import AddRowPicker from '$lib/components/play/AddRowPicker.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

function makeEntry(id: string, name: string, verb = 'ATTACK', legal = true): AvailableRuleEntry {
  return {
    rule: { id, ui: { name, intents: { [verb]: 'default' } } },
    legal,
    applicable: true,
    diagnostics: legal ? [] : ['rules.illegal.test']
  } as unknown as AvailableRuleEntry;
}

const entries = [makeEntry('greataxe', 'Greataxe'), makeEntry('dagger', 'Dagger')];

// ATTACK has legal options; DEFEND has only an illegal option ("Daze").
const mixedEntries = [
  makeEntry('greataxe', 'Greataxe'),
  makeEntry('dagger', 'Dagger'),
  makeEntry('daze', 'Daze', 'DEFEND', false)
];

const trigger = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>('.add-row-picker__search-trigger');

const eyeToggle = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>('.add-row-picker__toggle-illegal');

describe('AddRowPicker quick search', () => {
  it('renders a search trigger button with a localised aria-label', () => {
    const { container } = render(AddRowPicker, {
      props: { entries, onAddStep: vi.fn() }
    });
    expect(trigger(container)).toBeInstanceOf(HTMLButtonElement);
    expect(trigger(container)!.getAttribute('aria-label')).toBe('play.quickSearch.trigger');
  });

  it('reveals the quick search in place and hides the verb groups', async () => {
    const { container } = render(AddRowPicker, {
      props: { entries, onAddStep: vi.fn() }
    });
    expect(container.querySelector('.quick-search')).toBeNull();
    await fireEvent.click(trigger(container)!);
    await tick();
    expect(container.querySelector('.quick-search')).toBeTruthy();
    expect(container.querySelector('.add-row-picker__verbs')).toBeNull();
  });

  it('adds the picked entry and closes, restoring focus to the trigger', async () => {
    const onAddStep = vi.fn();
    const { container } = render(AddRowPicker, { props: { entries, onAddStep } });
    await fireEvent.click(trigger(container)!);
    await tick();
    await fireEvent.click(container.querySelector('button[data-key="d"]')!);
    await tick();
    await fireEvent.click(container.querySelector('.quick-search__result')!);
    await tick();
    expect(onAddStep).toHaveBeenCalledTimes(1);
    expect(onAddStep.mock.calls[0][0].rule.id).toBe('dagger');
    expect(container.querySelector('.quick-search')).toBeNull();
    expect(document.activeElement).toBe(trigger(container));
  });

  it('closing via back adds nothing and restores focus to the trigger', async () => {
    const onAddStep = vi.fn();
    const { container } = render(AddRowPicker, { props: { entries, onAddStep } });
    await fireEvent.click(trigger(container)!);
    await tick();
    await fireEvent.click(container.querySelector('button[data-action="back"]')!);
    await tick();
    expect(onAddStep).not.toHaveBeenCalled();
    expect(container.querySelector('.quick-search')).toBeNull();
    expect(document.activeElement).toBe(trigger(container));
  });

  it('closing via outside-click does not steal focus from the clicked element', async () => {
    const { container } = render(AddRowPicker, { props: { entries, onAddStep: vi.fn() } });
    await fireEvent.click(trigger(container)!);
    await tick();

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    await fireEvent.click(outside);
    await tick();

    expect(container.querySelector('.quick-search')).toBeNull();
    expect(document.activeElement).toBe(outside);
    expect(document.activeElement).not.toBe(trigger(container));

    outside.remove();
  });
});

describe('AddRowPicker illegal-options eye toggle', () => {
  it('renders the eye toggle closed by default with a localised aria-label', () => {
    const { container } = render(AddRowPicker, {
      props: { entries: mixedEntries, onAddStep: vi.fn() }
    });
    const eye = eyeToggle(container);
    expect(eye).toBeInstanceOf(HTMLButtonElement);
    expect(eye!.getAttribute('aria-pressed')).toBe('false');
    expect(eye!.getAttribute('aria-label')).toBe('play.addRow.showIllegal');
  });

  it('hides verb buttons that have only illegal options while closed', () => {
    const { container } = render(AddRowPicker, {
      props: { entries: mixedEntries, onAddStep: vi.fn() }
    });
    expect(container.querySelector('.add-row-picker__verb--illegal')).toBeNull();
  });

  it('reveals illegal verb buttons after opening the eye', async () => {
    const { container } = render(AddRowPicker, {
      props: { entries: mixedEntries, onAddStep: vi.fn() }
    });
    await fireEvent.click(eyeToggle(container)!);
    await tick();
    const eye = eyeToggle(container);
    expect(eye!.getAttribute('aria-pressed')).toBe('true');
    expect(eye!.getAttribute('aria-label')).toBe('play.addRow.hideIllegal');
    expect(container.querySelector('.add-row-picker__verb--illegal')).toBeTruthy();
  });

  it('hides illegal results in quick search while closed and reveals them when opened', async () => {
    const { container } = render(AddRowPicker, {
      props: { entries: mixedEntries, onAddStep: vi.fn() }
    });
    await fireEvent.click(trigger(container)!);
    await tick();
    // Query "da" matches both "Dagger" (legal) and "Daze" (illegal).
    await fireEvent.click(container.querySelector('button[data-key="d"]')!);
    await fireEvent.click(container.querySelector('button[data-key="a"]')!);
    await tick();
    expect(container.querySelector('.quick-search__result--illegal')).toBeNull();

    await fireEvent.click(eyeToggle(container)!);
    await tick();
    expect(container.querySelector('.quick-search__result--illegal')).toBeTruthy();
  });

  it('stays in quick search mode when the eye is toggled', async () => {
    const { container } = render(AddRowPicker, {
      props: { entries: mixedEntries, onAddStep: vi.fn() }
    });
    await fireEvent.click(trigger(container)!);
    await tick();
    expect(container.querySelector('.quick-search')).toBeTruthy();

    await fireEvent.click(eyeToggle(container)!);
    await tick();
    expect(container.querySelector('.quick-search')).toBeTruthy();
    expect(container.querySelector('.add-row-picker__verbs')).toBeNull();
  });
});
