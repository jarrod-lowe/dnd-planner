resource "aws_lambda_function" "this" {
  function_name    = var.name
  filename         = var.zip_path
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  role             = var.execution_role
  source_code_hash = filebase64sha256(var.zip_path)
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = var.api_source_arn
}
