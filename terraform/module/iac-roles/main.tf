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

locals {
  oidc_trust_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.workspace}/${var.repo}:*"
          }
        }
      }
    ]
  })
}

# ============================================
# PROD ROLES (OIDC access from GitHub Actions)
# ============================================

# Prod role for read-only operations
resource "aws_iam_role" "prod_ro" {
  name               = "dnd-planner-prod-iac-ro"
  assume_role_policy = local.oidc_trust_policy

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
  assume_role_policy = local.oidc_trust_policy

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

# Grant prod read-only role permission to assume the prod read-write role
resource "aws_iam_role_policy" "prod_ro_to_rw" {
  name = "assume-rw-role"
  role = aws_iam_role.prod_ro.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sts:AssumeRole"
        ]
        Resource = aws_iam_role.prod_rw.arn
      }
    ]
  })
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
