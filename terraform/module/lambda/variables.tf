variable "name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "zip_path" {
  description = "Path to the pre-built zip file"
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
