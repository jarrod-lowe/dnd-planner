import type { Annotation, EffectInstance, Facts, RuleModule } from './types';
import { plainReader } from './reader';

/**
 * The annotate pass: evaluate every module's `annotate` against the final
 * post-plan facts and the effects in force, concatenating the results in module
 * order.
 *
 * Each annotation carries `targets` the UI matches against panel
 * `annotationLabels` (via getMatchingAnnotations) — an unchanged view-contract convention. Pure:
 * same (modules, facts, committed) → same annotations.
 *
 * `committed` is every effect in force (input committed plus this turn's
 * advertised, key-deduped newest-wins); `persisted` is the input committed
 * effects alone, so a rule can tell a planned transition from a committed one
 * (see the RuleModule.annotate docs).
 */
export function collectAnnotations(
  modules: RuleModule[],
  facts: Facts,
  committed: EffectInstance[],
  persisted: EffectInstance[] = []
): Annotation[] {
  const reader = plainReader(facts);
  const annotations: Annotation[] = [];
  for (const m of modules) {
    if (!m.annotate) continue;
    annotations.push(...m.annotate(reader, committed, persisted));
  }
  return annotations;
}
