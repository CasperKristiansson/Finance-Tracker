locals {
  ventures_files_bucket_name      = "${local.name_prefix}-ventures-files"
  ventures_files_parameter_prefix = "/finance-tracker/${var.environment}/ventures/files"
  ventures_files_default_prefix   = "uploads"
  ventures_files_default_expiry   = 900
}

resource "aws_s3_bucket" "ventures_files" {
  bucket = local.ventures_files_bucket_name

  tags = merge(
    local.common_tags,
    {
      Name = local.ventures_files_bucket_name
    },
  )
}

resource "aws_s3_bucket_versioning" "ventures_files" {
  bucket = aws_s3_bucket.ventures_files.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ventures_files" {
  bucket = aws_s3_bucket.ventures_files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "ventures_files" {
  bucket                  = aws_s3_bucket.ventures_files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "ventures_files" {
  bucket = aws_s3_bucket.ventures_files.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_cors_configuration" "ventures_files" {
  bucket = aws_s3_bucket.ventures_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = [
      "https://${local.static_site_domain}",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_ssm_parameter" "ventures_files_bucket" {
  name        = "${local.ventures_files_parameter_prefix}/bucket"
  description = "Private S3 bucket for Ventures logos and documents."
  type        = "String"
  value       = aws_s3_bucket.ventures_files.bucket
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "ventures_files_prefix" {
  name        = "${local.ventures_files_parameter_prefix}/prefix"
  description = "Prefix within the Ventures files bucket."
  type        = "String"
  value       = local.ventures_files_default_prefix
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "ventures_files_url_expires_seconds" {
  name        = "${local.ventures_files_parameter_prefix}/url_expires_seconds"
  description = "Expiry in seconds for Ventures presigned URLs."
  type        = "String"
  value       = tostring(local.ventures_files_default_expiry)
  overwrite   = true

  tags = local.common_tags
}

output "ventures_files_bucket_parameter_name" {
  description = "SSM parameter exposing the Ventures files bucket name."
  value       = aws_ssm_parameter.ventures_files_bucket.name
}

output "ventures_files_prefix_parameter_name" {
  description = "SSM parameter exposing the Ventures files bucket prefix."
  value       = aws_ssm_parameter.ventures_files_prefix.name
}

output "ventures_files_url_expires_seconds_parameter_name" {
  description = "SSM parameter exposing the Ventures presigned URL expiry."
  value       = aws_ssm_parameter.ventures_files_url_expires_seconds.name
}
