data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3_gateway" {
  vpc_id            = aws_vpc.finance_tracker.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_default_route_table.finance_tracker.id]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowBackupsBucketAccess"
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:AbortMultipartUpload",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.database_backups.arn,
          "${aws_s3_bucket.database_backups.arn}/*",
        ]
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-s3-gateway"
    },
  )
}
