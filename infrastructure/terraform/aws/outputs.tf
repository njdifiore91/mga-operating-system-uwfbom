# AWS Infrastructure Outputs Configuration
# Provider version: ~> 5.0
# Purpose: Aggregates and exposes critical infrastructure information from all AWS service modules

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
  sensitive   = false
}

output "eks_cluster_name" {
  description = "The name of the EKS cluster for deployment configuration"
  value       = module.eks.cluster_name
  sensitive   = false
}

output "eks_oidc_provider_url" {
  description = "The URL of the OpenID Connect identity provider for IAM role federation"
  value       = module.eks.cluster_oidc_issuer_url
  sensitive   = false
}

# Database Endpoints
output "database_endpoints" {
  description = "Map of database endpoints for application configuration"
  value = {
    writer_endpoint          = module.rds.cluster_endpoint
    reader_endpoint          = module.rds.cluster_reader_endpoint
    database_name            = module.rds.database_name
    performance_insights_url = module.rds.performance_insights_endpoint
  }
  sensitive = false
}

# Redis Cache Endpoints
output "redis_endpoints" {
  description = "Map of Redis endpoints for caching layer configuration"
  value = {
    primary_endpoint = module.elasticache.redis_primary_endpoint
    reader_endpoint  = module.elasticache.redis_reader_endpoint
    port            = module.elasticache.redis_port
  }
  sensitive = false
}

# Network Configuration
output "network_config" {
  description = "VPC and network configuration details"
  value = {
    vpc_id              = module.vpc.vpc_id
    private_subnet_ids  = module.vpc.private_subnet_ids
    availability_zones  = module.vpc.availability_zones
  }
  sensitive = false
}

# Security Configuration
output "security_config" {
  description = "Security-related configuration and access controls"
  value = {
    eks_security_group_id = module.eks.cluster_security_group_id
    database_subnet_group = module.rds.db_subnet_group_name
    monitoring_role_arn   = module.rds.monitoring_role_arn
  }
  sensitive = false
}

# Monitoring Configuration
output "monitoring_config" {
  description = "Monitoring and observability configuration"
  value = {
    eks_log_group        = module.eks.cloudwatch_log_group_name
    rds_log_exports      = module.rds.cluster_resource_id
    backup_retention     = module.rds.backup_retention_period
    maintenance_windows = {
      database = module.rds.maintenance_window
    }
  }
  sensitive = false
}

# Backup Configuration
output "backup_config" {
  description = "Backup and disaster recovery configuration"
  value = {
    rds_backup_window    = module.rds.backup_retention_period
    rds_snapshot_config = {
      retention_period = module.rds.backup_retention_period
      encrypted       = true
      kms_key_id     = module.rds.storage_encryption_key_id
    }
  }
  sensitive = true
}

# High Availability Configuration
output "ha_config" {
  description = "High availability and scaling configuration"
  value = {
    database_cluster_arn = module.rds.cluster_arn
    database_instances   = module.rds.cluster_instance_ids
    redis_cluster_id     = module.elasticache.redis_cluster_id
  }
  sensitive = false
}

# Resource Tags
output "resource_tags" {
  description = "Common resource tags applied across infrastructure"
  value = {
    environment = var.environment
    project     = var.project
    managed_by  = "terraform"
    compliance  = "sox-compliant"
  }
  sensitive = false
}