terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Remote state backend can be enabled after running infra/bootstrap
  # backend "s3" {
  #   bucket         = "hr-platform-tfstate-staging-xxxxxx"
  #   key            = "staging/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   dynamodb_table = "hr-platform-tflocks-staging"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}
