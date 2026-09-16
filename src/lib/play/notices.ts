import { NOTICE_TARGET, type Annotation } from '$lib/rules-engine';

/**
 * The annotations the notices strip renders: every annotation whose `targets`
 * include the reserved {@link NOTICE_TARGET} label. No panel declares that
 * label in its `ui.annotationLabels`, so these are exactly the annotations
 * `getMatchingAnnotations` never claims — passive reminders that follow no
 * taken choice. Engine (input) order is preserved as-is; the UI never re-sorts.
 */
export function getNotices(annotations: Annotation[]): Annotation[] {
  return annotations.filter((annotation) => annotation.targets.includes(NOTICE_TARGET));
}
