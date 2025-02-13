# AWS EKS Cluster Configuration for MGA Operating System
# Provider version: ~> 5.0
# Purpose: Provisions and manages production-grade EKS cluster with enhanced security and HA

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

locals {
  name_prefix = "${var.environment}-mga-os"
  
  common_tags = {
    Environment = var.environment
    Project     = "MGA-OS"
    Terraform   = "true"
    ManagedBy   = "Terraform"
  }
}

# EKS Cluster IAM Role
data "aws_iam_policy_document" "eks_cluster_role" {
  statement {
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "eks_cluster" {
  name = "${local.name_prefix}-eks-cluster-role"
  assume_role_policy = data.aws_iam_policy_document.eks_cluster_role.json
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# EKS Node Group IAM Role
data "aws_iam_policy_document" "eks_node_role" {
  statement {
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "eks_node_group" {
  name = "${local.name_prefix}-eks-node-role"
  assume_role_policy = data.aws_iam_policy_document.eks_node_role.json
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_node_policies" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  ])
  
  policy_arn = each.value
  role       = aws_iam_role.eks_node_group.name
}

# EKS Cluster Security Group
resource "aws_security_group" "eks_cluster" {
  name        = "${local.name_prefix}-eks-cluster-sg"
  description = "Security group for EKS cluster control plane"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-cluster-sg"
  })
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "${local.name_prefix}-cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = false
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  encryption_config {
    provider {
      key_arn = var.kms_key_arn
    }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  kubernetes_network_config {
    service_ipv4_cidr = var.service_cidr
    ip_family         = "ipv4"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cluster"
  })

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# EKS Node Groups
resource "aws_eks_node_group" "main" {
  for_each = var.node_groups

  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${local.name_prefix}-${each.key}"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = each.value.instance_types
  capacity_type  = each.value.capacity_type
  disk_size      = each.value.disk_size

  scaling_config {
    desired_size = each.value.scaling_config.desired_size
    max_size     = each.value.scaling_config.max_size
    min_size     = each.value.scaling_config.min_size
  }

  update_config {
    max_unavailable_percentage = 25
  }

  labels = each.value.labels
  taints = each.value.taints

  launch_template {
    name    = aws_launch_template.eks_node.name
    version = aws_launch_template.eks_node.latest_version
  }

  tags = merge(local.common_tags, {
    "kubernetes.io/cluster/${aws_eks_cluster.main.name}" = "owned"
    NodeGroup = each.key
  })

  depends_on = [
    aws_iam_role_policy_attachment.eks_node_policies
  ]
}

# Launch Template for Node Groups
resource "aws_launch_template" "eks_node" {
  name = "${local.name_prefix}-eks-node-template"

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 100
      volume_type          = "gp3"
      encrypted            = true
      kms_key_id           = var.kms_key_arn
      delete_on_termination = true
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, {
      Name = "${local.name_prefix}-eks-node"
    })
  }

  tags = local.common_tags
}

# CloudWatch Log Group for EKS Cluster Logs
resource "aws_cloudwatch_log_group" "eks" {
  name              = "/aws/eks/${local.name_prefix}-cluster/cluster"
  retention_in_days = 30
  kms_key_id        = var.kms_key_arn

  tags = local.common_tags
}