# Handoff: W13d — Intent Stack UI

## TL;DR

Replace the current 4-column UI (Stats / Available Choices / Plan / Active Effects) with a **single vertical layout** organized around **player intent verbs** instead of D&D's action-economy categories. The current scroll-and-confuse problem dies because choices are gathered by what the player _wants to do_, not by which action slot they consume; the action-economy survives as a passive **ledger** at the bottom.

This is a **significant restructuring** of the play-character mode UI. The rules engine API doesn't have to change dramatically, but **rules need verb-category metadata** and the engine needs to emit a few new things (cascades, post-turn projection). Plan to do this in phases.

---

## About the design files

`W13d-intent-stack.html` in this folder is a **self-contained reference prototype** built in React/JSX with a hand-drawn-wireframe aesthetic. It is **not production code**. The task is to recreate it in the dnd-planner Svelte codebase using the codebase's existing patterns (Svelte 5 stores, light.css/dark.css color tokens, ARIA conventions, i18n, TDD), and the project's **"D&D in the desert"** visual language — _not_ the b&w pencil-sketch look of the prototype.

Open `W13d-intent-stack.html` in any browser. It works offline.

## Fidelity

**Low-fidelity wireframe.** The layout, components, copy, and behavior are the spec; the b&w sketch styling is _not_. Use the existing color variables in `light.css` / `dark.css`. Typography and visual tone follow the existing app.

---

## The conceptual moves

These are _why_ this works. Internalize them before implementing.

1. **Intent-first organization.** The user thinks "I want to attack and heal myself" — not "I want to spend a bonus action and an action." The UI is organized around **seven intent verbs**:
   - `ATTACK` (hurt), `AID` (help / heal / buff), `CONTROL` (debuff / frighten / stop), `DEFEND` (protect self), `MOVE` (reposition), `INSPECT` (sense / perceive / search), `HANDLE` (config / dismiss / swap / consume)

   Plus **six record verbs** for events the user retroactively logs (the GM tells them something happened):
   - `DAMAGE`, `HEAL`, `SAVE`, `CHECK`, `REST`, `NOTE`

   Plus **two build verbs** for foundational state (rarely touched outside character creation / level-up):
   - `STAT`, `PROFICIENCY`

   `LEVEL` is _not_ a planner verb — it's handled by the existing rule-group UI (attaching a new rule group like `paladin-l2`); cascade effects still happen as normal.

2. **Action-economy demoted to a ledger.** The action / bonus / reaction / move / spell-slot / LoH pool / Channel Divinity budget lives in a **strip at the bottom** showing the _post-turn_ state (remaining after the current draft commits). It's a "am I still legal?" indicator, not the picker.

3. **Action vs reaction confusion dissolves.** A Sentinel reaction-strike sits inside the `ATTACK` verb alongside Greataxe and Javelin-throw. They're alternatives for the same intent; cost chips (`1 ACT`, `1 BON`, `1 RXN`) decorate each option. The user picks by _what they want to do_, not by _which slot it consumes_.

4. **Plan stack mixes intents and events.** Three groups of rows live in the same vertical list:
   - **Plan rows** (`ATTACK`, `AID`, `CONTROL`, `DEFEND`, `MOVE`, `INSPECT`, `HANDLE`) — "what I'm doing this turn"
   - **Event rows** (`DAMAGE`, `HEAL`, `SAVE`, `CHECK`, `REST`, `NOTE`) — "what happened that I'm recording"
   - **Build rows** (`STAT`, `PROFICIENCY`) — "foundational state I'm setting" (rare; mostly at char-create / level-up)

   All three groups use the same row shape and the same `↕ drag` / `↺ undo` controls. The verb name does the heavy lifting; event rows take a subtly different background to signal "recorded" (use a theme-token tint, **not** a hardcoded color).

5. **No "auto" anywhere.** The app has no view of game state (the GM isn't using it). Everything is **player-entered**. The vocabulary uses "RECORDED" not "AUTO." When an active effect needs attention, the app gives a **reminder** (chip pulses with `!`, suggested wording to relay to the GM); the user records the GM's ruling.

6. **Everything is reversible until End Turn.** Every plan row — including damage and save events — has `↺ undo`. The GM rules "oops, that attack missed" → tap `↺` on the DAMAGE row → engine re-cascades from that point, HP returns, concentration restores. Once **End Turn** commits, the steps freeze (a short "recently committed" buffer can still un-do, but the primary undo guarantee is _before End Turn_).

7. **Illegal options stay visible with an explanation.** When a choice is currently illegal (e.g., Divine Smite while Searing Smite holds concentration), the option renders dim/dashed with a `(!) why` tag stating the reason. A `👁 show illegal` toggle (preserving the existing eye-icon affordance from the current 4-column UI) lets the user hide them entirely if they prefer. **Never silently drop illegal options** — the user should always be able to see what they _can't_ do and _why_.

8. **Active state = standing intents from past turns.** The strip at the top showing ongoing effects (Searing Smite, Bless from ally, Divine Sense, Belt of Giant Str) isn't a separate concept — it's earlier intents still firing. Effects that affect _this turn's_ choices auto-attach as `↑FX` rider chips on the relevant intent (e.g., Bless adds `+d4` to ATTACK).

9. **Events cascade through the engine.** Recording a DAMAGE event triggers HP change, concentration save, possible effect ending — all rendered as indented `↳` consequences under the row. One event entry handles a whole cascade, not three separate entries.

---

## Layout structure (top → bottom)

```
┌──────────────────────────────────────────────────────────────────────┐
│  TopBar                                                              │
│  [Name · Class · Lvl]  [HP 24/26 ▬]  [AC 18]  [SPD 30]              │
│  [🔗 CONC · Searing Smite]  [STR+3 · DEX+1 · CON+2 …  ▾]   [menu ≡] │
├──────────────────────────────────────────────────────────────────────┤
│  ACTIVE STATE · STANDING FROM PAST TURNS                             │
│  [EffectChip] [EffectChip⌛] [EffectChip!] [EffectChip] [EffectChip] │
├──────────────────────────────────────────────────────────────────────┤
│  THIS TURN I WANT TO…                                                │
│                                                                      │
│  ┌──────────┬──────────────────────────────────────────────────┐    │
│  │ DAMAGE   │  5 from Gob 1 attack          (during their turn)│    │
│  │ RECORDED │  AMOUNT  [─●─────] 5 of 30 dmg                  │    │
│  │ ↕ · ↺    │  ↳ HP: 26 → 21                                  │    │
│  │          │  ↳ Conc save: CON 14 vs DC 10 → passed          │    │
│  │          │  ↳ Searing Smite held ✓                         │    │
│  └──────────┴──────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────┬──────────────────────────────────────────────────┐    │
│  │ AID      │  Lay on Hands (5 hp)           [1 BON] [5 LoH]  │    │
│  │ ↕ · ↺    │  HEAL  [─●─────] 5 of 15 hp                     │    │
│  └──────────┴──────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────┬──────────────────────────────────────────────────┐    │
│  │ MOVE     │  Walk                                  [30 MOV] │    │
│  │ ↕ · ↺    │  DIST  [────────●] 30 of 30 ft                  │    │
│  └──────────┴──────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────┬──────────────────────────────────────────────────┐    │
│  │ ATTACK   │  Greataxe ⚔                            [1 ACT]  │    │
│  │ ↕ · ↺    │  [↑FX ✓ Bless +d4] [↑FX ✓ Searing +d6] [✓ Cleave]│   │
│  │ (primary)│  [Divine Smite] [Heroic Insp.]                  │    │
│  │          │  ⚀ d20+5+d4 to hit  ⚀ d12+3+d6 dmg  ⚀ d12+3 cl │    │
│  │          │  PREVIEW: d12+3 slash + d4 Bless + d6 fire …    │    │
│  └──────────┴──────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌── ─ ─ ─ ─┬── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐    │
│  │ DEFEND   │  Unarmed Strike (Sentinel)             [1 RXN] │    │
│  │ off-turn │  ⚀ d20+5 to hit  ⚀ d0+3 dmg                    │    │
│  │ ↕ · ↺    │  fires when enemy disengages                   │    │
│  └──────────┴──────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ + ADD                                                          │  │
│  │   plan →   [ATTACK][AID][CONTROL][DEFEND][MOVE][INSPECT][HANDLE]│  │
│  │   record → [DAMAGE][HEAL][SAVE][CHECK][REST][NOTE]              │  │
│  │   build →  [STAT][PROFICIENCY]              👁 show illegal · on│  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                              [ End Turn ▸ ]         │
├──────────────────────────────────────────────────────────────────────┤
│ LEDGER · after end-turn ▾                                            │
│ ACT 0/1  BON 0/1  RXN 0/1  MOV 0/30  L1 1/2  LoH 10/15  CD 1/1      │
└──────────────────────────────────────────────────────────────────────┘
```

### Sizing notes (tablet landscape baseline ~1280×800)

- TopBar: ~50–60px tall, single row, `flex-wrap` for narrower devices
- Active state strip: ~110–130px, horizontal flex; consider horizontal scroll if >5 effects
- Plan stack: flexible, fills remaining space
- Ledger: ~50px, pinned at bottom via flex layout (do not use fixed grid heights — caused clipping in earlier iteration)

---

## Verb vocabulary (two-level)

Each verb's options live in named sub-buckets. The same grouping shows in two places: the `+ ADD` picker expansion when creating a row, and the `OR INSTEAD` panel inside an already-placed row.

### plan →

| Verb      | Sub-buckets and example options                                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ATTACK`  | **weapons** → Greataxe · Javelin melee · Javelin thrown · Unarmed Strike. **spells** → Command (forced damage) · Searing Smite cast · Thunderous Smite cast                                    |
| `AID`     | **self** → Lay on Hands · Sanctuary on self. **ally** → Cure Wounds · Heroism · Bless · Sanctuary on ally · Help action. **area** → (reserved)                                                 |
| `CONTROL` | **single** → Command · Abjure Enemy · Grapple · Shove-prone. **area** → Sleep                                                                                                                  |
| `DEFEND`  | **evade** → Dodge · Disengage. **ward** → Shield (L1) · Sanctuary self. **ready** → Sentinel reaction strike · Ready custom (trigger + reaction)                                               |
| `MOVE`    | **walk** → Walk · Crawl. **hustle** → Dash · Disengage. **special** → Climb · Jump · Swim                                                                                                      |
| `INSPECT` | **sense** → Divine Sense · Detect Magic. **check** → Perception · Investigation · Insight · Search                                                                                             |
| `HANDLE`  | **gear** → Equip/Doff · Draw/Sheathe · Drop · Pick up. **consume** → Drink potion · Read scroll. **effects** → Dismiss \<effect> · Drop concentration. **spells** → Prepare spells (long rest) |

### record →

| Verb     | Sub-buckets and structure                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DAMAGE` | **source** → from enemy attack · environmental · fall · trap · other. _Slider for amount; cascade includes HP delta and any conc save._                                                    |
| `HEAL`   | **source** → potion · ally's spell · feature (Second Wind etc.) · other. _Slider for amount._                                                                                              |
| `SAVE`   | **others** → dynamically populated from active effects on others requiring a save (e.g., Sleep · Gob 1). **you** → STR · DEX · CON · INT · WIS · CHA (when GM prompts you to make a save). |
| `CHECK`  | **skill** → Athletics · Arcana · Insight · Perception · Religion · Stealth · … (auto-pulls proficiency state). **raw** → STR · DEX · CON · INT · WIS · CHA.                                |
| `REST`   | **type** → Short · Long. _One-level toggle._                                                                                                                                               |
| `NOTE`   | _No sub-buckets; opens a text field for flavor / RP recording (no mechanics, no cascade)._                                                                                                 |

### build →

| Verb          | Sub-buckets                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `STAT`        | **ability** → STR · DEX · CON · INT · WIS · CHA. Slider sets value; cascade re-derives AC, save mods, etc. |
| `PROFICIENCY` | **category** → Skill · Save · Weapon · Armor · Tool · Language. Tap a category to reveal specific options. |

Multi-tagging is normal. Sanctuary tags `AID` and `DEFEND`; Disengage tags `MOVE` and `DEFEND`; Searing Smite tags `ATTACK` (the cast) and `HANDLE` (the dismissal). The user sees it in every applicable verb's option list.

### Rules engine implication: verb tagging (schema change)

Add `ui.intents[]` (array of verb codes) and `ui.actionCost[]` (array of cost tags) to the **rule schema** — not just the rule data. The schema type files need new fields; the lint that enforces required-fields needs to learn about them; existing rules need values backfilled.

```yaml
# Example: existing rule extended
- id: greataxe.attack
  ui:
    section: 'Action -> Attack' # existing
    name: play.action.greataxe # existing
    model: attack # existing
    intents: [ATTACK] # NEW — verbs this rule fulfills
    actionCost:
      [action] # NEW — array of cost tags (a single rule may carry several:
      #       e.g. Searing Smite cast is [bonus, L1]; an action that
      #       also requires concentration tagged [action, conc]).
      #       UI hint for cost chips only. The engine doesn't budget
      #       from this — budget comes from actual resource consumption
      #       in the rule's effects.
```

The planner verbs `STAT`, `PROFICIENCY`, `DAMAGE`, `HEAL`, `SAVE`, `CHECK`, `REST`, `NOTE` are **built-in to the planner** (not rule-driven); they always appear in `+ ADD`.

---

## Component specifications

### TopBar

A horizontal strip with character identity + always-visible stats. Replace the existing top-bar (play character mode).

- **Identity**: name + species + class + level. Use existing i18n strings.
- **HP chip**: numeric `cur/max` plus a thin progress bar. Updates live as DAMAGE / HEAL events are recorded.
- **AC, SPD chips**: simple value chips.
- **🔗 CONC chip**: shows the name of the spell currently held with concentration (if any). Tap → expands to manage (drop, etc.). Empty state: "🔗 — no conc".
- **Abilities chip**: collapsed view shows the six modifier line "STR+3 · DEX+1 · CON+2 · INT+0 · WIS−1 · CHA+3 ▾". Tap → expand to full stat block.
- **Menu**: existing user dropdown (Gravatar, logout, version).

### ActiveStateStrip

Horizontal flex row of `EffectChip` components. Header line: `ACTIVE STATE · N STANDING`. Each effect is a card-shaped chip.

### EffectChip

~170–200px wide. Contains:

- Top-left: kind tag (`CONC` / `ONGOING` / `SENSE` / `BUFF` / `DEBUFF` / `ITEM`); add `· CONC` suffix when applicable.
- Top-right: dismiss control. Tap → adds a `MODIFY · Dismiss` row to the plan stack (does not immediately remove the effect; see _Dismissal flow_).
- Body: effect name (bold), target line ("→ Gob 1" or "→ you · +d4 atk"), source line ("via ally Lyra" if cast by someone else).
- Footer: duration pips + "N left" / "N rounds".

**Three urgency states**:

- **Rest**: default; no badge.
- **Pending (`!`)**: a circular `!` badge at top-left, background tinted (#fef0e3). Used when something the user must resolve has happened (e.g., target's end-of-turn save against your effect). Reminder copy: _"⚠ save needed · Tell GM: \"Goblin saves vs DC 13 CON?\""_. Tap → resolver popover with `[✓ saved]` `[✗ failed]` buttons; choosing one inserts a `SAVE` event row.
- **Expiring (`⌛`)**: hatched diagonal background, `⌛ EXPIRES` corner badge. Triggered when remaining duration is 1.

### PlanStack

Vertical container of `PlanRow` components in chronological order (oldest events first, then planned actions, then off-turn DEFEND last). Has an `+ ADD` picker at the bottom.

### PlanRow

Two-column grid: ~110px verb stripe on the left, content on the right.

**Verb stripe (left):**

- Verb label (e.g. `ATTACK`).
- For event rows: small `RECORDED` sub-label.
- For modifier rows sourced from an active effect: `from ↑ effect` caveat.
- Controls hint: `↕ · ↺`.
- Background: `ink` when `primary` (one row is the user's current focus), else `paper-2`.

**Content (right):**

- Top line: chosen option name (e.g., "Greataxe ⚔") + cost badges (`1 ACT`, `1 BON`, `1 RXN`, `1 L1`, `n LoH`, `n MOV`).
- Sub-line: a one-line description in caveat/hand font.
- (Plan rows) Alternatives row: "OR INSTEAD" with 2–3 alternative options (collapsed when not in focus).
- (Plan rows) Modifier chips: user-toggleable (Cleave, Divine Smite, Heroic Inspiration). Auto-attached effect riders get `↑FX` label and an inner ring outline.
- Inline control: a slider OR dice rollers, see _Inline controls_.
- Preview line (ATTACK): composed damage formula.
- Cascade list (event rows): indented `↳` consequence list.

**Variants:**

- `primary` — current focus, larger fonts, paper-2 bg.
- `event` — cream-tinted bg (#fef0e3); appears in the "record →" group.
- `offturn` — dashed border + diagonal hatch background; for DEFEND reactions and ready actions.
- `collapsed` — hide alternatives; show only the chosen option.

### Inline controls

The interactive control inside a row is determined by the **rule's `ui.model`** (existing field in the schema), not by the verb. A healing spell (`ui.model: 'spell'`) and Lay on Hands (`ui.model: 'amount'`) are both `AID` rows but use different controls; a Greataxe attack and a Javelin throw are both `ATTACK` rows with `ui.model: 'attack'` but their formulas differ. Reuse the existing model dispatch — don't switch on verb.

| Row source                                                       | Control                                                                                                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule with `ui.model: 'move'`                                     | Slider, 0–max distance (existing model).                                                                                                                       |
| Rule with `ui.model: 'amount'` (pool-driven, e.g., Lay on Hands) | Slider, 0–pool size; cost badges live-update.                                                                                                                  |
| Rule with `ui.model: 'attack'`                                   | Dice rollers: to-hit formula, damage formula, plus rider extras (Cleave, Smite).                                                                               |
| Rule with `ui.model: 'spell'`                                    | Spell-specific control set (typically dice rollers for damage/save DC; healing spells use a heal roller).                                                      |
| Rule with `ui.model: 'toggle'` / no model                        | No control beyond `↺ undo` (e.g., Dodge, Disengage).                                                                                                           |
| **Planner-built verbs** (no rule)                                | DAMAGE / HEAL / STAT → slider. REST → short/long toggle. SAVE / CHECK → dice roller + outcome buttons. NOTE → text field. PROFICIENCY → category + key picker. |

The sliders update the row's cost badges live (`5 LoH` → `10 LoH` as the slider moves) and the engine recomputes the ledger after each change. **No new schema fields needed for this** — `ui.model` is already in the spec; the new layout just rehouses the existing models inside intent rows.

### ModChip

Pill-shaped modifier toggle. Two variants:

- **User-toggleable** (default): plain border, checkmark when on.
- **Effect-sourced** (`fromEffect`): `↑FX` letterpress label at the start, inner-ring outline. Typically auto-checked and tied to the effect; tapping it dismisses the underlying effect (or removes the rider if the effect is multi-target). Illegal modifiers (e.g., Divine Smite when no L1 slot) get a dashed border + muted color.

### AddRowPicker

A dashed-border container with **three labeled groups** of verb chips (plan → / record → / build →). Plan verbs use plain chips; record verbs use the event-row tint; build verbs are slightly dimmed (rare use). Tapping a verb **expands its sub-buckets inline below the picker** (accordion-style) — the same two-level structure shows up in the row's `OR INSTEAD` panel when swapping alternatives. The picker also carries the `👁 show illegal` toggle.

### Ledger

A pinned-bottom strip showing the **post-turn resource state**. Cells: `ACT`, `BON`, `RXN`, `MOV`, `L1` (and other spell slot levels), `LoH`, `CD` (Channel Divinity), plus any per-character resources from `ui.stats[]`. Each cell shows `remaining/max`. Cells with full remaining + no spend get muted (40% opacity). If the plan would overspend any resource, the ledger turns warn (cream-red bg, `⚠ over budget` scrawl).

### Slider

A horizontal slider with a track, fill, thumb, and value+max readout. Plain pencil styling in the wireframe; use existing desert palette in production.

### Dice button

A clickable pill with `⚀ formula label` content. On click → roll the formula, append result to a roll log or surface inline (existing roll behavior in the codebase).

---

## User flows

### Flow A — Planning an intent

1. User taps `+ ADD → plan → ATTACK`.
2. A new ATTACK row appears with the engine's best-default option pre-selected (e.g., Greataxe).
3. The row's modifier chips list user-toggleable riders (Cleave, Divine Smite, Heroic Inspiration) plus any auto-attached effect riders (Bless `↑FX`, Searing Smite `↑FX`).
4. User toggles Cleave on, Divine Smite on. Ledger updates: `L1: 2/2 → 1/2`.
5. Dice rollers show the composed formula; user can roll any time.

### Flow B — Recording damage taken

1. GM tells the user "you take 15 damage from the goblin."
2. User taps `+ ADD → record → DAMAGE`.
3. A new DAMAGE row appears with slider defaulted to a reasonable starting value.
4. User drags slider to 15.
5. Engine cascades: HP 26→11 displayed; concentration check triggered (CON DC 15); save result populated from rolling button or manual entry; if failed, concentration drops and the held effect is removed from active state.
6. Cascade shown as indented `↳` lines on the row.
7. If GM later says "oops, undo that" → user taps `↺` on the DAMAGE row → entire cascade reverses (HP restored, conc restored, effect re-added to active state).

### Flow C — Resolving a target's save (reminder-driven)

1. End of the goblin's turn approaches; the Searing Smite chip in active state shows `!` pulse.
2. User taps the chip → resolver popover opens with copy: _"⚠ Save needed · ✉ Tell GM: 'Goblin saves vs DC 13 CON?'"_ and buttons `[✓ saved]` `[✗ failed]`.
3. User tells the GM, GM rules "saved", user taps `[✓ saved]`.
4. A `SAVE` event row is inserted into the plan stack with the resolution recorded; cascade ends the Searing Smite effect; concentration anchor in TopBar updates.
5. The chip on the active state strip strikes through and is removed at the start of the next turn (or immediately if preferred).
6. Reversible via `↺` on the SAVE row.

### Flow D — Scheduling a dismissal

1. User wants to drop Searing Smite to free their concentration for a new spell.
2. User taps `✕` (dismiss control) on the Searing Smite effect chip.
3. The chip enters a "scheduled to dismiss" state: diagonal strike-through pattern, `↘ DISMISSING` corner badge, the `✕` becomes `↺ undo`.
4. A new `HANDLE · Dismiss Searing Smite` row appears at the top of the plan stack with a `NEW` tag, `from ↑ effect` caveat in the verb stripe, and "free your concentration · no action cost" sub.
5. Ledger and effect-rider state recompute: Divine Smite is no longer competing for concentration → its illegal modifier on ATTACK becomes legal (`🔓` unlock indicator).
6. Cascading downstream changes (the +d6 fire rider on ATTACK disappears because Searing Smite is going away) reflect in the ATTACK row preview.
7. If user changes mind → tap `↺ undo` on the HANDLE row → everything reverts.

### Flow E — End turn

- Commit the plan: events become permanent (still un-doable for a short window, but the active state strip + character resources advance to the post-turn state).
- The plan stack clears, ready for the next turn.
- A "turn log" record is kept for later review.

---

## Rules engine contract

The existing engine returns: `availableRules`, `resources`, `stats`. This needs **additive** changes (the existing 4-column code can keep working during migration).

### Plan = ordered list of Steps; verb is a UI tag, not a payload key

There is **one** `Step` shape. The verb categorizes the row for the picker and applies the row's visual treatment — nothing about the payload or the control comes from the verb. **Everything mechanical dispatches through the rule's `ui.model`.**

The planner-built verbs (DAMAGE / HEAL / SAVE / CHECK / REST / NOTE / STAT / PROFICIENCY) are not special-cased anywhere — they're **regular rules in a built-in default rule group** (something like `core-events`, possibly already in the existing seed data) that ships attached to every character. The engine has no concept of "planner-built" vs "user-authored"; every Step references a rule, every rule has a `ui.model`, every model has a dispatch.

```ts
// One uniform Step shape
type Step = {
  id: string; // stable; used for undo and drag-reorder
  verb: Verb; // UI grouping only — which picker group, which stripe label, which tint
  ruleId: string; // points to a real rule (user-authored OR from the core-events rule group)
  modelSelections: unknown; // shape determined by the resolved rule's ui.model (existing dispatch)
  riderIds?: string[]; // attached modifier rules (e.g. Cleave / Divine Smite on an ATTACK)
  recordedAt: ISO8601;
};

type Verb =
  | 'ATTACK'
  | 'AID'
  | 'CONTROL'
  | 'DEFEND'
  | 'MOVE'
  | 'INSPECT'
  | 'HANDLE'
  | 'DAMAGE'
  | 'HEAL'
  | 'SAVE'
  | 'CHECK'
  | 'REST'
  | 'NOTE'
  | 'STAT'
  | 'PROFICIENCY';
```

#### What the verb is for

The verb is **purely a UI hint** carried on the step:

- Which picker group the row appears under (`plan → / record → / build →`).
- Which verb label appears on the row's stripe.
- Which tint the row gets (paper for plan rows, event-row tint for record rows, etc.).

It is **not** the source of:

- The payload shape — that's `ui.model`.
- The inline control — that's `ui.model`.
- Legality — that's the engine's rule evaluation.
- The action-economy cost — that's `ui.actionCost[]` on the rule (array; multiple tags allowed).

Note that a rule with multiple intents (Sanctuary tagged `[AID, DEFEND]`) appears in **both** picker buckets. When the user adds it from the DEFEND bucket, the step's verb is `DEFEND`; from AID, it's `AID`. The payload, control, cost, and cascade are identical — only the UI labeling differs.

#### The core-events rule group

The verbs that record events or set foundational state need rules to back them. Check whether a rule group like `core-events` (or equivalent) already exists in the seed data; if so, extend it. If not, add one. Either way it's **a normal rule group** — the engine treats it identically to `paladin-l1` or any user-authored group:

```yaml
# Rules in the core-events rule group (or wherever the planner-required
# rules live in your seed data). These are regular rules.
- id: damage.taken
  ui:
    intents: [DAMAGE]
    actionCost: [] # empty array — records don't spend action economy
    model: amount # → slider control; modelSelections = { amount, source?, type? }
    name: planner.record.damage

- id: save.made
  ui:
    intents: [SAVE]
    actionCost: []

- id: stat.set
  ui:
    intents: [STAT]
    actionCost: []
    model: ability-value # → slider 8–20 with ability picker
    name: planner.build.stat
```

When a planner verb needs a `ui.model` that doesn't already exist (`roll-outcome`, `text` for NOTE, `ability-value` for STAT, `category-key` for PROFICIENCY), **add the model to the engine's dispatch alongside the existing ones** — same mechanism, same lifecycle, no special path.

### Schema updates (not just data)

These fields need to be added to the TypeScript types AND to the YAML/JSON rule schema validators:

- **Rule schema**: add `ui.intents: Verb[]` and `ui.actionCost: ActionCost[]` as **required** fields on every rule (`actionCost: []` for zero-cost rules — the array can be empty but the field is required). The data linter must catch missing values.
- **Step type**: extend the union as above. Old plan steps that don't carry a `verb` get migrated (every existing step has an implicit verb derivable from its `ui.section`).
- **Effect / standing-state types**: add `pendingResolution?` and `expiringSoon: boolean` (see below).

### New on output (Engine response)

Note that **the engine is stateless and pure**: given the ordered list of steps, it returns the resulting character state. There is no "before" or "after" — the engine _always_ returns the resulting state. The UI's notion of "undo" is simply not sending a step. The UI's notion of "End Turn" is moving steps between client-side lists (draft vs committed); the engine concatenates both lists and computes one state from the result.

- For each rule in `availableRules`: `ui.intents[]` and `ui.actionCost[]` (above).
- **Riders come from the existing annotation mechanism.** Rules can declare annotations that target other rules — Divine Smite annotates "all weapon attacks: + d8 radiant on hit"; Bless annotates "this character's attack rolls: +d4". The annotated rule (Greataxe attack) never needs to know about the annotators. The engine resolves annotations during rule evaluation and exposes the merged result; the UI renders resolved annotations as rider chips on the target row. **Do not invent an `effectiveRiders[]` field** — the annotation pattern already does this.
- **Effect duration uses the existing `var` mechanism**, not a special flag. An effect rule declares a `var` (e.g. `effect.searing-smite.duration_left`) that decrements each round; the UI reads the var and renders the near-expiry treatment when the value reaches 1. **Do not invent an `expiringSoon: boolean`** — use the var-based engine→UI contract that already exists.
- For each active effect: `pendingResolution?: { kind: 'save', ability, dc, target, when }` — surfaces the `!` reminder on the chip. (This could itself be a var — worth confirming with the existing engine contract before adding it as a dedicated field.)
- For each rule and rider: use the existing `legal: boolean` and `illegalReason?: string` (i18n key) — used to render the `(!) why` tag on dim options.

### Undo

The engine state is **a pure function of the ordered step list**. Undo is just the UI removing a step from the list it sends to the engine — no special unwind logic. The undo window is _before_ End Turn; once committed, the UI moves the step into a separate "committed" list, and a short window keeps it removable. After the window closes, the step is permanent (still part of the input list, just no longer mutable from the UI).

For the engine, none of this matters — it sees one ordered list of steps and computes the resulting state.

### Cascade computation

"Cascade" is also a UI concern, not a separate engine pass. When the UI adds a step, it sends the new ordered list; the engine returns the updated state. The UI compares the new state to the previous one and renders the differences as `↳` lines under the row that caused them. Examples of what shows up:

- HP delta after DAMAGE
- Concentration save outcome from an effect rule's evaluation
- An effect ending because its duration reached zero (the rule simply isn't in the result anymore)
- A rider chip disappearing because an annotating effect ended

String templating uses i18n keys, applied by the UI.

---

## Phased task breakdown

Pick a phase, complete it, ship it behind a **user-menu UI selector** ("Classic" ↔ "Intent" mode, persisted to user prefs). Both layouts coexist until the new one reaches parity.

### Phase 0 — Engine prep (TypeScript rules engine + rule data + schema)

| ID  | Task                                                                                                                                                | Acceptance                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 | **Update the rule schema** (TypeScript types + validators) with `ui.intents: Verb[]` + `ui.actionCost: ActionCost[]`. Then tag every existing rule. | Schema type checks; validator rejects rules missing the new fields; all rule data files updated                                                        |
| 0.2 | Extend `Step` to a discriminated union by `verb` (all 15 verbs)                                                                                     | Plan can serialize/deserialize all step kinds; migration handles legacy steps                                                                          |
| 0.3 | Annotation resolution exposes merged riders                                                                                                         | Bless active → attack rules' resolved annotations include `+d4`; UI shows it. **Use existing annotation pattern, do NOT add a separate riders field.** |
| 0.4 | Effect duration via `var`                                                                                                                           | Effects declare a `duration_left` var; UI reads it for near-expiry treatment. No `expiringSoon` flag.                                                  |
| 0.5 | Engine state is pure from step list (already true)                                                                                                  | Removing any step from the input list still produces a correct state. End Turn is a UI concern; the engine just sees the combined list.                |
| 0.6 | Surface `pendingResolution` for effects requiring a player action                                                                                   | Searing Smite at end-of-target-turn surfaces a pending save (probably also a var if that fits the existing engine contract)                            |
| 0.7 | Add `legal` + `illegalReason` per rule + rider in the engine response                                                                               | Engine flags illegal options and provides i18n keys for _why_                                                                                          |
| 0.8 | Pure-function step list → state                                                                                                                     | Removing any step from the middle of the list still produces a correct state                                                                           |

### Phase 1 — Layout shell (Svelte)

| ID  | Task                                                                                      | Acceptance                                                                                    |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1.1 | **User-menu UI selector**: "Classic" ↔ "Intent" in user dropdown, persisted to user prefs | Both layouts render based on selection; switching has immediate visual effect                 |
| 1.2 | New play-character-mode layout: TopBar / ActiveStrip / PlanStack / Ledger                 | Vertical flex layout; ledger pins to bottom; no clipping at any viewport                      |
| 1.3 | TopBar with stats chips (HP, AC, SPD, Conc, Abilities)                                    | Reads from existing stats data; chips render with desert theme                                |
| 1.4 | Ledger component (renders current engine state, not a separate "post-turn" thing)         | All cells render from the engine response; mute when full + no spend; warn state on overspend |

### Phase 2 — Effect chips + active state strip

| ID  | Task                                      | Acceptance                                                             |
| --- | ----------------------------------------- | ---------------------------------------------------------------------- |
| 2.1 | `EffectChip` component, all three states  | Rest / pending / expiring render correctly; ARIA labels for each state |
| 2.2 | `ActiveStateStrip` rendering all effects  | Empty state ("no standing effects"); horizontal layout                 |
| 2.3 | `🔗 CONC` link from chip to TopBar anchor | Concentration spell name shows in both places; updates as plan changes |
| 2.4 | Reminder resolver popover                 | Tapping `!` chip opens popover with "Tell GM" copy + outcome buttons   |

### Phase 3 — Plan row + two-level verb picker

| ID  | Task                                                                            | Acceptance                                                                     |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 3.1 | `PlanRow` Svelte component (verb stripe + content)                              | Reusable; supports primary/event/build/offturn/collapsed variants              |
| 3.2 | `ModChip` with three variants                                                   | User-toggleable, effect-sourced (`↑FX`), and **illegal with `(!) why` tag**    |
| 3.3 | `AddRowPicker` with **plan→/record→/build→** groups and **two-level expansion** | All 15 verbs available; tapping a verb expands its sub-buckets inline          |
| 3.4 | Rule-to-verb mapping logic                                                      | Greataxe shows under ATTACK; Lay on Hands under AID/HEAL; etc.                 |
| 3.5 | **Default option per verb**: any legal option for v1                            | Tapping ATTACK pre-fills _any_ legal attack — do not invent a heuristic for v1 |
| 3.6 | **`👁 show illegal` toggle** preserving the current eye-icon affordance         | Toggle shows/hides illegal options in pickers and alternatives lists           |

### Phase 4 — Inline controls

| ID  | Task                                                          | Acceptance                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | `Slider` Svelte component                                     | Keyboard accessible; value + max readout; live-updates row cost badge                                                                                                                                        |
| 4.2 | `Dice` button (formula + label)                               | On click, fires existing roll logic / posts result to log                                                                                                                                                    |
| 4.3 | Wire controls into row types via existing `ui.model` dispatch | Lay on Hands (`ui.model: 'amount'`) uses pool slider; Cure Wounds (`ui.model: 'spell'`) uses healing roll; Greataxe (`ui.model: 'attack'`) uses dice rollers; planner-built rows use the fixed mapping above |

### Phase 5 — Event recording

| ID  | Task                                                                                        | Acceptance                                                               |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 5.1 | DAMAGE / HEAL rows with slider + cascade                                                    | Slider amount → HP/conc cascade in `↳` list; reversible via `↺`          |
| 5.2 | SAVE row created from resolver popover OR `+ ADD` (broadened from target-saves to any save) | Tapping outcome inserts row; effect updates                              |
| 5.3 | CHECK row                                                                                   | Skill / raw-ability picker; rolled result; no cascade by default         |
| 5.4 | REST row (short/long toggle)                                                                | Resources restore according to rest type; reuses existing rest mechanism |
| 5.5 | NOTE row                                                                                    | Text field; no cascade; ARIA labelled as informational                   |

### Phase 6 — Dismissal flow + HANDLE-effects

| ID  | Task                                            | Acceptance                                                               |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| 6.1 | Effect chip `✕` schedules a HANDLE-Dismiss row  | Chip enters "scheduled" visual state; HANDLE row appears at top of stack |
| 6.2 | Cascade unlocks (e.g., Divine Smite re-enables) | ATTACK row's modifier chips re-evaluate when conc is freed               |
| 6.3 | `↺ undo` reverts dismissal                      | Chip returns to rest state; cascading riders restore                     |

### Phase 7 — Build verbs (STAT + PROFICIENCY)

| ID  | Task                                                                    | Acceptance                                                        |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 7.1 | STAT row with ability picker + slider                                   | Setting STR = 15 cascades to AC, attack mods, str-save, athletics |
| 7.2 | PROFICIENCY row with category + key picker                              | Adding skill proficiency cascades to relevant skill rolls         |
| 7.3 | Foundational effects show in Active State strip when "show all" toggled | Default hidden; toggle in strip header reveals BASE / PROF chips  |

### Phase 8 — Undo + reversibility hardening

| ID  | Task                                                                    | Acceptance                                                  |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| 8.1 | Every plan row supports `↺ undo` pre-End-Turn                           | Row removal triggers engine recompute; UI updates in <100ms |
| 8.2 | "Recently committed" buffer keeps undo available briefly after End Turn | Configurable window; undo visible until window closes       |
| 8.3 | Undo never loses user data unexpectedly                                 | Tested with rapid add-undo-add cycles                       |

### Phase 9 — Polish + parity

| ID  | Task                                             | Acceptance                                                                               |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 9.1 | Concentration leash visual line                  | Subtle line connects CONC chip to TopBar `🔗 CONC` anchor                                |
| 9.2 | Near-expiry hatching + `⌛` badge                | Effects with 1 round left flagged correctly                                              |
| 9.3 | Off-turn DEFEND row styling                      | Dashed border + diagonal hatch background                                                |
| 9.4 | Damage preview composition                       | ATTACK row's preview line correctly composes base + Bless + Smite + Cleave               |
| 9.5 | Empty states                                     | "No standing effects" / "No plan rows yet — tap + ADD" messaging                         |
| 9.6 | Tablet + phone responsive layout                 | All chips wrap; sliders shrink gracefully                                                |
| 9.7 | a11y audit                                       | All ARIA roles correct; full keyboard nav; tested with NVDA / VoiceOver                  |
| 9.8 | i18n: verb labels + event copy + illegal reasons | All 15 verbs translatable; "Tell GM" copy translatable; all illegal-reason strings keyed |

### Phase 10 — Cleanup

| ID   | Task                                                      | Acceptance                                                             |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| 10.1 | Remove old 4-column components behind the selector        | StatsColumn / ChoicesColumn / PlanColumn / ActiveEffectsColumn deleted |
| 10.2 | Refactor `ChoicePanel.svelte` (TODO from existing README) | Split per row variant; rule-specific UI lives with rules data          |
| 10.3 | Remove the UI selector once Intent reaches parity         | Single code path                                                       |
| 10.4 | Update FRONTEND_DESIGN.md to reflect new layout           | Docs match implementation                                              |

---

## Existing codebase touchpoints

The dev should read these files in the repo before starting:

- **`README.md`** — overall architecture, goals, technology choices.
- **`FRONTEND_DESIGN.md`** — UI conventions (light.css/dark.css color tokens, ARIA, i18n, "D&D in the desert" aesthetic, TDD via Svelte). **Read first.**
- **`DATA_MODEL.md`** — character / plan / step / effect entities.
- **`RULES_ENGINE.md`** — the rules engine contract this design extends.
- **`AGENTS.md`** — agent / contributor conventions.
- **`src/`** — Svelte components. Note `ChoicePanel.svelte` is flagged as a refactor candidate in the existing TODO list (good — the intent stack lets us delete it).
- **`static/`** — assets.

The "TODO" section at the bottom of the README lists many feature gaps (Spells, Cleave-per-turn limit, etc.); the intent stack design _doesn't_ implement those — it provides the surface where they'll land cleanly.

---

## Visual / styling notes

The wireframe uses a hand-drawn b&w pencil look for clarity. **Production must use the existing dnd-planner "D&D in the desert" theme**:

- Colors come exclusively from `light.css` and `dark.css`. **No new colors, no hardcoded hex values, no `filter:brightness()` tricks.**
- Where the wireframe uses a tint to mark "recorded event" rows (or the warn-state ledger, or the "freed" cascade highlight), pick an **existing theme token** for that role. If no suitable token exists for a new role, **add a token to `light.css` / `dark.css`** with a semantic name (e.g., `--color-row-event-bg`, `--color-ledger-warn-bg`) — do not inline a hex.
- Use existing typography choices.
- Keep the existing tablet-first design philosophy; tap targets ≥ 44px.
- Inline styles forbidden (per existing rules) — translate the wireframe's inline styles to CSS classes.

The wireframe's specific hex values are illustrative only — they map to roles, not literal colors. Don't reuse them in production CSS.

---

## Files in this handoff

| File                     | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `README.md`              | This document                                                   |
| `W13d-intent-stack.html` | Standalone single-file HTML reference prototype (works offline) |
| `W13d-screenshot.png`    | Static reference image                                          |

The HTML prototype is **self-contained** — no external dependencies once downloaded. Open in any modern browser. Resize the viewport to see how it might fall back at narrower widths (the prototype is rigid at 1280×800; production should be responsive).

---

## Questions to escalate, not assume

A handful of decisions in this design haven't been pressure-tested. Bring them back to the designer rather than guessing:

1. **Smart defaults per verb.** v1 picks _any_ legal option for the verb's default — no heuristic. v2 could explore most-recently-used, highest-EV, or manually-pinned defaults. Confirm v1 stance with the designer.
2. **Verb taxonomy edge cases.** Multi-tagged options (Sanctuary as AID + DEFEND, Disengage as MOVE + DEFEND, Shove as ATTACK + CONTROL + MOVE) appear under all applicable verbs. Confirm that's preferred over picking a primary.
3. **Saved combos / macros** (was wireframed as W10). Not in this handoff; defer until intent stack ships.
4. **Multi-target effects** (e.g., Sleep on two goblins). Current chip shows a target line; per-target sub-cards parked as v2.
5. **Auto-suggest based on character state.** "HP low → suggest AID first" — interesting but out of scope for v1.
6. **Build wizards** for character creation and level-up — v2. v1 uses the STAT / PROFICIENCY verbs manually; the rule-group UI handles LEVEL attachments.

---

## How to verify

A done-correct implementation should pass these usability tests with no instructions:

1. New user opens the app on their character's turn. They can plan an attack within 3 taps.
2. User has Searing Smite active. They want to dismiss it to cast Bless. They can do so without leaving the planning surface, and the cascade (concentration freed → Bless legal) is visible.
3. User takes damage during an enemy turn. They record it. Concentration save fires automatically. Effect ends if save fails. All visible in one row.
4. User mis-enters damage as 25 instead of 15. They tap the slider and drag to 15. Everything downstream re-cascades.
5. User can't accidentally lose state. Every action has `↺ undo`.
