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
  source         = "../lambda"
  name           = "${local.resource_prefix}-test-handler"
  zip_path       = "${path.module}/../../../terraform/dummy-lambda.zip"
  execution_role = aws_iam_role.lambda_exec.arn
  api_source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
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
      "dynamodb:GetItem",
      "dynamodb:PutItem",
    ]
    resources = [aws_dynamodb_table.data.arn]
  }
}

resource "aws_iam_role_policy" "post_confirmation_dynamodb" {
  name   = "${local.resource_prefix}-post-confirmation-dynamodb"
  role   = aws_iam_role.post_confirmation.name
  policy = data.aws_iam_policy_document.post_confirmation_dynamodb.json
}

resource "aws_lambda_function" "post_confirmation" {
  function_name = "${local.resource_prefix}-post-confirmation"
  filename      = "${path.module}/../../../terraform/dummy-lambda.zip"
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = ["arm64"]
  role          = aws_iam_role.post_confirmation.arn

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.data.name
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.cognito.arn
}
