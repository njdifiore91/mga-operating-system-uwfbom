# AWS ElastiCache Redis Cluster Outputs
# Provider version: ~> 4.0
# Purpose: Expose Redis cluster connection details and configuration for application integration

output "redis_cluster_id" {
  description = "ID of the Redis replication group for infrastructure reference and monitoring"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_primary_endpoint" {
  description = "Primary endpoint address for Redis write operations and cluster management"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint address for Redis read operations and load balancing"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port number for Redis connections and security group configuration"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_connection_string" {
  description = "Formatted Redis connection string following standard URI scheme for application configuration"
  value       = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
}