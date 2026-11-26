# ==============================================================================
# Notification service (ADR-15 bước 1) trên staging: staging-readiness F6.
# services/notification chạy trên ECS Fargate trong subnet private:
#   - nhận event nghỉ phép, hồ sơ từ queue leave-notifications (API đẩy qua outbox, payload đã có email người nhận);
#   - gửi email bằng Amazon SES API v2 với task role (MAIL_DRIVER=ses), không cần SMTP credentials;
#   - chống trùng trong schema notification bằng user notification_svc (chỉ có quyền trên schema này).
# Không nhận kết nối vào (không có cổng nghiệp vụ), chỉ đi ra RDS, SQS, SES, CloudWatch qua NAT.
# Một lần sau migration NotificationServiceRole:
#   ALTER ROLE notification_svc LOGIN PASSWORD '<NOTIFICATION_DB_PASSWORD trong secret dưới>';
# ==============================================================================

# ---- Secret ----
resource "random_password" "notification_db_password" {
  length  = 24
  special = false # dùng trong URL kết nối
}

resource "aws_secretsmanager_secret" "notification" {
  name                    = "${var.project_name}/${var.environment}/notification"
  description             = "Notification service secrets (notification_svc DB credentials)"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-${var.environment}-notification-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "notification" {
  secret_id = aws_secretsmanager_secret.notification.id
  secret_string = jsonencode({
    NOTIFICATION_DB_PASSWORD = random_password.notification_db_password.result
    NOTIFICATION_DB_URL      = "postgresql://notification_svc:${random_password.notification_db_password.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.db_name}"
  })
}

# ---- Image ----
resource "aws_ecr_repository" "notification" {
  name                 = "hr-notification"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "hr-notification"
  }
}

resource "aws_ecr_lifecycle_policy" "notification" {
  repository = aws_ecr_repository.notification.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ---- Mạng ----
resource "aws_security_group" "notification" {
  name        = "${var.project_name}-${var.environment}-notification-sg"
  description = "Notification service, no inbound; outbound to RDS and NAT instance (SQS, SES, CloudWatch)"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "RDS, SQS, SES and CloudWatch (HTTPS via NAT instance)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-notification-sg"
  }
}

resource "aws_cloudwatch_log_group" "notification" {
  name              = "/ecs/${var.project_name}-${var.environment}-notification"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-${var.environment}-notification-logs"
  }
}

# ---- IAM ----
resource "aws_iam_role" "notification_task_role" {
  name = "${var.project_name}-${var.environment}-notification-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_policy" "notification_task_policy" {
  name = "${var.project_name}-${var.environment}-notification-task-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeLeaveEvents"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [aws_sqs_queue.worker_queue.arn]
      },
      {
        Sid      = "DecryptQueue"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [aws_kms_key.main.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "notification_task_attach" {
  role       = aws_iam_role.notification_task_role.name
  policy_arn = aws_iam_policy.notification_task_policy.arn
}

# Quyền ses:SendEmail (policy ở ses_alarms.tf) chuyển từ worker sang task notification.
resource "aws_iam_role_policy_attachment" "notification_ses_attach" {
  role       = aws_iam_role.notification_task_role.name
  policy_arn = aws_iam_policy.worker_ses_policy.arn
}

# ---- Task và service ----
resource "aws_ecs_task_definition" "notification" {
  family                   = "${var.project_name}-${var.environment}-notification"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256" # 0,25 vCPU
  memory                   = "512" # 0,5 GB
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.notification_task_role.arn

  container_definitions = jsonencode(concat([
    {
      name      = "notification"
      image     = "${aws_ecr_repository.notification.repository_url}:latest"
      essential = true

      environment = concat([
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3200" },
        { name = "DB_SSL", value = "require" },
        { name = "QUEUE_DRIVER", value = "sqs" },
        { name = "SQS_QUEUE_URL", value = aws_sqs_queue.worker_queue.url },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "MAIL_DRIVER", value = "ses" },
        { name = "SMTP_FROM", value = var.sender_email },
        { name = "MAIL_TIMEOUT_MS", value = "10000" },
        { name = "MAIL_ATTEMPTS", value = "3" }
      ], local.otel_ecs_env["notification"])

      secrets = [
        { name = "NOTIFICATION_DB_URL", valueFrom = "${aws_secretsmanager_secret.notification.arn}:NOTIFICATION_DB_URL::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.notification.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "notification"
        }
      }
    }
  ], local.adot_sidecar["notification"]))

  tags = {
    Name = "${var.project_name}-${var.environment}-notification-task"
  }
}

resource "aws_ecs_service" "notification" {
  name            = "${var.project_name}-${var.environment}-notification"
  cluster         = aws_ecs_cluster.staging.id
  task_definition = aws_ecs_task_definition.notification.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.notification.id]
    assign_public_ip = false
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-notification-service"
  }
}
