import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DamageTypeIcon from '$lib/components/play/panel-renderer/DamageTypeIcon.svelte';

const damageTypes = [
  'bludgeoning',
  'piercing',
  'slashing',
  'acid',
  'cold',
  'fire',
  'lightning',
  'thunder',
  'force',
  'necrotic',
  'radiant',
  'poison',
  'psychic'
];

describe('DamageTypeIcon', () => {
  it.each(damageTypes)('renders an SVG for %s', (type) => {
    const { container } = render(DamageTypeIcon, { props: { type } });
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders no SVG for an unknown damage type', () => {
    const { container } = render(DamageTypeIcon, { props: { type: 'unknown' } });
    expect(container.querySelector('svg')).toBeNull();
  });

  it.each(damageTypes)('SVG has aria-label for %s', (type) => {
    const { container } = render(DamageTypeIcon, { props: { type } });
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBeTruthy();
  });
});
