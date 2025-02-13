# Terraform AWS WAF Variables Configuration
# Version: ~> 1.0

# Project name variable for WAF resource identification
variable "project" {
  type        = string
  description = "Project name for WAF resource identification and tagging"
  default     = "mga-os"
}

# Environment deployment variable with validation
variable "environment" {
  type        = string
  description = "Environment name for WAF deployment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# WAF scope configuration for regional or CloudFront deployments
variable "waf_scope" {
  type        = string
  description = "Scope of WAF deployment (REGIONAL for API Gateway or CLOUDFRONT for CDN)"
  default     = "REGIONAL"
  validation {
    condition     = contains(["REGIONAL", "CLOUDFRONT"], var.waf_scope)
    error_message = "WAF scope must be either REGIONAL or CLOUDFRONT"
  }
}

# Rate limiting threshold configuration for IP-based request limiting
variable "ip_rate_based_rule_threshold" {
  type        = number
  description = "Maximum number of requests allowed from an IP in a 5-minute period"
  default     = 1000
}

# WAF log retention configuration
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain WAF logs in CloudWatch for security monitoring"
  default     = 30
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Additional tags to apply to WAF resources for organization and cost allocation"
  default     = {}
}