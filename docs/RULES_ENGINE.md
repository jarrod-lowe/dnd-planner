# D&D Planner Rules Engine

## Overview

The rules engine is the heart of the D&D Planner application. It evaluates game rules against character state to produce:

- **Facts**: Updated state values (e.g., remaining movement)
- **Available Rules**: Choices the user can add to their plan
- **Diagnostics**: Errors, warnings, and notices

## Evaluation Semantics

### Input

```typescript
interface EngineInput {
  schemaVersion: 1;
  rules: {
    standing: Rule[];  // Always-active rules
    planned: Rule[];   // User-planned actions
    effects: Rule[];   // Result of planned actions
  };
  state: {
    facts: Facts;      // Current character state
  };
}
```

### Output

```typescript
interface EngineOutput {
  status: Status;
  facts: Facts;                    // Projected state after evaluation
  collections: Record<string, unknown>;
  availableRules: AvailableRuleEntry[];
  diagnostics: Diagnostics;
  trace: Trace;
  next: EngineInput;               // Replayable input for subsequent calls
}
```

## Phase Execution

Rules execute in phase order:

1. **early** - Rules that establish preconditions (e.g., reset current movement to total)
2. **normal** - Standard rules and planned actions
3. **safeguard** - Late normalization rules

## Variable Resolution

When a rule references a var (e.g., `{ var: "distance" }`), the engine resolves it:

1. **Check selections first** - If `rule.selections[varName]` exists, use that value
2. **Fall back to default** - Resolve `vars[varName].default`:
   - `{ number: x }` → literal value
   - `{ fact: "path" }` → current fact value

### The `capture` Property

Vars with `capture: true` have their defaults resolved and stored as selections when the rule is added to the plan:

```yaml
vars:
  distance:
    capture: true
    default:
      fact: character.movement.current
```

**Why use capture?**

The `character.movement.current` fact changes during evaluation. Without capture:
1. Add Walk (remaining = 30ft)
2. Engine evaluates: uses 30ft, sets remaining to 0
3. Slider shows 0ft (derived from final remaining)

With `capture: true`:
1. Add Walk (remaining = 30ft)
2. Selection is captured: `{ distance: 30 }`
3. Slider shows 30ft (from selection, not facts)

**When to use capture:**

Use `capture: true` when:
- The var's default references a fact
- That fact changes during evaluation (e.g., consumed resources)
- The user should see/adjust the value they selected

Don't use capture when:
- The var represents a constant or calculation
- The value should always reflect current state

## Activity Types

### numberSet

Sets a fact to a specific value.

```yaml
- type: numberSet
  target: character.hp.current
  source:
    number: 20
```

### numberIncrement

Adds or subtracts from a fact.

```yaml
- type: numberIncrement
  target: character.movement.current
  source:
    var: distance
  subtract: true
```

### numberCopy

Copies a value from one fact to another.

```yaml
- type: numberCopy
  target: character.movement.current
  source:
    fact: character.movement.total
```

### offerRule

Offers a choice to the user.

```yaml
- type: offerRule
  legalWhen:
    - condition:
        fact: character.movement.current
        operator: greaterThan
        value: 0
      illegalDiagnostics:
        - code: no-movement
          severity: error
  rule:
    id: move-walk
    # ... rule definition
```

## Idempotency

The engine is deterministic and idempotent:
- Same input → equivalent output
- Calling `evaluate(output.next)` produces equivalent output

## See Also

- [DATA_MODEL.md](./DATA_MODEL.md) - Core data structures
- [FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md) - Frontend architecture
