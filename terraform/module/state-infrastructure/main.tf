terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

data "aws_caller_identity" "current" {}

# State S3 bucket for Terraform state storage
resource "aws_s3_bucket" "state" {
  bucket = "dnd-planner-iac-state-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project   = "dnd-planner"
    Purpose   = "terraform-state"
    ManagedBy = "terraform"
  }
}

# Configure server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Enable versioning
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "state_bucket_name" {
  description = "Name of the state S3 bucket"
  value       = aws_s3_bucket.state.id
}

output "state_bucket_arn" {
  description = "ARN of the state S3 bucket"
  value       = aws_s3_bucket.state.arn
}
