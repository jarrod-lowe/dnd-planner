# Offered Options by Verb Group / Verb / Sub-verb

Every option the rules engine can offer via `offerRule`, classified by its intent
metadata. The verb group determines which picker column an option appears in;
the verb determines the stripe label; the sub-verb groups options within a verb.

Options without explicit `intents` derive their verb from `ui.section` via
`deriveVerbFromSection()` and use the sub-verb `default`.

Source files: `data/rule-groups/`, `data/rule-sources/weapons.yaml`

---

## PLAN — Combat and exploration actions

### ATTACK

| Sub-verb | Option                   | Cost       | Source                                              |
| -------- | ------------------------ | ---------- | --------------------------------------------------- |
| weapons  | Dagger (action)          | action     | `weapons.yaml` — profile `use-action`               |
| weapons  | Greataxe (action)        | action     | `weapons.yaml` — profile `use-action`               |
| weapons  | Javelin (action)         | action     | `weapons.yaml` — profile `use-action`               |
| weapons  | Scimitar (action)        | action     | `weapons.yaml` — profile `use-action`               |
| weapons  | Dagger (bonus — light)   | bonus      | `weapons.yaml` — profile `use-bonus-followup-light` |
| weapons  | Scimitar (bonus — light) | bonus      | `weapons.yaml` — profile `use-bonus-followup-light` |
| brawl    | Unarmed Strike (action)  | action     | `attacks.yaml`                                      |
| brawl    | Grapple                  | action     | `grapple.yaml`                                      |
| brawl    | Shove                    | action     | `shove.yaml`                                        |
| spells   | Divine Smite             | bonus      | `class-paladin/divine-smite.yaml`                   |
| spells   | Paladin Smite            | bonus      | `class-paladin/paladin-smite.yaml`                  |
| spells   | Divine Favour (cast)     | bonus + L1 | `spells/spell-divine-favour.yaml`                   |
| spells   | Divine Favour (use)      | free       | `spells/spell-divine-favour.yaml`                   |
| spells   | Thunderous Smite         | bonus + L1 | `spells/thunderous-smite.yaml`                      |

### AID

| Sub-verb | Option                       | Cost               | Source                                      |
| -------- | ---------------------------- | ------------------ | ------------------------------------------- |
| ally     | Influence                    | action             | `simple-actions.yaml`                       |
| ally     | Help                         | action             | `free-actions.yaml`                         |
| ally     | Bless                        | action + conc + L1 | `spells/bless.yaml`                         |
| self     | Lay on Hands — Heal          | bonus + LoH        | `class-paladin/lay-on-hands.yaml`           |
| self     | Lay on Hands — Purify Poison | bonus + LoH        | `class-paladin/lay-on-hands.yaml`           |
| self     | Use Heroic Inspiration       | free               | `heroic-inspiration.yaml`                   |
| self     | Grant Heroic Inspiration     | free               | `heroic-inspiration.yaml`                   |
| self     | Emissary of Peace            | bonus + CD         | `class-paladin/oath-redemption-level3.yaml` |

### CONTROL

| Sub-verb | Option  | Cost               | Source                |
| -------- | ------- | ------------------ | --------------------- |
| single   | Command | action + L1        | `spells/command.yaml` |
| area     | Sleep   | action + conc + L1 | `spells/sleep.yaml`   |

### DEFEND

| Sub-verb | Option                        | Cost               | Source                                         |
| -------- | ----------------------------- | ------------------ | ---------------------------------------------- |
| weapons  | Dagger (reaction)             | reaction           | `weapons.yaml` — profile `use-reaction-weapon` |
| weapons  | Greataxe (reaction)           | reaction           | `weapons.yaml` — profile `use-reaction-weapon` |
| weapons  | Javelin (reaction)            | reaction           | `weapons.yaml` — profile `use-reaction-weapon` |
| weapons  | Scimitar (reaction)           | reaction           | `weapons.yaml` — profile `use-reaction-weapon` |
| brawl    | Unarmed Strike (reaction)     | reaction           | `attacks.yaml`                                 |
| evade    | Disengage                     | action             | `simple-actions.yaml`                          |
| evade    | Dodge                         | action             | `simple-actions.yaml`                          |
| ward     | Protection from Evil and Good | action + conc + L1 | `spells/protection-from-evil-and-good.yaml`    |
| ward     | Sanctuary                     | bonus + L1         | `spells/sanctuary.yaml`                        |
| ward     | Rebuke the Violent            | reaction + CD      | `class-paladin/oath-redemption-level3.yaml`    |

### MOVE

| Sub-verb | Option             | Cost   | Source          |
| -------- | ------------------ | ------ | --------------- |
| travel   | Walk               | move   | `movement.yaml` |
| travel   | Rough Terrain Walk | move   | `movement.yaml` |
| travel   | Swim               | move   | `movement.yaml` |
| travel   | Swim (costly)      | move   | `movement.yaml` |
| travel   | Fly                | move   | `movement.yaml` |
| dash     | Dash               | action | `dash.yaml`     |

### INSPECT

| Sub-verb | Option          | Cost       | Source                        |
| -------- | --------------- | ---------- | ----------------------------- |
| sense    | Search          | action     | `simple-actions.yaml`         |
| sense    | Divine Sense    | bonus + CD | `class-paladin/divinity.yaml` |
| sense    | Roll Initiative | free       | `initiative.yaml`             |
| check    | Study           | action     | `simple-actions.yaml`         |

### HANDLE

| Sub-verb | Option                    | Cost        | Source                                 |
| -------- | ------------------------- | ----------- | -------------------------------------- |
| gear     | Improvise                 | action      | `simple-actions.yaml`                  |
| gear     | Interact                  | free        | `simple-actions.yaml`                  |
| gear     | Utilize                   | action      | `simple-actions.yaml`                  |
| gear     | Free Action               | free        | `free-actions.yaml`                    |
| gear     | Don Leather Armor         | free        | `leather-armor.yaml`                   |
| gear     | Don Splint Armor          | move        | `splint-armor.yaml`                    |
| gear     | Don Shield                | free        | `shield.yaml`                          |
| gear     | Set Maximum HP Modifier   | free        | `hp.yaml`                              |
| gear     | Set Current HP Modifier   | free        | `hp.yaml`                              |
| consume  | Create and Destroy Water  | action + L1 | `spells/create-and-destroy-water.yaml` |
| consume  | Create Water (sub-spell)  | L1          | `spells/create-and-destroy-water.yaml` |
| consume  | Destroy Water (sub-spell) | L1          | `spells/create-and-destroy-water.yaml` |

---

## RECORD — Tracking what happened

### HEALTH

| Sub-verb | Option         | Cost | Source             |
| -------- | -------------- | ---- | ------------------ |
| hp       | Take Damage    | free | `core-events.yaml` |
| hp       | Record Healing | free | `core-events.yaml` |

### SAVE

| Sub-verb | Option              | Cost | Source               |
| -------- | ------------------- | ---- | -------------------- |
| you      | Strength Save       | free | `core-events.yaml`   |
| you      | Dexterity Save      | free | `core-events.yaml`   |
| you      | Constitution Save   | free | `core-events.yaml`   |
| you      | Intelligence Save   | free | `core-events.yaml`   |
| you      | Wisdom Save         | free | `core-events.yaml`   |
| you      | Charisma Save       | free | `core-events.yaml`   |
| you      | Concentration Check | free | `concentration.yaml` |

### CHECK

| Sub-verb | Option                | Cost | Source              |
| -------- | --------------------- | ---- | ------------------- |
| skill    | Skill Check (generic) | free | `core-events.yaml`  |
| skill    | Acrobatics Check      | free | `skill-checks.yaml` |
| skill    | Animal Handling Check | free | `skill-checks.yaml` |
| skill    | Arcana Check          | free | `skill-checks.yaml` |
| skill    | Athletics Check       | free | `skill-checks.yaml` |
| skill    | Deception Check       | free | `skill-checks.yaml` |
| skill    | History Check         | free | `skill-checks.yaml` |
| skill    | Insight Check         | free | `skill-checks.yaml` |
| skill    | Intimidation Check    | free | `skill-checks.yaml` |
| skill    | Investigation Check   | free | `skill-checks.yaml` |
| skill    | Medicine Check        | free | `skill-checks.yaml` |
| skill    | Nature Check          | free | `skill-checks.yaml` |
| skill    | Perception Check      | free | `skill-checks.yaml` |
| skill    | Performance Check     | free | `skill-checks.yaml` |
| skill    | Persuasion Check      | free | `skill-checks.yaml` |
| skill    | Religion Check        | free | `skill-checks.yaml` |
| skill    | Sleight of Hand Check | free | `skill-checks.yaml` |
| skill    | Stealth Check         | free | `skill-checks.yaml` |
| skill    | Survival Check        | free | `skill-checks.yaml` |

### REST

| Sub-verb | Option     | Cost | Source           |
| -------- | ---------- | ---- | ---------------- |
| type     | Long Rest  | free | `turn-rest.yaml` |
| type     | Short Rest | free | `turn-rest.yaml` |

### NOTE

| Sub-verb | Option    | Cost | Source             |
| -------- | --------- | ---- | ------------------ |
| freeform | Take Note | free | `core-events.yaml` |

---

## BUILD — Character configuration

> **Build lock:** the `Lock` option (`build-lock.yaml`) sets the `build.locked` fact via a
> removable effect. Every BUILD offer is gated on it with the `*not-locked-legal` legalWhen
> anchor (`_shared/definitions.yaml`), so locking hides the whole BUILD group behind the eye
> until the `Build Locked` effect is removed from the ledger. **New BUILD offers must add
> `*not-locked-legal` to their `legalWhen`** (weapon EQUIP offers inline the condition because
> rule-source preprocessing does not prepend the shared anchors).

### STAT

| Sub-verb | Option                | Cost | Source                |
| -------- | --------------------- | ---- | --------------------- |
| set      | Set Strength          | free | `ability-scores.yaml` |
| set      | Set Dexterity         | free | `ability-scores.yaml` |
| set      | Set Constitution      | free | `ability-scores.yaml` |
| set      | Set Intelligence      | free | `ability-scores.yaml` |
| set      | Set Wisdom            | free | `ability-scores.yaml` |
| set      | Set Charisma          | free | `ability-scores.yaml` |
| increase | Increase Strength     | free | `ability-scores.yaml` |
| increase | Increase Dexterity    | free | `ability-scores.yaml` |
| increase | Increase Constitution | free | `ability-scores.yaml` |
| increase | Increase Intelligence | free | `ability-scores.yaml` |
| increase | Increase Wisdom       | free | `ability-scores.yaml` |
| increase | Increase Charisma     | free | `ability-scores.yaml` |
| lock     | Lock                  | free | `build-lock.yaml`     |

### PROFICIENCY

| Sub-verb | Option                        | Cost | Source                |
| -------- | ----------------------------- | ---- | --------------------- |
| save     | Strength Save Proficiency     | free | `ability-scores.yaml` |
| save     | Dexterity Save Proficiency    | free | `ability-scores.yaml` |
| save     | Constitution Save Proficiency | free | `ability-scores.yaml` |
| save     | Intelligence Save Proficiency | free | `ability-scores.yaml` |
| save     | Wisdom Save Proficiency       | free | `ability-scores.yaml` |
| save     | Charisma Save Proficiency     | free | `ability-scores.yaml` |
| skill    | Acrobatics Proficiency        | free | `ability-scores.yaml` |
| skill    | Animal Handling Proficiency   | free | `ability-scores.yaml` |
| skill    | Arcana Proficiency            | free | `ability-scores.yaml` |
| skill    | Athletics Proficiency         | free | `ability-scores.yaml` |
| skill    | Deception Proficiency         | free | `ability-scores.yaml` |
| skill    | History Proficiency           | free | `ability-scores.yaml` |
| skill    | Insight Proficiency           | free | `ability-scores.yaml` |
| skill    | Intimidation Proficiency      | free | `ability-scores.yaml` |
| skill    | Investigation Proficiency     | free | `ability-scores.yaml` |
| skill    | Medicine Proficiency          | free | `ability-scores.yaml` |
| skill    | Nature Proficiency            | free | `ability-scores.yaml` |
| skill    | Perception Proficiency        | free | `ability-scores.yaml` |
| skill    | Performance Proficiency       | free | `ability-scores.yaml` |
| skill    | Persuasion Proficiency        | free | `ability-scores.yaml` |
| skill    | Religion Proficiency          | free | `ability-scores.yaml` |
| skill    | Sleight of Hand Proficiency   | free | `ability-scores.yaml` |
| skill    | Stealth Proficiency           | free | `ability-scores.yaml` |
| skill    | Survival Proficiency          | free | `ability-scores.yaml` |
