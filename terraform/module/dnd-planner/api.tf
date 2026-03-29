locals {
  api_name = "${local.resource_prefix}-api"
}

# CloudWatch Log Group for API Gateway access logs
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.api_name}"
  retention_in_days = 7

  tags = {
    Name = local.api_name
  }
}

# IAM role for API Gateway to write logs
data "aws_iam_policy_document" "api_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "api_logging" {
  name               = "${local.api_name}-logging"
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json

  tags = {
    Name = "${local.api_name}-logging"
  }
}

resource "aws_iam_role_policy" "api_logging" {
  name = "${local.api_name}-logging"
  role = aws_iam_role.api_logging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM role for API Gateway to access DynamoDB
resource "aws_iam_role" "api_dynamodb" {
  name               = "${local.api_name}-dynamodb"
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json

  tags = {
    Name = "${local.api_name}-dynamodb"
  }
}

resource "aws_iam_role_policy" "api_dynamodb" {
  name = "${local.api_name}-dynamodb"
  role = aws_iam_role.api_dynamodb.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.data.arn
      }
    ]
  })
}

# API Gateway account settings for CloudWatch logging
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.api_logging.arn

  depends_on = [aws_iam_role_policy.api_logging]
}

# REST API Gateway with OpenAPI definition
resource "aws_api_gateway_rest_api" "api" {
  name        = local.api_name
  description = "REST API for D&D Planner"
  body = templatefile("${path.module}/openapi.yaml", {
    cognito_user_pool_arn     = aws_cognito_user_pool.cognito.arn
    test_handler_uri          = "arn:aws:apigateway:${data.aws_region.current.region}:lambda:path/2015-03-31/functions/${module.test_handler.arn}/invocations"
    create_character_uri      = "arn:aws:apigateway:${data.aws_region.current.region}:lambda:path/2015-03-31/functions/${module.create_character.arn}/invocations"
    character_rule_groups_uri = "arn:aws:apigateway:${data.aws_region.current.region}:lambda:path/2015-03-31/functions/${module.character_rule_groups.arn}/invocations"
    dynamodb_table_name       = aws_dynamodb_table.data.name
    api_gateway_role_arn      = aws_iam_role.api_dynamodb.arn
    aws_region                = data.aws_region.current.region
  })

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = local.api_name
  }
}

# Deployment for the API
resource "aws_api_gateway_deployment" "api" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha256(jsonencode([
      aws_api_gateway_rest_api.api.body,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Stage for the API
resource "aws_api_gateway_stage" "default" {
  deployment_id = aws_api_gateway_deployment.api.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "api"

  depends_on = [aws_api_gateway_account.main]

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      ip                 = "$context.identity.sourceIp"
      requestTime        = "$context.requestTime"
      httpMethod         = "$context.httpMethod"
      resourcePath       = "$context.resourcePath"
      status             = "$context.status"
      responseLength     = "$context.responseLength"
      integrationLatency = "$context.integrationLatency"
    })
  }

  tags = {
    Name = "${local.api_name}-api"
  }
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_api_gateway_stage.default.invoke_url
}

output "api_id" {
  description = "API Gateway ID"
  value       = aws_api_gateway_rest_api.api.id
}
