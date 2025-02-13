# AWS KMS Configuration for MGA OS Platform
# Provider Version: ~> 4.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Get current AWS account ID for IAM policies
data "aws_caller_identity" "current" {}

# KMS key for encrypting sensitive data with compliance controls
resource "aws_kms_key" "mga_os_key" {
  description              = "MGA OS encryption key for data protection with compliance controls"
  deletion_window_in_days  = var.key_deletion_window
  enable_key_rotation     = var.enable_key_rotation
  is_enabled              = true
  key_usage               = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  multi_region            = false

  tags = merge(
    {
      Name                  = "${var.project}-${var.environment}-key"
      SecurityClassification = "RESTRICTED"
      ComplianceScope       = "SOC2-NAIC"
      DataProtectionLevel   = "CRITICAL"
    },
    var.tags
  )
}

# Human-readable alias for the KMS key
resource "aws_kms_alias" "mga_os_key_alias" {
  name          = "alias/${var.project}-${var.environment}-key"
  target_key_id = aws_kms_key.mga_os_key.id
}

# Comprehensive IAM policy for KMS key access control
resource "aws_kms_key_policy" "mga_os_key_policy" {
  key_id = aws_kms_key.mga_os_key.id
  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "${var.project}-${var.environment}-key-policy"
    Statement = [
      {
        Sid       = "Enable IAM User Permissions"
        Effect    = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "Allow Key Administrators"
        Effect    = "Allow"
        Principal = {
          AWS = var.key_administrators
        }
        Action = [
          "kms:Create*",
          "kms:Describe*",
          "kms:Enable*",
          "kms:List*",
          "kms:Put*",
          "kms:Update*",
          "kms:Revoke*",
          "kms:Disable*",
          "kms:Get*",
          "kms:Delete*",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion"
        ]
        Resource = "*"
      },
      {
        Sid       = "Allow Key Users"
        Effect    = "Allow"
        Principal = {
          AWS = var.key_users
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt", 
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid       = "Enable CloudWatch Logging"
        Effect    = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
}

# Output the KMS key ID and ARN for use by other resources
output "kms_key_id" {
  description = "The ID of the KMS key"
  value       = aws_kms_key.mga_os_key.id
}

output "kms_key_arn" {
  description = "The ARN of the KMS key"
  value       = aws_kms_key.mga_os_key.arn
}

output "kms_key_alias" {
  description = "The alias of the KMS key"
  value       = aws_kms_alias.mga_os_key_alias.name
}