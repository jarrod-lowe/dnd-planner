import type { Contribution, Facts, FactReader, RuleModule, SheetCtx } from './types';

interface TaggedContribution extends Contribution {
  moduleId: string;
}

/**
 * Evaluate the dataflow "sheet": derive all character-state facts from the
 * modules' `derive` contributions.
 *
 * Ordering is NOT authored. Each contribution's `value` is run once against a
 * recording reader to discover which facts it reads; the engine topologically
 * sorts facts by those reads and evaluates them in dependency order. A fact with
 * multiple contributors is fully settled (all contributors combined) before any
 * dependent reads it — so "copy-after-settle" needs no `group`/`after` dance.
 *
 * Pure: same (modules, inputFacts) → same result.
 *
 * @param modules     Rule modules to evaluate (registration order is irrelevant).
 * @param inputFacts  Pre-settled facts with no contributor (e.g. player-set
 *                    ability scores). Treated as immutable sources.
 * @returns The derived fact store.
 * @throws If the dependency graph contains a cycle.
 */
export function evaluateSheet(modules: RuleModule[], inputFacts: Facts = {}): Facts {
  const ctx: SheetCtx = { selections: {} };

  // 1. Collect contributions, grouped by target fact.
  const byFact = new Map<string, TaggedContribution[]>();
  for (const m of modules) {
    if (!m.derive) continue;
    for (const c of m.derive(ctx)) {
      const arr = byFact.get(c.fact) ?? [];
      arr.push({ ...c, moduleId: m.id });
      byFact.set(c.fact, arr);
    }
  }
  const contributedFacts = new Set(byFact.keys());

  // 2. Discover read-dependencies per fact via a probe run. Reads of facts that
  //    nobody contributes (pure inputs / absent) are settled sources, not edges.
  const deps = new Map<string, Set<string>>();
  for (const [fact, contribs] of byFact) {
    const reads = new Set<string>();
    const probe: FactReader = {
      num: (name) => {
        reads.add(name);
        return 0;
      }
    };
    for (const c of contribs) c.value(probe);
    const edges = new Set<string>();
    for (const r of reads) {
      if (r !== fact && contributedFacts.has(r)) edges.add(r);
    }
    deps.set(fact, edges);
  }

  // 3. Topological sort (DFS) with cycle detection.
  const order: string[] = [];
  const mark = new Map<string, 'visiting' | 'done'>();
  const visit = (fact: string, path: string[]): void => {
    const m = mark.get(fact);
    if (m === 'done') return;
    if (m === 'visiting') {
      throw new Error(`Dependency cycle detected: ${[...path, fact].join(' -> ')}`);
    }
    mark.set(fact, 'visiting');
    for (const dep of deps.get(fact) ?? []) visit(dep, [...path, fact]);
    mark.set(fact, 'done');
    order.push(fact);
  };
  for (const fact of byFact.keys()) visit(fact, []);

  // 4. Evaluate in dependency order, combining multiple contributors per fact.
  const facts: Facts = { ...inputFacts };
  const reader: FactReader = { num: (name) => facts[name] ?? 0 };
  for (const fact of order) {
    const contribs = byFact.get(fact)!;
    const mode = contribs[0].combine ?? 'override';
    let result: number;
    if (mode === 'sum') {
      result = 0;
      for (const c of contribs) result += c.value(reader);
    } else if (mode === 'max') {
      result = Number.NEGATIVE_INFINITY;
      for (const c of contribs) result = Math.max(result, c.value(reader));
    } else {
      // override: the last registered writer wins
      result = contribs[contribs.length - 1].value(reader);
    }
    facts[fact] = result;
  }
  return facts;
}
