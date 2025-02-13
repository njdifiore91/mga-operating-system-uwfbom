# AWS EKS Variables Configuration
# Provider Version: ~> 5.0

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster for the MGA Operating System platform"

  validation {
    condition     = can(regex("^mga-[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must start with 'mga-' followed by alphanumeric characters and hyphens"
  }
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster (must be 1.27 or higher per technical requirements)"
  default     = "1.27"

  validation {
    condition     = can(regex("^1\\.2[7-9]$", var.kubernetes_version))
    error_message = "Kubernetes version must be 1.27 or higher as per technical requirements"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment for the EKS cluster"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    disk_size     = number
    scaling_config = object({
      desired_size = number
      min_size     = number
      max_size     = number
    })
    labels        = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
    capacity_type = string
  }))
  description = "Configuration for EKS node groups with specific instance types for different workloads"

  default = {
    general = {
      instance_types = ["c5.xlarge"]
      disk_size     = 100
      scaling_config = {
        desired_size = 3
        min_size    = 2
        max_size    = 5
      }
      labels = {
        role     = "general"
        workload = "mga-services"
      }
      taints        = []
      capacity_type = "ON_DEMAND"
    }
    memory_optimized = {
      instance_types = ["r6g.2xlarge"]
      disk_size     = 200
      scaling_config = {
        desired_size = 2
        min_size    = 1
        max_size    = 4
      }
      labels = {
        role     = "memory-optimized"
        workload = "analytics"
      }
      taints        = []
      capacity_type = "ON_DEMAND"
    }
  }
}

variable "cluster_security_config" {
  type = object({
    enable_private_endpoint = bool
    enable_public_endpoint = bool
    allowed_cidr_blocks   = list(string)
    encryption_config     = object({
      resources         = list(string)
      provider_key_arn  = string
    })
  })
  description = "Security configuration for the EKS cluster"

  default = {
    enable_private_endpoint = true
    enable_public_endpoint = false
    allowed_cidr_blocks    = []
    encryption_config = {
      resources        = ["secrets"]
      provider_key_arn = ""
    }
  }
}

variable "logging_config" {
  type = object({
    enabled_types  = list(string)
    retention_days = number
  })
  description = "Control plane logging configuration for EKS cluster"

  default = {
    enabled_types  = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
    retention_days = 90
  }
}

variable "tags" {
  type        = map(string)
  description = "Common tags for all EKS resources"
  
  default = {
    Project     = "MGA-OS"
    Terraform   = "true"
    Environment = "production"
  }
}

variable "vpc_config" {
  type = object({
    vpc_id             = string
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  description = "VPC configuration for EKS cluster deployment"
}

variable "addon_config" {
  type = map(object({
    version               = string
    resolve_conflicts     = string
    service_account_role_arn = string
  }))
  description = "Configuration for EKS add-ons (e.g., VPC CNI, CoreDNS, kube-proxy)"

  default = {
    vpc_cni = {
      version               = "v1.12.0"
      resolve_conflicts     = "OVERWRITE"
      service_account_role_arn = ""
    }
    coredns = {
      version               = "v1.9.3"
      resolve_conflicts     = "OVERWRITE"
      service_account_role_arn = ""
    }
    kube_proxy = {
      version               = "v1.27.1"
      resolve_conflicts     = "OVERWRITE"
      service_account_role_arn = ""
    }
  }
}

variable "auth_config" {
  type = object({
    aws_auth_roles = list(object({
      rolearn  = string
      username = string
      groups   = list(string)
    }))
    aws_auth_users = list(object({
      userarn  = string
      username = string
      groups   = list(string)
    }))
  })
  description = "AWS IAM role and user mappings for Kubernetes RBAC"

  default = {
    aws_auth_roles = []
    aws_auth_users = []
  }
}