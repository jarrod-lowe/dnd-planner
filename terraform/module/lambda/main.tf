data "archive_file" "this" {
  type        = "zip"
  output_path = "${path.module}/../../archives/${var.name}.zip"
  source_file = var.binary_path
}

resource "aws_lambda_function" "this" {
  function_name    = var.name
  filename         = data.archive_file.this.output_path
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  role             = var.execution_role
  source_code_hash = data.archive_file.this.output_base64sha256
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = var.api_source_arn
}
