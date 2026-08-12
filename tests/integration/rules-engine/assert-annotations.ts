import { expect } from 'vitest';
import type { Annotation } from '$lib/rules-engine';

/**
 * Annotation assertions for the YAML scenario runner. `exists` / `notExists`
 * match by key; `riders` asserts named fields of a matched annotation's rider
 * field-by-field (the same shape as the runner's offerVars / offerUi asserts),
 * so a scenario can pin what a modifier is WORTH and not merely that it arrived.
 */
export interface AnnotationAssert {
  exists?: string[];
  notExists?: string[];
  riders?: { key: string; rider: Record<string, unknown> }[];
}

export function assertAnnotations(
  actual: Annotation[],
  expected: AnnotationAssert,
  where: string
): void {
  for (const key of expected.exists ?? [])
    expect(
      actual.some((a) => a.key === key),
      `${where}: annotation "${key}" exists`
    ).toBe(true);
  for (const key of expected.notExists ?? [])
    expect(
      actual.some((a) => a.key === key),
      `${where}: annotation "${key}" absent`
    ).toBe(false);
  for (const { key, rider } of expected.riders ?? []) {
    const found = actual.find((a) => a.key === key);
    expect(found, `${where}: annotation "${key}" exists`).toBeDefined();
    expect(found!.rider, `${where}: annotation "${key}" carries a rider`).toBeDefined();
    const actualRider = found!.rider as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(rider))
      expect(actualRider[field], `${where}: annotation "${key}".rider.${field}`).toEqual(value);
  }
}
