# Cognito User Pool (OIDC Identity Provider per ADR-12)
resource "aws_cognito_user_pool" "main" {
  name           = "${var.project_name}-${var.environment}-users"
  user_pool_tier = "ESSENTIALS"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Enforce TOTP MFA for all accounts on Cognito per ADR-17 / NFR-5.4
  mfa_configuration = "ON"
  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "DEVELOPER"
    source_arn            = aws_ses_email_identity.sender.arn
    from_email_address    = var.sender_email
  }

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cognito"
  }
}

# Cognito Hosted Domain for OIDC endpoints (/oauth2/userInfo, /logout)
resource "aws_cognito_user_pool_domain" "main" {
  domain                = "${var.project_name}-${var.environment}-${random_string.suffix.result}"
  user_pool_id          = aws_cognito_user_pool.main.id
  managed_login_version = 2
}

# Cognito App Client for Web SPA (Authorization Code Grant with PKCE, public client)
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-${var.environment}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = false # Public client for browser SPA
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = [
    "http://localhost:5173",
    "http://localhost:5173/",
    "http://localhost:5173/callback",
    "https://${aws_cloudfront_distribution.web.domain_name}",
    "https://${aws_cloudfront_distribution.web.domain_name}/",
    "https://${aws_cloudfront_distribution.web.domain_name}/callback"
  ]

  logout_urls = [
    "http://localhost:5173",
    "https://${aws_cloudfront_distribution.web.domain_name}"
  ]

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  access_token_validity  = 15
  id_token_validity      = 15
  refresh_token_validity = 10

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "hours"
  }
}

# Nhóm trên IdP chỉ để IdP bắt MFA theo vai trò; API không đọc nhóm, vai trò lấy từ database (ADR-18).
# Không có nhóm manager: MANAGER suy ra từ sơ đồ tổ chức (ADR-10).
resource "aws_cognito_user_group" "employee" {
  name         = "employee"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Standard employees group"
  precedence   = 40
}

resource "aws_cognito_user_group" "hr" {
  name         = "hr"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Human Resources staff"
  precedence   = 20
}

resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "System administrators"
  precedence   = 10
}

# Random passwords for Demo Users (length 16, upper, lower, numbers, special characters)
resource "random_password" "demo_employee" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "demo_manager" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "demo_hr" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "demo_admin" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# 4 Demo Users aligned with backend seed data (@hr.local)
resource "aws_cognito_user" "employee" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "employee@hr.local"

  attributes = {
    email          = "employee@hr.local"
    email_verified = "true"
    name           = "Demo Employee"
  }

  password       = random_password.demo_employee.result
  message_action = "SUPPRESS"
}

resource "aws_cognito_user" "manager" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "manager@hr.local"

  attributes = {
    email          = "manager@hr.local"
    email_verified = "true"
    name           = "Demo Manager"
  }

  password       = random_password.demo_manager.result
  message_action = "SUPPRESS"
}

resource "aws_cognito_user" "hr" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "hr@hr.local"

  attributes = {
    email          = "hr@hr.local"
    email_verified = "true"
    name           = "Demo HR"
  }

  password       = random_password.demo_hr.result
  message_action = "SUPPRESS"
}

resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "admin@hr.local"

  attributes = {
    email          = "admin@hr.local"
    email_verified = "true"
    name           = "Demo Administrator"
  }

  password       = random_password.demo_admin.result
  message_action = "SUPPRESS"
}

# Associate Demo Users to their respective Groups
resource "aws_cognito_user_in_group" "employee" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.employee.name
  username     = aws_cognito_user.employee.username
}

resource "aws_cognito_user_in_group" "hr" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.hr.name
  username     = aws_cognito_user.hr.username
}

resource "aws_cognito_user_in_group" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.admin.name
  username     = aws_cognito_user.admin.username
}

# Store demo user credentials securely in Secrets Manager (never in plaintext or outputs)
resource "aws_secretsmanager_secret" "cognito_demo_credentials" {
  name                    = "${var.project_name}/${var.environment}/cognito-demo-credentials"
  description             = "Auto-generated demo account credentials for ${var.project_name} staging"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-${var.environment}-cognito-demo-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "cognito_demo_credentials" {
  secret_id = aws_secretsmanager_secret.cognito_demo_credentials.id
  secret_string = jsonencode({
    employee = {
      username = aws_cognito_user.employee.username
      password = random_password.demo_employee.result
    }
    manager = {
      username = aws_cognito_user.manager.username
      password = random_password.demo_manager.result
    }
    hr = {
      username = aws_cognito_user.hr.username
      password = random_password.demo_hr.result
    }
    admin = {
      username = aws_cognito_user.admin.username
      password = random_password.demo_admin.result
    }
  })
}
