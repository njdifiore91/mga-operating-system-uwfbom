# AWS ElastiCache Redis Configuration for MGA Operating System
# Provider version: ~> 4.0
# Purpose: Deploys a highly available Redis cluster for caching layer

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Redis subnet group for cluster deployment
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-${var.environment}-redis-subnet-group"
  subnet_ids = data.terraform_remote_state.vpc.outputs.database_subnet_ids
  tags       = var.tags
}

# Redis parameter group for optimized performance
resource "aws_elasticache_parameter_group" "redis" {
  family = var.redis_parameter_group_family
  name   = "${var.project_name}-${var.environment}-redis-params"

  # Performance and reliability optimizations
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # Least Recently Used eviction policy
  }

  parameter {
    name  = "timeout"
    value = "300"  # Connection timeout in seconds
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"  # Sample size for LRU eviction
  }

  parameter {
    name  = "activedefrag"
    value = "yes"  # Enable active defragmentation
  }

  parameter {
    name  = "lazyfree-lazy-eviction"
    value = "yes"  # Asynchronous evictions
  }

  parameter {
    name  = "maxclients"
    value = "65000"  # Maximum client connections
  }

  tags = var.tags
}

# Redis replication group for high availability
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.project_name}-${var.environment}-redis"
  replication_group_description = "Redis cluster for MGA OS caching layer"
  node_type                    = var.redis_node_type
  number_cache_clusters        = var.redis_num_cache_clusters
  port                         = var.redis_port
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  
  # High availability configuration
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  
  # Maintenance and backup configuration
  maintenance_window         = var.redis_maintenance_window
  snapshot_retention_limit   = var.redis_snapshot_retention_limit
  snapshot_window           = "00:00-01:00"
  auto_minor_version_upgrade = true
  
  # Monitoring configuration
  notification_topic_arn = var.sns_topic_arn
  
  # Performance configuration
  engine_version = "7.0"  # Latest stable Redis version
  
  tags = var.tags
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = data.terraform_remote_state.vpc.outputs.vpc_id

  ingress {
    description = "Redis from private subnets"
    from_port   = var.redis_port
    to_port     = var.redis_port
    protocol    = "tcp"
    cidr_blocks = data.terraform_remote_state.vpc.outputs.private_subnet_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  })
}

# Outputs for other modules
output "redis_cluster_id" {
  description = "ID of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_endpoint" {
  description = "Primary endpoint for Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for Redis cluster"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port number for Redis cluster"
  value       = var.redis_port
}