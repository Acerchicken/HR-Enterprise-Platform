# ==============================================================================
# Trợ lý chính sách (UC6, ADR-15, ADR-16) trên staging: staging-readiness F4.
# Assistant service (services/assistant) chạy trên ECS Fargate trong subnet private:
#   - nhận event document.* từ SQS riêng (API đẩy qua outbox), tải file từ S3, tạo index FTS + pgvector trong schema assistant;
#   - API (App Runner, qua VPC connector) gọi POST /internal/answers tại assistant.<namespace>:3100 (Cloud Map, DNS private).
# Mặc định desired_count = 0 để không tốn tiền (0,5 vCPU, 2 GB); bật khi demo theo UC6 deploy.md mục 4a:
#   aws ecs update-service --cluster <cluster> --service <project>-<env>-assistant --desired-count 1
# Terraform bỏ qua thay đổi desired_count (lifecycle) để lệnh bật, tắt tay không bị apply sau ghi đè.
# Một lần sau migration đầu tiên: ALTER ROLE assistant_svc LOGIN PASSWORD '<ASSISTANT_DB_PASSWORD trong secret dưới>';
# ==============================================================================

# ---- Secrets ----
resource "random_password" "assistant_db_password" {
  length  = 24
  special = false # dùng trong URL kết nối
}

resource "random_password" "assistant_internal_token" {
  length  = 40
  special = false
}

# Khóa AES-256-GCM mã hóa API key nhà cung cấp LLM trong assistant.llm_config (FR-6.4): 32 byte base64.
resource "random_id" "assistant_config_key" {
  byte_length = 32
}

resource "aws_secretsmanager_secret" "assistant" {
  name                    = "${var.project_name}/${var.environment}/assistant"
  description             = "Assistant service secrets (internal token, config key, assistant_svc DB credentials)"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-${var.environment}-assistant-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "assistant" {
  secret_id = aws_secretsmanager_secret.assistant.id
  secret_string = jsonencode({
    ASSISTANT_INTERNAL_TOKEN = random_password.assistant_internal_token.result
    ASSISTANT_CONFIG_KEY     = random_id.assistant_config_key.b64_std
    ASSISTANT_DB_PASSWORD    = random_password.assistant_db_password.result
    ASSISTANT_DB_URL         = "postgresql://assistant_svc:${random_password.assistant_db_password.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.db_name}"
  })
}

# ---- Image ----
resource "aws_ecr_repository" "assistant" {
  name                 = "hr-assistant"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "hr-assistant"
  }
}

resource "aws_ecr_lifecycle_policy" "assistant" {
  repository = aws_ecr_repository.assistant.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the last 5 images (about 1 GB each, includes embedding model)"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ---- Queue (event document.* từ API) ----
resource "aws_sqs_queue" "assistant_dlq" {
  name                      = "${var.project_name}-${var.environment}-assistant-document-dlq"
  message_retention_seconds = 1209600 # 14 ngày
  kms_master_key_id         = aws_kms_key.main.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-assistant-document-dlq"
  }
}

resource "aws_sqs_queue" "assistant" {
  name                       = "${var.project_name}-${var.environment}-assistant-document"
  visibility_timeout_seconds = 300     # tải file + tạo embedding có thể mất vài phút
  message_retention_seconds  = 1209600 # 14 ngày: service tắt (desired_count = 0) thì event chờ, bật lên xử lý bù
  kms_master_key_id          = aws_kms_key.main.arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.assistant_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-assistant-document"
  }
}

# ---- Tên ổn định cho API gọi (Fargate đổi IP mỗi lần bật) ----
resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "${var.environment}.hr.internal"
  description = "Private DNS for service-to-service calls inside the VPC"
  vpc         = aws_vpc.main.id
}

resource "aws_service_discovery_service" "assistant" {
  name = "assistant"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# ---- Mạng ----
resource "aws_security_group" "assistant" {
  name        = "${var.project_name}-${var.environment}-assistant-sg"
  description = "Assistant service, port 3100 reachable only from the App Runner VPC connector"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Internal HTTP from App Runner VPC Connector"
    from_port       = 3100
    to_port         = 3100
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner_connector.id]
  }

  egress {
    description = "RDS, SQS, S3 and LLM providers (HTTPS via NAT instance)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-assistant-sg"
  }
}

resource "aws_cloudwatch_log_group" "assistant" {
  name              = "/ecs/${var.project_name}-${var.environment}-assistant"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-${var.environment}-assistant-logs"
  }
}

# ---- IAM ----
resource "aws_iam_role" "assistant_task_role" {
  name = "${var.project_name}-${var.environment}-assistant-task-role"

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

resource "aws_iam_policy" "assistant_task_policy" {
  name = "${var.project_name}-${var.environment}-assistant-task-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeDocumentEvents"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [aws_sqs_queue.assistant.arn]
      },
      {
        Sid      = "ReadDocuments"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = ["${aws_s3_bucket.documents.arn}/*"]
      },
      {
        Sid      = "DecryptQueueAndBucket"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [aws_kms_key.main.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "assistant_task_attach" {
  role       = aws_iam_role.assistant_task_role.name
  policy_arn = aws_iam_policy.assistant_task_policy.arn
}

# ---- Task và service ----
resource "aws_ecs_task_definition" "assistant" {
  family                   = "${var.project_name}-${var.environment}-assistant"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"  # 0,5 vCPU
  memory                   = "2048" # 2 GB: model EmbeddingGemma nạp trong bộ nhớ
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.assistant_task_role.arn

  container_definitions = jsonencode([
    {
      name         = "assistant"
      image        = "${aws_ecr_repository.assistant.repository_url}:latest"
      essential    = true
      portMappings = [{ containerPort = 3100, protocol = "tcp" }]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3100" },
        { name = "DB_SSL", value = "require" },
        { name = "QUEUE_DRIVER", value = "sqs" },
        { name = "SQS_ASSISTANT_QUEUE_URL", value = aws_sqs_queue.assistant.url },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "STORAGE_BUCKET", value = aws_s3_bucket.documents.id },
        { name = "STORAGE_REGION", value = var.aws_region },
        { name = "ASSISTANT_EMBEDDING_MODEL", value = "embeddinggemma-300m" }
      ]

      secrets = [
        { name = "ASSISTANT_DB_URL", valueFrom = "${aws_secretsmanager_secret.assistant.arn}:ASSISTANT_DB_URL::" },
        { name = "ASSISTANT_INTERNAL_TOKEN", valueFrom = "${aws_secretsmanager_secret.assistant.arn}:ASSISTANT_INTERNAL_TOKEN::" },
        { name = "ASSISTANT_CONFIG_KEY", valueFrom = "${aws_secretsmanager_secret.assistant.arn}:ASSISTANT_CONFIG_KEY::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.assistant.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "assistant"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-assistant-task"
  }
}

resource "aws_ecs_service" "assistant" {
  name            = "${var.project_name}-${var.environment}-assistant"
  cluster         = aws_ecs_cluster.staging.id
  task_definition = aws_ecs_task_definition.assistant.arn
  desired_count   = var.assistant_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.assistant.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.assistant.arn
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-assistant-service"
  }
}
