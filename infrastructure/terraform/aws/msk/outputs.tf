# AWS MSK (Managed Streaming for Kafka) Outputs Configuration
# Provider version: ~> 5.0
# Purpose: Expose critical MSK cluster information for service integration and monitoring

output "cluster_arn" {
  description = "ARN of the MSK cluster for resource referencing and IAM policies"
  value       = aws_msk_cluster.main.arn
  sensitive   = false
}

output "bootstrap_brokers" {
  description = "TLS-enabled bootstrap broker string for secure client connections"
  value       = aws_msk_cluster.main.bootstrap_brokers_tls
  sensitive   = true
}

output "zookeeper_connect_string" {
  description = "ZooKeeper connection string for cluster management and monitoring"
  value       = aws_msk_cluster.main.zookeeper_connect_string
  sensitive   = true
}