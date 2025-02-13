# CloudFront Distribution Output Configuration
# Provider version: ~> 5.0

# Distribution ID output for cache invalidation and distribution management
output "distribution_id" {
  description = "The ID of the CloudFront distribution used for cache invalidation and distribution management"
  value       = aws_cloudfront_distribution.main.id
  sensitive   = true

  precondition {
    condition     = aws_cloudfront_distribution.main.status == "Deployed"
    error_message = "CloudFront distribution must be fully deployed"
  }
}

# Distribution domain name output for DNS configuration
output "distribution_domain_name" {
  description = "The domain name of the CloudFront distribution for DNS configuration and client-side integration"
  value       = aws_cloudfront_distribution.main.domain_name
  sensitive   = true
  depends_on  = [aws_cloudfront_distribution.main]
}

# Distribution hosted zone ID output for Route 53 configuration
output "distribution_hosted_zone_id" {
  description = "The Route 53 hosted zone ID for the CloudFront distribution, used for alias record configuration"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
  sensitive   = true
  depends_on  = [aws_cloudfront_distribution.main]
}

# Distribution ARN output for IAM policy configuration
output "distribution_arn" {
  description = "The ARN of the CloudFront distribution for IAM policy and permission management"
  value       = aws_cloudfront_distribution.main.arn
  sensitive   = true
  depends_on  = [aws_cloudfront_distribution.main]
}