variable "aws_region" {
  description = "AWS region for staging infrastructure"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "hr-platform"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "vpc_cidr" {
  description = "CIDR block for the staging VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_name" {
  description = "Database name for PostgreSQL"
  type        = string
  default     = "hr"
}

variable "db_username" {
  description = "Master username for PostgreSQL database"
  type        = string
  default     = "hr_admin"
}

variable "alert_emails" {
  description = "List of email addresses to receive budget and system alerts"
  type        = list(string)
}

variable "sender_email" {
  description = "Verified sender email address for SES notifications"
  type        = string
  default     = "no-reply@hr.local"
}

variable "budget_limit_usd" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 50
}

variable "github_repository" {
  description = "GitHub repository (owner/repo) allowed to deploy via OIDC"
  type        = string
  default     = "Acerchicken/HR-Enterprise-Platform"
}

variable "api_container_port" {
  description = "Port exposed by the API container"
  type        = number
  default     = 3000
}
