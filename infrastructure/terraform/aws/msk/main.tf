# AWS MSK (Managed Streaming for Kafka) Configuration
# Provider version: ~> 5.0
# Purpose: Deploy and configure production-grade MSK cluster for MGA Operating System

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

locals {
  default_tags = {
    Environment      = var.environment
    Project         = "MGA-OS"
    ManagedBy       = "Terraform"
    Component       = "EventStore"
    SecurityLevel   = "High"
    ComplianceScope = "SOC2"
  }
}

# CloudWatch Log Group for MSK Broker Logs
resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/${var.cluster_name}"
  retention_in_days = 30
  tags             = local.default_tags
}

# MSK Cluster Configuration
resource "aws_msk_configuration" "main" {
  name              = "${var.cluster_name}-config"
  kafka_versions    = [var.kafka_version]
  description       = "Production configuration for MGA OS Kafka cluster"

  server_properties = <<PROPERTIES
auto.create.topics.enable=false
default.replication.factor=3
min.insync.replicas=2
num.partitions=6
log.retention.hours=${var.retention_period_hours}
unclean.leader.election.enable=false
auto.leader.rebalance.enable=true
log.segment.bytes=536870912
log.retention.check.interval.ms=300000
log.cleaner.enable=true
PROPERTIES
}

# MSK Cluster
resource "aws_msk_cluster" "main" {
  cluster_name           = var.cluster_name
  kafka_version         = var.kafka_version
  number_of_broker_nodes = var.broker_nodes

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.subnet_ids
    security_groups = var.security_group_ids

    storage_info {
      ebs_storage_info {
        volume_size = var.ebs_volume_size
        provisioned_throughput {
          enabled           = true
          volume_throughput = 250
        }
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = var.kms_key_arn
    encryption_in_transit {
      client_broker = var.encryption_in_transit.client_broker
      in_cluster    = var.encryption_in_transit.in_cluster
    }
  }

  client_authentication {
    tls {
      certificate_authority_arns = var.client_authentication.tls_enabled ? [aws_acmpca_certificate_authority.msk[0].arn] : []
    }
    sasl {
      iam {
        enabled = var.client_authentication.iam_enabled
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
      firehose {
        enabled         = true
        delivery_stream = var.firehose_stream_name
      }
      s3 {
        enabled = true
        bucket  = var.s3_logs_bucket
        prefix  = "msk-logs/${var.environment}"
      }
    }
  }

  enhanced_monitoring = var.monitoring_level

  tags = merge(
    local.default_tags,
    {
      Name = var.cluster_name
    }
  )

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      broker_node_group_info[0].storage_info[0].ebs_storage_info[0].volume_size
    ]
  }
}

# CloudWatch Dashboard for MSK Monitoring
resource "aws_cloudwatch_dashboard" "msk" {
  dashboard_name = "${var.cluster_name}-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Kafka", "CPUUtilization", "Cluster Name", var.cluster_name],
            [".", "MemoryUtilization", ".", "."],
            [".", "DiskUtilization", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "MSK Cluster Resource Utilization"
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Kafka", "BytesInPerSec", "Cluster Name", var.cluster_name],
            [".", "BytesOutPerSec", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "MSK Cluster Network Traffic"
        }
      }
    ]
  })
}

# Data source for current AWS region
data "aws_region" "current" {}

# Outputs
output "bootstrap_brokers_tls" {
  description = "TLS connection host:port pairs"
  value       = aws_msk_cluster.main.bootstrap_brokers_tls
}

output "zookeeper_connect_string" {
  description = "Zookeeper connection string"
  value       = aws_msk_cluster.main.zookeeper_connect_string
}

output "cluster_arn" {
  description = "MSK cluster ARN"
  value       = aws_msk_cluster.main.arn
}

output "current_version" {
  description = "Current version of the MSK cluster"
  value       = aws_msk_cluster.main.current_version
}