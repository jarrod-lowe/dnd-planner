import { describe, it, expect } from 'vitest';
import { getAnnotationLabels, getMatchingAnnotations } from '$lib/play/annotations';
import type { Annotation } from '$lib/rules-engine';

describe('getAnnotationLabels', () => {
  it('returns empty array when ui is undefined', () => {
    expect(getAnnotationLabels(undefined)).toEqual([]);
  });

  it('returns empty array when annotationLabels is missing', () => {
    expect(getAnnotationLabels({})).toEqual([]);
  });

  it('returns labels from ui', () => {
    expect(getAnnotationLabels({ annotationLabels: ['attack.melee', 'attack.unarmed'] })).toEqual([
      'attack.melee',
      'attack.unarmed'
    ]);
  });

  it('filters non-string entries', () => {
    expect(getAnnotationLabels({ annotationLabels: ['attack.melee', 42, true] })).toEqual([
      'attack.melee'
    ]);
  });
});

describe('getMatchingAnnotations', () => {
  it('returns empty array when labels is undefined', () => {
    const active: Annotation[] = [{ key: 'smite.annotation', targets: ['attack.melee'] }];
    expect(getMatchingAnnotations(undefined, active)).toEqual([]);
  });

  it('returns empty array when labels is empty', () => {
    const active: Annotation[] = [{ key: 'smite.annotation', targets: ['attack.melee'] }];
    expect(getMatchingAnnotations([], active)).toEqual([]);
  });

  it('returns empty array when no annotations match', () => {
    const active: Annotation[] = [{ key: 'smite.annotation', targets: ['attack.melee'] }];
    expect(getMatchingAnnotations(['attack.ranged'], active)).toEqual([]);
  });

  it('returns matching annotation when one target overlaps', () => {
    const active: Annotation[] = [
      { key: 'smite.annotation', targets: ['attack.melee', 'attack.unarmed'] }
    ];
    const result = getMatchingAnnotations(['attack.any', 'attack.melee', 'attack.weapon'], active);
    expect(result).toEqual([{ key: 'smite.annotation' }]);
  });

  it('returns multiple matching annotations', () => {
    const active: Annotation[] = [
      { key: 'divine.annotation', targets: ['attack.melee'] },
      { key: 'thunderous.annotation', targets: ['attack.unarmed'] }
    ];
    const result = getMatchingAnnotations(['attack.any', 'attack.melee', 'attack.unarmed'], active);
    expect(result).toEqual([{ key: 'divine.annotation' }, { key: 'thunderous.annotation' }]);
  });

  it('returns empty when active annotations is empty', () => {
    expect(getMatchingAnnotations(['attack.melee'], [])).toEqual([]);
  });

  it('matches annotation that targets attack.any', () => {
    const active: Annotation[] = [{ key: 'bonus.annotation', targets: ['attack.any'] }];
    expect(getMatchingAnnotations(['attack.any', 'attack.melee'], active)).toEqual([
      { key: 'bonus.annotation' }
    ]);
  });
});
