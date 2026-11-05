# KMS Customer Managed Key for encrypting Secrets, RDS, and SQS
resource "aws_kms_key" "main" {
  description             = "KMS Key for ${var.project_name}-${var.environment} encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-kms"
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.project_name}-${var.environment}-key"
  target_key_id = aws_kms_key.main.key_id
}

# Generate 32-byte Base64 key for AES-256 field encryption in NestJS backend
# (Required by backend/src/common/field-crypto.ts: 32 bytes base64 encoded)
resource "random_id" "field_encryption_key" {
  byte_length = 32
}

# Generate random secure password for RDS PostgreSQL
resource "random_password" "db_password" {
  length  = 24
  special = false # Avoid special characters that break database URL connection strings
}

# Secrets Manager: Database Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}/${var.environment}/db-credentials"
  description             = "Master database connection credentials for ${var.project_name} staging"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 0 # Immediate deletion on destroy for staging

  tags = {
    Name = "${var.project_name}-${var.environment}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    database = var.db_name
    url      = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.db_name}"
  })
}

# Secrets Manager: Application Secrets (FIELD_ENCRYPTION_KEY)
# Never exposed in code or outputs per project requirements
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}/${var.environment}/app-secrets"
  description             = "Application cryptographic secrets for ${var.project_name} staging"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-${var.environment}-app-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    FIELD_ENCRYPTION_KEY = random_id.field_encryption_key.b64_std
  })
}
