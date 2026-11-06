# Cognito User Pool (OIDC Identity Provider per ADR-12)
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
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
  domain       = "${var.project_name}-${var.environment}-${random_string.suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
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
    "https://${aws_cloudfront_distribution.web.domain_name}",
    "https://${aws_cloudfront_distribution.web.domain_name}/"
  ]

  logout_urls = [
    "http://localhost:5173",
    "https://${aws_cloudfront_distribution.web.domain_name}"
  ]

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]
}

# 4 User Groups matching Application Role-Based Access Control
resource "aws_cognito_user_group" "employee" {
  name         = "employee"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Standard employees group"
  precedence   = 40
}

resource "aws_cognito_user_group" "manager" {
  name         = "manager"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Department managers and team leads"
  precedence   = 30
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

# 4 Demo Users
resource "aws_cognito_user" "employee" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "employee@example.com"

  attributes = {
    email          = "employee@example.com"
    email_verified = "true"
    name           = "Demo Employee"
  }

  password       = "Employee123!"
  message_action = "SUPPRESS"
}

resource "aws_cognito_user" "manager" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "manager@example.com"

  attributes = {
    email          = "manager@example.com"
    email_verified = "true"
    name           = "Demo Manager"
  }

  password       = "Manager123!"
  message_action = "SUPPRESS"
}

resource "aws_cognito_user" "hr" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "hr@example.com"

  attributes = {
    email          = "hr@example.com"
    email_verified = "true"
    name           = "Demo HR"
  }

  password       = "HrStaff123!"
  message_action = "SUPPRESS"
}

resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "admin@example.com"

  attributes = {
    email          = "admin@example.com"
    email_verified = "true"
    name           = "Demo Administrator"
  }

  password       = "Admin123!"
  message_action = "SUPPRESS"
}

# Associate Demo Users to their respective Groups
resource "aws_cognito_user_in_group" "employee" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.employee.name
  username     = aws_cognito_user.employee.username
}

resource "aws_cognito_user_in_group" "manager" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.manager.name
  username     = aws_cognito_user.manager.username
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
