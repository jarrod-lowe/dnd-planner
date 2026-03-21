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
  description = "Source ARN for API Gateway permissions (optional)"
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
}

variable "sns_alarm_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  type        = string
}
