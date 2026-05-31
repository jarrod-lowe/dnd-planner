import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/svelte';

// Mock Element.animate for JSDOM
beforeAll(() => {
  Element.prototype.animate = vi.fn();
});

// Mock i18n
vi.mock('$lib/i18n', () => ({
  t: {
    subscribe: (cb: (v: (k: string) => string) => void) => {
      cb((k: string) => k);
      return { unsubscribe: () => {} };
    }
  }
}));

import RulesPane from '$lib/components/play/details/RulesPane.svelte';
import type { ItemDetail } from '$lib/details/types';

const sampleDetail: ItemDetail = {
  source: 'srd52',
  meta: 'Level 1 Enchantment (Bard, Sorcerer, Wizard)',
  fields: [
    { labelKey: 'rules.field.castingTime', value: 'Action' },
    { labelKey: 'rules.field.range', value: '60 feet' }
  ],
  body: [
    { text: ['Each creature must succeed on a Wisdom saving throw.'] },
    { bullet: true, text: [{ strong: 'At Higher Levels.' }, ' More targets.'] }
  ]
};

describe('RulesPane', () => {
  it('renders the RULES mode label', () => {
    const { getByText } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    expect(getByText('rules.mode')).toBeTruthy();
  });

  it('renders the return chip with Flip label', () => {
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    const returnChip = container.querySelector('.rules-rail__return');
    expect(returnChip).toBeTruthy();
    expect(returnChip?.textContent).toContain('play.planRow.flipReturn');
  });

  it('calls onFlip when rail is clicked', async () => {
    const onFlip = vi.fn();
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, returnLabel: 'Cast', onFlip }
    });
    const rail = container.querySelector('.rules-rail');
    rail?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('renders italic meta subtitle', () => {
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    const meta = container.querySelector('.rules-meta');
    expect(meta).toBeTruthy();
    expect(meta?.tagName).toBe('EM');
    expect(meta?.textContent).toBe('Level 1 Enchantment (Bard, Sorcerer, Wizard)');
  });

  it('renders field labels and values', () => {
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    const dts = container.querySelectorAll('dt');
    const dds = container.querySelectorAll('dd');
    expect(dts).toHaveLength(2);
    expect(dds).toHaveLength(2);
    expect(dts[0]?.textContent).toBe('rules.field.castingTime');
    expect(dds[0]?.textContent).toBe('Action');
    expect(dts[1]?.textContent).toBe('rules.field.range');
    expect(dds[1]?.textContent).toBe('60 feet');
  });

  it('renders body content via LineRenderer', () => {
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    expect(container.querySelector('.rules-body')).toBeTruthy();
    expect(container.querySelector('ul')).toBeTruthy();
    expect(container.querySelector('li')).toBeTruthy();
    expect(container.querySelector('p')?.textContent).toContain('Each creature must succeed');
  });

  it('renders without meta when absent', () => {
    const noMeta: ItemDetail = { source: 'custom', body: [{ text: ['Just text.'] }] };
    const { container } = render(RulesPane, {
      props: { detail: noMeta, onFlip: vi.fn() }
    });
    expect(container.querySelector('.rules-meta')).toBeNull();
  });

  it('renders without fields when absent', () => {
    const noFields: ItemDetail = { source: 'custom', body: [{ text: ['Just text.'] }] };
    const { container } = render(RulesPane, {
      props: { detail: noFields, onFlip: vi.fn() }
    });
    expect(container.querySelector('.rules-fields')).toBeNull();
  });

  it('applies rules-shell class to root element', () => {
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    expect(container.querySelector('.rules-shell')).toBeTruthy();
  });

  it('applies aria-pressed to rail toggle', () => {
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    const rail = container.querySelector('[aria-pressed="true"]');
    expect(rail).toBeTruthy();
  });

  it('renders rail as native button element', () => {
    const { container } = render(RulesPane, {
      props: { detail: sampleDetail, onFlip: vi.fn() }
    });
    const rail = container.querySelector('.rules-rail');
    expect(rail?.tagName).toBe('BUTTON');
  });
});
