output "bastion_public_dns" {
  description = "Public DNS name for the bastion host when enabled."
  value       = module.resources.bastion_public_dns
}

output "bastion_instance_id" {
  description = "Instance ID of the bastion host when enabled."
  value       = module.resources.bastion_instance_id
}

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
