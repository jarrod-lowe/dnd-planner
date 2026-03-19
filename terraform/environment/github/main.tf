terraform {
  required_version = ">= 1.5.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    # Configured via make setup-github
  }
}

provider "aws" {
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  state_bucket_name = "dnd-planner-iac-state-${data.aws_caller_identity.current.account_id}"
}

variable "workspace" {
  description = "GitHub workspace (organization or user)"
  type        = string
}

variable "repo" {
  description = "GitHub repository name"
  type        = string
}

variable "codacy_api_token" {
  description = "Codacy API token"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Route53 hosted zone domain name for prod"
  type        = string
  sensitive   = true
}

variable "host" {
  description = "Host/subdomain prefix for prod CDN"
  type        = string
  sensitive   = true
}

import {
  to = github_repository.main
  id = var.repo
}

#tfsec:ignore:GIT-0001
resource "github_repository" "main" {
  name                   = var.repo
  has_issues             = true
  allow_auto_merge       = true
  allow_squash_merge     = true
  allow_merge_commit     = false
  allow_rebase_merge     = false
  delete_branch_on_merge = true
  vulnerability_alerts   = true
}

# Issue labels for Dependabot PRs
resource "github_issue_label" "dependabot" {
  repository  = github_repository.main.name
  name        = "dependabot"
  color       = "0366d6"
  description = "Dependabot PRs"
}

# Repository ruleset for main branch protection
resource "github_repository_ruleset" "main" {
  name        = "dnd-planner-main-protection"
  repository  = github_repository.main.name
  enforcement = "active"
  target      = "branch"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  rules {
    required_linear_history   = true
    deletion                  = true
    non_fast_forward          = true
    update                    = false
    required_signatures       = true

    pull_request {
      required_approving_review_count   = 0
      require_code_owner_review         = false
      dismiss_stale_reviews_on_push     = true
      require_last_push_approval        = false
      required_review_thread_resolution = true
    }
  }
}

# GitHub Environments
# prod-ro: Used for terraform plan on PRs (read-only access)
resource "github_repository_environment" "prod_ro" {
  repository  = github_repository.main.name
  environment = "prod-ro"
}

# prod-rw: Used for terraform apply on merge (read-write access, restricted to main branch)
resource "github_repository_environment" "prod_rw" {
  repository  = github_repository.main.name
  environment = "prod-rw"

  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}

# GitHub Repository Variables
resource "github_actions_secret" "codacy_api_token" {
  count           = var.codacy_api_token != "" ? 1 : 0
  repository      = github_repository.main.name
  secret_name     = "CODACY_API_TOKEN"
  plaintext_value = var.codacy_api_token
}

# Environment variables for prod-ro (terraform plan)
resource "github_actions_environment_variable" "prod_ro_aws_account" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_ro.environment
  variable_name = "AWS_ACCOUNT"
  value         = data.aws_caller_identity.current.account_id
}

resource "github_actions_environment_variable" "prod_ro_aws_region" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_ro.environment
  variable_name = "AWS_REGION"
  value         = data.aws_region.current.id
}

resource "github_actions_environment_variable" "prod_ro_state_bucket" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_ro.environment
  variable_name = "STATE_BUCKET"
  value         = local.state_bucket_name
}

resource "github_actions_environment_variable" "prod_ro_environment" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_ro.environment
  variable_name = "ENVIRONMENT"
  value         = "prod"
}

resource "github_actions_environment_secret" "prod_ro_aws_role" {
  repository      = github_repository.main.name
  environment     = github_repository_environment.prod_ro.environment
  secret_name     = "AWS_ROLE"
  plaintext_value = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/dnd-planner-prod-iac-ro"
}

resource "github_actions_environment_secret" "prod_ro_domain" {
  repository      = github_repository.main.name
  environment     = github_repository_environment.prod_ro.environment
  secret_name     = "TF_VAR_domain"
  plaintext_value = var.domain
}

resource "github_actions_environment_secret" "prod_ro_host" {
  repository      = github_repository.main.name
  environment     = github_repository_environment.prod_ro.environment
  secret_name     = "TF_VAR_host"
  plaintext_value = var.host
}

# Environment variables for prod-rw (terraform apply)
resource "github_actions_environment_variable" "prod_rw_aws_account" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_rw.environment
  variable_name = "AWS_ACCOUNT"
  value         = data.aws_caller_identity.current.account_id
}

resource "github_actions_environment_variable" "prod_rw_aws_region" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_rw.environment
  variable_name = "AWS_REGION"
  value         = data.aws_region.current.id
}

resource "github_actions_environment_variable" "prod_rw_state_bucket" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_rw.environment
  variable_name = "STATE_BUCKET"
  value         = local.state_bucket_name
}

resource "github_actions_environment_variable" "prod_rw_environment" {
  repository    = github_repository.main.name
  environment   = github_repository_environment.prod_rw.environment
  variable_name = "ENVIRONMENT"
  value         = "prod"
}

resource "github_actions_environment_secret" "prod_rw_aws_role" {
  repository      = github_repository.main.name
  environment     = github_repository_environment.prod_rw.environment
  secret_name     = "AWS_ROLE"
  plaintext_value = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/dnd-planner-prod-iac-rw"
}

resource "github_actions_environment_secret" "prod_rw_domain" {
  repository      = github_repository.main.name
  environment     = github_repository_environment.prod_rw.environment
  secret_name     = "TF_VAR_domain"
  plaintext_value = var.domain
}

resource "github_actions_environment_secret" "prod_rw_host" {
  repository      = github_repository.main.name
  environment     = github_repository_environment.prod_rw.environment
  secret_name     = "TF_VAR_host"
  plaintext_value = var.host
}


# Required status checks for ruleset (to be added after workflows are in place)
resource "github_branch_protection" "main" {
  repository_id           = github_repository.main.node_id
  pattern                 = "main"
  enforce_admins          = false
  required_linear_history = true
  force_push_bypassers    = []
  require_signed_commits  = true
  required_status_checks {
    strict = true
    contexts = [
      "Terraform Plan - Prod",
      "Terraform Security Scan",
      "Frontend Build & Test",
    ]
  }
  allows_deletions    = false
  allows_force_pushes = false
}

# Output IAM role ARNs for reference
output "prod_ro_role_arn" {
  description = "Prod environment read-only role ARN (set as PROD_IAC_RO_ROLE_ARN secret)"
  value       = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/dnd-planner-prod-iac-ro"
}

output "prod_rw_role_arn" {
  description = "Prod environment read-write role ARN (set as PROD_IAC_RW_ROLE_ARN secret)"
  value       = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/dnd-planner-prod-iac-rw"
}
