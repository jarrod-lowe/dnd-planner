export type Span = string | { strong: string } | { em: string };

export interface Line {
  bullet?: boolean;
  text: Span[];
}

export interface ItemDetail {
  source: 'srd52' | 'srd51' | 'custom';
  meta?: string;
  fields?: { labelKey: string; value: string }[];
  body: Line[];
}

export function isPlainText(span: Span): span is string {
  return typeof span === 'string';
}

export function isStrongSpan(span: Span): span is { strong: string } {
  return typeof span === 'object' && 'strong' in span;
}

export function isEmSpan(span: Span): span is { em: string } {
  return typeof span === 'object' && 'em' in span;
}

export interface RenderedSpan {
  kind: 'text' | 'strong' | 'em';
  value: string;
}

export function renderSpans(spans: Span[]): RenderedSpan[] {
  const result: RenderedSpan[] = [];
  for (const span of spans) {
    if (isPlainText(span)) {
      result.push({ kind: 'text', value: span });
    } else if (isStrongSpan(span)) {
      result.push({ kind: 'strong', value: span.strong });
    } else if (isEmSpan(span)) {
      result.push({ kind: 'em', value: span.em });
    }
    // unknown span kinds: ignored
  }
  return result;
}
