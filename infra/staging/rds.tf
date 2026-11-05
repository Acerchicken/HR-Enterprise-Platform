# DB Subnet Group covering 2 Private Subnets
resource "aws_db_subnet_group" "staging" {
  name        = "${var.project_name}-${var.environment}-db-subnet-group"
  description = "Private database subnets for ${var.project_name} staging RDS"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# Parameter Group for PostgreSQL 16
resource "aws_db_parameter_group" "pg16" {
  name        = "${var.project_name}-${var.environment}-pg16-params"
  family      = "postgres16"
  description = "Custom parameter group for PostgreSQL 16 on ${var.project_name} staging"

  parameter {
    name  = "rds.force_ssl"
    value = "0" # Allows flexible local/staging dev while transit is secured via private VPC
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-pg16-params"
  }
}

# RDS PostgreSQL 16 Instance
resource "aws_db_instance" "postgres" {
  identifier = "${var.project_name}-${var.environment}-db"

  engine         = "postgres"
  engine_version = "16.4"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.main.arn

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.staging.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.pg16.name

  publicly_accessible = false
  multi_az            = false # Single-AZ for staging per ADR-12 cost constraint

  backup_retention_period    = 7 # 7 days backup retention per requirements
  backup_window              = "03:00-04:00"
  maintenance_window         = "Mon:04:30-Mon:05:30"
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true
  skip_final_snapshot        = true
  deletion_protection        = false

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}
