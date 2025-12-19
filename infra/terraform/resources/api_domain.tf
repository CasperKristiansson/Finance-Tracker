locals {
  api_domain_name           = "api.finance-tracker.${var.root_domain_name}"
  api_certificate_parameter = "/finance-tracker/${var.environment}/api/custom_domain/certificate_arn"
  api_stack_name            = "finance-tracker-api-${var.environment}"
}

data "aws_cloudformation_stack" "serverless_api" {
  name = local.api_stack_name
}

locals {
  api_http_api_id = try(
    one([
      for output in data.aws_cloudformation_stack.serverless_api.outputs :
      output.value if output.key == "HttpApiId"
    ]),
    ""
  )
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

resource "aws_apigatewayv2_domain_name" "api_gateway_http" {
  domain_name = local.api_domain_name

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.api_gateway.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-api-domain"
    },
  )
}

resource "aws_apigatewayv2_api_mapping" "api_gateway_http" {
  count       = local.api_http_api_id == "" ? 0 : 1
  api_id      = local.api_http_api_id
  domain_name = aws_apigatewayv2_domain_name.api_gateway_http.id
  stage       = "$default"
}

resource "aws_route53_record" "api_gateway_http_alias_ipv4" {
  allow_overwrite = true
  zone_id = data.aws_route53_zone.root.zone_id
  name    = local.api_domain_name
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api_gateway_http.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api_gateway_http.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_gateway_http_alias_ipv6" {
  allow_overwrite = true
  zone_id = data.aws_route53_zone.root.zone_id
  name    = local.api_domain_name
  type    = "AAAA"

  alias {
    name                   = aws_apigatewayv2_domain_name.api_gateway_http.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api_gateway_http.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

output "api_domain_certificate_parameter_name" {
  description = "SSM parameter storing the ACM certificate ARN for the API custom domain."
  value       = aws_ssm_parameter.api_gateway_certificate_arn.name
}

output "api_custom_domain" {
  description = "Fully qualified domain name serving the Finance Tracker API."
  value       = local.api_domain_name
}
