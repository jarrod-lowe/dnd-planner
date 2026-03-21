output "arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Invocation ARN of the Lambda function"
  value       = aws_lambda_function.this.invoke_arn
}
