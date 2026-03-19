output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = module.dnd-planner.s3_bucket_arn
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.dnd-planner.s3_bucket_name
}

output "cdn_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.dnd-planner.cdn_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.dnd-planner.cloudfront_distribution_id
}
