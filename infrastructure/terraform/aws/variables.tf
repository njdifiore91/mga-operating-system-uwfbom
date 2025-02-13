# AWS Provider Version: ~> 5.0

# Project identifier variable
variable "project" {
  type        = string
  description = "Project identifier for resource tagging and organization"
  default     = "MGA-OS"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.project))
    error_message = "Project name must start with letter and only contain alphanumeric characters and hyphens"
  }
}

# Environment identifier variable
variable "environment" {
  type        = string
  description = "Deployment environment identifier controlling infrastructure configuration"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

# Primary AWS region variable
variable "aws_region" {
  type        = string
  description = "Primary AWS region for resource deployment and data residency"
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d$", var.aws_region))
    error_message = "AWS region must be in valid format (e.g., us-east-1)"
  }
}

# Secondary regions variable for multi-region deployment
variable "secondary_regions" {
  type        = list(string)
  description = "Secondary AWS regions for multi-region high availability deployment"
  default     = []

  validation {
    condition     = alltrue([for r in var.secondary_regions : can(regex("^[a-z]{2}-[a-z]+-\\d$", r))])
    error_message = "All secondary regions must be in valid AWS region format"
  }
}

# Global encryption configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable KMS encryption for all supported AWS services and data at rest"
  default     = true
}

# Monitoring configuration
variable "enable_monitoring" {
  type        = bool
  description = "Enable comprehensive CloudWatch monitoring, logging, and alerting"
  default     = true
}

# Backup retention configuration
variable "backup_retention_days" {
  type        = number
  description = "Global backup retention period in days for all AWS service backups"
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 30 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 30 and 365 days"
  }
}

# Common resource tags
variable "common_tags" {
  type        = map(string)
  description = "Common resource tags applied to all AWS infrastructure components"
  default = {
    Project            = "MGA-OS"
    Terraform          = "true"
    Environment        = "${var.environment}"
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    DataClassification = "Sensitive"
  }
}