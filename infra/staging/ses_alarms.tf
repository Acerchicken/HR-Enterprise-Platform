# ==============================================================================
# Amazon Simple Email Service (SES) & CloudWatch Alarms (Tuần 10 - IaC)
# ==============================================================================

# SES Email Identity for Notification Sender (Sandbox requires verified email)
resource "aws_ses_email_identity" "sender" {
  email = var.sender_email
}

# IAM Policy allowing ECS Worker to send emails via SES
resource "aws_iam_policy" "worker_ses_policy" {
  name        = "${var.project_name}-${var.environment}-worker-ses-policy"
  description = "Permissions for worker to send leave notification emails via SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SendEmailSES"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "worker_ses_attach" {
  role       = aws_iam_role.worker_task_role.name
  policy_arn = aws_iam_policy.worker_ses_policy.arn
}

# ------------------------------------------------------------------------------
# SNS Topic for System & Infrastructure Alarms
# ------------------------------------------------------------------------------
resource "aws_sns_topic" "system_alerts" {
  name              = "${var.project_name}-${var.environment}-system-alerts"
  kms_master_key_id = aws_kms_key.main.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-system-alerts"
  }
}

resource "aws_sns_topic_subscription" "alert_subscribers" {
  for_each  = toset(var.alert_emails)
  topic_arn = aws_sns_topic.system_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# ------------------------------------------------------------------------------
# CloudWatch Metric Alarms (5 core operational alarms)
# ------------------------------------------------------------------------------

# 1. API 5xx Error Spike Alarm
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.project_name}-${var.environment}-api-5xx-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxStatusAnswers"
  namespace           = "AWS/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "App Runner API returned 5 or more 5xx errors in a 5-minute period"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  ok_actions          = [aws_sns_topic.system_alerts.arn]

  dimensions = {
    ServiceName = aws_apprunner_service.api.service_name
    ServiceID   = aws_apprunner_service.api.service_id
  }
}

# 2. API p95 High Latency Alarm (> 1000ms)
resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "${var.project_name}-${var.environment}-api-p95-latency"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ResponseTime"
  namespace           = "AWS/AppRunner"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 1000
  alarm_description   = "App Runner API p95 response time exceeded 1000ms across two consecutive 5-minute periods"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]

  dimensions = {
    ServiceName = aws_apprunner_service.api.service_name
    ServiceID   = aws_apprunner_service.api.service_id
  }
}

# 3. RDS High CPU Utilization Alarm (> 80%)
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS PostgreSQL CPU utilization exceeded 80% for 10 minutes"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  ok_actions          = [aws_sns_topic.system_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }
}

# 4. RDS High Database Connections Alarm (> 80)
resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS PostgreSQL active connections exceeded 80"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }
}

# 5. SQS Dead-Letter Queue (DLQ) Message Alarm (> 0)
resource "aws_cloudwatch_metric_alarm" "sqs_dlq" {
  alarm_name          = "${var.project_name}-${var.environment}-sqs-dlq-messages"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "One or more failed notification messages arrived in the SQS Dead-Letter Queue"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.worker_dlq.name
  }
}
