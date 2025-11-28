variable "account_id" {
  description = "AWS account ID where Finance Tracker resources are provisioned."
  type        = string
}

variable "environment" {
  description = "Deployment environment identifier (for example dev or prod)."
  type        = string
}

variable "enable_public_db_access" {
  description = "Expose Aurora publicly for local development. Keep disabled in shared environments."
  type        = bool
  default     = false
}

locals {
  project_name = "finance-tracker"
  name_prefix  = "${local.project_name}-${var.environment}"

  common_tags = {
    Project     = local.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "random_password" "finance_tracker_db_master" {
  length           = 24
  min_upper        = 1
  min_lower        = 1
  min_numeric      = 1
  min_special      = 1
  special          = true
  override_special = "!#$%^&*()-_=+[]{}"
}

resource "aws_vpc" "finance_tracker" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-vpc"
    },
  )
}

resource "aws_internet_gateway" "finance_tracker" {
  count = var.enable_public_db_access ? 1 : 0

  vpc_id = aws_vpc.finance_tracker.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-igw"
    },
  )
}

resource "aws_subnet" "finance_tracker_private_a" {
  vpc_id                  = aws_vpc.finance_tracker.id
  cidr_block              = "10.10.1.0/24"
  availability_zone       = "eu-north-1a"
  map_public_ip_on_launch = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-a"
      Tier = "private"
    },
  )
}

resource "aws_subnet" "finance_tracker_private_b" {
  vpc_id                  = aws_vpc.finance_tracker.id
  cidr_block              = "10.10.2.0/24"
  availability_zone       = "eu-north-1b"
  map_public_ip_on_launch = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-b"
      Tier = "private"
    },
  )
}

resource "aws_subnet" "finance_tracker_public_a" {
  count                   = var.enable_public_db_access ? 1 : 0
  vpc_id                  = aws_vpc.finance_tracker.id
  cidr_block              = "10.10.10.0/24"
  availability_zone       = "eu-north-1a"
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-a"
      Tier = "public"
    },
  )
}

resource "aws_subnet" "finance_tracker_public_b" {
  count                   = var.enable_public_db_access ? 1 : 0
  vpc_id                  = aws_vpc.finance_tracker.id
  cidr_block              = "10.10.11.0/24"
  availability_zone       = "eu-north-1b"
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-b"
      Tier = "public"
    },
  )
}

resource "aws_default_route_table" "finance_tracker" {
  default_route_table_id = aws_vpc.finance_tracker.default_route_table_id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-main-rt"
    },
  )
}

resource "aws_route" "finance_tracker_public_default" {
  count = var.enable_public_db_access ? 1 : 0

  route_table_id         = aws_default_route_table.finance_tracker.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.finance_tracker[0].id
}

resource "aws_route_table_association" "finance_tracker_public_a" {
  count = var.enable_public_db_access ? 1 : 0

  subnet_id      = aws_subnet.finance_tracker_public_a[0].id
  route_table_id = aws_default_route_table.finance_tracker.id
}

resource "aws_route_table_association" "finance_tracker_public_b" {
  count = var.enable_public_db_access ? 1 : 0

  subnet_id      = aws_subnet.finance_tracker_public_b[0].id
  route_table_id = aws_default_route_table.finance_tracker.id
}

resource "aws_db_subnet_group" "finance_tracker_aurora" {
  name        = "${local.name_prefix}-aurora-subnets"
  description = "Private subnets for the Finance Tracker Aurora cluster."
  subnet_ids = var.enable_public_db_access ? concat(
    [
      aws_subnet.finance_tracker_private_a.id,
      aws_subnet.finance_tracker_private_b.id,
    ],
    [
      aws_subnet.finance_tracker_public_a[0].id,
      aws_subnet.finance_tracker_public_b[0].id,
    ],
  ) : [
    aws_subnet.finance_tracker_private_a.id,
    aws_subnet.finance_tracker_private_b.id,
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-aurora-subnets"
    },
  )
}

resource "aws_security_group" "finance_tracker_aurora" {
  name        = "${local.name_prefix}-aurora-sg"
  description = "Restricts inbound database access to the Aurora cluster."
  vpc_id      = aws_vpc.finance_tracker.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-aurora-sg"
    },
  )
}

resource "aws_security_group" "finance_tracker_lambda" {
  name        = "${local.name_prefix}-lambda-sg"
  description = "Lambda function security group with access to Aurora."
  vpc_id      = aws_vpc.finance_tracker.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-lambda-sg"
    },
  )
}

resource "aws_security_group_rule" "finance_tracker_aurora_ingress_from_lambda" {
  description              = "Allow Lambda functions to reach Aurora PostgreSQL."
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.finance_tracker_aurora.id
  source_security_group_id = aws_security_group.finance_tracker_lambda.id
}

resource "aws_security_group_rule" "finance_tracker_aurora_public_ingress" {
  count = var.enable_public_db_access ? 1 : 0

  description       = "Allow public PostgreSQL access for local development."
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  security_group_id = aws_security_group.finance_tracker_aurora.id
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "finance_tracker_lambda_egress" {
  description       = "Allow Lambda functions outbound internet access."
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  security_group_id = aws_security_group.finance_tracker_lambda.id
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_rds_cluster" "finance_tracker" {
  cluster_identifier      = "${local.name_prefix}-aurora"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  database_name           = "finance_tracker"
  master_username         = "finance_app"
  master_password         = random_password.finance_tracker_db_master.result
  db_subnet_group_name    = aws_db_subnet_group.finance_tracker_aurora.name
  vpc_security_group_ids  = [aws_security_group.finance_tracker_aurora.id]
  storage_encrypted       = true
  deletion_protection     = false
  skip_final_snapshot     = true
  backup_retention_period = 3
  apply_immediately       = true
  copy_tags_to_snapshot   = true

  serverlessv2_scaling_configuration {
    min_capacity = 0
    max_capacity = 1
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-aurora"
    },
  )
}

resource "aws_rds_cluster_instance" "finance_tracker_primary" {
  identifier          = "${local.name_prefix}-aurora-1"
  cluster_identifier  = aws_rds_cluster.finance_tracker.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.finance_tracker.engine
  publicly_accessible = var.enable_public_db_access

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-aurora-1"
    },
  )
}

resource "aws_ssm_parameter" "finance_tracker_db_endpoint" {
  name        = "/finance-tracker/${var.environment}/db/endpoint"
  description = "Aurora cluster endpoint for the Finance Tracker application."
  type        = "String"
  value       = aws_rds_cluster.finance_tracker.endpoint
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_db_name" {
  name        = "/finance-tracker/${var.environment}/db/name"
  description = "Aurora database name for the Finance Tracker application."
  type        = "String"
  value       = aws_rds_cluster.finance_tracker.database_name
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_db_user" {
  name        = "/finance-tracker/${var.environment}/db/user"
  description = "Aurora database user for the Finance Tracker application."
  type        = "String"
  value       = aws_rds_cluster.finance_tracker.master_username
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_db_password" {
  name        = "/finance-tracker/${var.environment}/db/password"
  description = "Initial Aurora database password for the Finance Tracker application."
  type        = "SecureString"
  value       = random_password.finance_tracker_db_master.result
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_lambda_sg_id" {
  name        = "/finance-tracker/${var.environment}/lambda/sg"
  description = "Security group for Finance Tracker Lambda functions."
  type        = "String"
  value       = aws_security_group.finance_tracker_lambda.id
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_subnet_private_a" {
  name        = "/finance-tracker/${var.environment}/subnet/private-a"
  description = "Private subnet A for Finance Tracker workloads."
  type        = "String"
  value       = aws_subnet.finance_tracker_private_a.id
  overwrite   = true

  tags = local.common_tags
}

resource "aws_ssm_parameter" "finance_tracker_subnet_private_b" {
  name        = "/finance-tracker/${var.environment}/subnet/private-b"
  description = "Private subnet B for Finance Tracker workloads."
  type        = "String"
  value       = aws_subnet.finance_tracker_private_b.id
  overwrite   = true

  tags = local.common_tags
}

output "subnet_ids" {
  description = "Private subnet identifiers used by the Aurora cluster."
  value = [
    aws_subnet.finance_tracker_private_a.id,
    aws_subnet.finance_tracker_private_b.id,
  ]
}

output "subnet_a_id" {
  description = "Private subnet A identifier for Lambda configuration."
  value       = aws_subnet.finance_tracker_private_a.id
}

output "subnet_b_id" {
  description = "Private subnet B identifier for Lambda configuration."
  value       = aws_subnet.finance_tracker_private_b.id
}

output "lambda_sg" {
  description = "Security group identifier for Lambda functions accessing Aurora."
  value       = aws_security_group.finance_tracker_lambda.id
}

output "db_endpoint_parameter_name" {
  description = "SSM parameter storing the Aurora endpoint."
  value       = aws_ssm_parameter.finance_tracker_db_endpoint.name
}

output "db_name_parameter_name" {
  description = "SSM parameter storing the Aurora database name."
  value       = aws_ssm_parameter.finance_tracker_db_name.name
}

output "db_user_parameter_name" {
  description = "SSM parameter storing the Aurora database user."
  value       = aws_ssm_parameter.finance_tracker_db_user.name
}

output "db_password_parameter_name" {
  description = "SSM parameter storing the Aurora database password."
  value       = aws_ssm_parameter.finance_tracker_db_password.name
}

output "lambda_sg_parameter_name" {
  description = "SSM parameter containing the Lambda security group id."
  value       = aws_ssm_parameter.finance_tracker_lambda_sg_id.name
}

output "subnet_private_a_parameter_name" {
  description = "SSM parameter containing private subnet A id."
  value       = aws_ssm_parameter.finance_tracker_subnet_private_a.name
}

output "subnet_private_b_parameter_name" {
  description = "SSM parameter containing private subnet B id."
  value       = aws_ssm_parameter.finance_tracker_subnet_private_b.name
}
