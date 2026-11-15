output "s3_bucket_name" {
  description = "Name of the S3 bucket storing Terraform remote state"
  value       = aws_s3_bucket.tfstate.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket storing Terraform remote state"
  value       = aws_s3_bucket.tfstate.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking"
  value       = aws_dynamodb_table.tflocks.name
}

output "backend_config_snippet" {
  description = "Snippet to configure remote backend in staging/main.tf"
  value       = <<EOT
terraform {
  backend "s3" {
    bucket         = "${aws_s3_bucket.tfstate.bucket}"
    key            = "staging/terraform.tfstate"
    region         = "${var.aws_region}"
    dynamodb_table = "${aws_dynamodb_table.tflocks.name}"
    encrypt        = true
  }
}
EOT
}
