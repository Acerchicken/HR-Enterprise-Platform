variable "aws_region" {
  description = "AWS region for terraform remote state infrastructure"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "hr-platform"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}
