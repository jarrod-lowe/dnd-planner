import { describe, it, expect } from 'vitest';
import { assertAnnotations } from '../../integration/rules-engine/assert-annotations';
import type { Annotation } from '$lib/rules-engine';

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
    expect(() =>
      assertAnnotations(annotations, { exists: ['rule.demo.absent'] }, 'where')
    ).toThrow();
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

  it('passes when the targets array matches exactly', () => {
    expect(() =>
      assertAnnotations(
        annotations,
        { targets: [{ key: 'rule.demo.valued', targets: ['save.any'] }] },
        'where'
      )
    ).not.toThrow();
  });

  it('fails when a target is missing from the actual array', () => {
    expect(() =>
      assertAnnotations(
        annotations,
        {
          targets: [{ key: 'rule.demo.valued', targets: ['save.any', 'save.any.companion'] }]
        },
        'where'
      )
    ).toThrow();
  });

  it('fails when asserting targets on an annotation that is absent', () => {
    expect(() =>
      assertAnnotations(
        annotations,
        { targets: [{ key: 'rule.demo.absent', targets: ['save.any'] }] },
        'where'
      )
    ).toThrow();
  });
});
