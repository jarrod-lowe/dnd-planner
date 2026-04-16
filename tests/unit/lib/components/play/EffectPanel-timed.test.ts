import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EffectPanel from '$lib/components/play/EffectPanel.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';
import type { Facts } from '$lib/rules-engine';

const createTimedEntry = (id: string, ui: Record<string, unknown>): AvailableRuleEntry => {
  const rule: Rule = {
    id,
    activities: [],
    ui: { name: id, ...ui }
  };
  return {
    rule,
    legal: true,
    applicable: true,
    diagnostics: []
  };
};

describe('EffectPanel - timed-save-effect model', () => {
  it('renders save type and DC from facts', () => {
    const entry = createTimedEntry('effect-sanctuary-1', {
      model: 'timed-save-effect',
      saveType: 'WIS',
      saveFact: 'spellcasting.saveDC',
      countDown: 7,
      duration: 10
    });
    const facts: Facts = { 'spellcasting.saveDC': 13 };
    const { container } = render(EffectPanel, {
      props: { entry, facts }
    });

    expect(container.textContent).toContain('WIS Save DC 13');
  });

  it('renders filled and empty circle markers based on countDown', () => {
    const entry = createTimedEntry('effect-sanctuary-1', {
      model: 'timed-save-effect',
      saveType: 'WIS',
      saveFact: 'spellcasting.saveDC',
      countDown: 7,
      duration: 10
    });
    const facts: Facts = { 'spellcasting.saveDC': 13 };
    const { container } = render(EffectPanel, {
      props: { entry, facts }
    });

    const markers = container.querySelectorAll('.effect-panel__marker');
    expect(markers).toHaveLength(10);
    const filled = container.querySelectorAll('.effect-panel__marker--filled');
    const empty = container.querySelectorAll('.effect-panel__marker--empty');
    expect(filled).toHaveLength(7);
    expect(empty).toHaveLength(3);
  });

  it('renders all filled when countDown equals duration', () => {
    const entry = createTimedEntry('effect-sanctuary-1', {
      model: 'timed-save-effect',
      saveType: 'WIS',
      saveFact: 'spellcasting.saveDC',
      countDown: 10,
      duration: 10
    });
    const facts: Facts = { 'spellcasting.saveDC': 13 };
    const { container } = render(EffectPanel, {
      props: { entry, facts }
    });

    const filled = container.querySelectorAll('.effect-panel__marker--filled');
    const empty = container.querySelectorAll('.effect-panel__marker--empty');
    expect(filled).toHaveLength(10);
    expect(empty).toHaveLength(0);
  });

  it('does not render save line or markers for non-timed model', () => {
    const entry = createTimedEntry('effect-other-1', {
      model: 'other'
    });
    const { container } = render(EffectPanel, {
      props: { entry }
    });

    expect(container.querySelector('.effect-panel__save')).toBeNull();
    expect(container.querySelector('.effect-panel__markers')).toBeNull();
  });
});
