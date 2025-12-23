locals {
  backup_parameter_prefix = "/finance-tracker/${var.environment}/backups"
  backup_bucket_name      = "${local.name_prefix}-${var.account_id}-database-backups"
}

resource "aws_s3_bucket" "database_backups" {
  bucket        = local.backup_bucket_name
  force_destroy = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-database-backups"
    },
  )
}

resource "aws_s3_bucket_versioning" "database_backups" {
  bucket = aws_s3_bucket.database_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "database_backups" {
  bucket = aws_s3_bucket.database_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "database_backups" {
  bucket = aws_s3_bucket.database_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "database_backups" {
  bucket = aws_s3_bucket.database_backups.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "database_backups" {
  bucket = aws_s3_bucket.database_backups.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "database_backups" {
  bucket = aws_s3_bucket.database_backups.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.database_backups.arn,
          "${aws_s3_bucket.database_backups.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = false }
        }
      }
    ]
  })
}

resource "aws_ssm_parameter" "database_backup_bucket" {
  name        = "${local.backup_parameter_prefix}/bucket"
  description = "S3 bucket used to store monthly Finance Tracker database backups."
  type        = "String"
  value       = aws_s3_bucket.database_backups.bucket
  overwrite   = true

  tags = local.common_tags
}

output "backup_bucket_parameter_name" {
  description = "SSM parameter exposing the backup bucket name."
  value       = aws_ssm_parameter.database_backup_bucket.name
}
