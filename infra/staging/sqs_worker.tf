# ==============================================================================
# QUEUE VÀ WORKER TRÊN STAGING (ADR-15 bước 1, 26/11):
# - Queue leave-notifications: API đẩy event nghỉ phép, hồ sơ (đã có email người nhận); notification service
#   (notification.tf) nhận và gửi email qua Amazon SES API. Local vẫn SMTP tới Mailpit.
# - Queue identity-sync: API đẩy event tài khoản, vai trò (UC8); worker của backend nhận và đồng bộ sang IdP.
# Worker không còn gửi email.
# ==============================================================================

# Dead-Letter Queue (DLQ) for failed notification jobs
resource "aws_sqs_queue" "worker_dlq" {
  name                      = "${var.project_name}-${var.environment}-leave-notifications-dlq"
  message_retention_seconds = 1209600 # 14 days
  kms_master_key_id         = aws_kms_key.main.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-leave-notifications-dlq"
  }
}

# Main SQS Queue for Outbox Notification Worker
resource "aws_sqs_queue" "worker_queue" {
  name                       = "${var.project_name}-${var.environment}-leave-notifications"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600 # 4 days
  kms_master_key_id          = aws_kms_key.main.arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.worker_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-leave-notifications"
  }
}

# Queue event tài khoản, vai trò (UC8 identity-sync), tách khỏi queue email từ 26/11 (staging-readiness F6)
resource "aws_sqs_queue" "identity_dlq" {
  name                      = "${var.project_name}-${var.environment}-identity-sync-dlq"
  message_retention_seconds = 1209600 # 14 days
  kms_master_key_id         = aws_kms_key.main.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-identity-sync-dlq"
  }
}

resource "aws_sqs_queue" "identity" {
  name                       = "${var.project_name}-${var.environment}-identity-sync"
  visibility_timeout_seconds = 120 # identity-sync thử lại IdP tối đa 5 lần trong một lượt nhận
  message_retention_seconds  = 345600
  kms_master_key_id          = aws_kms_key.main.arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.identity_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-identity-sync"
  }
}

# ECS Cluster for Background Workers
resource "aws_ecs_cluster" "staging" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled" # Keep disabled to save on staging CloudWatch metrics costs
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cluster"
  }
}

# CloudWatch Log Group for ECS Worker
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.project_name}-${var.environment}-worker"
  retention_in_days = 14 # Optimized for staging per ADR-12

  tags = {
    Name = "${var.project_name}-${var.environment}-worker-logs"
  }
}

# IAM Role for ECS Task Execution (Pull ECR, CloudWatch Logs)
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project_name}-${var.environment}-ecs-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_standard" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow Execution role to fetch secrets into container definition
resource "aws_iam_policy" "ecs_exec_secrets" {
  name = "${var.project_name}-${var.environment}-ecs-exec-secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.app_secrets.arn,
          aws_secretsmanager_secret.assistant.arn,
          aws_secretsmanager_secret.notification.arn,
          aws_kms_key.main.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_exec_secrets_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ecs_exec_secrets.arn
}

# IAM Role for Worker Task runtime (SQS processing, DB access)
resource "aws_iam_role" "worker_task_role" {
  name = "${var.project_name}-${var.environment}-worker-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "worker_sqs_policy" {
  name = "${var.project_name}-${var.environment}-worker-sqs-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          aws_sqs_queue.identity.arn,
          aws_sqs_queue.identity_dlq.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.main.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.documents.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "worker_sqs_attach" {
  role       = aws_iam_role.worker_task_role.name
  policy_arn = aws_iam_policy.worker_sqs_policy.arn
}

# IAM Policy for Worker to synchronize users with Cognito User Pool (UC8 F2)
resource "aws_iam_policy" "worker_cognito_admin_policy" {
  name        = "${var.project_name}-${var.environment}-worker-cognito-admin-policy"
  description = "Permissions for worker to manage Cognito user accounts (UC8 F2)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CognitoUserAdmin"
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminDisableUser",
          "cognito-idp:AdminEnableUser",
          "cognito-idp:AdminUserGlobalSignOut",
          "cognito-idp:AdminGetUser",
          "cognito-idp:ListUsers"
        ]
        Resource = aws_cognito_user_pool.main.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "worker_cognito_admin_attach" {
  role       = aws_iam_role.worker_task_role.name
  policy_arn = aws_iam_policy.worker_cognito_admin_policy.arn
}

# ECS Task Definition for Worker (identity-sync, transfer and leave jobs)
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project_name}-${var.environment}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256" # 0.25 vCPU
  memory                   = "512" # 0.5 GB RAM
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.worker_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${aws_ecr_repository.api.repository_url}:latest"
      essential = true
      command   = ["node", "dist/worker/main.js"]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "DB_HOST", value = aws_db_instance.postgres.address },
        { name = "DB_PORT", value = tostring(aws_db_instance.postgres.port) },
        { name = "DB_NAME", value = var.db_name },
        { name = "DB_USER", value = var.db_username },
        { name = "DB_SSL", value = "require" },
        { name = "QUEUE_DRIVER", value = "sqs" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "SQS_QUEUE_URL", value = aws_sqs_queue.worker_queue.url },
        { name = "SQS_IDENTITY_QUEUE_URL", value = aws_sqs_queue.identity.url },
        { name = "STORAGE_BUCKET", value = aws_s3_bucket.documents.id },
        { name = "STORAGE_REGION", value = var.aws_region },
        { name = "IDP_ADMIN_DRIVER", value = "cognito" },
        { name = "COGNITO_USER_POOL_ID", value = aws_cognito_user_pool.main.id },
        # Job nền (cộng phép đầu năm, áp dụng điều chuyển) chạy câu lệnh dài hơn request API: nới statement_timeout.
        { name = "DB_STATEMENT_TIMEOUT_MS", value = "60000" }
      ]

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
        },
        {
          name      = "FIELD_ENCRYPTION_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:FIELD_ENCRYPTION_KEY::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-worker-task"
  }
}

# ECS Fargate Service (Single task running continuously in private subnets)
resource "aws_ecs_service" "worker" {
  name            = "${var.project_name}-${var.environment}-worker"
  cluster         = aws_ecs_cluster.staging.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false # In private subnets, egress routed through NAT instance
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-worker-service"
  }
}
