import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/svelte';
import LineRenderer from '$lib/components/play/details/LineRenderer.svelte';
import type { Line } from '$lib/details/types';

// Mock Element.animate for JSDOM
beforeAll(() => {
  Element.prototype.animate = vi.fn();
});

function renderLines(lines: Line[]) {
  return render(LineRenderer, { props: { lines } });
}

describe('LineRenderer', () => {
  it('renders a paragraph line as <p>', () => {
    const lines: Line[] = [{ text: ['Hello world.'] }];
    const { container } = renderLines(lines);
    const p = container.querySelector('p');
    expect(p).toBeTruthy();
    expect(p?.textContent).toBe('Hello world.');
  });

  it('renders a single bullet line as <ul><li>', () => {
    const lines: Line[] = [{ bullet: true, text: ['Bullet point.'] }];
    const { container } = renderLines(lines);
    const ul = container.querySelector('ul');
    expect(ul).toBeTruthy();
    const li = container.querySelector('li');
    expect(li).toBeTruthy();
    expect(li?.textContent).toBe('Bullet point.');
  });

  it('groups consecutive bullet lines into one <ul>', () => {
    const lines: Line[] = [
      { bullet: true, text: ['First bullet.'] },
      { bullet: true, text: ['Second bullet.'] }
    ];
    const { container } = renderLines(lines);
    const uls = container.querySelectorAll('ul');
    expect(uls).toHaveLength(1);
    const lis = container.querySelectorAll('li');
    expect(lis).toHaveLength(2);
  });

  it('separates bullet groups split by a paragraph', () => {
    const lines: Line[] = [
      { bullet: true, text: ['Bullet 1.'] },
      { text: ['A paragraph in between.'] },
      { bullet: true, text: ['Bullet 2.'] }
    ];
    const { container } = renderLines(lines);
    const uls = container.querySelectorAll('ul');
    expect(uls).toHaveLength(2);
    const ps = container.querySelectorAll('p');
    expect(ps).toHaveLength(1);
  });

  it('renders strong spans as <strong>', () => {
    const lines: Line[] = [{ text: [{ strong: 'Bold text' }] }];
    const { container } = renderLines(lines);
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('Bold text');
  });

  it('renders em spans as <em>', () => {
    const lines: Line[] = [{ text: [{ em: 'Italic text' }] }];
    const { container } = renderLines(lines);
    const em = container.querySelector('em');
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe('Italic text');
  });

  it('renders mixed spans inline', () => {
    const lines: Line[] = [
      { text: ['Normal ', { strong: 'bold' }, ' and ', { em: 'italic' }, '.'] }
    ];
    const { container } = renderLines(lines);
    const p = container.querySelector('p');
    expect(p?.textContent).toBe('Normal bold and italic.');
    expect(p?.querySelector('strong')?.textContent).toBe('bold');
    expect(p?.querySelector('em')?.textContent).toBe('italic');
  });

  it('escapes script tags in text spans', () => {
    const lines: Line[] = [{ text: ['<script>alert("xss")</script>'] }];
    const { container } = renderLines(lines);
    const html = container.innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('ignores unknown span kinds', () => {
    const lines: Line[] = [
      { text: [{ unknown: 'mystery' } as unknown as import('$lib/details/types').Span, 'visible'] }
    ];
    const { container } = renderLines(lines);
    const p = container.querySelector('p');
    expect(p?.textContent).toBe('visible');
    expect(container.querySelector('.unknown')).toBeNull();
  });

  it('renders an empty array with no output', () => {
    const { container } = renderLines([]);
    expect(container.querySelector('.rules-body')?.children.length).toBe(0);
  });
});
