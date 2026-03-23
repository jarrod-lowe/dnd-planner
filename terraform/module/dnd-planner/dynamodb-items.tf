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
      S = "SEED#USER#$(userId)/CHAR#$(characterId)"
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
    createdAt = {
      S = "$(now)"
    }
    updatedAt = {
      S = "$(now)"
    }
  })
}

# Character rule group seed - creates the base rule group assignment
resource "aws_dynamodb_table_item" "char_rulegroup_seed" {
  table_name = aws_dynamodb_table.data.name
  hash_key   = "PK"
  range_key  = "SK"

  item = jsonencode({
    PK = {
      S = "SEED#CHAR#$(characterId)/RULEGROUP#base"
    }
    SK = {
      S = "RULEGROUP#base"
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
      S = "base"
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
