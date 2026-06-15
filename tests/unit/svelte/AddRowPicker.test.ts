import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import AddRowPicker from '$lib/components/play/AddRowPicker.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

function makeEntry(id: string, name: string, verb = 'ATTACK'): AvailableRuleEntry {
  return {
    rule: { id, ui: { name, intents: { [verb]: 'default' } } },
    legal: true,
    applicable: true,
    diagnostics: []
  } as unknown as AvailableRuleEntry;
}

const entries = [makeEntry('greataxe', 'Greataxe'), makeEntry('dagger', 'Dagger')];

const trigger = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>('.add-row-picker__search-trigger');

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
});
