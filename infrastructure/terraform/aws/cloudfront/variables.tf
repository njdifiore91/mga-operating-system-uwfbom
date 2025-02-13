# Core project variables
variable "project" {
  type        = string
  description = "Project name for resource naming and tagging"
  default     = "mga-os"
}

variable "environment" {
  type        = string
  description = "Environment name for resource naming and tagging (e.g., dev, staging, prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Domain and DNS configuration
variable "domain_name" {
  type        = string
  description = "Domain name for CloudFront distribution alias"
}

variable "enable_ipv6" {
  type        = bool
  description = "Enable IPv6 support for CloudFront distribution"
  default     = true
}

variable "price_class" {
  type        = string
  description = "CloudFront distribution price class"
  default     = "PriceClass_All"
  validation {
    condition     = can(regex("^PriceClass_(All|100|200)$", var.price_class))
    error_message = "Price class must be PriceClass_All, PriceClass_100, or PriceClass_200"
  }
}

# SSL/TLS configuration
variable "ssl_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for CloudFront distribution"
}

variable "ssl_protocol_version" {
  type        = string
  description = "Minimum TLS version for viewer connections"
  default     = "TLSv1.2_2021"
  validation {
    condition     = can(regex("^TLSv1\\.[2-3]_[0-9]{4}$", var.ssl_protocol_version))
    error_message = "SSL protocol version must be TLSv1.2_2021 or higher"
  }
}

# Cache configuration
variable "min_ttl" {
  type        = number
  description = "Minimum TTL for cached objects in seconds"
  default     = 0
}

variable "default_ttl" {
  type        = number
  description = "Default TTL for cached objects in seconds"
  default     = 3600  # 1 hour
}

variable "max_ttl" {
  type        = number
  description = "Maximum TTL for cached objects in seconds"
  default     = 86400  # 24 hours
}

# Logging configuration
variable "log_bucket" {
  type        = string
  description = "S3 bucket for CloudFront access logs"
}

variable "log_prefix" {
  type        = string
  description = "Prefix for CloudFront access logs in S3 bucket"
  default     = "cloudfront/"
}

variable "include_cookies" {
  type        = bool
  description = "Include cookies in CloudFront access logs"
  default     = false
}