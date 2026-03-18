terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "workspace" {
  description = "GitHub workspace (organization or user)"
  type        = string
}

variable "repo" {
  description = "GitHub repository name"
  type        = string
}

variable "oidc_arn" {
  description = "ARN of the GitHub OIDC provider"
  type        = string
}

# OIDC trust policy for prod-ro role - only workflows in prod-ro environment
data "aws_iam_policy_document" "prod_ro" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.workspace}/${var.repo}:environment:prod-ro"]
    }
  }
}

# OIDC trust policy for prod-rw role - only workflows in prod-rw environment
data "aws_iam_policy_document" "prod_rw" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.workspace}/${var.repo}:environment:prod-rw"]
    }
  }
}

# ============================================
# PROD ROLES (OIDC access from GitHub Actions)
# ============================================

# Prod role for read-only operations
resource "aws_iam_role" "prod_ro" {
  name               = "dnd-planner-prod-iac-ro"
  assume_role_policy = data.aws_iam_policy_document.prod_ro.json

  tags = {
    Project     = "dnd-planner"
    Environment = "prod"
    Access      = "oidc"
    ManagedBy   = "terraform"
  }
}

# Attach AWS managed ReadOnlyAccess policy to prod role
resource "aws_iam_role_policy_attachment" "prod_ro" {
  role       = aws_iam_role.prod_ro.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Prod role for read-write operations
resource "aws_iam_role" "prod_rw" {
  name               = "dnd-planner-prod-iac-rw"
  assume_role_policy = data.aws_iam_policy_document.prod_rw.json

  tags = {
    Project     = "dnd-planner"
    Environment = "prod"
    Access      = "oidc"
    ManagedBy   = "terraform"
  }
}

# Attach AWS managed AdministratorAccess policy to prod role
resource "aws_iam_role_policy_attachment" "prod_rw" {
  role       = aws_iam_role.prod_rw.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# Policy document for assuming the prod-rw role
data "aws_iam_policy_document" "prod_ro_to_rw" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    resources = [aws_iam_role.prod_rw.arn]
  }
}

# Grant prod read-only role permission to assume the prod read-write role
resource "aws_iam_role_policy" "prod_ro_to_rw" {
  name   = "assume-rw-role"
  role   = aws_iam_role.prod_ro.name
  policy = data.aws_iam_policy_document.prod_ro_to_rw.json
}

# ============================================
# OUTPUTS
# ============================================

output "prod_ro_role_arn" {
  description = "ARN of the prod read-only IAM role (OIDC access)"
  value       = aws_iam_role.prod_ro.arn
}

output "prod_rw_role_arn" {
  description = "ARN of the prod read-write IAM role (OIDC access)"
  value       = aws_iam_role.prod_rw.arn
}
