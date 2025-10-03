.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate

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

tf-destroy:
	$(TF_CMD) destroy

tf-fmt:
	$(TF_CMD) fmt -recursive

tf-validate:
	$(TF_CMD) validate
