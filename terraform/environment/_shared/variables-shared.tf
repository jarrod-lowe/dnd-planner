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
