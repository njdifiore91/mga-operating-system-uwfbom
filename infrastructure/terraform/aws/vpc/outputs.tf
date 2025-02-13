# VPC Infrastructure Outputs Configuration
# Provider version: ~> 5.0
# Purpose: Expose VPC, subnet, and networking configuration for AWS infrastructure integration

# VPC Outputs
output "vpc_id" {
  description = "ID of the created VPC for use in dependent AWS resources"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC for network planning and security group configuration"
  value       = aws_vpc.main.cidr_block
}

# Subnet Outputs
output "public_subnet_ids" {
  description = "List of public subnet IDs across multiple AZs for load balancer and NAT gateway deployment"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs across multiple AZs for EKS cluster and application workloads"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "List of database subnet IDs across multiple AZs for RDS and ElastiCache deployments"
  value       = aws_subnet.database[*].id
}

# Routing Outputs
output "public_route_table_id" {
  description = "ID of the public route table for internet gateway routing configuration"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of private route table IDs for NAT gateway routing across AZs"
  value       = aws_route_table.private[*].id
}

# NAT Gateway Outputs
output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs providing internet access for private subnets across AZs"
  value       = aws_nat_gateway.main[*].id
}