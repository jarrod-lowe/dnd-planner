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
