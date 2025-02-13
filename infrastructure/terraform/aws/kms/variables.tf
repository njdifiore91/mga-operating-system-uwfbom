# AWS KMS Variables Configuration
# Provider Version: ~> 5.0

variable "environment" {
  type        = string
  description = "Deployment environment identifier for KMS resources (development, staging, production)"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "project" {
  type        = string
  description = "Project identifier for KMS resource naming and tagging"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.project))
    error_message = "Project name must start with letter and only contain alphanumeric characters and hyphens"
  }
}

variable "key_deletion_window" {
  type        = number
  description = "Waiting period in days before KMS key deletion (SOC 2 compliance requirement)"
  default     = 30

  validation {
    condition     = var.key_deletion_window >= 7 && var.key_deletion_window <= 30
    error_message = "Key deletion window must be between 7 and 30 days per security requirements"
  }
}

variable "enable_key_rotation" {
  type        = bool
  description = "Enable automatic key rotation every 365 days (NAIC security requirement)"
  default     = true
}

variable "key_administrators" {
  type        = list(string)
  description = "List of IAM ARNs with administrative access to KMS keys (key deletion, policy management)"

  validation {
    condition     = length(var.key_administrators) > 0
    error_message = "At least one key administrator must be specified"
  }
}

variable "key_users" {
  type        = list(string)
  description = "List of IAM ARNs with usage access to KMS keys (encrypt/decrypt operations)"

  validation {
    condition     = length(var.key_users) > 0
    error_message = "At least one key user must be specified"
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for KMS keys and aliases including compliance tracking"
  default = {
    Terraform          = "true"
    SecurityLevel      = "High"
    DataClassification = "Sensitive"
    Compliance         = "SOC2,NAIC"
    Encryption         = "AES-256-GCM"
  }
}

variable "key_alias_prefix" {
  type        = string
  description = "Prefix for KMS key aliases to identify keys by service/purpose"
  default     = "mga-os"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.key_alias_prefix))
    error_message = "Key alias prefix must start with lowercase letter and contain only lowercase alphanumeric characters and hyphens"
  }
}

variable "symmetric_key_spec" {
  type        = string
  description = "Cryptographic configuration for symmetric KMS keys"
  default     = "SYMMETRIC_DEFAULT"

  validation {
    condition     = contains(["SYMMETRIC_DEFAULT"], var.symmetric_key_spec)
    error_message = "Only SYMMETRIC_DEFAULT key spec is supported for compliance requirements"
  }
}

variable "key_usage" {
  type        = string
  description = "Usage type for KMS keys"
  default     = "ENCRYPT_DECRYPT"

  validation {
    condition     = contains(["ENCRYPT_DECRYPT"], var.key_usage)
    error_message = "Only ENCRYPT_DECRYPT key usage is supported for compliance requirements"
  }
}