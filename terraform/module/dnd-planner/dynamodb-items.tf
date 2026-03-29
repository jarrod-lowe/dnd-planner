# SEED#USER record - template for new user creation
# The post-confirmation Lambda reads this record to populate new user metadata
resource "aws_dynamodb_table_item" "user_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#USER#$(userId)"
    }
    SK = {
      S = "META#"
    }
    gsiSeedPK = {
      S = "SEED#USER"
    }
    type = {
      S = "USER"
    }
    userId = {
      S = "$(userId)"
    }
    email = {
      S = "$(email)"
    }
    charQuotaRemaining = {
      N = "10"
    }
    updatedAt = {
      S = "$(now)"
    }
    createdAt = {
      S = "$(now)"
    }
  })
}

# SEED#CHAR records - templates for new character creation
# These records are queried via gsiSeed with gsiSeedPK = "SEED#CHAR"
# The character creation process reads these to populate new character data

# Character record seed - creates the CHAR record under USER
resource "aws_dynamodb_table_item" "char_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#USER#$(userId)"
    }
    SK = {
      S = "CHAR#$(characterId)"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR"
    }
    characterId = {
      S = "$(characterId)"
    }
    userId = {
      S = "$(userId)"
    }
    name = {
      S = "$(name)"
    }
    species = {
      S = "$(species)"
    }
    vars = {
      S = jsonencode({
        # default character config goes here
        "stats.str.start" : 10,
        "stats.dex.start" : 10,
        "stats.con.start" : 10,
        "stats.int.start" : 10,
        "stats.wis.start" : 10,
        "stats.cha.start" : 10,
      })
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

# Character rule group seeds - create rule group assignments for new characters

resource "aws_dynamodb_table_item" "char_turn_rest_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)"
    }
    SK = {
      S = "RULEGROUP#turn-rest"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR"
    }
    characterId = {
      S = "$(characterId)"
    }
    ruleGroupId = {
      S = "turn-rest"
    }
    userId = {
      S = "$(userId)"
    }
    enabled = {
      BOOL = true
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

resource "aws_dynamodb_table_item" "char_action_economy_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)"
    }
    SK = {
      S = "RULEGROUP#action-economy"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR"
    }
    characterId = {
      S = "$(characterId)"
    }
    ruleGroupId = {
      S = "action-economy"
    }
    userId = {
      S = "$(userId)"
    }
    enabled = {
      BOOL = true
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

resource "aws_dynamodb_table_item" "char_proficiency_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)"
    }
    SK = {
      S = "RULEGROUP#proficiency"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR"
    }
    characterId = {
      S = "$(characterId)"
    }
    ruleGroupId = {
      S = "proficiency"
    }
    userId = {
      S = "$(userId)"
    }
    enabled = {
      BOOL = true
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

resource "aws_dynamodb_table_item" "char_movement_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)"
    }
    SK = {
      S = "RULEGROUP#movement"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR"
    }
    characterId = {
      S = "$(characterId)"
    }
    ruleGroupId = {
      S = "movement"
    }
    userId = {
      S = "$(userId)"
    }
    enabled = {
      BOOL = true
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

resource "aws_dynamodb_table_item" "char_free_actions_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)"
    }
    SK = {
      S = "RULEGROUP#free-actions"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR"
    }
    characterId = {
      S = "$(characterId)"
    }
    ruleGroupId = {
      S = "free-actions"
    }
    userId = {
      S = "$(userId)"
    }
    enabled = {
      BOOL = true
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

# Species rule group seed - creates the species-specific rule group assignment
resource "aws_dynamodb_table_item" "char_species_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)"
    }
    SK = {
      S = "RULEGROUP#species-$(species)"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR"
    }
    characterId = {
      S = "$(characterId)"
    }
    ruleGroupId = {
      S = "species-$(species)"
    }
    userId = {
      S = "$(userId)"
    }
    enabled = {
      BOOL = true
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

# Custom rule group definition seed - creates an empty per-character rule group
resource "aws_dynamodb_table_item" "char_custom_rulegroup_def_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#RULEGROUP#custom-$(characterId)"
    }
    SK = {
      S = "META#"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "RULEGROUP"
    }
    ruleGroupId = {
      S = "custom-$(characterId)"
    }
    translations = {
      M = {
        en = {
          M = {
            name = {
              S = "Custom Rules"
            }
            description = {
              S = "Custom rules for your character"
            }
            keywords = {
              L = []
            }
          }
        }
        "en-x-tlh" = {
          M = {
            name = {
              S = "nuDmey raQpo'"
            }
            description = {
              S = "nuDmey raQpo' DIvI' naQ"
            }
            keywords = {
              L = []
            }
          }
        }
      }
    }
    rules = {
      S = "[]"
    }
    userId = {
      S = "$(userId)"
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

# Custom rule group assignment seed - links the custom rule group to the character
resource "aws_dynamodb_table_item" "char_custom_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)"
    }
    SK = {
      S = "RULEGROUP#custom-$(characterId)"
    }
    gsiSeedPK = {
      S = "SEED#CHAR"
    }
    type = {
      S = "CHAR_RULEGROUP"
    }
    characterId = {
      S = "$(characterId)"
    }
    ruleGroupId = {
      S = "custom-$(characterId)"
    }
    userId = {
      S = "$(userId)"
    }
    enabled = {
      BOOL = true
    }
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}
