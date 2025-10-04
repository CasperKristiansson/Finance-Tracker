resource "aws_cognito_user_pool" "finance_tracker" {
  name = "${local.name_prefix}-user-pool"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-user-pool"
    },
  )
}

resource "aws_cognito_user_pool_client" "finance_tracker_web" {
  name         = "${local.name_prefix}-web-client"
  user_pool_id = aws_cognito_user_pool.finance_tracker.id

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
  supported_identity_providers  = ["COGNITO"]
  enable_token_revocation       = true
  refresh_token_validity        = 30
  access_token_validity         = 60
  id_token_validity             = 60

  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  read_attributes = [
    "email",
    "email_verified",
    "name",
    "preferred_username",
  ]

  write_attributes = [
    "email",
    "name",
    "preferred_username",
  ]
}

resource "aws_cognito_user_group" "finance_tracker_users" {
  name         = "finance-tracker-users"
  description  = "Default group for Finance Tracker authenticated users."
  user_pool_id = aws_cognito_user_pool.finance_tracker.id
  precedence   = 0
}

resource "aws_ssm_parameter" "finance_tracker_user_pool_id" {
  name        = "/finance-tracker/${var.environment}/auth/user_pool_id"
  description = "Cognito user pool identifier for the Finance Tracker application."
  type        = "String"
  value       = aws_cognito_user_pool.finance_tracker.id
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_user_pool_client_id" {
  name        = "/finance-tracker/${var.environment}/auth/user_pool_client_id"
  description = "Cognito user pool client identifier for the Finance Tracker web app."
  type        = "String"
  value       = aws_cognito_user_pool_client.finance_tracker_web.id
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_user_group_name" {
  name        = "/finance-tracker/${var.environment}/auth/user_group"
  description = "Default Cognito group name assigned to Finance Tracker users."
  type        = "String"
  value       = aws_cognito_user_group.finance_tracker_users.name
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_user_pool_issuer" {
  name        = "/finance-tracker/${var.environment}/auth/user_pool_issuer"
  description = "Issuer URL for the Finance Tracker Cognito user pool."
  type        = "String"
  value = format(
    "https://cognito-idp.%s.amazonaws.com/%s",
    "eu-north-1",
    aws_cognito_user_pool.finance_tracker.id,
  )
  overwrite = true

  tags = local.common_tags
}

output "user_pool_id_parameter_name" {
  description = "SSM parameter storing the Cognito user pool identifier."
  value       = aws_ssm_parameter.finance_tracker_user_pool_id.name
}

output "user_pool_client_id_parameter_name" {
  description = "SSM parameter storing the Cognito user pool client identifier."
  value       = aws_ssm_parameter.finance_tracker_user_pool_client_id.name
}

output "user_group_parameter_name" {
  description = "SSM parameter storing the Cognito default user group name."
  value       = aws_ssm_parameter.finance_tracker_user_group_name.name
}

output "user_pool_issuer_parameter_name" {
  description = "SSM parameter storing the Cognito issuer URL."
  value       = aws_ssm_parameter.finance_tracker_user_pool_issuer.name
}
