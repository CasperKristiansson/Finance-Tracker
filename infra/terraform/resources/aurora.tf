resource "aws_vpc" "app" { cidr_block = "10.10.0.0/16" enable_dns_support = true enable_dns_hostnames = true }
resource "aws_subnet" "priv_a" { vpc_id = aws_vpc.app.id cidr_block = "10.10.1.0/24" availability_zone = "eu-north-1a" }
resource "aws_subnet" "priv_b" { vpc_id = aws_vpc.app.id cidr_block = "10.10.2.0/24" availability_zone = "eu-north-1b" }
resource "aws_db_subnet_group" "aurora" { name = "aurora-subnets" subnet_ids = [aws_subnet.priv_a.id, aws_subnet.priv_b.id] }

resource "aws_security_group" "aurora" { name = "sg-aurora" vpc_id = aws_vpc.app.id }
resource "aws_security_group" "lambda" { name = "sg-lambda" vpc_id = aws_vpc.app.id }
resource "aws_security_group_rule" "aurora_in" {
  type="ingress" from_port=5432 to_port=5432 protocol="tcp"
  security_group_id=aws_security_group.aurora.id source_security_group_id=aws_security_group.lambda.id
}
resource "aws_security_group_rule" "lambda_out" {
  type="egress" from_port=0 to_port=0 protocol="-1"
  security_group_id=aws_security_group.lambda.id cidr_blocks=["0.0.0.0/0"]
}

resource "aws_rds_cluster" "aurora_pg" {
  cluster_identifier     = "personal-app"
  engine                 = "aurora-postgresql"
  engine_version         = "16.3"
  database_name          = "personaldb"
  master_username        = "appuser"
  master_password        = "CHANGE_ME_INIT"
  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [aws_security_group.aurora.id]
  storage_encrypted      = true
  deletion_protection    = false
  backup_retention_period= 3
  apply_immediately      = true

  serverlessv2_scaling_configuration {
    min_capacity             = 0
    max_capacity             = 1
    seconds_until_auto_pause = 600
  }
}

resource "aws_rds_cluster_instance" "aurora_pg_i1" {
  identifier         = "personal-app-1"
  cluster_identifier = aws_rds_cluster.aurora_pg.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora_pg.engine
  engine_version     = aws_rds_cluster.aurora_pg.engine_version
}

resource "aws_ssm_parameter" "db_endpoint" { name="/personal/db/endpoint" type="String"       value=aws_rds_cluster.aurora_pg.endpoint }
resource "aws_ssm_parameter" "db_name"     { name="/personal/db/name"     type="String"       value=aws_rds_cluster.aurora_pg.database_name }
resource "aws_ssm_parameter" "db_user"     { name="/personal/db/user"     type="String"       value=aws_rds_cluster.aurora_pg.master_username }
resource "aws_ssm_parameter" "db_password" { name="/personal/db/password" type="SecureString" value="set-a-long-random" }

output "subnet_ids" { value = [aws_subnet.priv_a.id, aws_subnet.priv_b.id] }
output "lambda_sg"  { value = aws_security_group.lambda.id }
