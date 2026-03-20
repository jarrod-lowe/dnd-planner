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

output "cdn_nice_domain" {
  description = "Custom domain name"
  value       = module.dnd-planner.cdn_nice_domain
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.dnd-planner.cloudfront_distribution_id
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.dnd-planner.cognito_user_pool_id
}

output "cognito_web_client_id" {
  description = "Cognito App Client ID"
  value       = module.dnd-planner.cognito_web_client_id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = module.dnd-planner.cognito_identity_pool_id
}

output "cognito_login_domain" {
  description = "Cognito hosted login domain"
  value       = module.dnd-planner.cognito_login_domain
}
