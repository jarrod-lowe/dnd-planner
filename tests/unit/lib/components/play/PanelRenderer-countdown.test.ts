import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule, Facts } from '$lib/rules-engine';

const createCountdownEntry = (filled: number, total: number): AvailableRuleEntry => ({
  rule: {
    id: 'effect-sanctuary',
    description: 'Sanctuary',
    activities: [],
    ui: {
      name: 'rule.spells.sanctuary.effect.name',
      information: [
        {
          type: 'countdown',
          filled: { number: filled },
          total: { number: total }
        }
      ]
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - countdown information', () => {
  it('renders filled and empty markers', () => {
    const entry = createCountdownEntry(7, 10);
    const { container } = render(PanelRenderer, { props: { entry, facts: {} } });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    const empty = container.querySelectorAll('.panel-renderer__marker--empty');
    expect(filled).toHaveLength(7);
    expect(empty).toHaveLength(3);
  });

  it('renders all filled when filled equals total', () => {
    const entry = createCountdownEntry(10, 10);
    const { container } = render(PanelRenderer, { props: { entry, facts: {} } });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    const empty = container.querySelectorAll('.panel-renderer__marker--empty');
    expect(filled).toHaveLength(10);
    expect(empty).toHaveLength(0);
  });

  it('resolves filled and total from facts', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'effect',
        activities: [],
        ui: {
          information: [
            { type: 'countdown', filled: { fact: 'countDown' }, total: { fact: 'duration' } }
          ]
        }
      }
    } as Rule as AvailableRuleEntry;
    const facts: Facts = { countDown: 3, duration: 5 };
    const { container } = render(PanelRenderer, { props: { entry, facts } });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    expect(filled).toHaveLength(3);
  });

  it('renders nothing when filled or total is missing', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'effect',
        activities: [],
        ui: {
          information: [
            { type: 'countdown', filled: { fact: 'missingFact' }, total: { number: 5 } }
          ]
        }
      }
    } as Rule as AvailableRuleEntry;
    const { container } = render(PanelRenderer, { props: { entry, facts: {} } });
    const markers = container.querySelectorAll('.panel-renderer__marker');
    expect(markers).toHaveLength(0);
  });

  it('uses ui.countDown for filled dots when present', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'effect',
        activities: [],
        ui: {
          countDown: 5,
          duration: 10,
          information: [{ type: 'countdown', filled: { number: 10 }, total: { number: 10 } }]
        }
      }
    } as Rule as AvailableRuleEntry;
    const { container } = render(PanelRenderer, { props: { entry, facts: {} } });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    const empty = container.querySelectorAll('.panel-renderer__marker--empty');
    expect(filled).toHaveLength(5);
    expect(empty).toHaveLength(5);
  });

  it('renders countdown in editable mode', () => {
    const entry = createCountdownEntry(3, 5);
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {}, editable: true }
    });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    const empty = container.querySelectorAll('.panel-renderer__marker--empty');
    expect(filled).toHaveLength(3);
    expect(empty).toHaveLength(2);
  });
});
