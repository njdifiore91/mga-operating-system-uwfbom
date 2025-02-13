# AWS EKS Cluster Outputs Configuration
# Provider version: ~> 5.0
# Purpose: Export essential EKS cluster information for platform integration

# Core Cluster Information
output "cluster_id" {
  description = "The unique identifier of the EKS cluster"
  value       = aws_eks_cluster.main.id
}

output "cluster_name" {
  description = "The name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_version" {
  description = "The Kubernetes version running on the EKS cluster"
  value       = aws_eks_cluster.main.version
}

output "cluster_platform_version" {
  description = "The platform version of the EKS cluster"
  value       = aws_eks_cluster.main.platform_version
}

# Networking Information
output "cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_security_group_id" {
  description = "The security group ID attached to the EKS cluster"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cluster_vpc_config" {
  description = "The VPC configuration for the EKS cluster"
  value = {
    vpc_id             = aws_eks_cluster.main.vpc_config[0].vpc_id
    subnet_ids         = aws_eks_cluster.main.vpc_config[0].subnet_ids
    security_group_ids = aws_eks_cluster.main.vpc_config[0].security_group_ids
  }
}

# Authentication Information
output "cluster_certificate_authority_data" {
  description = "The base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_oidc_issuer_url" {
  description = "The URL of the OpenID Connect identity provider for IAM role federation"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# Node Groups Information
output "node_groups" {
  description = "Map of node groups created and their configurations"
  value = {
    for ng in aws_eks_node_group.main : ng.node_group_name => {
      arn           = ng.arn
      status        = ng.status
      capacity_type = ng.capacity_type
      disk_size     = ng.disk_size
      instance_types = ng.instance_types
      scaling_config = ng.scaling_config
      labels        = ng.labels
      taints        = ng.taints
    }
  }
}

# IAM Information
output "cluster_role_arn" {
  description = "The ARN of the IAM role assumed by the EKS cluster"
  value       = aws_eks_cluster.main.role_arn
}

output "node_group_role_arn" {
  description = "The ARN of the IAM role assumed by the EKS node groups"
  value       = aws_iam_role.eks_node_group.arn
}

# Logging Information
output "cluster_log_types" {
  description = "The enabled control plane logging types for the EKS cluster"
  value       = aws_eks_cluster.main.enabled_cluster_log_types
}

output "cloudwatch_log_group_name" {
  description = "The name of the CloudWatch log group for EKS cluster logs"
  value       = aws_cloudwatch_log_group.eks.name
}

# Tags
output "cluster_tags" {
  description = "The tags applied to the EKS cluster"
  value       = aws_eks_cluster.main.tags
}

# Launch Template Information
output "launch_template" {
  description = "Information about the launch template used for node groups"
  value = {
    id      = aws_launch_template.eks_node.id
    name    = aws_launch_template.eks_node.name
    version = aws_launch_template.eks_node.latest_version
  }
}