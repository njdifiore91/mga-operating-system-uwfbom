# WAF Web ACL ID output for integration with ALB and CloudFront
output "web_acl_id" {
  description = "The ID of the WAF Web ACL for association with ALB or CloudFront"
  value       = aws_wafv2_web_acl.main.id
}

# WAF Web ACL ARN output for CloudWatch logging configuration
output "web_acl_arn" {
  description = "The ARN of the WAF Web ACL for CloudWatch logging configuration"
  value       = aws_wafv2_web_acl.main.arn
}

# WAF Web ACL name output for reference in other resources
output "web_acl_name" {
  description = "The name of the WAF Web ACL for reference in other resources"
  value       = aws_wafv2_web_acl.main.name
}

# WAF Web ACL capacity output for monitoring purposes
output "web_acl_capacity" {
  description = "The current capacity of the WAF Web ACL for monitoring purposes"
  value       = aws_wafv2_web_acl.main.capacity
}