# KMS key identifier output for service integration
output "key_id" {
  description = "The unique identifier of the KMS key used for data encryption across MGA OS services"
  value       = aws_kms_key.mga_os_key.id
  sensitive   = false
}

# KMS key ARN output for IAM policies and cross-account access
output "key_arn" {
  description = "The Amazon Resource Name (ARN) of the KMS key used for cross-account and IAM-based access control"
  value       = aws_kms_key.mga_os_key.arn
  sensitive   = false
}

# KMS key alias output for human-readable identification
output "key_alias" {
  description = "The human-readable alias assigned to the KMS key for easy identification and management"
  value       = aws_kms_alias.mga_os_key_alias.name
  sensitive   = false
}

# KMS key policy output for verification and management
output "key_policy" {
  description = "The IAM policy document attached to the KMS key controlling access and operations"
  value       = aws_kms_key_policy.mga_os_key_policy.policy
  sensitive   = true
}

# KMS key rotation status for compliance verification
output "key_rotation_enabled" {
  description = "Indicates whether automatic key rotation is enabled for compliance with NAIC requirements"
  value       = aws_kms_key.mga_os_key.enable_key_rotation
  sensitive   = false
}

# KMS key deletion window for operational awareness
output "key_deletion_window" {
  description = "The waiting period in days before KMS key deletion becomes permanent"
  value       = aws_kms_key.mga_os_key.deletion_window_in_days
  sensitive   = false
}

# KMS key tags for resource management and compliance tracking
output "key_tags" {
  description = "Resource tags applied to the KMS key for compliance and management purposes"
  value       = aws_kms_key.mga_os_key.tags
  sensitive   = false
}