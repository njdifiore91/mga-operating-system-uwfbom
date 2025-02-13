# Core Terraform functionality for variable definitions
terraform {
  required_version = "~> 1.0"
}

variable "project_name" {
  type        = string
  description = "Name of the project used for resource naming"
  default     = "mga-os"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache node instance type"
  default     = "cache.r6g.large"
  validation {
    condition     = can(regex("^cache\\.r6g\\.(large|xlarge|2xlarge)$", var.redis_node_type))
    error_message = "Redis node type must be a valid r6g instance type"
  }
}

variable "redis_num_cache_clusters" {
  type        = number
  description = "Number of cache clusters (nodes) in the replication group"
  default     = 3
  validation {
    condition     = var.redis_num_cache_clusters >= 2
    error_message = "Must have at least 2 cache clusters for high availability"
  }
}

variable "redis_port" {
  type        = number
  description = "Port number for Redis cluster"
  default     = 6379
  validation {
    condition     = var.redis_port > 0 && var.redis_port < 65536
    error_message = "Port number must be between 1 and 65535"
  }
}

variable "redis_parameter_group_family" {
  type        = string
  description = "Redis parameter group family"
  default     = "redis7.0"
  validation {
    condition     = can(regex("^redis[0-9]\\.[0-9]$", var.redis_parameter_group_family))
    error_message = "Parameter group family must be a valid Redis version"
  }
}

variable "redis_maintenance_window" {
  type        = string
  description = "Weekly maintenance window"
  default     = "sun:05:00-sun:07:00"
  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.redis_maintenance_window))
    error_message = "Maintenance window must be in format day:HH:MM-day:HH:MM"
  }
}

variable "redis_snapshot_retention_limit" {
  type        = number
  description = "Number of days to retain automatic snapshots"
  default     = 7
  validation {
    condition     = var.redis_snapshot_retention_limit >= 0 && var.redis_snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days"
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
  default = {
    Terraform  = "true"
    Project    = "MGA-OS"
    Component  = "Cache"
  }
}