# Unused - passed by Makefile for consistency across environments
variable "workspace" {
  type    = string
  default = ""
}

# Unused - passed by Makefile for consistency across environments
variable "repo" {
  type    = string
  default = ""
}

variable "domain" {
  description = "Route53 hosted zone domain name"
  type        = string
}

variable "host" {
  description = "Host/subdomain prefix for the CDN"
  type        = string
}

variable "lambda_log_retention_days" {
  description = "Lambda CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "sns_alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  type        = string
}
