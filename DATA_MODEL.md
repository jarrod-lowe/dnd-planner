# Data Model

## Overview

- PK=USER#{userId}, SK=META#
- PK=USER#{userId}, SK=CHAR#{characterId}
- PK=CHAR#{characterId}, SK=RULEGROUP#{ruleGroupId}
- PK=RULEGROUP#{ruleGroupId}, SK=META#

## Global Secondary Indexes

### gsiSeed

Enables querying seed records by trigger type. Used by instantiation processes to find all seeds for a given trigger.

- **Index Name:** `gsiSeed`
- **Partition Key:** `gsiSeedPK` (String)
- **Query Pattern:** `Query gsiSeed WHERE gsiSeedPK = "SEED#<trigger>"`

| gsiSeedPK Value | Purpose                          |
| --------------- | -------------------------------- |
| `SEED#USER`     | Seeds for new user creation      |
| `SEED#CHAR`     | Seeds for new character creation |

### gsi1

Enables cleanup of stale search index entries during sync. Used by `sync_rule_groups.py` to find and delete search entries older than the current sync timestamp for a category.

- **Index Name:** `gsi1`
- **Partition Key:** `GSI1PK` (String) - `RULEGROUPDIRECTORY#{category}`
- **Sort Key:** `GSI1SK` (String) - `UPDATEDAT#{timestamp}`
- **Projection:** KEYS_ONLY
- **Query Pattern:** `Query gsi1 WHERE GSI1PK = "RULEGROUPDIRECTORY#<category>" AND GSI1SK < "UPDATEDAT#<timestamp>"`

## Seed Records

Template records used for creating new entities. Each seed contains placeholder variables (e.g., `$(userId)`, `$(now)`) that are substituted during creation.

### User Seed Record

Template for new user creation. Managed by Terraform. Triggered by Cognito post-confirmation.

- PK = `SEED#USER#$(userId)`
- SK = `META#`
- gsiSeedPK = `SEED#USER`
- type = `USER`
- userId = `$(userId)`
- email = `$(email)`
- charQuotaRemaining = default character quota for new users (e.g., 10)
- createdAt = `$(now)`
- updatedAt = `$(now)`

### Character Seed Records

Templates for new character creation. Both have `gsiSeedPK = "SEED#CHAR"` so they're queried together.

#### CHAR Record Seed

- PK = `SEED#USER#$(userId)`
- SK = `CHAR#$(characterId)`
- gsiSeedPK = `SEED#CHAR`
- type = `CHAR`
- characterId = `$(characterId)`
- userId = `$(userId)`
- name = `$(name)`
- species = `$(species)`
- vars = JSON of the default base variables
- createdAt = `$(now)`
- updatedAt = `$(now)`

#### CHAR_RULEGROUP Record Seeds

Five rule group seeds are created per character (turn-rest, action-economy, proficiency, movement, free-actions):

- PK = `SEED#CHAR#$(characterId)`
- SK = `RULEGROUP#<group-id>`
- gsiSeedPK = `SEED#CHAR`
- type = `CHAR`
- characterId = `$(characterId)`
- ruleGroupId = `<group-id>` (one of: turn-rest, action-economy, proficiency, movement, free-actions)
- userId = `$(userId)`
- enabled = `true`
- createdAt = `$(now)`
- updatedAt = `$(now)`

### Variable Placeholders

| Placeholder      | Description       | Source                |
| ---------------- | ----------------- | --------------------- |
| `$(userId)`      | User ID           | Cognito or request    |
| `$(characterId)` | Character ID      | Generated GUID        |
| `$(name)`        | Character name    | Request body          |
| `$(email)`       | User email        | Cognito               |
| `$(now)`         | Current timestamp | System time (RFC3339) |

## User Record

Represents a cognito user. Created by a Cognito trigger.

- PK = `USER#{userId}` -- `userId` comes from cognito
- SK = `META#`
- type = `USER`
- userId = id from cognito
- createdAt = ISO timestamp
- updatedAt = ISO timestamp
- charQuotaRemaining = number of characters this user can still create, starts at 10
- ... more to come in the future ...

## Character Record

Represents a character user is playing (a PC).

- PK = `USER#{userId}`
- SK = `CHAR#{characterId}`
- type = `CHAR`
- createdAt = ISO timestamp
- updatedAt = ISO timestamp
- characterId = unique ID for the character (GUID)
- userId = owner of the character
- name = character name
- species = the species code
- vars = JSON of the default base variables

## Character Rule Group Assignment Record

Represents the relationship between a character and a rule group.

- PK = CHAR#{characterId}
- SK = RULEGROUP#{ruleGroupId}
- type = CHAR_RULEGROUP
- characterId = ID of the character
- ruleGroupId = ID of the rule group
- userId = owner of the character (duplicated for safety/debugging)
- createdAt = ISO timestamp
- updatedAt = ISO timestamp
- enabled = boolean (default: true)

## Rule Group Record

Represents a reusable set of rules.

- PK = RULEGROUP#{ruleGroupId}
- SK = META#
- type = RULEGROUP
- ruleGroupId = unique ID (GUID)
- translations = JSON object keyed by locale code (e.g., "en", "en-x-tlh")
  - Each locale contains: name, description, keywords
- createdAt = ISO timestamp
- updatedAt = ISO timestamp
- rules = list of rule objects (complex, stored as JSON string)

### Translations Structure

The `translations` field contains localized metadata for each supported locale:

```json
{
  "en": {
    "name": "Base Rules",
    "description": "Core D&D 5e 2024 rules",
    "keywords": ["basic", "core", "movement", "actions"]
  },
  "en-x-tlh": {
    "name": "raD naQ",
    "description": "DIvI' Hol",
    "keywords": ["ratlh", "rutlh"]
  }
}
```

## Search Index Records

Enable prefix search (3-6 characters) for rule group names and keywords, per locale.

### Search Index Entry

- PK = `LANG#{locale}#PREFIX#{standardized-term}`
- SK = `SCORE#{score}#RULEGROUP#{ruleGroupId}`
- type = `SEARCHINDEX`
- category = category name (e.g., "dnd-5e-2024")
- updatedAt = ISO timestamp
- GSI1PK = `RULEGROUPDIRECTORY#{category}`
- GSI1SK = `UPDATEDAT#{timestamp}`

**Scoring:**

- `SCORE#0002` = name match
- `SCORE#0001` = keyword match

**Example entries for "Fireball" (category: spells, id: fireball):**

```
PK=LANG#en#PREFIX#fir,  SK=SCORE#0002#RULEGROUP#fireball, GSI1PK=RULEGROUPDIRECTORY#spells, GSI1SK=UPDATEDAT#2024-03-28T10:00:00Z
PK=LANG#en#PREFIX#fire, SK=SCORE#0002#RULEGROUP#fireball, GSI1PK=RULEGROUPDIRECTORY#spells, GSI1SK=UPDATEDAT#2024-03-28T10:00:00Z
PK=LANG#en#PREFIX#fireb, SK=SCORE#0002#RULEGROUP#fireball, GSI1PK=RULEGROUPDIRECTORY#spells, GSI1SK=UPDATEDAT#2024-03-28T10:00:00Z
PK=LANG#en#PREFIX#fireba, SK=SCORE#0002#RULEGROUP#fireball, GSI1PK=RULEGROUPDIRECTORY#spells, GSI1SK=UPDATEDAT#2024-03-28T10:00:00Z
PK=LANG#en#PREFIX#firebal, SK=SCORE#0002#RULEGROUP#fireball, GSI1PK=RULEGROUPDIRECTORY#spells, GSI1SK=UPDATEDAT#2024-03-28T10:00:00Z
```

**Term Standardization:**

Terms are standardized before indexing:

1. Normalize to NFD (separate base characters from diacritics)
2. Remove combining characters (diacritics)
3. Convert to lowercase
4. Remove non-alphanumeric characters

Examples: `"Fire-Ball!"` → `"fireball"`, `"Éléphant"` → `"elephant"`

### API Response Transformation

When rule groups are fetched via the API, the `lang` query parameter determines which locale's translations are returned at the top level:

- Request: `GET /api/rule-groups/batch?lang=en`
- Response includes: `name`, `description`, `keywords` extracted from `translations.en`
