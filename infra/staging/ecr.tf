# ECR Repository for Backend API & Worker Image
# Note: Frontend Web SPA is built and synced directly to S3 Bucket per review feedback
resource "aws_ecr_repository" "api" {
  name                 = "hr-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "hr-api"
  }
}

# Lifecycle policy: retain only the latest 10 images to optimize ECR storage cost
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
