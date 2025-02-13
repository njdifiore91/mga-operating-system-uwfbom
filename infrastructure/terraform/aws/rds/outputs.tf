# AWS RDS Aurora PostgreSQL Outputs Configuration
# Provider version: ~> 5.0

# Primary cluster endpoint for writer connections
output "cluster_endpoint" {
  description = "The writer endpoint for the RDS Aurora PostgreSQL cluster used for primary database operations"
  value       = aws_rds_cluster.main.endpoint
  sensitive   = false
}

# Reader endpoint for read replica connections
output "cluster_reader_endpoint" {
  description = "The reader endpoint for the RDS Aurora PostgreSQL cluster used for read-only operations and reporting"
  value       = aws_rds_cluster.main.reader_endpoint
  sensitive   = false
}

# Cluster identifier for reference in other resources
output "cluster_identifier" {
  description = "The unique identifier of the RDS Aurora PostgreSQL cluster for cross-resource referencing"
  value       = aws_rds_cluster.main.id
  sensitive   = false
}

# Database name for application configuration
output "database_name" {
  description = "The name of the default database created in the RDS Aurora PostgreSQL cluster"
  value       = aws_rds_cluster.main.database_name
  sensitive   = false
}

# Port number for database connections
output "port" {
  description = "The port number on which the RDS Aurora PostgreSQL cluster accepts connections"
  value       = aws_rds_cluster.main.port
  sensitive   = false
}

# Security group ID for network access control
output "security_group_id" {
  description = "The ID of the security group controlling network access to the RDS Aurora PostgreSQL cluster"
  value       = aws_security_group.rds.id
  sensitive   = false
}

# Enhanced monitoring role ARN
output "monitoring_role_arn" {
  description = "The ARN of the IAM role used for RDS Enhanced Monitoring integration"
  value       = aws_iam_role.rds_monitoring.arn
  sensitive   = false
}

# Cluster instance IDs for individual node management
output "cluster_instance_ids" {
  description = "The list of instance IDs in the RDS Aurora PostgreSQL cluster"
  value       = aws_rds_cluster_instance.main[*].id
  sensitive   = false
}

# Cluster ARN for IAM and cross-account access
output "cluster_arn" {
  description = "The ARN of the RDS Aurora PostgreSQL cluster for IAM policy configuration"
  value       = aws_rds_cluster.main.arn
  sensitive   = false
}

# Parameter group name for database configuration
output "parameter_group_name" {
  description = "The name of the DB parameter group used by the RDS Aurora PostgreSQL cluster"
  value       = aws_rds_cluster_parameter_group.main.name
  sensitive   = false
}

# Backup retention period for compliance verification
output "backup_retention_period" {
  description = "The number of days automated backups are retained for the RDS Aurora PostgreSQL cluster"
  value       = aws_rds_cluster.main.backup_retention_period
  sensitive   = false
}

# KMS key ID used for storage encryption
output "storage_encryption_key_id" {
  description = "The KMS key ID used for storage encryption of the RDS Aurora PostgreSQL cluster"
  value       = aws_rds_cluster.main.kms_key_id
  sensitive   = true
}

# Cluster resource ID for CloudWatch integration
output "cluster_resource_id" {
  description = "The unique resource ID of the RDS Aurora PostgreSQL cluster for CloudWatch metrics"
  value       = aws_rds_cluster.main.cluster_resource_id
  sensitive   = false
}

# Database subnet group name for network configuration
output "db_subnet_group_name" {
  description = "The name of the DB subnet group associated with the RDS Aurora PostgreSQL cluster"
  value       = aws_db_subnet_group.main.name
  sensitive   = false
}

# Maintenance window for operational planning
output "maintenance_window" {
  description = "The maintenance window for the RDS Aurora PostgreSQL cluster"
  value       = aws_rds_cluster.main.preferred_maintenance_window
  sensitive   = false
}