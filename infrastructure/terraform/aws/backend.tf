# Backend configuration for MGA Operating System infrastructure state management
# AWS Provider Version: ~> 5.0

terraform {
  # S3 backend configuration with encryption and state locking
  backend "s3" {
    # State storage bucket with environment-specific naming
    bucket = "${var.project}-terraform-state-${var.environment}"
    
    # State file path within bucket
    key = "terraform.tfstate"
    
    # Primary region for state storage
    region = var.aws_region
    
    # Enable state file encryption using AWS KMS
    encrypt = true
    
    # DynamoDB table for state locking
    dynamodb_table = "${var.project}-terraform-locks-${var.environment}"
    
    # Enable bucket versioning for state history
    versioning = true
    
    # Restrict bucket access
    acl = "private"
    
    # Use AWS KMS for server-side encryption
    sse_algorithm = "aws:kms"
    
    # Environment-specific workspace prefixing
    workspace_key_prefix = var.environment
    
    # Additional security configurations
    force_path_style = false
    
    # Enable HTTP endpoint for private VPC endpoints
    endpoint = "s3.${var.aws_region}.amazonaws.com"
    
    # Minimum TLS version for API calls
    min_tls_version = "TLS1.2"
    
    # Skip region validation for custom endpoints
    skip_region_validation = false
    
    # Skip credentials validation
    skip_credentials_validation = false
    
    # Skip metadata API check
    skip_metadata_api_check = false
    
    # Maximum retry attempts for state operations
    max_retries = 5
    
    # Enable bucket logging
    logging = {
      target_bucket = "${var.project}-terraform-logs-${var.environment}"
      target_prefix = "terraform-state/"
    }
  }
}