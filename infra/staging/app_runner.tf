# App Runner VPC Connector connecting to private subnets
resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "${var.project_name}-${var.environment}-vpc-conn"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.apprunner_connector.id]

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc-conn"
  }
}

# IAM Role for App Runner to pull images from ECR
resource "aws_iam_role" "apprunner_access_role" {
  name = "${var.project_name}-${var.environment}-apprunner-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_access_ecr" {
  role       = aws_iam_role.apprunner_access_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# IAM Role for App Runner Instance (Runtime permissions: Secrets Manager, KMS, SQS, Logs)
resource "aws_iam_role" "apprunner_instance_role" {
  name = "${var.project_name}-${var.environment}-apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "apprunner_instance_policy" {
  name        = "${var.project_name}-${var.environment}-apprunner-instance-policy"
  description = "Permissions for App Runner container to read secrets, KMS, and publish SQS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.app_secrets.arn
        ]
      },
      {
        Sid    = "DecryptKMS"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.main.arn
        ]
      },
      {
        Sid    = "SendSQSMessages"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          aws_sqs_queue.worker_queue.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_instance_attach" {
  role       = aws_iam_role.apprunner_instance_role.name
  policy_arn = aws_iam_policy.apprunner_instance_policy.arn
}

# App Runner Service for Backend API
resource "aws_apprunner_service" "api" {
  service_name = "${var.project_name}-${var.environment}-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access_role.arn
    }
    auto_deployments_enabled = false # Deployments are managed explicitly via CI/CD pipeline

    image_repository {
      image_identifier      = "${aws_ecr_repository.api.repository_url}:latest"
      image_repository_type = "ECR"

      image_configuration {
        port = tostring(var.api_container_port)

        runtime_environment_variables = {
          NODE_ENV             = "production"
          PORT                 = tostring(var.api_container_port)
          DB_HOST              = aws_db_instance.postgres.address
          DB_PORT              = tostring(aws_db_instance.postgres.port)
          DB_NAME              = var.db_name
          DB_USER              = var.db_username
          DB_SSL               = "require"
          AWS_REGION           = var.aws_region
          AUTH_MODE            = "oidc"
          OIDC_ISSUER          = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
          OIDC_JWKS_URI        = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}/.well-known/jwks.json"
          OIDC_ALLOWED_CLIENTS = aws_cognito_user_pool_client.web.id
          OIDC_CLIENT_CLAIM    = "client_id"
          OIDC_ROLES_CLAIM     = "cognito:groups"
          OIDC_USERINFO_URL    = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com/oauth2/userInfo"
          CORS_ORIGIN          = "https://${aws_cloudfront_distribution.web.domain_name}"
          SQS_QUEUE_URL        = aws_sqs_queue.worker_queue.url
        }

        # Sensitive secrets retrieved directly from AWS Secrets Manager
        runtime_environment_secrets = {
          DB_PASSWORD          = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
          FIELD_ENCRYPTION_KEY = "${aws_secretsmanager_secret.app_secrets.arn}:FIELD_ENCRYPTION_KEY::"
        }
      }
    }
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
  }

  instance_configuration {
    cpu               = "512"  # 0.5 vCPU
    memory            = "1024" # 1.0 GB RAM
    instance_role_arn = aws_iam_role.apprunner_instance_role.arn
  }

  depends_on = [
    aws_iam_role_policy_attachment.apprunner_access_ecr,
    aws_iam_role_policy_attachment.apprunner_instance_attach
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-api"
  }
}
