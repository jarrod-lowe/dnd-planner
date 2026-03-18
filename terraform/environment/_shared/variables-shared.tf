variable "environment" {
  description = "Environment name (test, prod)"
  type        = string
}

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
