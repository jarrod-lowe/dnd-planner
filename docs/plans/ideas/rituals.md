# Rituals

A number of spells can be cast as rituals. We need to come up with how we are going to implement rituals.

Casting a ritual takes an additional 10 minutes, and limit what you can do. We'll need to check what that is - figure that out.

How should we implement this? What interaction should it have with other rules (e.g. should it expire things?).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Spec

Ritual casting. First (only) spell: Detect Magic. SRD 5.2 verified against docs/srd52.txt.

### Rules (SRD 5.2)

- Ritual version: +10 min casting time; expends no slot; spell must be prepared; can't be cast at a higher level (6310–6316, 12019–12028).
- Casting time ≥ 1 min: Magic action every turn + Concentration on the casting itself; broken → spell fails, no slot lost, restart (6392–6399).
- Concentration is single-slot → starting any ritual ends an existing hold, even when the ritual spell isn't C-tagged. A C-tagged ritual then holds concentration normally (Detect Magic does).
- Casting a non-cantrip spell interrupts SR/LR (12036–12042, 11904–11912). `rest → ritual` in one plan is already illegal via the after-rest lock; consistent, no new work.

### Semantics

- Ritual cast of an eligible prepared spell: no slot spend, no upcast. Action cost abstracted away (out-of-combat fiction, same as rests).
- At commit (End Turn):
  - 10 minutes elapse → 1-minute (10-turn) effects end. Includes buffs planned earlier in the same plan (1 min < 10 min). 10-minute-bucket effects are modelled `untilShortRest` and are NOT expired — minutes-aware expiry deferred.
  - Existing concentration ends; Detect Magic then holds concentration (standard replacement flow).
- A ritual row closes the plan: later rows illegal + warning, same treatment as rests today. `ritual → rest` also blocked in-plan (commit twice) — accepted.
- Detect Magic duration: `untilShortRest` (convention per Detect Evil and Good).
- Offered only while prepared (existing prepared-spells gating).

### Data

- Ritual-eligible spells need a machine-readable flag in spell data (`castingTime` is free text; exact field/schema placement open).
- Add Detect Magic: Paladin L1, C+R (srd52.txt:3330–3338); detail text quoted from SRD.

### Out of scope

- Wizard Ritual Adept (spellbook, needn't be prepared) — no wizard class loaded.
- Non-C ritual spells: "ritual breaks concentration anyway" is stated but untested (none loaded).
- Prayer of Healing's 10-minute cast stays a plain Action.
- Minutes-aware expiry kind (revisit when a non-C 10-min spell lands, e.g. Speak with Animals).

### UI design

- Include a tag for Ritual
- Add an extra option on the spell level slider for Ritual
- The ritual position should be before the lowest level, but after Free Use if it is there
- Ritual is only the default option if all other options are unavailable

## Issue

Still need to work out the legality issue - a ritual casting would be available even if there are no spell levels or free use left, but would normally be unhelpful to have in the list. What do we want to do?
