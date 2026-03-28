data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${local.resource_prefix}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

module "test_handler" {
  source              = "../lambda"
  name                = "${local.resource_prefix}-test-handler"
  zip_path            = "${path.module}/../../../terraform/dummy-lambda.zip"
  execution_role      = aws_iam_role.lambda_exec.arn
  api_source_arn      = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
  log_retention_days  = var.lambda_log_retention_days
  sns_alarm_topic_arn = var.sns_alarm_topic_arn
}

# Post-confirmation Lambda for user creation
resource "aws_iam_role" "post_confirmation" {
  name               = "${local.resource_prefix}-post-confirmation"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "post_confirmation_basic" {
  role       = aws_iam_role.post_confirmation.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "post_confirmation_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:Query",
      "dynamodb:PutItem",
    ]
    resources = [
      aws_dynamodb_table.data.arn,
      "${aws_dynamodb_table.data.arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "post_confirmation_dynamodb" {
  name   = "${local.resource_prefix}-post-confirmation-dynamodb"
  role   = aws_iam_role.post_confirmation.name
  policy = data.aws_iam_policy_document.post_confirmation_dynamodb.json
}

module "post_confirmation" {
  source              = "../lambda"
  name                = "${local.resource_prefix}-post-confirmation"
  zip_path            = "${path.module}/../../../terraform/dummy-lambda.zip"
  execution_role      = aws_iam_role.post_confirmation.arn
  log_retention_days  = var.lambda_log_retention_days
  sns_alarm_topic_arn = var.sns_alarm_topic_arn
  environment_variables = {
    TABLE_NAME = aws_dynamodb_table.data.name
  }
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = module.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.cognito.arn
}

# Create-character Lambda for character creation API
resource "aws_iam_role" "create_character" {
  name               = "${local.resource_prefix}-create-character"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "create_character_basic" {
  role       = aws_iam_role.create_character.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "create_character_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:Query",
      "dynamodb:PutItem",
    ]
    resources = [
      aws_dynamodb_table.data.arn,
      "${aws_dynamodb_table.data.arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "create_character_dynamodb" {
  name   = "${local.resource_prefix}-create-character-dynamodb"
  role   = aws_iam_role.create_character.name
  policy = data.aws_iam_policy_document.create_character_dynamodb.json
}

module "create_character" {
  source              = "../lambda"
  name                = "${local.resource_prefix}-create-character"
  zip_path            = "${path.module}/../../../terraform/dummy-lambda.zip"
  execution_role      = aws_iam_role.create_character.arn
  api_source_arn      = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
  log_retention_days  = var.lambda_log_retention_days
  sns_alarm_topic_arn = var.sns_alarm_topic_arn
  environment_variables = {
    TABLE_NAME = aws_dynamodb_table.data.name
  }
}

# Character Rule Groups Lambda for managing character-rulegroup relationships
resource "aws_iam_role" "character_rule_groups" {
  name               = "${local.resource_prefix}-character-rule-groups"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "character_rule_groups_basic" {
  role       = aws_iam_role.character_rule_groups.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "character_rule_groups_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:Query",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      aws_dynamodb_table.data.arn,
    ]
  }
}

resource "aws_iam_role_policy" "character_rule_groups_dynamodb" {
  name   = "${local.resource_prefix}-character-rule-groups-dynamodb"
  role   = aws_iam_role.character_rule_groups.name
  policy = data.aws_iam_policy_document.character_rule_groups_dynamodb.json
}

module "character_rule_groups" {
  source              = "../lambda"
  name                = "${local.resource_prefix}-character-rule-groups"
  zip_path            = "${path.module}/../../../terraform/dummy-lambda.zip"
  execution_role      = aws_iam_role.character_rule_groups.arn
  api_source_arn      = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
  log_retention_days  = var.lambda_log_retention_days
  sns_alarm_topic_arn = var.sns_alarm_topic_arn
  environment_variables = {
    TABLE_NAME = aws_dynamodb_table.data.name
  }
}
