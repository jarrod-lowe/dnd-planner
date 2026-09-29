import type {
  Annotation,
  AnnotationAction,
  AnnotationRider,
  AnnotationToggle,
  Facts
} from '$lib/rules-view';

export interface ActiveAnnotation {
  key: string;
  /** Interpolation params for the label — `$t(key, values)`. Absent → plain. */
  values?: Record<string, string | number>;
  rider?: AnnotationRider;
  /** State-toggle chip data; absent → no pressed/unpressed chip. */
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

/**
 * Captures the per-row state of every toggle annotation reaching a rule being
 * added to the plan (Frightened's line of sight): the row takes the fact's
 * CURRENT value — the going-forward seed — as its own selection, so later seed
 * changes never move a row already in the plan. The capture-var idiom
 * (resolveInitialSelections), generalized to the annotation channel: the
 * toggle's `fact` doubles as the row's selection var.
 */
export function captureToggleSelections(
  annotationLabels: string[],
  facts: Facts,
  activeAnnotations: Annotation[]
): Record<string, number> {
  if (annotationLabels.length === 0) return {};
  const labels = new Set(annotationLabels);
  const selections: Record<string, number> = {};
  for (const annotation of activeAnnotations) {
    const toggle = annotation.toggle;
    if (!toggle) continue;
    if (!annotation.targets.some((t) => labels.has(t))) continue;
    const value = facts[toggle.fact];
    selections[toggle.fact] = typeof value === 'number' ? value : 0;
  }
  return selections;
}
