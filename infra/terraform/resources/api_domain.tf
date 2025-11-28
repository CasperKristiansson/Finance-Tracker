locals {
  api_domain_name           = "api.finance-tracker.${var.root_domain_name}"
  api_certificate_parameter = "/finance-tracker/${var.environment}/api/custom_domain/certificate_arn"
}

resource "aws_acm_certificate" "api_gateway" {
  domain_name       = local.api_domain_name
  validation_method = "DNS"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-api-domain-cert"
    },
  )
}

resource "aws_route53_record" "api_gateway_certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.api_gateway.domain_validation_options : option.domain_name => {
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

resource "aws_acm_certificate_validation" "api_gateway" {
  certificate_arn         = aws_acm_certificate.api_gateway.arn
  validation_record_fqdns = [for record in aws_route53_record.api_gateway_certificate_validation : record.fqdn]
}

resource "aws_ssm_parameter" "api_gateway_certificate_arn" {
  depends_on = [aws_acm_certificate_validation.api_gateway]

  name        = local.api_certificate_parameter
  description = "ACM certificate ARN for the Finance Tracker API custom domain."
  type        = "String"
  value       = aws_acm_certificate.api_gateway.arn
  overwrite   = true

  tags = local.common_tags
}

output "api_domain_certificate_parameter_name" {
  description = "SSM parameter storing the ACM certificate ARN for the API custom domain."
  value       = aws_ssm_parameter.api_gateway_certificate_arn.name
}

output "api_custom_domain" {
  description = "Fully qualified domain name serving the Finance Tracker API."
  value       = local.api_domain_name
}
