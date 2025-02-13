# Environment configuration
variable "environment" {
  type        = string
  description = "Environment name for resource tagging and identification (e.g., prod, staging, dev)"
}

# Cluster identification
variable "cluster_identifier" {
  type        = string
  description = "Unique identifier for the RDS Aurora PostgreSQL cluster"
}

# Database engine configuration
variable "engine_version" {
  type        = string
  description = "PostgreSQL engine version for Aurora cluster"
  default     = "14.9"  # Latest stable PostgreSQL 14 version for Aurora
}

# Instance configuration
variable "instance_class" {
  type        = string
  description = "Instance class for RDS Aurora PostgreSQL cluster nodes"
  default     = "db.r6g.2xlarge"  # Optimized for memory-intensive database workloads
}

variable "instance_count" {
  type        = number
  description = "Number of instances in the Aurora cluster (minimum 2 for high availability)"
  default     = 3  # 1 writer + 2 readers for production workload distribution
}

# Backup configuration
variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 30  # Standard retention for production databases
}

variable "preferred_backup_window" {
  type        = string
  description = "Daily time range during which automated backups are created (UTC)"
  default     = "03:00-04:00"  # Off-peak window for minimal impact
}

# Maintenance configuration
variable "preferred_maintenance_window" {
  type        = string
  description = "Weekly time range during which system maintenance can occur (UTC)"
  default     = "sun:04:00-sun:05:00"  # Weekly maintenance window during off-peak hours
}

# Protection settings
variable "skip_final_snapshot" {
  type        = bool
  description = "Determines whether a final DB snapshot is created before the cluster is deleted"
  default     = false  # Always create final snapshot for production safety
}

variable "deletion_protection" {
  type        = bool
  description = "Prevents the database from being deleted accidentally"
  default     = true  # Enable deletion protection for production safety
}

# Performance configuration
variable "max_connections" {
  type        = number
  description = "Maximum number of database connections allowed"
  default     = 5000  # Optimized for high-concurrency workloads
}

# Storage configuration
variable "storage_encrypted" {
  type        = bool
  description = "Specifies whether the DB cluster storage should be encrypted"
  default     = true  # Enable encryption by default for security
}

# Monitoring configuration
variable "monitoring_interval" {
  type        = number
  description = "Interval, in seconds, between points when Enhanced Monitoring metrics are collected"
  default     = 15  # Standard monitoring interval for production
}

variable "performance_insights_enabled" {
  type        = bool
  description = "Specifies whether Performance Insights are enabled"
  default     = true  # Enable performance insights for monitoring
}

variable "performance_insights_retention_period" {
  type        = number
  description = "Amount of time (in days) to retain Performance Insights data"
  default     = 7  # Standard retention for performance analysis
}

# Network configuration
variable "publicly_accessible" {
  type        = bool
  description = "Specifies whether the RDS cluster should be publicly accessible"
  default     = false  # Private access only for security
}

# Auto scaling configuration
variable "autoscaling_enabled" {
  type        = bool
  description = "Enables automatic scaling of Aurora replicas"
  default     = true  # Enable auto-scaling for production workloads
}

variable "autoscaling_min_capacity" {
  type        = number
  description = "Minimum number of Aurora replicas"
  default     = 2  # Minimum replicas for high availability
}

variable "autoscaling_max_capacity" {
  type        = number
  description = "Maximum number of Aurora replicas"
  default     = 5  # Maximum replicas for peak loads
}