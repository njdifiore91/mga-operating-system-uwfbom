# AWS CloudFront Distribution Configuration for MGA Operating System
# Provider version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  common_tags = {
    Environment     = var.environment
    Project         = var.project
    Service         = "cloudfront"
    ManagedBy      = "terraform"
    CostCenter     = "infrastructure"
    ComplianceLevel = "pci-dss"
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = var.enable_ipv6
  price_class         = var.price_class
  aliases             = [var.domain_name]
  web_acl_id          = module.waf.web_acl_id
  comment             = "MGA OS ${var.environment} distribution"
  http_version        = "http2and3"
  retain_on_delete    = true
  wait_for_deployment = true

  # Origin configuration for S3 backend
  origin {
    domain_name = "${var.project}-${var.environment}-origin.s3.amazonaws.com"
    origin_id   = "S3-${var.project}-${var.environment}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }

    custom_header {
      name  = "X-Environment"
      value = var.environment
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.project}-${var.environment}"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = var.min_ttl
    default_ttl            = var.default_ttl
    max_ttl                = var.max_ttl
    compress              = true

    # Lambda@Edge functions for request/response manipulation
    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = var.request_lambda_arn
      include_body = false
    }

    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # Logging configuration
  logging_config {
    include_cookies = var.include_cookies
    bucket         = var.log_bucket
    prefix         = "${var.log_prefix}${var.environment}/${var.project}/"
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = var.ssl_certificate_arn
    minimum_protocol_version = var.ssl_protocol_version
    ssl_support_method       = "sni-only"
  }

  # Geo restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Custom error responses
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 10
  }

  tags = local.common_tags
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for ${var.project} ${var.environment} distribution"
}

# Security Headers Policy
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.project}-${var.environment}-security-headers"
  comment = "Security headers policy for ${var.project} ${var.environment}"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      override = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }

    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
  }
}

# Outputs
output "distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.arn
}