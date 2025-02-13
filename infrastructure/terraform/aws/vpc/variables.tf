# Terraform AWS VPC Module Variables
# Version: ~> 1.5
# Purpose: Define input variables for VPC infrastructure deployment

variable "environment" {
  description = "Deployment environment identifier (e.g., production, staging, development)"
  type        = string

  validation {
    condition     = can(regex("^(production|staging|development)$", var.environment))
    error_message = "Environment must be one of: production, staging, development"
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC network space"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  description = "List of AWS availability zones for multi-AZ deployment"
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones required for high availability"
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_cidrs) == length(var.availability_zones)
    error_message = "Number of public subnet CIDRs must match number of availability zones"
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_cidrs) == length(var.availability_zones)
    error_message = "Number of private subnet CIDRs must match number of availability zones"
  }
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets (one per AZ)"
  type        = list(string)

  validation {
    condition     = length(var.database_subnet_cidrs) == length(var.availability_zones)
    error_message = "Number of database subnet CIDRs must match number of availability zones"
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnet internet access"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway instead of one per AZ"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags for VPC resources"
  type        = map(string)
  default = {
    Project   = "MGA-OS"
    Terraform = "true"
  }
}