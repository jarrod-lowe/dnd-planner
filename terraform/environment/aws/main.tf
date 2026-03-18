terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    # Configured via make init-aws
  }
}

data "aws_caller_identity" "current" {}

import {
  to = module.oidc.aws_iam_openid_connect_provider.github
  id = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

locals {
  state_bucket_name = "dnd-planner-iac-state-${data.aws_caller_identity.current.account_id}"
}

provider "aws" {
  default_tags {
    tags = {
      Project   = "dnd-planner"
      ManagedBy = "terraform"
    }
  }
}

module "oidc" {
  source = "../../module/oidc"
}

module "iac_roles" {
  source = "../../module/iac-roles"

  workspace = var.workspace
  repo      = var.repo
  oidc_arn  = module.oidc.oidc_arn
}

variable "workspace" {
  description = "GitHub workspace (organization or user)"
  type        = string
}

variable "repo" {
  description = "GitHub repository name"
  type        = string
}
