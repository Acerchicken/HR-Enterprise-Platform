# Security Group for App Runner VPC Connector
resource "aws_security_group" "apprunner_connector" {
  name        = "${var.project_name}-${var.environment}-apprunner-connector-sg"
  description = "Security group for App Runner VPC Connector egress"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Allow all outbound traffic to VPC and NAT instance"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-apprunner-connector-sg"
  }
}

# Security Group for ECS Fargate Worker
resource "aws_security_group" "worker" {
  name        = "${var.project_name}-${var.environment}-worker-sg"
  description = "Security group for ECS Fargate Worker"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Allow worker outbound traffic to RDS and NAT instance (SQS, Cognito, CloudWatch)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-worker-sg"
  }
}

# Security Group for RDS PostgreSQL
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL, accepting connections only from API and Worker"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from App Runner VPC Connector"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner_connector.id]
  }

  ingress {
    description     = "PostgreSQL from ECS Fargate Worker"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.worker.id]
  }

  egress {
    description = "Allow outbound response traffic within VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}
