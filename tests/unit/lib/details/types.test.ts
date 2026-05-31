import { describe, it, expect } from 'vitest';
import type { Span, Line, ItemDetail } from '$lib/details/types';
import { isStrongSpan, isEmSpan, isPlainText, renderSpans } from '$lib/details/types';

describe('Span types', () => {
  it('plain string is a valid Span', () => {
    const span: Span = 'hello world';
    expect(isPlainText(span)).toBe(true);
    expect(isStrongSpan(span)).toBe(false);
    expect(isEmSpan(span)).toBe(false);
  });

  it('{ strong: string } is a strong span', () => {
    const span: Span = { strong: 'bold text' };
    expect(isStrongSpan(span)).toBe(true);
    expect(isPlainText(span)).toBe(false);
    expect(isEmSpan(span)).toBe(false);
  });

  it('{ em: string } is an em span', () => {
    const span: Span = { em: 'italic text' };
    expect(isEmSpan(span)).toBe(true);
    expect(isPlainText(span)).toBe(false);
    expect(isStrongSpan(span)).toBe(false);
  });

  it('unknown span kind is not any known type', () => {
    const span = { unknown: 'mystery' } as unknown as Span;
    expect(isPlainText(span)).toBe(false);
    expect(isStrongSpan(span)).toBe(false);
    expect(isEmSpan(span)).toBe(false);
  });
});

describe('Line type', () => {
  it('paragraph line has no bullet flag', () => {
    const line: Line = { text: ['Just a paragraph.'] };
    expect(line.bullet).toBeUndefined();
    expect(line.text).toHaveLength(1);
  });

  it('bullet line has bullet: true', () => {
    const line: Line = {
      bullet: true,
      text: [{ strong: 'Header.' }, ' Followed by text.']
    };
    expect(line.bullet).toBe(true);
    expect(line.text).toHaveLength(2);
  });
});

describe('ItemDetail type', () => {
  it('minimal ItemDetail has source and body', () => {
    const detail: ItemDetail = {
      source: 'srd52',
      body: [{ text: ['Some rules text.'] }]
    };
    expect(detail.source).toBe('srd52');
    expect(detail.body).toHaveLength(1);
  });

  it('full ItemDetail has all optional fields', () => {
    const detail: ItemDetail = {
      source: 'srd51',
      meta: 'Level 1 Enchantment (Bard, Sorcerer, Wizard)',
      fields: [
        { labelKey: 'rules.field.castingTime', value: 'Action' },
        { labelKey: 'rules.field.range', value: '60 feet' }
      ],
      body: [
        { text: ['First paragraph.'] },
        { bullet: true, text: [{ strong: 'At Higher Levels.' }, ' More stuff.'] }
      ]
    };
    expect(detail.source).toBe('srd51');
    expect(detail.meta).toBeDefined();
    expect(detail.fields).toHaveLength(2);
    expect(detail.body).toHaveLength(2);
  });
});

describe('renderSpans', () => {
  it('renders plain text as-is', () => {
    expect(renderSpans(['hello'])).toEqual([{ kind: 'text', value: 'hello' }]);
  });

  it('renders strong spans', () => {
    expect(renderSpans([{ strong: 'bold' }])).toEqual([{ kind: 'strong', value: 'bold' }]);
  });

  it('renders em spans', () => {
    expect(renderSpans([{ em: 'italic' }])).toEqual([{ kind: 'em', value: 'italic' }]);
  });

  it('skips unknown span kinds', () => {
    const spans = [{ unknown: 'mystery' }] as unknown as Span[];
    expect(renderSpans(spans)).toEqual([]);
  });

  it('renders mixed spans in order', () => {
    const spans: Span[] = ['plain', { strong: 'bold' }, { em: 'italic' }, 'end'];
    expect(renderSpans(spans)).toEqual([
      { kind: 'text', value: 'plain' },
      { kind: 'strong', value: 'bold' },
      { kind: 'em', value: 'italic' },
      { kind: 'text', value: 'end' }
    ]);
  });
});
