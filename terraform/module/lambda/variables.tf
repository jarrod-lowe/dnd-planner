variable "name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "binary_path" {
  description = "Path to the compiled Go binary"
  type        = string
}

variable "execution_role" {
  description = "ARN of the IAM execution role"
  type        = string
}

variable "api_source_arn" {
  description = "Source ARN for API Gateway permissions"
  type        = string
}
