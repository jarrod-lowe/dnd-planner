import { describe, it, expect } from 'vitest';
import { assertAnnotations } from '../../integration/rules-engine/assert-annotations';
import type { Annotation } from '$lib/rules-view';

const annotations: Annotation[] = [
  {
    key: 'rule.demo.plain',
    targets: ['save.any']
  },
  {
    key: 'rule.demo.valued',
    targets: ['save.any'],
    rider: {
      label: 'rule.demo.valued',
      type: 'modifier',
      value: { kind: 'flat', bonus: 3 },
      appliesTo: 'save'
    }
  }
];

describe('assertAnnotations', () => {
  it('still honours exists / notExists by key', () => {
    expect(() =>
      assertAnnotations(annotations, { exists: ['rule.demo.valued'] }, 'where')
    ).not.toThrow();
    expect(() =>
      assertAnnotations(annotations, { notExists: ['rule.demo.absent'] }, 'where')
    ).not.toThrow();
    expect(() => assertAnnotations(annotations, { exists: ['rule.demo.absent'] }, 'where')).toThrow();
  });

  it('passes when every asserted rider field matches', () => {
    expect(() =>
      assertAnnotations(
        annotations,
        {
          riders: [
            {
              key: 'rule.demo.valued',
              rider: { type: 'modifier', appliesTo: 'save', value: { kind: 'flat', bonus: 3 } }
            }
          ]
        },
        'where'
      )
    ).not.toThrow();
  });

  it('fails when a rider field differs', () => {
    expect(() =>
      assertAnnotations(
        annotations,
        { riders: [{ key: 'rule.demo.valued', rider: { value: { kind: 'flat', bonus: 1 } } }] },
        'where'
      )
    ).toThrow();
  });

  it('fails when the annotation carries no rider at all', () => {
    expect(() =>
      assertAnnotations(
        annotations,
        { riders: [{ key: 'rule.demo.plain', rider: { type: 'modifier' } }] },
        'where'
      )
    ).toThrow();
  });

  it('fails when the annotation is missing entirely', () => {
    expect(() =>
      assertAnnotations(
        annotations,
        { riders: [{ key: 'rule.demo.absent', rider: { type: 'modifier' } }] },
        'where'
      )
    ).toThrow();
  });
});
