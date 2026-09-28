import type {
  Annotation,
  AnnotationAction,
  AnnotationRider,
  AnnotationToggle
} from '$lib/rules-view';

export interface ActiveAnnotation {
  key: string;
  /** Interpolation params for the label — `$t(key, values)`. Absent → plain. */
  values?: Record<string, string | number>;
  rider?: AnnotationRider;
  /** The persistent committed-state toggle a governed dice-line renders. */
  toggle?: AnnotationToggle;
  /** What to plan when the annotation is tapped; absent → not actionable. */
  addsToPlan?: AnnotationAction;
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
      result.push({
        key: annotation.key,
        values: annotation.values,
        rider: annotation.rider,
        toggle: annotation.toggle,
        addsToPlan: annotation.addsToPlan
      });
    }
  }
  return result;
}
