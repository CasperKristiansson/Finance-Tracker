locals {
  import_files_bucket_name       = "${local.name_prefix}-import-files"
  import_files_parameter_prefix  = "/finance-tracker/${var.environment}/imports/files"
  import_files_default_prefix    = "uploads"
  import_files_default_expiry    = 900
}

resource "aws_s3_bucket" "import_files" {
  bucket = local.import_files_bucket_name

  tags = merge(
    local.common_tags,
    {
      Name = local.import_files_bucket_name
    },
  )
}

resource "aws_s3_bucket_versioning" "import_files" {
  bucket = aws_s3_bucket.import_files.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "import_files" {
  bucket = aws_s3_bucket.import_files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "import_files" {
  bucket                  = aws_s3_bucket.import_files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "import_files" {
  bucket = aws_s3_bucket.import_files.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_ssm_parameter" "import_files_bucket" {
  name        = "${local.import_files_parameter_prefix}/bucket"
  description = "S3 bucket for storing import files."
  type        = "String"
  value       = aws_s3_bucket.import_files.bucket
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "import_files_prefix" {
  name        = "${local.import_files_parameter_prefix}/prefix"
  description = "Prefix within the import files bucket."
  type        = "String"
  value       = local.import_files_default_prefix
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "import_files_url_expires_seconds" {
  name        = "${local.import_files_parameter_prefix}/url_expires_seconds"
  description = "Expiry in seconds for presigned download URLs."
  type        = "String"
  value       = tostring(local.import_files_default_expiry)
  overwrite   = true

  tags = local.common_tags
}
