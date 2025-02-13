# AWS MSK (Managed Streaming for Kafka) Variables Configuration
# Provider version: ~> 5.0
# Purpose: Define variables for MSK cluster deployment and configuration

variable "cluster_name" {
  description = "Name of the MSK cluster"
  type        = string
  default     = "mga-os-kafka"
}

variable "environment" {
  description = "Deployment environment (e.g., prod, staging, dev)"
  type        = string

  validation {
    condition     = contains(["prod", "staging", "dev"], var.environment)
    error_message = "Environment must be one of: prod, staging, dev"
  }
}

variable "kafka_version" {
  description = "Apache Kafka version for MSK cluster"
  type        = string
  default     = "3.4.0"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", var.kafka_version))
    error_message = "Kafka version must be in the format X.Y.Z"
  }
}

variable "broker_nodes" {
  description = "Number of broker nodes in the MSK cluster"
  type        = number
  default     = 3

  validation {
    condition     = var.broker_nodes >= 3
    error_message = "Minimum of 3 broker nodes required for high availability"
  }
}

variable "broker_instance_type" {
  description = "EC2 instance type for MSK broker nodes"
  type        = string
  default     = "kafka.m5.large"

  validation {
    condition     = can(regex("^kafka\\.(t3|m5|r5)\\.", var.broker_instance_type))
    error_message = "Broker instance type must be a valid MSK instance type"
  }
}

variable "ebs_volume_size" {
  description = "Size of EBS volumes attached to MSK brokers (GB)"
  type        = number
  default     = 1000

  validation {
    condition     = var.ebs_volume_size >= 100 && var.ebs_volume_size <= 16384
    error_message = "EBS volume size must be between 100 and 16384 GB"
  }
}

variable "retention_period_hours" {
  description = "Message retention period in hours"
  type        = number
  default     = 720  # 30 days

  validation {
    condition     = var.retention_period_hours >= 24
    error_message = "Retention period must be at least 24 hours"
  }
}

variable "vpc_id" {
  description = "ID of the VPC where MSK cluster will be deployed"
  type        = string

  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier"
  }
}

variable "subnet_ids" {
  description = "List of private subnet IDs for MSK broker placement"
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 3
    error_message = "At least 3 subnet IDs required for multi-AZ deployment"
  }
}

variable "security_group_ids" {
  description = "List of security group IDs for MSK cluster"
  type        = list(string)

  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "At least one security group ID is required"
  }
}

variable "kms_key_arn" {
  description = "ARN of KMS key for MSK encryption at rest"
  type        = string

  validation {
    condition     = can(regex("^arn:aws:kms:[a-z0-9-]+:[0-9]+:key/[a-zA-Z0-9-]+$", var.kms_key_arn))
    error_message = "KMS key ARN must be a valid AWS KMS key identifier"
  }
}

variable "monitoring_level" {
  description = "Monitoring level for MSK cluster (DEFAULT, PER_BROKER, or PER_TOPIC_PER_BROKER)"
  type        = string
  default     = "PER_BROKER"

  validation {
    condition     = contains(["DEFAULT", "PER_BROKER", "PER_TOPIC_PER_BROKER"], var.monitoring_level)
    error_message = "Monitoring level must be one of: DEFAULT, PER_BROKER, PER_TOPIC_PER_BROKER"
  }
}

variable "enhanced_monitoring" {
  description = "Enable enhanced monitoring metrics for MSK cluster"
  type        = bool
  default     = true
}

variable "client_authentication" {
  description = "Client authentication configuration for MSK cluster"
  type = object({
    tls_enabled = bool
    sasl_enabled = bool
    iam_enabled = bool
  })
  default = {
    tls_enabled  = true
    sasl_enabled = false
    iam_enabled  = true
  }
}

variable "encryption_in_transit" {
  description = "Encryption in transit configuration for MSK cluster"
  type = object({
    client_broker = string
    in_cluster    = bool
  })
  default = {
    client_broker = "TLS"
    in_cluster    = true
  }

  validation {
    condition     = contains(["PLAINTEXT", "TLS", "TLS_PLAINTEXT"], var.encryption_in_transit.client_broker)
    error_message = "Client-broker encryption must be one of: PLAINTEXT, TLS, TLS_PLAINTEXT"
  }
}

variable "tags" {
  description = "Additional tags for MSK cluster resources"
  type        = map(string)
  default = {
    Project     = "MGA-OS"
    Terraform   = "true"
    CostCenter  = "infrastructure"
  }
}