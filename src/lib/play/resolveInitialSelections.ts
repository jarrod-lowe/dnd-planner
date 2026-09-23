/**
 * Resolves initial selections for vars marked with `capture: true`.
 *
 * When a rule with capture vars is added to the plan, this utility resolves
 * the var defaults from the current facts and returns them as selections.
 * This "captures" the state at add time rather than deriving from final facts.
 *
 * A loadout control captures the same way, without needing a `capture` var: its
 * value is the whole `LoadoutConfig` the character is already holding, read back
 * off the facts. Capturing it at add time is what stops the row from opening on
 * "empty hands" — which, committed, would silently disarm the character. A
 * spell-prepare control captures identically: the whole prepared set read back
 * off the prepared facts, so the picker never opens on a set whose commit would
 * unprepare everything.
 *
 * @param rule - The rule being added to the plan
 * @param facts - Current facts from the engine output
 * @param modules - The character's resolved modules (the loadout roster)
 * @returns Selections object with captured values
 */
import type { Rule, Facts } from '$lib/rules-view';
import type { RuleModule } from '$lib/rules-engine/types';
import { currentLoadout } from './currentLoadout';
import { currentPrepared } from './currentPrepared';

/** The primary control's var, if it is a control type whose value lives in facts. */
function controlVar(rule: Rule, type: 'loadout' | 'spell-prepare'): string | undefined {
  const control = rule.ui?.primaryControl as { type?: string; var?: string } | undefined;
  if (!control || control.type !== type || typeof control.var !== 'string') return undefined;
  return control.var;
}

export function resolveInitialSelections(
  rule: Rule,
  facts: Facts,
  modules: RuleModule[] = []
): Record<string, unknown> {
  const selections: Record<string, unknown> = {};

  const loadout = controlVar(rule, 'loadout');
  if (loadout) {
    selections[loadout] = currentLoadout(modules, facts);
  }

  // Same capture, same reason: the prepared set is a whole-set replacement, so
  // an unseeded picker opening empty would unprepare everything on commit.
  const prepared = controlVar(rule, 'spell-prepare');
  if (prepared) {
    selections[prepared] = currentPrepared(modules, facts);
  }

  if (!rule.vars) {
    return selections;
  }

  for (const [varName, varDef] of Object.entries(rule.vars)) {
    // Only process vars with capture: true
    if (!varDef.capture) {
      continue;
    }

    const defaultSource = varDef.default;

    // Resolve number default
    if (defaultSource.number !== undefined) {
      selections[varName] = defaultSource.number;
      continue;
    }

    // Resolve fact default
    if (defaultSource.fact !== undefined) {
      const factValue = facts[defaultSource.fact];
      // Numeric captures floor at 0: the fact is read from the plan PREFIX,
      // and earlier rows can over-commit it (the planner projects
      // over-commitment rather than preventing it), so `remaining`-shaped
      // facts can legitimately read negative there — never a meaningful
      // opening default. Non-numeric values (and missing facts → 0) are
      // untouched.
      selections[varName] =
        typeof factValue === 'number'
          ? Math.max(0, factValue)
          : factValue !== undefined && factValue !== null
            ? factValue
            : 0;
      continue;
    }
  }

  return selections;
}
