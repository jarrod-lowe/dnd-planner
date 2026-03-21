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
