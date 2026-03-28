resource "aws_dynamodb_table" "data" {
  name         = "${local.resource_prefix}-data"
  billing_mode = "PAY_PER_REQUEST"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "gsiSeedPK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  hash_key  = "PK"
  range_key = "SK"

  global_secondary_index {
    name = "gsiSeed"

    key_schema {
      attribute_name = "gsiSeedPK"
      key_type       = "HASH"
    }

    projection_type = "ALL"
  }

  global_secondary_index {
    name = "gsi1"

    key_schema {
      attribute_name = "GSI1PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI1SK"
      key_type       = "RANGE"
    }

    projection_type = "KEYS_ONLY"
  }

  tags = {
    Name = "${local.resource_prefix}-data"
  }
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.data.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.data.arn
}
