import type { RuleModule } from './types';
import { isEngineCompatible } from './version';

/**
 * Lazy per-character module loading — the M2 delivery mechanism.
 *
 * Each entry is a dynamic `import()`, which Vite code-splits into its own chunk
 * shipped to the existing S3/CloudFront (the co-bundled model). A character loads
 * only its assigned groups' chunks, by id, at play time — not the whole rule set.
 *
 * This is the RUNTIME path and is deliberately separate from the static
 * `registry.ts` (which eager-imports everything for the sync parity harness): a
 * `loadModules` caller pulls in only the chunks it asks for. `evaluate` stays
 * sync/pure — resolution happens here, before it.
 */
// Keyed by canonical ruleGroupId (= each module's `id`), matching the registry
// and the backend's persisted/published id namespace.
const LOADERS: Record<string, () => Promise<{ default: RuleModule }>> = {
  'ability-scores': () => import('./rules/ability-scores'),
  proficiency: () => import('./rules/proficiency'),
  ac: () => import('./rules/ac'),
  hp: () => import('./rules/hp'),
  'action-economy': () => import('./rules/action-economy'),
  'free-actions': () => import('./rules/free-actions'),
  'core-events': () => import('./rules/core-events'),
  concentration: () => import('./rules/concentration'),
  'heroic-inspiration': () => import('./rules/heroic-inspiration'),
  attacks: () => import('./rules/attacks'),
  spellcasting: () => import('./rules/spellcasting'),
  'class-paladin-level1': () => import('./rules/class-paladin-level1'),
  'class-paladin-level2': () => import('./rules/class-paladin-level2'),
  'class-paladin-level3': () => import('./rules/class-paladin-level3'),
  'class-paladin-level4': () => import('./rules/class-paladin-level4'),
  'class-paladin-level5': () => import('./rules/class-paladin-level5'),
  'class-paladin-divinity': () => import('./rules/class-paladin-divinity'),
  'class-paladin-oath-redemption-level3': () =>
    import('./rules/class-paladin-oath-redemption-level3'),
  'class-paladin-lay-on-hands': () => import('./rules/lay-on-hands'),
  'class-paladin-paladin-smite': () => import('./rules/paladin-smite'),
  'spell-divine-smite': () => import('./rules/divine-smite'),
  'spell-divine-favour': () => import('./rules/divine-favour'),
  'spell-bless': () => import('./rules/bless'),
  'spell-thunderous-smite': () => import('./rules/thunderous-smite'),
  'spell-create-and-destroy-water': () => import('./rules/create-and-destroy-water'),
  'spell-sanctuary': () => import('./rules/sanctuary'),
  'spell-protection-from-evil-and-good': () => import('./rules/protection-from-evil-and-good'),
  'spell-sleep': () => import('./rules/sleep'),
  'spell-command': () => import('./rules/command'),
  'paladin-spells-l1': () => import('./rules/paladin-spells-l1'),
  'build-lock': () => import('./rules/build-lock'),
  initiative: () => import('./rules/initiative'),
  'passive-skills': () => import('./rules/passive-skills'),
  'simple-actions': () => import('./rules/simple-actions'),
  dash: () => import('./rules/dash'),
  'species-human': () => import('./rules/species-human'),
  movement: () => import('./rules/movement'),
  'leather-armor': () => import('./rules/leather-armor'),
  'splint-armor': () => import('./rules/splint-armor'),
  shield: () => import('./rules/shield'),
  hands: () => import('./rules/hands'),
  dagger: () => import('./rules/dagger'),
  'dagger-mastery': () => import('./rules/dagger-mastery'),
  greataxe: () => import('./rules/greataxe'),
  'greataxe-mastery': () => import('./rules/greataxe-mastery')
};

export interface LoadResult {
  /** Loaded modules, in the requested id order. */
  modules: RuleModule[];
  /** Ids with no chunk (unknown / not yet ported). */
  missing: string[];
  /** Ids whose metadata reported an incompatible engineApiVersion (skew). */
  incompatible: string[];
}

/**
 * Lazily load the chunks for the given rule-group ids, in order. Pass
 * `builtForVersion` (from the search metadata) to gate on engine compatibility
 * before a chunk is fetched; ids with no entry are assumed current.
 */
export async function loadModules(
  ids: string[],
  builtForVersion: Record<string, number> = {}
): Promise<LoadResult> {
  const loaded = await Promise.all(
    ids.map(async (id) => {
      const v = builtForVersion[id];
      if (v !== undefined && !isEngineCompatible(v)) return { id, status: 'incompatible' as const };
      const loader = LOADERS[id];
      if (!loader) return { id, status: 'missing' as const };
      const chunk = await loader();
      return { id, status: 'ok' as const, module: chunk.default };
    })
  );

  const modules: RuleModule[] = [];
  const missing: string[] = [];
  const incompatible: string[] = [];
  for (const r of loaded) {
    if (r.status === 'ok') modules.push(r.module);
    else if (r.status === 'missing') missing.push(r.id);
    else incompatible.push(r.id);
  }
  return { modules, missing, incompatible };
}

/** The rule-group ids with a lazy chunk (kept in sync with the registry by test). */
export function lazyRuleGroupIds(): string[] {
  return Object.keys(LOADERS);
}
