# AWS Provider Configuration for MGA Operating System
# Version: ~> 5.0
# Purpose: Defines AWS provider settings for multi-region deployment with enhanced security

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary AWS provider configuration
provider "aws" {
  region = var.aws_region

  # Enhanced security defaults
  default_tags {
    tags = var.common_tags
  }

  # Security and compliance settings
  default_encryption = true
  s3_force_path_style = false
  skip_credentials_validation = false
  skip_metadata_api_check = false
  skip_region_validation = false

  # Assume role configuration for secure access
  assume_role {
    role_arn     = var.aws_role_arn
    session_name = "MGA-OS-Infrastructure"
  }
}

# Secondary region provider configurations for high availability
locals {
  secondary_provider_config = {
    for region in var.secondary_regions : region => {
      region = region
      tags   = merge(var.common_tags, {
        Region = region
        Role   = "Secondary"
      })
    }
  }
}

provider "aws" {
  for_each = local.secondary_provider_config
  
  alias  = "secondary_${each.key}"
  region = each.value.region

  # Enhanced security defaults for secondary regions
  default_tags {
    tags = each.value.tags
  }

  # Security and compliance settings
  default_encryption = true
  s3_force_path_style = false
  skip_credentials_validation = false
  skip_metadata_api_check = false
  skip_region_validation = false

  # Assume role configuration for secure access
  assume_role {
    role_arn     = var.aws_role_arn
    session_name = "MGA-OS-Infrastructure-Secondary-${each.key}"
  }
}

# Provider configuration for global services (IAM, Route53, etc.)
provider "aws" {
  alias  = "global"
  region = "us-east-1"  # Global services are managed from us-east-1

  default_tags {
    tags = merge(var.common_tags, {
      Scope = "Global"
    })
  }

  # Security and compliance settings
  default_encryption = true
  s3_force_path_style = false
  skip_credentials_validation = false
  skip_metadata_api_check = false
  skip_region_validation = false

  # Assume role configuration for secure access
  assume_role {
    role_arn     = var.aws_role_arn
    session_name = "MGA-OS-Infrastructure-Global"
  }
}