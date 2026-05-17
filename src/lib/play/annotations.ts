import type { Annotation, AnnotationRider } from '$lib/rules-engine';

export interface ActiveAnnotation {
  key: string;
  rider?: AnnotationRider;
}

export function getAnnotationLabels(ui: Record<string, unknown> | undefined): string[] {
  const labels = ui?.annotationLabels;
  if (!Array.isArray(labels)) return [];
  return labels.filter((l): l is string => typeof l === 'string');
}

export function getMatchingAnnotations(
  annotationLabels: string[] | undefined,
  activeAnnotations: Annotation[]
): ActiveAnnotation[] {
  if (!annotationLabels || annotationLabels.length === 0) return [];
  const labels = new Set(annotationLabels);
  const result: ActiveAnnotation[] = [];
  for (const annotation of activeAnnotations) {
    if (annotation.targets.some((t) => labels.has(t))) {
      result.push({ key: annotation.key, rider: annotation.rider });
    }
  }
  return result;
}
