import type {
  Contribution,
  EffectInstance,
  Facts,
  FactReader,
  RuleModule,
  SheetCtx
} from './types';
import { dedupeByKey, endsOnRest, restFlagsFrom } from './effects';

interface TaggedContribution extends Contribution {
  moduleId: string;
}

/**
 * Evaluate the dataflow "sheet": derive all character-state facts from the
 * modules' `derive` contributions.
 *
 * Ordering is NOT authored. Evaluation is **pull-based**: a fact is settled the
 * first time it is read. Each contribution's `value` runs against a reader whose
 * `num(name)` settles `name` on demand before returning it. Because reads happen
 * during real evaluation (with real values), dependencies hidden behind
 * input-driven branches are followed correctly — there is no separate
 * zero-valued probe pass to miss them. A fact with multiple contributors is
 * fully combined before any dependent observes it, so "copy-after-settle" needs
 * no `group`/`after` dance.
 *
 * Pure: same (modules, inputFacts) → same result, independent of registration
 * order.
 *
 * @param modules     Rule modules to evaluate (registration order is irrelevant).
 * @param inputFacts  Pre-settled facts with no contributor (e.g. player-set
 *                    ability scores). Treated as immutable sources.
 * @returns The derived fact store.
 * @throws On a dependency cycle, duplicate `override` writers, or conflicting
 *         combine modes for a single fact.
 */
export function evaluateSheet(
  modules: RuleModule[],
  inputFacts: Facts = {},
  effects: EffectInstance[] = []
): Facts {
  const ctx: SheetCtx = { selections: {} };

  // Collect contributions, grouped by target fact.
  const byFact = new Map<string, TaggedContribution[]>();
  const add = (c: Contribution, moduleId: string): void => {
    const arr = byFact.get(c.fact) ?? [];
    arr.push({ ...c, moduleId });
    byFact.set(c.fact, arr);
  };
  for (const m of modules) {
    if (!m.derive) continue;
    for (const c of m.derive(ctx)) add(c, m.id);
  }

  // Active effects contribute to the sheet too (e.g. a spent slot adds to
  // `...spent`). They are plain values, not self-replicating rules. Replacement
  // effects sharing a `key` are first collapsed (newest wins) so they don't
  // stack. By default `state` is read as fact deltas (summed); a per-fact
  // `stateCombine` may pick `max`/`override`, and an owning module may override
  // with `effectContributions` for parameterized effects.
  if (effects.length > 0) {
    const deduped = dedupeByKey(effects);
    // A rest recorded this evaluation (a rest.long / rest.short fact, from an
    // input or a recorder effect) restores its scoped effects immediately: they
    // do not contribute this turn (and endTurn then drops them, so they don't
    // return next turn). Matches v1's in-evaluation rest.
    const flags = restFlagsFrom(deduped);
    const restLong = flags.long || (inputFacts['rest.long'] ?? 0) > 0;
    const restShort = flags.short || (inputFacts['rest.short'] ?? 0) > 0;
    const byId = new Map(modules.map((m) => [m.id, m]));
    for (const effect of deduped) {
      if (endsOnRest(effect.expiry, restLong, restShort)) continue;
      const mod = effect.ruleId ? byId.get(effect.ruleId) : undefined;
      if (mod?.effectContributions) {
        for (const c of mod.effectContributions(effect)) add(c, `${mod.id}#${effect.id}`);
      } else if (effect.state) {
        for (const [fact, amount] of Object.entries(effect.state)) {
          add(
            { fact, combine: effect.stateCombine?.[fact] ?? 'sum', value: () => amount },
            `effect#${effect.id}`
          );
        }
      }
    }
  }

  // Inputs are pre-settled sources with no contributor (see the doc above). If a
  // module or effect also wrote an input fact, settle() would silently replace
  // the input with the combined contributions — fail loudly instead. (The store
  // catches and banners engine throws, so a bad module degrades, not blanks.)
  for (const fact of Object.keys(inputFacts)) {
    const contribs = byFact.get(fact);
    if (contribs) {
      const writers = [...new Set(contribs.map((c) => c.moduleId))].join(', ');
      throw new Error(
        `Sheet input fact "${fact}" is also written by contributions (${writers}); ` +
          `inputs are immutable sources — contribute the base value from a module or effect instead`
      );
    }
  }

  const contributedFacts = new Set(byFact.keys());

  const facts: Facts = { ...inputFacts };
  const settled = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  // Reading a contributed-but-unsettled fact settles it first (depth-first).
  const ensureSettled = (name: string): void => {
    if (contributedFacts.has(name) && !settled.has(name)) settle(name);
  };
  const reader: FactReader = {
    num: (name) => {
      ensureSettled(name);
      return facts[name] ?? 0;
    },
    has: (name) => {
      ensureSettled(name);
      return Object.prototype.hasOwnProperty.call(facts, name);
    }
  };

  function settle(fact: string): void {
    if (settled.has(fact)) return;
    if (visiting.has(fact)) {
      throw new Error(`Dependency cycle detected: ${[...path, fact].join(' -> ')}`);
    }
    visiting.add(fact);
    path.push(fact);

    facts[fact] = combine(fact, byFact.get(fact)!);

    path.pop();
    visiting.delete(fact);
    settled.add(fact);
  }

  function combine(fact: string, contribs: TaggedContribution[]): number {
    if (contribs.length === 1) {
      // Single writer: any mode (including the default `override`) is fine.
      return contribs[0].value(reader);
    }

    // Multiple writers must agree on a single accumulating mode. `override`
    // means "one authoritative writer", so duplicates are rejected rather than
    // resolved by registration order (which would break order-independence).
    const modes = new Set(contribs.map((c) => c.combine ?? 'override'));
    const writers = contribs.map((c) => c.moduleId).join(', ');
    if (modes.has('override')) {
      throw new Error(
        `Multiple override writers for fact "${fact}" (writers: ${writers}); ` +
          `'override' requires a single authoritative writer`
      );
    }
    if (modes.size > 1) {
      throw new Error(
        `Conflicting combine mode for fact "${fact}": ${[...modes].join(', ')} (writers: ${writers})`
      );
    }

    const mode = [...modes][0];
    if (mode === 'sum') {
      let sum = 0;
      for (const c of contribs) sum += c.value(reader);
      return sum;
    }
    // 'max'
    let max = Number.NEGATIVE_INFINITY;
    for (const c of contribs) max = Math.max(max, c.value(reader));
    return max;
  }

  for (const fact of contributedFacts) settle(fact);
  return facts;
}
