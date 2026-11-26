# ADR-15 bước 4: truy vết phân tán trên staging bằng AWS X-Ray.
#
# - API (App Runner): bật observability của App Runner (vendor AWSXRAY). App Runner tự chạy collector ADOT, chỉ nhận OTLP gRPC
#   ở localhost:4317, nên API đặt OTEL_EXPORTER_OTLP_PROTOCOL=grpc.
# - Worker, notification, assistant (ECS Fargate): mỗi task thêm container phụ ADOT collector nhận OTLP/HTTP ở 127.0.0.1:4318
#   (cùng network namespace awsvpc) rồi gửi sang X-Ray. Cấu hình collector truyền qua biến AOT_CONFIG_CONTENT.
# - Trace ID W3C (traceparent qua outbox và queue) giữ nguyên; X-Ray nhận trace ID W3C.
# Tắt cả hai phần: xray_tracing_enabled = false (không đặt OTEL_EXPORTER_OTLP_ENDPOINT thì SDK trong code không chạy).

variable "xray_tracing_enabled" {
  description = "Bật truy vết X-Ray cho API và các service (ADR-15 bước 4)"
  type        = bool
  default     = true
}

variable "adot_collector_image" {
  description = "Image ADOT collector chạy kèm các task ECS"
  type        = string
  default     = "public.ecr.aws/aws-observability/aws-otel-collector:v0.40.0"
}

locals {
  # Chỉ nhận trace qua OTLP/HTTP trên loopback, gom lô rồi gửi X-Ray; không xuất metric (đã có EMF trong log, NFR-8.x).
  adot_config = yamlencode({
    receivers  = { otlp = { protocols = { http = { endpoint = "127.0.0.1:4318" } } } }
    processors = { batch = { timeout = "5s" } }
    exporters  = { awsxray = { region = var.aws_region } }
    service = {
      pipelines = { traces = { receivers = ["otlp"], processors = ["batch"], exporters = ["awsxray"] } }
    }
  })

  # Biến OTel cho container ứng dụng trong task ECS, theo tên service hiện trên bản đồ X-Ray.
  otel_ecs_env = {
    for k, svc in { worker = "hr-worker", notification = "hr-notification", assistant = "hr-assistant" } : k => (
      var.xray_tracing_enabled ? [
        { name = "OTEL_EXPORTER_OTLP_ENDPOINT", value = "http://127.0.0.1:4318" },
        { name = "OTEL_SERVICE_NAME", value = svc }
      ] : []
    )
  }

  # Container phụ ADOT, log chung log group của task với tiền tố "adot".
  adot_sidecar = {
    for k, group in {
      worker       = aws_cloudwatch_log_group.worker.name
      notification = aws_cloudwatch_log_group.notification.name
      assistant    = aws_cloudwatch_log_group.assistant.name
      } : k => (
      var.xray_tracing_enabled ? [
        {
          name              = "adot-collector"
          image             = var.adot_collector_image
          essential         = false # collector lỗi thì chỉ mất trace, service vẫn chạy
          memoryReservation = 64
          environment       = [{ name = "AOT_CONFIG_CONTENT", value = local.adot_config }]
          logConfiguration = {
            logDriver = "awslogs"
            options = {
              "awslogs-group"         = group
              "awslogs-region"        = var.aws_region
              "awslogs-stream-prefix" = "adot"
            }
          }
        }
      ] : []
    )
  }

  # Biến OTel cho API trên App Runner (collector của App Runner chỉ nhận gRPC).
  otel_apprunner_env = var.xray_tracing_enabled ? {
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_PROTOCOL = "grpc"
    OTEL_SERVICE_NAME           = "hr-api"
  } : {}
}

resource "aws_apprunner_observability_configuration" "xray" {
  observability_configuration_name = "${var.project_name}-${var.environment}-xray"

  trace_configuration {
    vendor = "AWSXRAY"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-xray"
  }
}

# Quyền gửi segment và đọc luật lấy mẫu X-Ray cho role chạy API và các task.
resource "aws_iam_role_policy_attachment" "xray_write" {
  for_each = var.xray_tracing_enabled ? {
    api          = aws_iam_role.apprunner_instance_role.name
    worker       = aws_iam_role.worker_task_role.name
    notification = aws_iam_role.notification_task_role.name
    assistant    = aws_iam_role.assistant_task_role.name
  } : {}

  role       = each.value
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}
