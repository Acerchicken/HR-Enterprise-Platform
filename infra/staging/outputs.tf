# Network Outputs
output "vpc_id" {
  description = "ID of the staging VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

# RDS Outputs (Host and Port only, No secrets)
output "rds_endpoint" {
  description = "RDS PostgreSQL connection endpoint (hostname:port)"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS PostgreSQL hostname"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.postgres.port
}

# Secrets Manager ARNs (No raw secret values exposed)
output "db_credentials_secret_arn" {
  description = "ARN of Secrets Manager secret storing database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "app_secrets_arn" {
  description = "ARN of Secrets Manager secret storing application encryption keys"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "cognito_demo_credentials_secret_arn" {
  description = "ARN of Secrets Manager secret storing Cognito demo user credentials (never logs raw passwords)"
  value       = aws_secretsmanager_secret.cognito_demo_credentials.arn
}

# ECR Outputs
output "ecr_api_repository_url" {
  description = "ECR Repository URL for Backend API & Worker"
  value       = aws_ecr_repository.api.repository_url
}

# App Runner API Output
output "app_runner_service_url" {
  description = "Public URL of the backend REST API on AWS App Runner"
  value       = "https://${aws_apprunner_service.api.service_url}"
}

# Frontend Web & CDN Outputs
output "s3_web_bucket" {
  description = "S3 Bucket hosting frontend static bundle"
  value       = aws_s3_bucket.web.bucket
}

output "s3_documents_bucket" {
  description = "S3 Bucket hosting HR policies and employee documents"
  value       = aws_s3_bucket.documents.bucket
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name serving the Frontend Web SPA"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

# Cognito OIDC Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_endpoint" {
  description = "Cognito User Pool OIDC Issuer URL"
  value       = "https://${aws_cognito_user_pool.main.endpoint}"
}

output "cognito_client_id" {
  description = "Cognito User Pool Web Client ID"
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_domain" {
  description = "Cognito Hosted Domain prefix"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "oidc_jwks_uri" {
  description = "Cognito JWKS URI for token signature verification"
  value       = "https://${aws_cognito_user_pool.main.endpoint}/.well-known/jwks.json"
}

output "oidc_userinfo_url" {
  description = "Cognito UserInfo endpoint URL"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com/oauth2/userInfo"
}

output "oidc_logout_url" {
  description = "Cognito Logout endpoint URL for Web SPA"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com/logout?client_id=${aws_cognito_user_pool_client.web.id}&logout_uri=https://${aws_cloudfront_distribution.web.domain_name}"
}

# SQS Worker Outputs
output "sqs_queue_url" {
  description = "URL of the primary SQS Queue for Outbox Notification Worker"
  value       = aws_sqs_queue.worker_queue.url
}

output "sqs_dlq_url" {
  description = "URL of the Dead-Letter Queue"
  value       = aws_sqs_queue.worker_dlq.url
}

# CI/CD Deployment Outputs
output "github_actions_role_arn" {
  description = "IAM Role ARN to be assumed by GitHub Actions via OIDC"
  value       = aws_iam_role.github_actions_deploy.arn
}

output "nat_instance_id" {
  description = "ID of the NAT instance (stop outside demo hours to save cost)"
  value       = aws_instance.nat.id
}
