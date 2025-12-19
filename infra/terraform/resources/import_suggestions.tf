locals {
  import_suggestions_parameter_prefix = "/finance-tracker/${var.environment}/imports/suggestions"
  import_suggestions_queue_name       = "${local.name_prefix}-import-suggestions"
  import_suggestions_table_name       = "${local.name_prefix}-import-suggestions-connections"
}

resource "aws_dynamodb_table" "import_suggestions_connections" {
  name         = local.import_suggestions_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connection_id"

  attribute {
    name = "connection_id"
    type = "S"
  }

  attribute {
    name = "client_id"
    type = "S"
  }

  global_secondary_index {
    name            = "client_id-index"
    hash_key        = "client_id"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = local.import_suggestions_table_name
    },
  )
}

resource "aws_sqs_queue" "import_suggestions" {
  name                       = local.import_suggestions_queue_name
  visibility_timeout_seconds = 180

  tags = merge(
    local.common_tags,
    {
      Name = local.import_suggestions_queue_name
    },
  )
}

resource "aws_ssm_parameter" "import_suggestions_connections_table" {
  name        = "${local.import_suggestions_parameter_prefix}/connections_table"
  description = "DynamoDB table name for import suggestions websocket connections."
  type        = "String"
  value       = aws_dynamodb_table.import_suggestions_connections.name
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "import_suggestions_queue_url" {
  name        = "${local.import_suggestions_parameter_prefix}/queue_url"
  description = "SQS queue URL for import suggestions jobs."
  type        = "String"
  value       = aws_sqs_queue.import_suggestions.id
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "import_suggestions_queue_arn" {
  name        = "${local.import_suggestions_parameter_prefix}/queue_arn"
  description = "SQS queue ARN for import suggestions jobs."
  type        = "String"
  value       = aws_sqs_queue.import_suggestions.arn
  overwrite   = true

  tags = local.common_tags
}
