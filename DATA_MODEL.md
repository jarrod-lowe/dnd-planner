# Data Model

## Overview

- PK=USER#{userId}, SK=META#
- PK=USER#{userId}, SK=CHAR#{characterId}
- PK=CHAR#{characterId}, SK=RULEGROUP#{ruleGroupId}
- PK=RULEGROUP#{ruleGroupId}, SK=META#

## Defaults Record

Defaults information.

- PK = `SEED#<type>`
- SK = based on what the record the default will be copied into
- type = `SEED` or type of the record the default will be copied into
- ... records to duplicate ...

### User Seed Record

Template for new user creation. Managed by Terraform.

- PK = `SEED#USER`
- SK = `META#`
- type = `SEED`
- charQuotaRemaining = default character quota for new users (e.g., 10)

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
- race = D&D race (e.g. `elf`, `human`)
- baseStats = object containing base attributes
  - str = number
  - dex = number
  - con = number
  - int = number
  - wis = number
  - cha = number
- ... additional character metadata as needed ...

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
