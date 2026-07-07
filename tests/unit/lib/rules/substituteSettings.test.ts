import { describe, it, expect } from 'vitest';
import { substituteTemplate } from '$lib/rules/substituteSettings';

describe('substituteTemplate', () => {
  it('replaces ${value} in string fields', () => {
    const template = {
      id: 'effect-skill-${value}',
      phase: 'early',
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.${value}.proficiency' },
          source: { number: 1 }
        }
      ]
    };

    const result = substituteTemplate(template, 'athletics');

    expect(result.id).toBe('effect-skill-athletics');
    expect(result.activities).toEqual([
      {
        type: 'numberSet',
        target: { fact: 'skill.athletics.proficiency' },
        source: { number: 1 }
      }
    ]);
  });

  it('handles multiple ${value} occurrences in one string', () => {
    const template = {
      id: '${value}-${value}',
      activities: []
    };

    const result = substituteTemplate(template, 'test');

    expect(result.id).toBe('test-test');
  });

  it('substitutes ${value} inside an EffectInstance display block (reveal names)', () => {
    const template = {
      id: 'sentinel-asi-${value}',
      key: 'sentinel-asi-${value}',
      state: { '${value}.value': 1 },
      display: {
        name: 'rules.settings.sentinel-asi.${value}',
        displayFact: '${value}.value',
        hidden: true
      },
      expiry: { kind: 'permanent' }
    };

    const result = substituteTemplate(template, 'str') as typeof template;

    expect(result.display).toEqual({
      name: 'rules.settings.sentinel-asi.str',
      displayFact: 'str.value',
      hidden: true
    });
    expect(result.state).toEqual({ 'str.value': 1 });
  });

  it('leaves non-string values unchanged', () => {
    const template = {
      count: 42,
      enabled: true,
      items: [1, 2, 3],
      nested: { num: 5 }
    };

    const result = substituteTemplate(template, 'anything');

    expect(result.count).toBe(42);
    expect(result.enabled).toBe(true);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.nested).toEqual({ num: 5 });
  });

  it('returns identity when no ${value} present', () => {
    const template = {
      id: 'static-id',
      activities: [{ type: 'numberSet', target: { fact: 'hp.max' }, source: { number: 10 } }]
    };

    const result = substituteTemplate(template, 'unused');

    expect(result).toEqual(template);
  });

  it('handles deeply nested objects', () => {
    const template = {
      a: {
        b: {
          c: 'skill.${value}.deep'
        }
      }
    };

    const result = substituteTemplate(template, 'athletics');

    expect(result.a.b.c).toBe('skill.athletics.deep');
  });

  it('handles null values', () => {
    const template = { value: null, text: '${value}' };

    const result = substituteTemplate(template, 'test');

    expect(result.value).toBeNull();
    expect(result.text).toBe('test');
  });
});
