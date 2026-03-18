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

data "github_repository" "main" {
  name = var.repo
}

# Repository ruleset for main branch protection
resource "github_repository_ruleset" "main" {
  name        = "dnd-planner-main-protection"
  repository  = data.github_repository.main.name
  enforcement = "active"
  target      = "branch"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  rules {
    required_linear_history = true
    deletion                = true
    non_fast_forward        = true
    update                  = false

    pull_request {
      required_approving_review_count   = 1
      require_code_owner_review         = false
      dismiss_stale_reviews_on_push     = true
      require_last_push_approval        = false
      required_review_thread_resolution = true
    }
  }
}

# GitHub Environments
resource "github_repository_environment" "test" {
  repository  = data.github_repository.main.name
  environment = "test"
  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}

resource "github_repository_environment" "prod" {
  repository  = data.github_repository.main.name
  environment = "prod"
  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}

# GitHub Repository Variables
resource "github_actions_secret" "codacy_api_token" {
  count           = var.codacy_api_token != "" ? 1 : 0
  repository      = data.github_repository.main.name
  secret_name     = "CODACY_API_TOKEN"
  plaintext_value = var.codacy_api_token
}

resource "github_actions_variable" "aws_account" {
  repository    = data.github_repository.main.name
  variable_name = "AWS_ACCOUNT"
  value         = data.aws_caller_identity.current.account_id
}

resource "github_actions_variable" "aws_region" {
  repository    = data.github_repository.main.name
  variable_name = "AWS_REGION"
  value         = data.aws_region.current.name
}

resource "github_actions_variable" "state_bucket" {
  repository    = data.github_repository.main.name
  variable_name = "STATE_BUCKET"
  value         = local.state_bucket_name
}

# IAM Role ARN secrets for GitHub Actions OIDC
resource "github_actions_secret" "prod_iac_ro_role_arn" {
  repository      = data.github_repository.main.name
  secret_name     = "PROD_IAC_RO_ROLE_ARN"
  plaintext_value = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/dnd-planner-prod-iac-ro"
}

resource "github_actions_secret" "prod_iac_rw_role_arn" {
  repository      = data.github_repository.main.name
  secret_name     = "PROD_IAC_RW_ROLE_ARN"
  plaintext_value = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/dnd-planner-prod-iac-rw"
}

# Required status checks for ruleset (to be added after workflows are in place)
resource "github_branch_protection" "main" {
  repository_id          = data.github_repository.main.node_id
  pattern                = "main"
  enforce_admins         = false
  required_linear_history = true
  force_push_bypassers   = []
  require_signed_commits = false
  required_status_checks {
    strict = true
    contexts = [
      "Environment Test - Plan"
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
