# AWS RDS Aurora PostgreSQL Configuration for MGA Operating System
# Provider version: ~> 5.0

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

# Local variables for resource naming and tagging
locals {
  tags = {
    Environment        = var.environment
    Service           = "mga-rds"
    ManagedBy         = "terraform"
    Compliance        = "sox-compliant"
    CostCenter        = "db-infrastructure"
    BackupRetention   = var.backup_retention_period
    DataClassification = "sensitive"
  }
}

# Generate secure master password
resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store master password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "rds_credentials" {
  name = "${var.cluster_identifier}-credentials"
  kms_key_id = data.aws_kms_key.database.arn
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "rds_credentials" {
  secret_id = aws_secretsmanager_secret.rds_credentials.id
  secret_string = jsonencode({
    username = "mga_admin"
    password = random_password.master.result
  })
}

# RDS Parameter Group for PostgreSQL optimization
resource "aws_rds_cluster_parameter_group" "main" {
  family = "aurora-postgresql14"
  name   = "${var.cluster_identifier}-params"

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }

  parameter {
    name  = "max_connections"
    value = tostring(var.max_connections)
  }

  parameter {
    name  = "work_mem"
    value = "32MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2GB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory/2}"
  }

  parameter {
    name  = "autovacuum_work_mem"
    value = "1GB"
  }

  tags = local.tags
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.cluster_identifier}-subnet-group"
  subnet_ids = data.aws_vpc.vpc_outputs.database_subnet_ids

  tags = local.tags
}

# Security Group for RDS access
resource "aws_security_group" "rds" {
  name        = "${var.cluster_identifier}-sg"
  description = "Security group for RDS Aurora PostgreSQL cluster"
  vpc_id      = data.aws_vpc.vpc_outputs.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = local.tags
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.cluster_identifier}-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]
  tags = local.tags
}

# Aurora PostgreSQL Cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier     = var.cluster_identifier
  engine                = "aurora-postgresql"
  engine_version        = var.engine_version
  database_name         = "mga_os"
  master_username       = "mga_admin"
  master_password       = random_password.master.result
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  storage_encrypted      = var.storage_encrypted
  kms_key_id            = data.aws_kms_key.database.arn
  
  backup_retention_period   = var.backup_retention_period
  preferred_backup_window   = var.preferred_backup_window
  preferred_maintenance_window = var.preferred_maintenance_window
  
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  deletion_protection = var.deletion_protection
  skip_final_snapshot = var.skip_final_snapshot
  final_snapshot_identifier = "${var.cluster_identifier}-final-snapshot"
  
  copy_tags_to_snapshot = true
  apply_immediately     = false
  
  port = 5432
  network_type = "IPV4"
  
  iam_database_authentication_enabled = true
  
  tags = local.tags
}

# Aurora PostgreSQL Cluster Instances
resource "aws_rds_cluster_instance" "main" {
  count = var.instance_count
  
  identifier          = "${var.cluster_identifier}-${count.index + 1}"
  cluster_identifier  = aws_rds_cluster.main.id
  instance_class      = var.instance_class
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version
  
  performance_insights_enabled = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period
  
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  auto_minor_version_upgrade = true
  promotion_tier = count.index + 1
  
  copy_tags_to_snapshot = true
  publicly_accessible  = var.publicly_accessible
  
  ca_cert_identifier  = "rds-ca-2019"
  
  tags = local.tags
}

# Auto Scaling Configuration
resource "aws_appautoscaling_target" "replicas" {
  count = var.autoscaling_enabled ? 1 : 0
  
  max_capacity       = var.autoscaling_max_capacity
  min_capacity       = var.autoscaling_min_capacity
  resource_id        = "cluster:${aws_rds_cluster.main.cluster_identifier}"
  scalable_dimension = "rds:cluster:ReadReplicaCount"
  service_namespace  = "rds"
}

resource "aws_appautoscaling_policy" "replicas" {
  count = var.autoscaling_enabled ? 1 : 0
  
  name               = "${var.cluster_identifier}-autoscaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.replicas[0].resource_id
  scalable_dimension = aws_appautoscaling_target.replicas[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.replicas[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "RDSReaderAverageCPUUtilization"
    }
    target_value = 75.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }
}

# Outputs
output "cluster_endpoint" {
  description = "Writer endpoint for the RDS cluster"
  value       = aws_rds_cluster.main.endpoint
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint for the RDS cluster"
  value       = aws_rds_cluster.main.reader_endpoint
}

output "cluster_identifier" {
  description = "Identifier of the RDS cluster"
  value       = aws_rds_cluster.main.id
}