.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate tf-allow-ip

TF_DIR ?= infra/terraform
TF_CMD = terraform -chdir=$(TF_DIR)
AWS_PROFILE ?= Personal
AWS_REGION  ?= eu-north-1

# Terraform helpers

tf-init:
	$(TF_CMD) init

tf-plan:
	$(TF_CMD) plan

tf-apply:
	$(TF_CMD) apply

# Allow the current public IP to reach the Aurora cluster for SQL access

tf-allow-ip:
	@set -euo pipefail; \
		WORKSPACE=$$($(TF_CMD) workspace show); \
		SG_NAME="finance-tracker-$${WORKSPACE}-aurora-sg"; \
		SG_ID=$$(aws ec2 describe-security-groups \
			--profile $(AWS_PROFILE) \
			--region $(AWS_REGION) \
			--filters Name=group-name,Values=$${SG_NAME} \
			--query 'SecurityGroups[0].GroupId' \
			--output text); \
		if [ -z "$$SG_ID" ] || [ "$$SG_ID" = "None" ]; then \
			echo "Could not find security group $$SG_NAME. Run terraform apply first?"; \
			exit 1; \
		fi; \
		IP=$$(curl -s https://checkip.amazonaws.com | tr -d '\n'); \
		if [ -z "$$IP" ]; then \
			echo "Could not determine current public IP"; \
			exit 1; \
		fi; \
		echo "Authorizing $$IP/32 on $$SG_NAME"; \
		aws ec2 authorize-security-group-ingress \
			--profile $(AWS_PROFILE) \
			--region $(AWS_REGION) \
			--group-id "$$SG_ID" \
			--protocol tcp \
			--port 5432 \
			--cidr "$$IP/32" \
		|| echo "Ingress rule might already exist";
