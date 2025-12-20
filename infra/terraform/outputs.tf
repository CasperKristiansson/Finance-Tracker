output "lambda_security_group_id" {
  description = "Security group assigned to Lambda functions running inside the VPC."
  value       = module.resources.lambda_sg
}

output "private_subnet_a_id" {
  description = "Primary private subnet identifier for Lambda deployments."
  value       = module.resources.subnet_a_id
}

output "private_subnet_b_id" {
  description = "Secondary private subnet identifier for Lambda deployments."
  value       = module.resources.subnet_b_id
}

output "db_parameter_paths" {
  description = "SSM parameter names containing database connection details."
  value = {
    endpoint = module.resources.db_endpoint_parameter_name
    name     = module.resources.db_name_parameter_name
    user     = module.resources.db_user_parameter_name
    password = module.resources.db_password_parameter_name
  }
}

output "network_parameter_paths" {
  description = "SSM parameter names containing network configuration for Lambda."
  value = {
    lambda_sg   = module.resources.lambda_sg_parameter_name
    subnet_a_id = module.resources.subnet_private_a_parameter_name
    subnet_b_id = module.resources.subnet_private_b_parameter_name
  }
}

output "auth_parameter_paths" {
  description = "SSM parameter names containing Cognito authentication identifiers."
  value = {
    user_pool_id     = module.resources.user_pool_id_parameter_name
    user_pool_client = module.resources.user_pool_client_id_parameter_name
    user_group       = module.resources.user_group_parameter_name
    user_pool_issuer = module.resources.user_pool_issuer_parameter_name
    user_pool_domain = module.resources.user_pool_domain_parameter_name
  }
}

output "auth_oauth_settings" {
  description = "Cognito hosted UI domain and OAuth redirect settings."
  value = {
    domain        = module.resources.oauth_settings.domain
    callback_urls = module.resources.oauth_settings.callback_urls
    logout_urls   = module.resources.oauth_settings.logout_urls
  }
}

output "api_domain_configuration" {
  description = "API custom domain name and supporting parameter references."
  value = {
    domain_name               = module.resources.api_custom_domain
    certificate_parameter_arn = module.resources.api_domain_certificate_parameter_name
  }
}

output "backup_parameter_paths" {
  description = "SSM parameter names containing backup storage configuration."
  value = {
    bucket = module.resources.backup_bucket_parameter_name
  }
}
