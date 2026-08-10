import type { Annotation, Facts, RuleModule } from './types';
import { plainReader } from './reader';

/**
 * The annotate pass: evaluate every module's `annotate` against the final
 * post-plan facts and concatenate the results in module order.
 *
 * Each annotation carries `targets` the UI matches against panel
 * `annotationLabels` (via getMatchingAnnotations) — an unchanged view-contract convention. Pure:
 * same (modules, facts) → same annotations.
 */
export function collectAnnotations(modules: RuleModule[], facts: Facts): Annotation[] {
  const reader = plainReader(facts);
  const annotations: Annotation[] = [];
  for (const m of modules) {
    if (!m.annotate) continue;
    annotations.push(...m.annotate(reader));
  }
  return annotations;
}
