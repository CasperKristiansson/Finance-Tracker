data "archive_file" "cognito_pre_token_approval" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/cognito_pre_token_approval"
  output_path = "${path.module}/lambda/cognito_pre_token_approval.zip"
}

resource "aws_iam_role" "cognito_pre_token_approval" {
  name = "${local.name_prefix}-cognito-pre-token-approval-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      },
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "cognito_pre_token_approval" {
  name = "${local.name_prefix}-cognito-pre-token-approval-policy"
  role = aws_iam_role.cognito_pre_token_approval.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminUpdateUserAttributes",
        ]
        Resource = aws_cognito_user_pool.finance_tracker.arn
      },
    ]
  })
}

resource "aws_lambda_function" "cognito_pre_token_approval" {
  function_name = "${local.name_prefix}-cognito-pre-token-approval"
  description   = "Blocks token issuance until a Cognito user has been approved."
  handler       = "handler.lambda_handler"
  role          = aws_iam_role.cognito_pre_token_approval.arn
  runtime       = "python3.13"
  timeout       = 10

  filename         = data.archive_file.cognito_pre_token_approval.output_path
  source_code_hash = data.archive_file.cognito_pre_token_approval.output_base64sha256

  environment {
    variables = {
      APPROVAL_ATTRIBUTE = "custom:approved"
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "allow_cognito_pre_token" {
  statement_id  = "AllowCognitoInvokePreToken"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_pre_token_approval.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.finance_tracker.arn
}
