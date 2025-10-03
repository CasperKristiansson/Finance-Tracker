data "http" "workstation_ip" {
  count = var.enable_bastion ? 1 : 0
  url   = "https://checkip.amazonaws.com/"
}

locals {
  workstation_cidr  = var.enable_bastion ? "${trimspace(data.http.workstation_ip[0].response_body)}/32" : null
  bastion_user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    dnf update -y
    dnf install -y postgresql15 telnet
    echo 'Session manager ready for Finance Tracker bastion.'
  EOT
}

resource "aws_internet_gateway" "finance_tracker" {
  count = var.enable_bastion ? 1 : 0

  vpc_id = aws_vpc.finance_tracker.id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-igw"
    },
  )
}

resource "aws_subnet" "finance_tracker_public" {
  count = var.enable_bastion ? 1 : 0

  vpc_id                  = aws_vpc.finance_tracker.id
  cidr_block              = "10.10.50.0/24"
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

resource "aws_route_table" "finance_tracker_public" {
  count = var.enable_bastion ? 1 : 0

  vpc_id = aws_vpc.finance_tracker.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.finance_tracker[0].id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-rt"
    },
  )
}

resource "aws_route_table_association" "finance_tracker_public" {
  count = var.enable_bastion ? 1 : 0

  subnet_id      = aws_subnet.finance_tracker_public[0].id
  route_table_id = aws_route_table.finance_tracker_public[0].id
}

data "aws_ami" "bastion" {
  count       = var.enable_bastion ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-kernel-6.1-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_iam_role" "bastion_ssm" {
  count = var.enable_bastion ? 1 : 0

  name = "${local.name_prefix}-bastion-ssm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-bastion-ssm-role"
    },
  )
}

resource "aws_iam_role_policy_attachment" "bastion_ssm_core" {
  count = var.enable_bastion ? 1 : 0

  role       = aws_iam_role.bastion_ssm[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "bastion" {
  count = var.enable_bastion ? 1 : 0

  name = "${local.name_prefix}-bastion-profile"
  role = aws_iam_role.bastion_ssm[0].name
}

resource "aws_security_group" "finance_tracker_bastion" {
  count = var.enable_bastion ? 1 : 0

  name        = "${local.name_prefix}-bastion-sg"
  description = "SSH access to the Finance Tracker bastion host"
  vpc_id      = aws_vpc.finance_tracker.id

  ingress {
    description = "SSH from current workstation"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [local.workstation_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-bastion-sg"
    },
  )
}

resource "aws_security_group_rule" "finance_tracker_aurora_from_bastion" {
  count = var.enable_bastion ? 1 : 0

  description              = "Allow bastion host to reach Aurora"
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.finance_tracker_aurora.id
  source_security_group_id = aws_security_group.finance_tracker_bastion[0].id
}

resource "aws_instance" "finance_tracker_bastion" {
  count = var.enable_bastion ? 1 : 0

  ami                         = data.aws_ami.bastion[0].id
  instance_type               = "t4g.nano"
  subnet_id                   = aws_subnet.finance_tracker_public[0].id
  vpc_security_group_ids      = [aws_security_group.finance_tracker_bastion[0].id]
  iam_instance_profile        = aws_iam_instance_profile.bastion[0].name
  associate_public_ip_address = true
  user_data                   = local.bastion_user_data

  metadata_options {
    http_endpoint          = "enabled"
    http_tokens            = "required"
    instance_metadata_tags = "enabled"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-bastion"
    },
  )
}

output "bastion_public_dns" {
  description = "Public DNS name for the Finance Tracker bastion host."
  value       = var.enable_bastion ? aws_instance.finance_tracker_bastion[0].public_dns : null
}

output "bastion_instance_id" {
  description = "Instance ID of the Finance Tracker bastion host."
  value       = var.enable_bastion ? aws_instance.finance_tracker_bastion[0].id : null
}
