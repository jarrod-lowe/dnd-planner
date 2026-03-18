terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    # Configured via make init-state
  }
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

provider "aws" {
  default_tags {
    tags = {
      Project   = "dnd-planner"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

module "state_infrastructure" {
  source = "../../module/state-infrastructure"
}

import {
  to = module.state_infrastructure.aws_s3_bucket.state
  id = "dnd-planner-iac-state-${data.aws_caller_identity.current.account_id}"
}
