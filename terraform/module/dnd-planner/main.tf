terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 6.0"
      configuration_aliases = [aws, aws.us-east-1]
    }
  }
}

variable "environment" {
  description = "Environment name (test, prod)"
  type        = string
}

variable "domain" {
  description = "Route53 hosted zone domain name (e.g., example.com)"
  type        = string
}

variable "host" {
  description = "Host/subdomain prefix (e.g., test, www)"
  type        = string
}

locals {
  resource_prefix = "dnd-planner-${var.environment}"
  cdn_domain_name = "${var.host}.${var.domain}"
}

data "aws_route53_zone" "zone" {
  name = var.domain
}

data "aws_partition" "current" {}

# S3 bucket for UI hosting
resource "aws_s3_bucket" "ui" {
  bucket = "${local.resource_prefix}-ui"

  tags = {
    Project     = "dnd-planner"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_policy" "ui" {
  bucket = aws_s3_bucket.ui.id
  policy = data.aws_iam_policy_document.ui.json
}

data "aws_iam_policy_document" "ui" {
  statement {
    sid       = "CDNRead"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.ui.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.${data.aws_partition.current.dns_suffix}"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }

  statement {
    sid       = "CDNList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.ui.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.${data.aws_partition.current.dns_suffix}"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }

  # Block all HTTP Access
  statement {
    sid     = "BlockHTTP"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.ui.arn,
      "${aws_s3_bucket.ui.arn}/*",
    ]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

#tfsec:ignore:AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "ui" {
  bucket = aws_s3_bucket.ui.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "ui" {
  bucket = aws_s3_bucket.ui.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "ui" {
  bucket = aws_s3_bucket.ui.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "ui" {
  bucket = aws_s3_bucket.ui.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_cors_configuration" "ui" {
  bucket = aws_s3_bucket.ui.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://${aws_cloudfront_distribution.cdn.domain_name}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.ui.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.ui.arn
}

output "cdn_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.cdn.id
}
