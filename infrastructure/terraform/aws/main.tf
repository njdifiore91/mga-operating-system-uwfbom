# AWS Infrastructure Configuration for MGA Operating System
# Provider version: ~> 5.0
# Purpose: Orchestrates the AWS infrastructure deployment with multi-region support,
# high availability, and comprehensive security controls

terraform {
  required_version = "~> 1.5"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Backend configuration should be provided via backend config file
    encrypt = true
  }
}

# Primary region provider
provider "aws" {
  region = var.primary_region
  
  default_tags {
    tags = local.common_tags
  }
}

# Secondary region provider for disaster recovery
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
  
  default_tags {
    tags = local.common_tags
  }
}

locals {
  name_prefix = "${var.environment}-mga-os"
  common_tags = {
    Project            = "MGA-OS"
    Environment        = var.environment
    Terraform          = "true"
    DR-Tier           = "Tier-1"
    Compliance-Level  = "High"
    DataClassification = "Sensitive"
    ManagedBy         = "Terraform"
  }
}

# VPC Module - Primary Region
module "vpc_primary" {
  source = "./vpc"
  providers = {
    aws = aws
  }

  environment            = var.environment
  vpc_cidr              = "10.0.0.0/16"
  availability_zones    = ["${var.primary_region}a", "${var.primary_region}b", "${var.primary_region}c"]
  public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  database_subnet_cidrs = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
  enable_nat_gateway    = true
  single_nat_gateway    = var.environment != "production"
}

# VPC Module - Secondary Region
module "vpc_secondary" {
  source = "./vpc"
  providers = {
    aws = aws.secondary
  }

  environment            = var.environment
  vpc_cidr              = "10.1.0.0/16"
  availability_zones    = ["${var.secondary_region}a", "${var.secondary_region}b", "${var.secondary_region}c"]
  public_subnet_cidrs   = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  private_subnet_cidrs  = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
  database_subnet_cidrs = ["10.1.21.0/24", "10.1.22.0/24", "10.1.23.0/24"]
  enable_nat_gateway    = true
  single_nat_gateway    = var.environment != "production"
}

# EKS Module - Primary Region
module "eks_primary" {
  source = "./eks"
  providers = {
    aws = aws
  }

  environment = var.environment
  vpc_id      = module.vpc_primary.vpc_id
  subnet_ids  = module.vpc_primary.private_subnet_ids

  cluster_name    = "${local.name_prefix}-primary"
  cluster_version = "1.27"

  node_groups = {
    critical = {
      instance_types  = ["c5.xlarge"]
      desired_size    = 3
      min_size       = 2
      max_size       = 10
      disk_size      = 100
    }
    general = {
      instance_types  = ["m5.large"]
      desired_size    = 3
      min_size       = 2
      max_size       = 8
      disk_size      = 50
    }
  }
}

# RDS Module - Primary Region
module "rds_primary" {
  source = "./rds"
  providers = {
    aws = aws
  }

  environment = var.environment
  vpc_id      = module.vpc_primary.vpc_id
  subnet_ids  = module.vpc_primary.database_subnet_ids

  identifier           = "${local.name_prefix}-primary"
  engine              = "postgres"
  engine_version      = "14.7"
  instance_class      = "db.r6g.xlarge"
  allocated_storage   = 100
  storage_encrypted   = true
  multi_az           = true
  backup_retention_period = 30
  deletion_protection = true
}

# ElastiCache Module - Primary Region
module "elasticache_primary" {
  source = "./elasticache"
  providers = {
    aws = aws
  }

  environment = var.environment
  vpc_id      = module.vpc_primary.vpc_id
  subnet_ids  = module.vpc_primary.database_subnet_ids

  cluster_id           = "${local.name_prefix}-primary"
  engine              = "redis"
  engine_version      = "7.0"
  node_type           = "cache.r6g.large"
  num_cache_clusters  = 3
  parameter_group_family = "redis7"
  port                = 6379
  multi_az_enabled    = true
}

# WAF Module
module "waf" {
  source = "./waf"
  providers = {
    aws = aws
  }

  environment = var.environment
  name_prefix = local.name_prefix

  enable_logging     = true
  enable_rate_limiting = true
  ip_rate_limit     = 2000

  rule_groups = [
    "OWASP-Top-10",
    "Known-Bad-Inputs",
    "IP-Reputation",
    "Bot-Control"
  ]
}

# Outputs
output "infrastructure_outputs" {
  description = "Comprehensive infrastructure outputs for multi-region deployment"
  value = {
    vpc_ids = {
      primary   = module.vpc_primary.vpc_id
      secondary = module.vpc_secondary.vpc_id
    }
    eks_endpoints = {
      primary   = module.eks_primary.cluster_endpoint
    }
    database_endpoints = {
      primary   = module.rds_primary.endpoint
    }
  }
}