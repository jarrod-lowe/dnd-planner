import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PlayLayout from '$lib/components/play/PlayLayout.svelte';

// Helper to create empty snippet functions
const emptySnippet = () => {};

describe('PlayLayout', () => {
  it('renders a four-column grid layout', () => {
    const { container } = render(PlayLayout, {
      props: {
        stats: emptySnippet,
        choices: emptySnippet,
        plan: emptySnippet,
        journal: emptySnippet
      }
    });

    const layout = container.querySelector('.play-layout');
    expect(layout).toBeTruthy();
  });

  it('has slots for all four columns', () => {
    const { container } = render(PlayLayout, {
      props: {
        stats: emptySnippet,
        choices: emptySnippet,
        plan: emptySnippet,
        journal: emptySnippet
      }
    });

    // Check that all column containers exist
    expect(container.querySelector('.play-layout__stats')).toBeTruthy();
    expect(container.querySelector('.play-layout__choices')).toBeTruthy();
    expect(container.querySelector('.play-layout__plan')).toBeTruthy();
    expect(container.querySelector('.play-layout__journal')).toBeTruthy();
  });

  it('uses semantic section elements for columns', () => {
    const { container } = render(PlayLayout, {
      props: {
        stats: emptySnippet,
        choices: emptySnippet,
        plan: emptySnippet,
        journal: emptySnippet
      }
    });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(4);
  });

  it('has aria-labelledby on each section', () => {
    const { container } = render(PlayLayout, {
      props: {
        stats: emptySnippet,
        choices: emptySnippet,
        plan: emptySnippet,
        journal: emptySnippet
      }
    });

    const sections = container.querySelectorAll('section');
    sections.forEach((section) => {
      expect(section.getAttribute('aria-labelledby')).toBeTruthy();
    });
  });
});
