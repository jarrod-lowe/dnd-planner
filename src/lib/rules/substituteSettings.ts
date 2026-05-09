const PLACEHOLDER = /\$\{value\}/g;

export function substituteTemplate(
  template: Record<string, unknown>,
  value: string
): Record<string, unknown> {
  return walk(template, value) as Record<string, unknown>;
}

function walk(obj: unknown, value: string): unknown {
  if (typeof obj === 'string') {
    return obj.replace(PLACEHOLDER, value);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => walk(item, value));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = walk(val, value);
    }
    return result;
  }
  return obj;
}
