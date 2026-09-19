import { apiGet, apiPost, apiDelete } from '$lib/api/client';
import type { Rule, AvailableRuleEntry, AnnotationSeedSource } from '$lib/rules-view';
import {
  loadModules,
  endTurn as ageCommittedEffects,
  type EffectInstance,
  type PlannedRef
} from '$lib/rules-engine';
import type { PlannedItem, PlayState } from './types';
import { resolveInitialSelections } from './resolveInitialSelections';
import { evaluateCharacter, hypotheticalOffers } from './evaluateCharacter';
import {
  effectInstanceToRule,
  adaptEngineOutput,
  offersToViewEntries,
  plannedEntryToViewEntry
} from './engineBridge';
import { deriveVerbFromRule } from './stepUtils';
import { locale, t } from '$lib/i18n';
import { prefetchDetailsForEffects } from '$lib/details/rehydrate';
import { get } from 'svelte/store';
import { getCache, ensureCached } from '$lib/rules/ruleGroupCache.svelte';
import { resolveDependencies } from '$lib/rules/resolveDependencies';
import { toast } from 'svelte-sonner';
import type { SettingDefinition } from '$lib/rules/settingsTypes';
import { resolveSettings } from '$lib/rules/resolveSettings';
import { evaluateRuleGroupConditions } from '$lib/rules/evaluateCondition';

const DEBOUNCE_MS = 300;
const BATCH_SIZE = 100;

const initialState: PlayState = {
  modules: [],
  ruleGroupIds: [],
  isLoadingRuleGroups: false,
  ruleGroupError: null,
  engineOutput: null,
  isEvaluating: false,
  plannedItems: [],
  facts: {},
  effects: [],
  committed: [],
  advertised: [],
  currentCharacterId: null,
  topBarEntries: [],
  resourceEntries: []
};

// Reactive state
let state = $state<PlayState>({ ...initialState });

function generateInstanceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Module-level, plain Map (not $state). Replaced entirely each performEvaluation().
let _hypotheticalEntriesMap = new Map<string, AvailableRuleEntry[]>();
// Per-instance planned entries (legality from the engine's planDiagnostics),
// keyed by instanceId. The plan rows read these; `availableRules` stays the
// addable offer catalog only. Replaced each performEvaluation().
let _plannedEntriesMap = new Map<string, AvailableRuleEntry>();
// The effects advertised by the last evaluation — aged into `committed` at End Turn.
let _lastAdvertised: EffectInstance[] = [];

/**
 * The plan as `PlannedRef`s. `addToPlan` rewrites each item's `rule.id` to its
 * instanceId (instances evaluate separately), keeping the real rule id in
 * `originalRuleId` — so the ref's `ruleId` is `originalRuleId ?? rule.id`.
 */
function buildPlannedRefs(): PlannedRef[] {
  return state.plannedItems.map((item) => ({
    instanceId: item.instanceId,
    ruleId: item.originalRuleId ?? item.rule.id,
    selections: item.rule.selections as Record<string, unknown> | undefined
  }));
}

/**
 * Parse a persisted `/effects` blob. Characters are current-format (there is no
 * migration of legacy characters — those are deleted and recreated), so the blob
 * is always a stored `EffectInstance[]`; this just parses it defensively.
 */
function parsePersistedEffects(json: string): EffectInstance[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    // A EffectInstance always carries `expiry`. Any entry without it is a legacy
    // (legacy-shape) effect from a character not yet recreated — drop it rather
    // than crash the play view. Not a migration: the effect is discarded, and that
    // character starts from a clean effect state (its build is re-made via settings).
    return parsed.filter((e): e is EffectInstance => !!e && typeof e === 'object' && 'expiry' in e);
  } catch {
    return [];
  }
}

/**
 * Dismiss, once at load, committed concentration effects that were persisted
 * WITHOUT a `key` — the shape every concentration spell's hold had before the
 * shared CONCENTRATION_SPELL_KEY landed. The SRD 5.2 recast ruling ("Another
 * Concentration Effect": you lose Concentration the moment you start casting a
 * second Concentration spell) leans on that key — newest replaces oldest — so a
 * keyless legacy hold would STACK with a fresh cast (`concentration.spent` =
 * 2). Not a key-normalization migration: single-user app, and
 * `parsePersistedEffects` above documents the no-migration policy, so the
 * legacy hold is simply dropped and the player re-concentrates by casting
 * (PR #425 review thread 4051725201). KEYED concentration effects — every cast
 * since the key landed, including character imports that funnel through this
 * same load — and keyless non-concentration effects pass through untouched.
 * Idempotent: with no keyless holds left in the blob it is the identity.
 */
function dismissLegacyKeylessConcentration(effects: EffectInstance[]): EffectInstance[] {
  const holdsConcentration = (e: EffectInstance): boolean =>
    e.state !== undefined && 'concentration.spent' in e.state;
  return effects.filter((e) => e.key !== undefined || !holdsConcentration(e));
}

function performEvaluation(): void {
  // A direct evaluation supersedes any still-scheduled one.
  cancelScheduledEvaluation();
  state = { ...state, isEvaluating: true };

  const refs = buildPlannedRefs();
  let result: ReturnType<typeof evaluateCharacter>;
  try {
    result = evaluateCharacter(state.modules, state.committed, refs);
  } catch (error) {
    // An engine throw (duplicate offer id, dependency cycle, watchdog timeout)
    // must degrade to an error banner, not a dead play view. Keep the previous
    // output (stale but usable) and surface the error via diagnostics.errors —
    // PlayCharacterMode renders the first error code as the engine-error banner.
    console.error('[performEvaluation] Engine error:', error);
    const code =
      error instanceof Error && /cycle/i.test(error.message)
        ? 'play.error.engineCycle'
        : 'play.error.evaluate';
    const prev = state.engineOutput ?? {
      status: { ok: false, legal: true, applicable: true },
      facts: {},
      collections: {},
      availableRules: [],
      annotations: [],
      diagnostics: { errors: [], warnings: [], notices: [] },
      trace: {
        appliedRuleIds: [],
        appliedActivityIds: [],
        providedCapabilities: [],
        emittedEvents: []
      },
      effects: [],
      next: {
        schemaVersion: 1 as const,
        rules: { standing: [], planned: [], effects: [] },
        state: { facts: {} }
      }
    };
    // The failed evaluation produced nothing: the per-evaluation caches still
    // describe the LAST SUCCESSFUL plan, not the visible one. Clear them so
    // End Turn cannot merge the previous plan's advertised effects into the
    // committed set, and plan rows / alternatives fall back rather than show
    // the old evaluation's legality.
    _lastAdvertised = [];
    _plannedEntriesMap = new Map();
    _hypotheticalEntriesMap = new Map();
    state = {
      ...state,
      isEvaluating: false,
      // Same reason as `_lastAdvertised` above: the failed evaluation advertised
      // nothing, so the previous plan's slot spends must not keep showing.
      advertised: [],
      engineOutput: {
        ...prev,
        // The failed evaluation advertised nothing, so the previous plan's
        // effects must not linger: the strip merges engineOutput.effects into
        // its chips, and End Turn will never commit them (caches cleared above).
        effects: [],
        diagnostics: { ...prev.diagnostics, errors: [{ code, severity: 'error' }] }
      }
    };
    return;
  }

  // Pre-compute hypothetical evaluations for each planned item (the alternatives
  // picker). Creates a brand-new Map each time — old map is GC'd, no stale entries.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- intentionally non-reactive; replaced each evaluation
  const newMap = new Map<string, AvailableRuleEntry[]>();
  for (const [id, entries] of hypotheticalOffers(state.modules, state.committed, refs)) {
    newMap.set(id, offersToViewEntries(entries));
  }
  _hypotheticalEntriesMap = newMap;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- intentionally non-reactive; replaced each evaluation
  const plannedMap = new Map<string, AvailableRuleEntry>();
  for (const pe of result.plannedEntries) {
    plannedMap.set(pe.instanceId, plannedEntryToViewEntry(pe));
  }
  _plannedEntriesMap = plannedMap;
  _lastAdvertised = result.advertised;

  const viewOutput = adaptEngineOutput(result.raw);
  state = {
    ...state,
    engineOutput: viewOutput,
    isEvaluating: false,
    // The RAW advertised instances. `viewOutput.effects` is the same list bridged
    // to the display `Rule` shape, which drops `state` — consumers that read
    // effect state (the ledger's slot cell) need these. Reactive because it lives
    // here: `_lastAdvertised` is a plain module variable and would not re-render.
    advertised: result.advertised,
    // The VIEW facts, not the raw engine facts: the panels read state.facts,
    // and the bridge synthesizes view-only facts on top of the engine's (the
    // spellcasting.saveAbility label) that would otherwise never reach them.
    facts: viewOutput.facts,
    topBarEntries: result.topBarEntries,
    resourceEntries: result.resourceEntries
  };
}

function getAlternativeEntries(instanceId: string): AvailableRuleEntry[] {
  return _hypotheticalEntriesMap.get(instanceId) ?? [];
}

/**
 * The per-instance entry for a planned row: the offer's rule with THIS
 * instance's legality/diagnostics (from the engine's planDiagnostics).
 * Undefined when the offer's structural gate closed (stale row) or before the
 * first evaluation.
 */
function getPlannedEntry(instanceId: string): AvailableRuleEntry | undefined {
  return _plannedEntriesMap.get(instanceId);
}

// Scheduled (debounced) evaluation for plan changes. Not the plain `debounce`
// helper: End Turn commits what the LAST evaluation advertised, so a pending
// evaluation must be flushable synchronously before the commit reads it.
let _evaluationTimer: ReturnType<typeof setTimeout> | null = null;

function cancelScheduledEvaluation(): void {
  if (_evaluationTimer) {
    clearTimeout(_evaluationTimer);
    _evaluationTimer = null;
  }
}

function scheduleEvaluation(): void {
  cancelScheduledEvaluation();
  _evaluationTimer = setTimeout(() => {
    _evaluationTimer = null;
    performEvaluation();
  }, DEBOUNCE_MS);
}

/**
 * Run a still-scheduled evaluation now, if any. Commit paths (End Turn) read
 * the advertised effects of the last evaluation — without this flush, a plan
 * edit inside the debounce window would be committed from its PREVIOUS
 * advertisement (or not at all).
 */
function flushPendingEvaluation(): void {
  if (_evaluationTimer) {
    performEvaluation();
  }
}

async function loadRuleGroups(characterId: string): Promise<void> {
  state = { ...state, isLoadingRuleGroups: true, ruleGroupError: null };

  try {
    // Get current locale for translations
    const currentLocale = get(locale);

    // Step 1: Get rule group IDs
    const idsResponse = await apiGet(`/api/characters/${characterId}/rule-groups`);

    if (!idsResponse.ok) {
      throw new Error(`Failed to fetch rule groups: ${idsResponse.status}`);
    }

    const { ruleGroups: groupIds } = await idsResponse.json();

    // Step 2: Batch fetch rule groups (max 100 per request)
    for (let i = 0; i < groupIds.length; i += BATCH_SIZE) {
      const batch = groupIds.slice(i, i + BATCH_SIZE);
      const batchResponse = await apiPost(`/api/rule-groups/batch?lang=${currentLocale}`, {
        ids: batch
      });

      if (!batchResponse.ok) {
        throw new Error(`Failed to fetch rule group batch: ${batchResponse.status}`);
      }

      // Only rule-group metadata (name/requires/settings/condition) is consumed;
      // evaluates code modules, so the batch's rule JSON is intentionally ignored.
      const { ruleGroups: batchGroups } = await batchResponse.json();
      const batchCache = getCache();
      for (const rg of batchGroups) {
        if (rg.ruleGroupId && !batchCache.has(rg.ruleGroupId)) {
          batchCache.set(rg.ruleGroupId, {
            name: rg.name ?? '',
            description: rg.description ?? '',
            requires: rg.requires ?? [],
            settings:
              typeof rg.settings === 'string' && rg.settings
                ? JSON.parse(rg.settings)
                : Array.isArray(rg.settings)
                  ? rg.settings
                  : [],
            condition:
              typeof rg.condition === 'string' && rg.condition
                ? JSON.parse(rg.condition)
                : Array.isArray(rg.condition)
                  ? rg.condition
                  : undefined
          });
        }
      }
    }

    // Self-heal missing requires dependencies
    const cache = getCache();
    for (const gid of groupIds) {
      await prefetchDepTree(gid, groupIds);
    }
    const missingDeps: string[] = [];
    const accumulated: string[] = [...groupIds];
    for (const gid of groupIds) {
      const deps = resolveDependencies(gid, cache, [...accumulated]);
      for (const dep of deps) {
        if (!accumulated.includes(dep)) {
          missingDeps.push(dep);
          accumulated.push(dep);
        }
      }
    }
    for (const depId of missingDeps) {
      try {
        const resp = await apiPost(`/api/characters/${characterId}/rule-groups`, {
          ruleGroupId: depId
        });
        if (resp.ok) {
          groupIds.push(depId);
        }
      } catch {
        // best-effort: skip failed dep assignments
      }
    }

    // Load the rule modules for the assigned groups (the engine evaluates these).
    // Unknown ids (with no module) are skipped.
    const { modules } = await loadModules(groupIds);

    state = {
      ...state,
      modules,
      ruleGroupIds: groupIds,
      isLoadingRuleGroups: false,
      currentCharacterId: characterId
    };

    // Load persisted effects (graceful fallback on failure). The stored blob is a
    // `EffectInstance[]`; `state.effects` is the view-shaped display bridge the
    // active-effects UI reads.
    try {
      const effectsResponse = await apiGet(`/api/characters/${characterId}/effects`);
      if (effectsResponse?.ok) {
        const { effects: effectsJson } = await effectsResponse.json();
        if (effectsJson) {
          const committed = dismissLegacyKeylessConcentration(parsePersistedEffects(effectsJson));
          const effects = committed.map(effectInstanceToRule);
          state = { ...state, committed, effects };
          prefetchDetailsForEffects(effects);
        }
      } else {
        toast.error(get(t)('play.error.loadEffects'));
      }
    } catch {
      toast.error(get(t)('play.error.loadEffects'));
    }

    // Initial evaluation
    performEvaluation();
  } catch (error) {
    console.error('[loadRuleGroups] Error:', error);
    state = {
      ...state,
      isLoadingRuleGroups: false,
      ruleGroupError: error instanceof Error ? error.message : 'Failed to load rule groups'
    };
  }
}

function addToPlan(rule: Rule, seed?: Record<string, unknown>): void {
  const instanceId = generateInstanceId();
  // Resolve capture vars from current facts
  const initialSelections = resolveInitialSelections(rule, state.facts, state.modules);

  const newItem: PlannedItem = {
    instanceId,
    rule: {
      ...rule,
      id: instanceId, // Unique ID so engine processes each instance separately
      // `seed` goes last deliberately: a value carried over from the panel that
      // opened this row is a deliberate choice by the player and must beat the
      // capture-var default it is standing in for.
      selections: { ...(rule.selections ?? {}), ...initialSelections, ...(seed ?? {}) }
    },
    order: state.plannedItems.length,
    originalRuleId: rule.id,
    verb: deriveVerbFromRule(rule)
  };

  state = {
    ...state,
    plannedItems: [...state.plannedItems, newItem]
  };

  scheduleEvaluation();
}

/**
 * Plan an offer by its id — the shortcut an actionable annotation takes when
 * tapped. Resolves against the SAME addable catalog the add-row picker reads,
 * so the resulting row is indistinguishable from one the player picked by hand
 * (capture vars, verb and all).
 *
 * A miss is a no-op: the catalog is post-plan, so an offer whose `when` gate has
 * since closed simply isn't addable. `annotation-targets.test.ts` guards the
 * other miss — an annotation naming an offer that never existed.
 */
function addOfferToPlan(
  offerId: string,
  seed?: Record<string, AnnotationSeedSource>,
  sourceInstanceId?: string
): void {
  // Resolve the seed BEFORE the catalog lookup: an `{ effect }` source reads
  // what the source row advertised, and advertised effects trail the debounce by
  // up to DEBOUNCE_MS. Drag the slider and tap the reminder under it inside that
  // window and an unflushed read seeds the value from before the drag — usually
  // the row's opening zero. Flushing also refreshes the catalog this then reads.
  const resolved = resolveSeed(seed, sourceInstanceId);

  const entry = state.engineOutput?.availableRules.find((e) => e.rule.id === offerId);
  if (!entry) return;
  if (!resolved) {
    addToPlan(entry.rule);
    return;
  }
  addToPlan(entry.rule, clampSeed(entry.rule, resolved));
}

/**
 * Turn a seed spec into the values the new row opens on, read from the row the
 * annotation was tapped on. Undefined when there is nothing to seed, so the
 * target keeps its own capture-var defaults.
 *
 * A source that resolves to nothing is dropped rather than written as
 * undefined — the target's default is a better answer than a hole.
 */
function resolveSeed(
  seed: Record<string, AnnotationSeedSource> | undefined,
  sourceInstanceId: string | undefined
): Record<string, unknown> | undefined {
  if (!seed || Object.keys(seed).length === 0 || !sourceInstanceId) return undefined;
  flushPendingEvaluation();

  const item = state.plannedItems.find((i) => i.instanceId === sourceInstanceId);
  if (!item) return undefined;
  const selections = (item.rule.selections ?? {}) as Record<string, unknown>;
  const advertised = _plannedEntriesMap.get(sourceInstanceId)?.advertisedEffects ?? [];

  const resolved: Record<string, unknown> = {};
  for (const [targetVar, source] of Object.entries(seed)) {
    const value =
      typeof source === 'string' ? selections[source] : contributionTo(advertised, source.effect);
    if (value !== undefined) resolved[targetVar] = value;
  }
  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

/**
 * What one row contributed to a fact, summed over the effects it advertised.
 *
 * This is the post-rule figure and that is the point: `record-heal` caps its
 * heal at the HP the character was missing, and Life Bond follows the HP
 * actually regained. The cap is applied inside `apply` and cannot be recovered
 * from the facts afterwards — post-plan facts already fold this row in, so
 * re-deriving `missing` from them would subtract the same heal twice.
 */
function contributionTo(effects: EffectInstance[], fact: string): number | undefined {
  let total = 0;
  let found = false;
  for (const effect of effects) {
    const value = effect.state?.[fact];
    if (typeof value === 'number') {
      total += value;
      found = true;
    }
  }
  return found ? total : undefined;
}

/**
 * Hold a seeded value inside its control's range.
 *
 * `PanelSlider` renders what it is handed without clamping — and writes it back
 * to selections — so a heal larger than the steed's maximum HP would open a
 * slider showing a value its own control stops short of. Only the slider's
 * `max` is enforced, and only when it resolves to a number: an unresolvable
 * source (or any other control type) is left alone rather than guessed at.
 */
function clampSeed(rule: Rule, seed: Record<string, unknown>): Record<string, unknown> {
  const control = rule.ui?.primaryControl as
    | { type?: string; var?: string; max?: { number?: number; fact?: string } }
    | undefined;
  if (control?.type !== 'slider' || !control.var) return seed;
  const value = seed[control.var];
  if (typeof value !== 'number') return seed;

  const max =
    control.max?.number ??
    (control.max?.fact !== undefined ? state.facts[control.max.fact] : undefined);
  if (typeof max !== 'number') return seed;

  return { ...seed, [control.var]: Math.min(value, max) };
}

function removeFromPlan(instanceId: string): void {
  const filtered = state.plannedItems.filter((item) => item.instanceId !== instanceId);

  // Re-index order values
  const reindexed = filtered.map((item, index) => ({
    ...item,
    order: index
  }));

  state = {
    ...state,
    plannedItems: reindexed
  };

  scheduleEvaluation();
}

function movePlanItem(instanceId: string, direction: 'up' | 'down'): void {
  const items = [...state.plannedItems];
  const currentIndex = items.findIndex((item) => item.instanceId === instanceId);

  if (currentIndex === -1) return;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= items.length) return;

  // Swap
  [items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]];

  // Re-index
  const reindexed = items.map((item, index) => ({
    ...item,
    order: index
  }));

  state = {
    ...state,
    plannedItems: reindexed
  };

  scheduleEvaluation();
}

function updateSelections(instanceId: string, selections: Record<string, unknown>): void {
  const itemIndex = state.plannedItems.findIndex((item) => item.instanceId === instanceId);

  if (itemIndex === -1) return;

  const updatedItems = [...state.plannedItems];
  updatedItems[itemIndex] = {
    ...updatedItems[itemIndex],
    rule: {
      ...updatedItems[itemIndex].rule,
      selections: { ...updatedItems[itemIndex].rule.selections, ...selections }
    }
  };

  state = {
    ...state,
    plannedItems: updatedItems
  };

  scheduleEvaluation();
}

function swapPlanItemRule(instanceId: string, entry: AvailableRuleEntry): void {
  const index = state.plannedItems.findIndex((i) => i.instanceId === instanceId);
  if (index === -1) return;

  const initialSelections = resolveInitialSelections(entry.rule, state.facts, state.modules);
  const updated = [...state.plannedItems];
  updated[index] = {
    ...updated[index],
    verb: deriveVerbFromRule(entry.rule),
    rule: {
      ...entry.rule,
      id: instanceId,
      selections: { ...(entry.rule.selections ?? {}), ...initialSelections }
    },
    originalRuleId: entry.rule.id
  };

  state = {
    ...state,
    plannedItems: updated
  };

  scheduleEvaluation();
}

/**
 * Recursively fetch metadata for all transitive dependencies.
 * resolveDependencies can only walk cached entries, so we must ensure
 * all intermediate deps are in the cache before calling it.
 */
async function prefetchDepTree(ruleGroupId: string, assignedIds: string[]): Promise<void> {
  const cache = getCache();
  const assigned = [...assignedIds, ruleGroupId];
  const visited: string[] = [];
  const toFetch: string[] = [];

  // First pass: collect all dep IDs reachable from the target
  function collect(id: string): void {
    if (visited.includes(id)) return;
    visited.push(id);
    const meta = cache.get(id);
    if (!meta) {
      // Not in cache — queue for fetch
      if (!assignedIds.includes(id)) {
        toFetch.push(id);
      }
      return;
    }
    for (const depId of meta.requires) {
      if (!assigned.includes(depId)) {
        collect(depId);
      }
    }
  }

  collect(ruleGroupId);

  // Iteratively fetch missing metadata and discover further deps
  const currentLocale = get(locale);
  while (toFetch.length > 0) {
    const batch = [...toFetch];
    toFetch.length = 0;
    try {
      await ensureCached(batch, currentLocale);
    } catch (e) {
      console.error('[prefetchDepTree] ensureCached failed:', e);
      break;
    }
    for (const id of batch) {
      const meta = cache.get(id);
      if (meta) {
        for (const depId of meta.requires) {
          if (!assigned.includes(depId) && !visited.includes(depId)) {
            toFetch.push(depId);
          }
        }
      }
    }
  }
}

async function assignRuleGroup(characterId: string, ruleGroupId: string): Promise<void> {
  // Validate conditions
  const cache = getCache();
  const meta = cache.get(ruleGroupId);
  if (meta?.condition && !evaluateRuleGroupConditions(meta.condition, state.facts)) {
    throw new Error(`Prerequisites not met for ${ruleGroupId}`);
  }

  // Pre-fetch metadata for the full transitive dependency tree
  // resolveDependencies can only walk cached entries, so we must ensure
  // all intermediate deps are in the cache before resolving.
  await prefetchDepTree(ruleGroupId, state.ruleGroupIds);

  // Resolve transitive dependencies
  const deps = resolveDependencies(ruleGroupId, cache, state.ruleGroupIds);

  // Assign dependencies first (deepest-first order)
  const assignedDeps: string[] = [];
  for (const depId of deps) {
    try {
      await assignSingleGroup(characterId, depId);
      assignedDeps.push(depId);
    } catch (error) {
      // Roll back any deps already assigned on API
      await rollbackDeps(characterId, assignedDeps);
      throw error;
    }
  }

  // Assign the target group
  try {
    await assignSingleGroup(characterId, ruleGroupId);
  } catch (error) {
    // Roll back all deps on API
    await rollbackDeps(characterId, assignedDeps);
    throw error;
  }
}

async function rollbackDeps(characterId: string, depIds: string[]): Promise<void> {
  for (const depId of [...depIds].reverse()) {
    // Remove from local state
    state = {
      ...state,
      ruleGroupIds: state.ruleGroupIds.filter((id) => id !== depId),
      modules: state.modules.filter((m) => m.id !== depId)
    };

    // Remove from API
    try {
      await apiDelete(`/api/characters/${characterId}/rule-groups/${depId}`);
    } catch {
      // Best-effort API cleanup
    }
  }
}

async function assignSingleGroup(characterId: string, ruleGroupId: string): Promise<void> {
  if (state.ruleGroupIds.includes(ruleGroupId)) return;

  // Snapshot for revert
  const prevIds = [...state.ruleGroupIds];

  // Optimistic: add ID
  state = {
    ...state,
    ruleGroupIds: [...state.ruleGroupIds, ruleGroupId]
  };

  try {
    const response = await apiPost(`/api/characters/${characterId}/rule-groups`, {
      ruleGroupId
    });

    if (!response.ok) {
      throw new Error(`Assign failed: ${response.status}`);
    }

    // Fetch rules for the newly assigned group
    const currentLocale = get(locale);
    const batchResponse = await apiPost(`/api/rule-groups/batch?lang=${currentLocale}`, {
      ids: [ruleGroupId]
    });

    if (!batchResponse.ok) {
      throw new Error(`Fetch rules failed: ${batchResponse.status}`);
    }

    let batchGroups: {
      ruleGroupId: string;
      rules: string;
      name?: string;
      description?: string;
      requires?: string[];
      settings?: string | unknown[];
    }[] = [];
    try {
      const data = await batchResponse.json();
      batchGroups = data.ruleGroups ?? [];
    } catch {
      // Empty body - group assigned but rules unavailable
    }
    // Also cache metadata from batch response so resolveDependencies can use it
    const cache = getCache();
    for (const rg of batchGroups) {
      if (rg.ruleGroupId && !cache.has(rg.ruleGroupId)) {
        cache.set(rg.ruleGroupId, {
          name: rg.name ?? '',
          description: rg.description ?? '',
          requires: rg.requires ?? [],
          settings:
            typeof rg.settings === 'string' && rg.settings
              ? JSON.parse(rg.settings)
              : Array.isArray(rg.settings)
                ? rg.settings
                : []
        });
      }
    }
    // Load the newly assigned group's rule module so the engine evaluates it.
    const { modules: newModules } = await loadModules([ruleGroupId]);

    state = {
      ...state,
      modules: [...state.modules, ...newModules]
    };

    scheduleEvaluation();
  } catch (error) {
    console.error('[assignRuleGroup] Error:', error);
    // Revert
    state = {
      ...state,
      ruleGroupIds: prevIds
    };
    throw error;
  }
}

async function unassignRuleGroup(characterId: string, ruleGroupId: string): Promise<void> {
  // Snapshot for revert
  const prevIds = [...state.ruleGroupIds];
  const prevModules = [...state.modules];
  const prevEffects = [...state.effects];
  const prevCommitted = [...state.committed];

  // Optimistic: remove ID, module, and the group's committed effects — both the
  // settings-derived namespaced ones (`${ruleGroupId}::`) and the module-created
  // effects the plan fold stamped with this `ruleGroupId` (e.g. a donned shield),
  // which would otherwise keep contributing facts under a group that's gone.
  const committed = state.committed.filter(
    (e) => e.ruleGroupId !== ruleGroupId && !e.id.startsWith(`${ruleGroupId}::`)
  );
  state = {
    ...state,
    ruleGroupIds: state.ruleGroupIds.filter((id) => id !== ruleGroupId),
    modules: state.modules.filter((m) => m.id !== ruleGroupId),
    committed,
    effects: committed.map(effectInstanceToRule)
  };

  // Re-evaluate immediately for responsive UI
  performEvaluation();

  try {
    const response = await apiDelete(`/api/characters/${characterId}/rule-groups/${ruleGroupId}`);

    if (!response.ok && response.status !== 204) {
      throw new Error(`Unassign failed: ${response.status}`);
    }

    // Persist updated committed effects (settings-derived effects removed above)
    if (state.currentCharacterId) {
      apiPost(`/api/characters/${state.currentCharacterId}/effects`, {
        effects: JSON.stringify(state.committed)
      })
        .then((res) => {
          if (!res.ok) {
            toast.error(get(t)('play.error.saveEffects'));
          }
        })
        .catch(() => {
          toast.error(get(t)('play.error.saveEffects'));
        });
    }
  } catch (error) {
    console.error('[unassignRuleGroup] Error:', error);
    // Revert
    state = {
      ...state,
      ruleGroupIds: prevIds,
      modules: prevModules,
      effects: prevEffects,
      committed: prevCommitted
    };
    performEvaluation();
    throw error;
  }
}

function isLocked(ruleGroupId: string): boolean {
  return getDependents(ruleGroupId).length > 0;
}

function getDependents(ruleGroupId: string): string[] {
  const cache = getCache();
  const assigned = new Set(state.ruleGroupIds);
  const dependents: string[] = [];

  for (const assignedId of assigned) {
    const meta = cache.get(assignedId);
    if (meta?.requires?.includes(ruleGroupId)) {
      dependents.push(assignedId);
    }
  }

  return dependents;
}

function persistCommitted(): void {
  if (!state.currentCharacterId) return;
  apiPost(`/api/characters/${state.currentCharacterId}/effects`, {
    effects: JSON.stringify(state.committed)
  })
    .then((response) => {
      if (!response.ok) {
        toast.error(get(t)('play.error.saveEffects'));
      }
    })
    .catch(() => {
      toast.error(get(t)('play.error.saveEffects'));
    });
}

function removeEffect(effectId: string): void {
  // effect ids are stable (no counter suffix), so match by exact id. An effect
  // may declare `dependents` (child effect keys it owns) — removing the chip
  // evicts those too, so a steed mount takes its HP records with it, matching the
  // eviction the planned Dismiss/recast paths already do (by key).
  const removed = state.committed.find((e) => e.id === effectId);
  const dependentKeys = new Set(removed?.dependents ?? []);
  const committed = state.committed.filter(
    (e) => e.id !== effectId && !(e.key !== undefined && dependentKeys.has(e.key))
  );
  state = { ...state, committed, effects: committed.map(effectInstanceToRule) };
  performEvaluation();
  persistCommitted();
}

function endTurn(): void {
  // A plan edit inside the debounce window (tapped die, slider, added step) has
  // not been evaluated yet — flush it so the commit below reads the CURRENT
  // plan's advertised effects, not the previous evaluation's.
  flushPendingEvaluation();
  // Age the committed set across the turn boundary: merge in this turn's advertised
  // effects, collapse replacements by key, and drop any whose expiry fired. Rests
  // recorded this turn are detected from the effects themselves (`endTurn`).
  const committed = ageCommittedEffects(state.committed, _lastAdvertised);

  state = {
    ...state,
    plannedItems: [],
    committed,
    effects: committed.map(effectInstanceToRule)
  };
  performEvaluation();

  // Fire-and-forget save to backend.
  persistCommitted();
}

function addFollowupEffect(effect: EffectInstance): void {
  // JSON round-trip strips Svelte reactive proxies that structuredClone can't handle.
  const plain = JSON.parse(JSON.stringify(effect)) as EffectInstance;
  // Re-tapping the same follow-up must REPLACE, not append: the strip keys chips
  // by id and the engine dedupes committed effects by key, so a duplicate id/key
  // would double-render and persist a stale copy until End Turn collapses it. Drop
  // any existing committed effect sharing this one's id (or key, when keyed) first.
  const committed = [
    ...state.committed.filter(
      (e) => e.id !== plain.id && (plain.key === undefined || e.key !== plain.key)
    ),
    plain
  ];
  state = { ...state, committed, effects: committed.map(effectInstanceToRule) };
  performEvaluation();
  persistCommitted();
}

function reset(): void {
  cancelScheduledEvaluation();
  _hypotheticalEntriesMap = new Map();
  _plannedEntriesMap = new Map();
  _lastAdvertised = [];
  state = { ...initialState };
}

interface SettingsGroup {
  ruleGroupId: string;
  name: string;
  settings: SettingDefinition[];
}

async function getSettingsForRuleGroup(ruleGroupId: string): Promise<SettingsGroup[] | null> {
  await prefetchDepTree(ruleGroupId, state.ruleGroupIds);
  const cache = getCache();
  const deps = resolveDependencies(ruleGroupId, cache, state.ruleGroupIds);
  const allIds = [...deps, ruleGroupId];
  const groups: SettingsGroup[] = [];

  for (const id of allIds) {
    const meta = cache.get(id);
    if (meta && meta.settings.length > 0) {
      groups.push({
        ruleGroupId: id,
        name: meta.name,
        settings: meta.settings
      });
    }
  }

  return groups.length > 0 ? groups : null;
}

async function assignRuleGroupWithSettings(
  characterId: string,
  ruleGroupId: string,
  settingsValues: Map<string, Record<string, string>>
): Promise<void> {
  await assignRuleGroup(characterId, ruleGroupId);

  const cache = getCache();

  const groups = Array.from(settingsValues.entries()).map(([groupId, values]) => {
    const meta = cache.get(groupId);
    return { ruleGroupId: groupId, settings: meta?.settings ?? [], values };
  });

  const { additionalRuleGroupIds, effects } = resolveSettings(groups, (id) => {
    const meta = cache.get(id);
    return meta ? { requires: meta.requires } : undefined;
  });

  for (const additionalId of additionalRuleGroupIds) {
    if (!state.ruleGroupIds.includes(additionalId)) {
      await assignRuleGroup(characterId, additionalId);
    }
  }

  if (effects.length > 0) {
    // Settings resolve directly to EffectInstances — commit them as-is.
    const committed = [...state.committed, ...effects];
    state = { ...state, committed, effects: committed.map(effectInstanceToRule) };
    performEvaluation();
    persistCommitted();
  }
}

function checkCondition(ruleGroupId: string): boolean {
  const cache = getCache();
  const meta = cache.get(ruleGroupId);
  if (!meta?.condition) return true;
  return evaluateRuleGroupConditions(meta.condition, state.facts);
}

export const playStore = {
  get state() {
    return state;
  },
  loadRuleGroups,
  assignRuleGroup,
  unassignRuleGroup,
  isLocked,
  getDependents,
  addToPlan,
  addOfferToPlan,
  removeFromPlan,
  movePlanItem,
  updateSelections,
  swapPlanItemRule,
  getAlternativeEntries,
  getPlannedEntry,
  removeEffect,
  addFollowupEffect,
  getSettingsForRuleGroup,
  checkCondition,
  assignRuleGroupWithSettings,
  endTurn,
  reset
};
