import type { CombineMode, EffectInstance, ExpirySpec } from './types';

/**
 * M4/W2 — the persisted-effect migration core: convert a stored v1 effect `Rule`
 * into a v2 `EffectInstance`. This is the pure heart of W5 (the one-shot migration
 * of characters' `/effects` blobs old→new + the read-time shim); wiring it to the
 * backend and proving it against real data is env/CI-gated, but the conversion
 * itself is deterministic and unit-tested here.
 *
 * Committed effects carry BAKED values (the advertise-time capture is already in
 * `varsRuntime`), so the shapes that actually persist are `numberSet` /
 * `numberIncrement` over a literal or a captured var:
 *  - `numberSet`       → an `override` contribution (the effect fixes the fact),
 *  - `numberIncrement` → a `sum` contribution (negated when `subtract`),
 *  - `advertiseEffect self:true` → the effect persists, so `permanent`; otherwise
 *    it is a one-turn effect (`endOfTurn`).
 * A `group` becomes the replacement `key`. Activities whose source resolves only
 * at eval time (`fact`/`condition`) can't be statically baked and are surfaced in
 * `unresolved` rather than silently dropped, so the migration can flag them.
 *
 * Scope: this is correct for effects that share a fact namespace between v1 and v2
 * — build state (`weapon.*.equipped`, `spell.*.prepared`, `*.value`,
 * proficiencies), buffs (`divineFavour.active`), and HP modifiers
 * (`hp.modifier.*`). Resource-tracking effects diverge (v1 sets `*.remaining`
 * directly; v2 derives `remaining = total − spent`), so remapping those to the v2
 * `*.spent` namespace is a semantic layer W5 adds on top — not this mechanical pass.
 */

/** The subset of a persisted v1 effect rule this converter reads. */
export interface V1EffectRule {
  id: string;
  group?: string[];
  varsRuntime?: Record<string, number>;
  activities?: V1Activity[];
}
interface V1Activity {
  type: string;
  target?: { fact?: string };
  source?: { number?: number; var?: string; fact?: string; condition?: unknown };
  subtract?: boolean;
  self?: boolean;
}

export interface MigrationResult {
  effect: EffectInstance;
  /** `type fact` for each activity that could not be statically resolved. */
  unresolved: string[];
}

/** A numeric v1 source resolved to a literal via the rule's captured vars, or undefined. */
function resolveNumber(
  source: V1Activity['source'],
  vars: Record<string, number>
): number | undefined {
  if (source?.number !== undefined) return source.number;
  if (source?.var !== undefined) return vars[source.var];
  return undefined;
}

export function v1EffectRuleToInstance(rule: V1EffectRule): MigrationResult {
  const vars = rule.varsRuntime ?? {};
  const state: Record<string, number> = {};
  const stateCombine: Record<string, CombineMode> = {};
  const unresolved: string[] = [];
  let persists = false;

  for (const a of rule.activities ?? []) {
    if (a.type === 'advertiseEffect') {
      if (a.self) persists = true;
      continue;
    }
    if (a.type !== 'numberSet' && a.type !== 'numberIncrement') continue;
    const fact = a.target?.fact;
    if (!fact) continue;
    const value = resolveNumber(a.source, vars);
    if (value === undefined) {
      unresolved.push(`${a.type} ${fact}`);
      continue;
    }
    if (a.type === 'numberSet') {
      state[fact] = value;
      stateCombine[fact] = 'override';
    } else {
      // numberIncrement sums (v2 default combine); accumulate across activities.
      state[fact] = (state[fact] ?? 0) + (a.subtract ? -value : value);
    }
  }

  const expiry: ExpirySpec = persists ? { kind: 'permanent' } : { kind: 'endOfTurn' };
  const effect: EffectInstance = {
    id: rule.id,
    ...(rule.group && rule.group.length > 0 ? { key: rule.group[0] } : {}),
    state,
    ...(Object.keys(stateCombine).length > 0 ? { stateCombine } : {}),
    expiry
  };
  return { effect, unresolved };
}

/** Batch-migrate a character's persisted v1 effects to v2 `EffectInstance`s. */
export function migratePersistedEffects(rules: V1EffectRule[]): {
  effects: EffectInstance[];
  unresolved: Record<string, string[]>;
} {
  const effects: EffectInstance[] = [];
  const unresolved: Record<string, string[]> = {};
  for (const rule of rules) {
    const { effect, unresolved: u } = v1EffectRuleToInstance(rule);
    effects.push(effect);
    if (u.length > 0) unresolved[rule.id] = u;
  }
  return { effects, unresolved };
}
