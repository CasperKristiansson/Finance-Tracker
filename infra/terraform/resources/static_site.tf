variable "root_domain_name" {
  description = "Root Route53 hosted zone domain that serves Finance Tracker web frontends."
  type        = string
  default     = "casperkristiansson.com"
}

data "aws_route53_zone" "root" {
  name         = "${var.root_domain_name}."
  private_zone = false
}

locals {
  static_site_subdomain = "finance-tracker"
  static_site_domain    = "${local.static_site_subdomain}.${var.root_domain_name}"
  static_site_bucket    = format("%s-%s", replace(local.static_site_domain, ".", "-"), var.account_id)
  cloudfront_origin_id  = "s3-static-site"
}

resource "aws_s3_bucket" "static_site" {
  bucket        = local.static_site_bucket
  force_destroy = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-static-site"
    },
  )
}

resource "aws_s3_bucket_versioning" "static_site" {
  bucket = aws_s3_bucket.static_site.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_site" {
  bucket = aws_s3_bucket.static_site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_site" {
  bucket = aws_s3_bucket.static_site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "static_site" {
  bucket = aws_s3_bucket.static_site.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_policy" "static_site" {
  bucket = aws_s3_bucket.static_site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = ["s3:GetObject"]
        Resource = ["${aws_s3_bucket.static_site.arn}/*"]
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.static_site.arn
          }
        }
      }
    ]
  })
}

resource "aws_acm_certificate" "static_site" {
  provider          = aws.us_east_1
  domain_name       = local.static_site_domain
  validation_method = "DNS"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-static-site-cert"
    },
  )
}

resource "aws_route53_record" "static_site_certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.static_site.domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      type   = option.resource_record_type
      record = option.resource_record_value
    }
  }

  name    = each.value.name
  type    = each.value.type
  zone_id = data.aws_route53_zone.root.zone_id
  ttl     = 300
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "static_site" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.static_site.arn
  validation_record_fqdns = [for record in aws_route53_record.static_site_certificate_validation : record.fqdn]
}

resource "aws_cloudfront_origin_access_control" "static_site" {
  name                              = "${local.name_prefix}-static-site-oac"
  description                       = "Origin access control for the Finance Tracker static site bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "static_site" {
  depends_on = [aws_acm_certificate_validation.static_site]

  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  aliases = [local.static_site_domain]

  origin {
    domain_name              = aws_s3_bucket.static_site.bucket_regional_domain_name
    origin_id                = local.cloudfront_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static_site.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.cloudfront_origin_id

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.static_site.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-static-site-distribution"
    },
  )
}

resource "aws_route53_record" "static_site_alias_ipv4" {
  zone_id = data.aws_route53_zone.root.zone_id
  name    = local.static_site_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.static_site.domain_name
    zone_id                = aws_cloudfront_distribution.static_site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "static_site_alias_ipv6" {
  zone_id = data.aws_route53_zone.root.zone_id
  name    = local.static_site_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.static_site.domain_name
    zone_id                = aws_cloudfront_distribution.static_site.hosted_zone_id
    evaluate_target_health = false
  }
}
