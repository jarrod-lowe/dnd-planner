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

- PK = `SEED#USER#$(userId)/CHAR#$(characterId)`
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

#### CHAR_RULEGROUP Record Seed

- PK = `SEED#CHAR#$(characterId)`
- SK = `RULEGROUP#base`
- gsiSeedPK = `SEED#CHAR`
- type = `CHAR`
- characterId = `$(characterId)`
- ruleGroupId = `base` (fixed, points to the base rule group)
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
- name = short display name (translation id)
- createdAt = ISO timestamp
- updatedAt = ISO timestamp
- rules = list of rule objects (complex)
