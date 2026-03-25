# D&D Rules Engine Input/Output JSON Spec (v2)

## Purpose

This document defines the JSON input and output contract for the rules engine.

It focuses on:

- the top-level input object
- the top-level output object
- the meaning of `rules.standing`, `rules.planned`, and `rules.effects`
- the meaning of `state.facts`
- the meaning of top-level projected `facts`
- the meaning of replayable `next`
- the shape of `availableRules`
- the distinction between facts and events
- the reusable rule object schema

---

## Design summary

The rules engine is fully stateless.

It receives:

- standing rules
- planned rules
- effect rules already in force
- current facts

It evaluates them together and returns:

- projected facts after applying the current rules
- available rules that the UI may offer as choices
- diagnostics
- trace information
- a replayable `next` object

The engine does not commit anything.

Committing is a UI operation.

---

## Core concepts

### Standing rules

Standing rules are rules the UI treats as part of the persistent baseline rule set.

Examples:

- derived-stat rules
- resource offering rules
- item behavior rules
- spell behavior definitions

### Planned rules

Planned rules are rules the UI has currently added to the plan. The UI thinks of these as "choices", but the rules engine has no need for the distinction.

Examples:

- using Bardic Inspiration
- taking a Long Rest
- making an attack
- increment turn counter

### Effect rules

Effect rules are rules already in force because of prior events and still affecting evaluation.

Examples:

- an active buff
- a debuff applied to an enemy being tracked by the player
- a condition that expires later
- an externally granted effect such as Bardic Inspiration

### Facts

Facts are durable state values.

They are provided as input and returned as output.

Examples:

- `hp.current`
- `hp.max`
- `bardicInspiration.remaining`
- `turn.counter`

### Events

Events are transient occurrences during a single evaluation.

Examples:

- `longRest`
- `endTurn`
- `bardicInspirationUsed`

Events are not persisted in the output.

### Projected facts

Top-level output `facts` are the projected facts after applying the current standing rules, planned rules, and effect rules to the input state.

These are the "what would happen" facts.

### Replayable next

`next` is a complete normalized input object suitable for reuse in the next engine call.

It is replayable.

If the caller invokes the engine again using `next` unchanged, the engine should produce a semantically equivalent result.

This means `next.state.facts` are replay/base facts, not automatically committed projected facts.

---

## Input JSON shape

```json
{
  "schemaVersion": 1,
  "rules": {
    "standing": [],
    "planned": [],
    "effects": []
  },
  "state": {
    "facts": {}
  }
}
```

---

## Rule object

A rule is the reusable executable object used in all rule arrays and rule-bearing outputs.

The same rule schema is used in these places:

- `rules.standing[]`
- `rules.planned[]`
- `rules.effects[]`
- `availableRules[].rule`

A rule has this shape:

```json
{
  "id": "string",
  "description": "string",
  "ui": {},
  "vars": {},
  "phase": "normal",
  "enabled": true,
  "when": [],
  "after": [],
  "group": ["string"],
  "activities": []
}
```

All fields are optional except where noted, but a practically useful executable rule normally has at least:

- `id`
- `activities`

### Rule fields

#### `id`

Type: string

Required: yes

Meaning:
A stable identifier for the rule within the evaluation.

#### `description`

Type: string

Required: no

Meaning:
Human-readable description for debugging and inspection.

#### `ui`

Type: object

Required: no

Meaning:
Optional opaque UI metadata used when rules are surfaced to the UI, especially in `availableRules[].rule`. The rules engine does not look at this field, it just copies it through unchanged.

#### `phase`

Type: string

Required: no

Default: `normal`

Allowed values in v1:

- `early`
- `normal`
- `safeguard`

Meaning:
Determines when the rule runs in evaluation.

- `early`: runs before normal rules. This is often useful for rules that emit events or otherwise need to establish preconditions for later rules.
- `normal`: ordinary evaluation phase.
- `safeguard`: late normalization phase.

Phases are evaluated in this order:

1. `early`
2. `normal`
3. `safeguard`

#### `enabled`

Type: boolean

Required: no

Default: `true`

Meaning:
Whether the rule is eligible to execute.

If `false`, the rule is ignored for evaluation.

#### `when`

Type: array

Required: no

Default: `[]`

Meaning:
Applicability conditions that must all be satisfied for the rule to execute.

Supported forms in v1:

##### Fact existence

```json
{ "fact": "hp.max" }
```

##### Fact comparison

```json
{ "fact": "bardicInspiration.remaining", "greaterThan": 0 }
```

Supported comparison keys:

- `equals`
- `notEquals`
- `greaterThan`
- `greaterThanOrEqual`
- `lessThan`
- `lessThanOrEqual`

##### Event condition

```json
{ "event": "longRest" }
```

Meaning: this rule only applies in evaluations where that event occurred.

All entries are ANDed together.

Important:

- `when` is evaluated at the time the rule is considered for execution
- `when` is evaluated against the current working state at that point in evaluation
- `when` does not imply ordering

This means a `when` condition may see facts that have already been changed by earlier rules in the same evaluation, but it must not assume that a fact has reached its final value unless ordering has been established separately.

If a rule's `when` conditions depend on facts established or modified by other rules, the rule author must use `after` and/or phase structure to ensure the intended ordering.

The same principle applies to facts read by the rule's activities: fact references in `when` or in activities do not automatically create ordering edges.

#### `after`

Type: array

Required: no

Default: `[]`

Meaning:
Ordering constraints. A rule must not execute until all referenced groups have settled.

Shape:

```json
{ "group": "str.modifier" }
```

Meaning:
The rule must wait until all rules belonging to the specified group have either executed or been determined not to execute in this evaluation.

All entries are ANDed together.

Additional legality rules for `after`:

- waiting on a group that has no provider rules in the same evaluation is illegal
- waiting on a group defined only in a later phase is illegal
- group waits must not cross phase boundaries

In practice this means:

- an `early` rule may only wait on `early` groups
- a `normal` rule may only wait on `normal` groups
- a `safeguard` rule may only wait on `safeguard` groups

#### `group`

Type: array of strings

Required: no

Default: `[]`

Meaning:
Declares that this rule participates in the specified group(s).

All rules with the same group name form a group whose execution must settle before rules depending on that group may run.

Groups are phase-local. A group name is only meaningful within a single phase for ordering purposes.

#### `activities`

Type: array of activity objects

Required: yes

Meaning:
Ordered operations performed when the rule executes.

Activities are defined later in this document.

- activities execute in array order
- each activity mutates the working state
- later activities see the results of earlier activities in the same rule
- later rules see the results of earlier rules

Activities do not:

- create implicit ordering dependencies
- bypass `when` or `after`

### Rule execution semantics

The engine evaluates `rules.standing`, `rules.planned`, and `rules.effects` together as one combined ruleset.

A rule executes if:

- `enabled` is not `false`
- its `phase` is currently being evaluated
- all `after` group dependencies are settled
- all `when` conditions are satisfied at that moment in the current working state

When a rule executes:

- its `activities` run in order
- its `id` may appear in `trace.appliedRuleIds`

A group is considered settled when all rules belonging to that group in the same phase have either:

- executed, or
- been determined not to execute

### Vars, Selections, and UI State

#### Vars

Rules may declare engine-facing variables using vars.

```json
{
  "vars": {
    "distance": {
      "default": {
        "fact": "character.movement.current"
      }
    }
  }
}
```

- `vars` define parameters that influence rule execution
- `default` is used if there is no matching value in `selections`
- vars must not contain UI-only data
- `vars[].default` uses the same structure as activity `source` values, except they cannot reference other vars

#### Selections

Rules may include:

```json
{
  "selections": {
    "distance": 15
  }
}
```

- `selections` is a sparse map of user-selected values
- only values differing from defaults should be stored
- `selections` do not come from the database, they will be added by the UI during execution

#### Separation of concerns

| Concern              | Field      |
| -------------------- | ---------- |
| Rule mechanics       | activities |
| Engine parameters    | vars       |
| User-selected values | selections |
| UI-only data         | ui.state   |

### Ordering and applicability

`after` establishes ordering constraints.

`when` does not establish ordering constraints. It is only an applicability check performed when the rule is considered for execution.

Therefore, if a rule needs another rule's fact writes to have happened first, the author must express that ordering explicitly using `after` and/or phases.

A useful rule of thumb is:

- use `when` to say **whether** a rule applies
- use `after` to say **when** it is safe to evaluate that rule

### Ordering legality and cycles

The engine must reject illegal ordering graphs.

At minimum, the following cases are illegal and should make `status.ok = false`:

- dependency cycles within a phase
- a rule waiting on a group that no rule in that phase belongs to
- a rule waiting on a group that belongs only to a different phase
- any ordering relationship that would require cross-phase waiting
- a generated rule targeting the same phase as the generating rule
- a generated rule targeting an earlier phase than the generating rule

These are structural evaluation failures, not ordinary plan-illegality diagnostics.

---

## Activity object

Activities are the executable operations within a rule. They are run in order when a rule executes.

This section defines the core activity schema and the built-in activity types for v1.

### Activity shape

```json
{
  "id": "string",
  "type": "string"
}
```

All activity types extend this base shape with additional fields.

#### `id`

Type: string

Required: yes

Meaning:
A stable identifier for the activity within the evaluation.

#### `type`

Type: string

Required: yes

Meaning:
The activity type.

---

## Built-in activity types (v1)

Multiple activity types reference a `source` field. `source` fields may contain _one_ of:

- `fact`: takes the name of a fact
- `number`: takes a constant number
- `var`: `varName`

e.g.

```json
source:
  var: varName
```

In the case of a varName, it will look up the value in `selections` first, and
if not present, then `vars[].default`. These will then need to be resolved.

E.g.

```plain
resolved(x) = selections[x] ?? vars[x].default
```

### `number_set`

```json
{
  "type": "number_set",
  "target": "hp.current",
  "source": {
    "number": 10
  }
}
```

Sets a numeric fact to a value.

- overwrites any existing value

---

### `number_increment`

```json
{
  "type": "number_increment",
  "target": "hp.current",
  "max": "hp.max",
  "source": {
    "number": 5
  }
}
```

Increments a numeric fact.

- if the fact does not exist, it is treated as 0
- `max` (optional) caps the resulting value using another fact
- a `min` field may be added in future

---

### `number_copy`

```json
{
  "type": "number_copy",
  "target": "hp.current",
  "source": {
    "fact": "hp.max"
  }
}
```

Copies the value from one fact to another.

---

### `number_sum`

```json
{
  "type": "number_sum",
  "target": "hp.max",
  "sources": [{ "fact": "hp.base" }, { "fact": "hp.bonus" }]
}
```

Sets a numeric fact to the sum of multiple other facts.

- missing facts are treated as 0

---

### `number_function`

```json
{
  "type": "number_function",
  "target": "str.modifier",
  "function": "modifier_value",
  "sources": [{ "fact": "str.value" }]
}
```

Sets a numeric fact using a named function.

- functions are implementation-defined
- for security, available functions should be referenced by a string name, not `eval()` or equivalent

---

### `emit_event`

```json
{
  "type": "emit_event",
  "event": "longRest"
}
```

Emits an event for this evaluation.

- events may be used by `when` conditions in other rules during the same evaluation
- events are not persisted in `next`

---

### `generate_rule`

```json
{
  "type": "generate_rule",
  "rule": { ... }
}
```

Creates a new rule during evaluation.

A generated rule may only target a later phase than the phase of the rule currently executing.

This means:

- an `early` rule may generate `normal` or `safeguard` rules
- a `normal` rule may generate `safeguard` rules
- a `safeguard` rule may not generate any further rules for the current evaluation
- a rule may not generate another rule in the same phase
- a rule may not generate another rule in an earlier phase

Immediate effects that must happen in the current phase must be represented directly by the generating rule's own activities, not by a generated rule.

If a generated rule should persist into future evaluations, it must appear in `next.rules.effects`.

---

### `offer_rule`

```json
{
  "type": "offer_rule",
  "rule": { ... },
  "legalWhen": [ ... ]
}
```

Offers a rule as a potential choice to the UI.

- does not execute the offered rule
- produces an entry in `availableRules`

#### `legalWhen`

Type: array

Meaning:
Conditions that determine whether the offered rule is ordinarily legal.

Each entry has the form:

```json
{
  "condition": { ... },
  "illegalDiagnostics": [ ... ]
}
```

Conditions are the same as `when` conditions. If a condition is not satisfied:

- the offered rule is still returned
- but marked `legal: false`
- diagnostics are attached

`illegalDiagnostics` has the same shape as `diagnostics` documented elsewhere in this document.

---

## Input fields

### `schemaVersion`

Type: integer

Required: yes

Meaning:
The version of the input/output schema.

---

### `rules`

Type: object

Required: yes

Shape:

```json
{
  "standing": [],
  "planned": [],
  "effects": []
}
```

Meaning:
The complete set of rules to evaluate in this call.

The engine combines `rules.standing`, `rules.planned`, and `rules.effects` into one evaluated ruleset. The separation exists for caller and UI clarity, not because the engine applies different execution semantics to them.

#### `rules.standing`

Type: array of rule objects

Meaning:
Rules that the UI considers part of the persistent baseline rule set.

#### `rules.planned`

Type: array of rule objects

Meaning:
Rules that the UI considers part of the current speculative plan.

Planned rules may include additional per-instance fields:

- `selections`: user-selected values for vars
- `ui.state`: UI-only state

These fields are ignored by the rules engine except where selections affect var resolution. These fields will not be present in the rule groups in the database, as they are execution state.

The UI may add and remove these freely while the user edits the plan.

#### `rules.effects`

Type: array of rule objects

Meaning:
Rules already in force before this evaluation starts.

These are usually generated or persistent temporary effects.

Although they are already in force from the caller's point of view, the engine evaluates them using the same rule semantics as `rules.standing` and `rules.planned`.

---

### `state`

Type: object

Required: yes

Shape:

```json
{
  "facts": {}
}
```

#### `state.facts`

Type: object mapping fact names to values

Meaning:
The replay/base facts at the start of evaluation.

These are the current durable state values.

---

## Output JSON shape

```json
{
  "status": {
    "ok": true,
    "legal": true,
    "applicable": true
  },
  "facts": {},
  "collections": {},
  "availableRules": [],
  "diagnostics": {
    "errors": [],
    "warnings": [],
    "notices": []
  },
  "trace": {
    "appliedRuleIds": [],
    "appliedActivityIds": [],
    "providedCapabilities": [],
    "emittedEvents": []
  },
  "next": {
    "schemaVersion": 1,
    "rules": {
      "standing": [],
      "planned": [],
      "effects": []
    },
    "state": {
      "facts": {}
    }
  }
}
```

---

## Output fields

### `status`

Type: object

Required: yes

Shape:

```json
{
  "ok": true,
  "legal": true,
  "applicable": true
}
```

#### `status.ok`

Whether the engine successfully evaluated the input structurally.

#### `status.legal`

Whether the current full evaluated plan is ordinarily legal.

#### `status.applicable`

Whether the engine could still evaluate the current input and produce a meaningful result.

A plan may be illegal but still applicable.

---

### `facts`

Type: object mapping fact names to values

Required: yes

Meaning:
The projected fact state after evaluating the current rules against the input replay state.

These are the hypothetical result facts.

Important:

- these are not automatically committed
- these may intentionally differ from `next.state.facts`

---

### `collections`

Type: object

Required: yes

Meaning:
Projected collection outputs such as sets, lists, notices, resistances, and other non-scalar derived values.

---

### `availableRules`

Type: array

Required: yes

Meaning:
Rules the UI may present as choices that can be added to `rules.planned` in a future evaluation.

`availableRules` are derived from the currently projected evaluated state, not from `next.state.facts`.

A rule may still be present in `availableRules` even if it is ordinarily illegal, as long as a containing `offer_rule` activity offered it.

Each entry contains the executable rule plus legality metadata.

Recommended shape:

```json
[
  {
    "rule": {
      "id": "rule-id",
      "activities": [],
      "ui": {
        "label": "string",
        "description": "string"
      }
    },
    "legal": true,
    "applicable": true,
    "diagnostics": []
  }
]
```

#### `availableRules[].rule`

The full executable rule object that may be added to `rules.planned` by the caller/UI. See the Rules spec earlier in this document.

#### `availableRules[].legal`

Whether adding this rule would be ordinarily legal in the currently projected state.

#### `availableRules[].applicable`

Whether the engine could still evaluate this rule if the UI added it anyway.

#### `availableRules[].diagnostics`

Diagnostics relevant to the legality of the offered rule.

These come from failed `offer_rule.legalWhen` checks.

---

### `diagnostics`

Type: object

Required: yes

Shape:

```json
{
  "errors": [],
  "warnings": [],
  "notices": []
}
```

Meaning:
Diagnostics for the current evaluated input as a whole.

This is distinct from per-offered-rule diagnostics in `availableRules`, but is the same shape.

---

### `trace`

Type: object

Required: yes

Shape:

```json
{
  "appliedRuleIds": [],
  "appliedActivityIds": [],
  "providedCapabilities": [],
  "emittedEvents": []
}
```

Meaning:
Trace/debug information describing what occurred during this evaluation.

This is not durable state and must not be treated as input for the next call.

If you need visibility into rules created during evaluation, trace may later be extended with creation-specific details, but there is no separate top-level `generatedRules` output.

---

### `next`

Type: complete input object

Required: yes

Meaning:
A complete replayable input document suitable for immediate reuse as the input to a subsequent evaluation.

Important properties:

- `next` is replayable
- `next` is not the same thing as a committed result
- `next.state.facts` are replay/base facts, not automatically the projected top-level `facts`
- `next` does not include transient output-only values such as emitted events, diagnostics, trace, or `availableRules`

Rules created during evaluation that should persist into future evaluations must appear in `next.rules.effects`.

A generated rule may only target a later phase than the rule that generated it. This avoids retroactive same-phase ordering problems.

### Replayability guarantee

If the caller invokes the engine with `next` unchanged, the engine should produce a semantically equivalent result.

This does not require byte-for-byte identical output.

---

## Facts vs events

### Facts

Facts are durable state.

They:

- appear in input as `state.facts`
- appear in output as top-level projected `facts`
- appear in `next.state.facts` as replay/base facts
- are passed back into later calls

### Events

Events are transient evaluation-local occurrences.

They:

- are emitted during rule execution
- may satisfy rule dependencies during the same evaluation
- may appear in `trace.emittedEvents`
- do not appear in `next`
- are not passed back into the next call

A useful shorthand:

- facts answer: **what is true right now?**
- events answer: **what happened during this evaluation?**

---

## Commit semantics

The engine does not commit plan effects.

Commit is performed by the UI/caller.

To commit the currently evaluated result, the UI should:

1. take the returned `next`
2. replace `next.state.facts` with the top-level projected `facts`
3. make any corresponding UI-level plan edits, such as removing planned rules that have now actually been carried out
4. use the resulting document as the new base input

This keeps the distinction between preview and execution outside the engine.

---

## Example: Bardic Inspiration offering

### Input

```json
{
  "schemaVersion": 1,
  "rules": {
    "standing": [
      {
        "id": "rule-offer-bardic-inspiration",
        "description": "Offer Bardic Inspiration if it can be used",
        "activities": [
          {
            "id": "activity-offer-bardic-inspiration",
            "type": "offer_rule",
            "rule": {
              "id": "rule-use-bardic-inspiration",
              "description": "Use Bardic Inspiration",
              "ui": {
                "label": "Use Bardic Inspiration",
                "description": "Add a Bardic Inspiration die to a roll"
              },
              "activities": [
                {
                  "id": "activity-consume-bardic-inspiration",
                  "type": "number_increment",
                  "target": "bardicInspiration.remaining",
                  "number": -1
                }
              ]
            },
            "legalWhen": [
              {
                "condition": {
                  "fact": "bardicInspiration.remaining",
                  "greaterThan": 0
                },
                "illegalDiagnostics": [
                  {
                    "code": "resource.bardicInspiration.insufficient",
                    "severity": "error"
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "planned": [],
    "effects": []
  },
  "state": {
    "facts": {
      "bardicInspiration.remaining": 2
    }
  }
}
```

### Output shape (abridged)

```json
{
  "facts": {
    "bardicInspiration.remaining": 2
  },
  "availableRules": [
    {
      "rule": {
        "id": "rule-use-bardic-inspiration"
      },
      "legal": true,
      "applicable": true,
      "diagnostics": []
    }
  ],
  "next": {
    "schemaVersion": 1,
    "rules": {
      "standing": [],
      "planned": [],
      "effects": []
    },
    "state": {
      "facts": {
        "bardicInspiration.remaining": 2
      }
    }
  }
}
```

If the UI adds the offered rule to `rules.planned`, top-level projected `facts` may become `1` while `next.state.facts` remains `2` until the UI decides to commit the result.

---

## Practical guidance for the UI

### To preview a new choice

- take a rule from `availableRules[].rule`
- append it to `rules.planned`
- call the engine again

### To reevaluate without changes

- call the engine again with `next` unchanged

### To commit the result

- take `next`
- overwrite `next.state.facts` with top-level `facts`
- update `rules.planned` to reflect what was actually done
- call the engine again if needed

---

## Summary

The input/output contract is built around two distinct fact states:

- input replay/base facts in `state.facts`
- output projected facts in top-level `facts`

and one replayable next input object:

- `next`

All rules are grouped under `rules`, with three caller-facing buckets:

- `standing`: baseline persistent rules
- `planned`: rules currently included in the speculative plan
- `effects`: rules already in force due to prior events and still affecting evaluation

From the engine's point of view, all three are simply combined into the evaluated ruleset.

## A note on UI state

FOR INFORMATIONAL PURPOSES ONLY:

The rules engine does not engage with the `ui` field, it is for the user interface. The rules engine just returns it unchanged. However, for completeness:

```json
{
  "ui": {
    "model": "uiModelName",
    "name": "rule.group.file.object.name", # A i18n key for the name in the UI
    "state": {
      "note": "towards enemy #1" # for example
    },
  }
}
```

- ignored by the rules engine
- persisted in memory for UI purposes only
- must not affect rule execution
- is not present in the rule groups stored in the database
- `state` will not be defined in the rule group in the database, it will be generated by the UI itself
