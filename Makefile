.PHONY: tf-init tf-plan tf-apply tf-enable-public tf-disable-public

TF_DIR ?= infra/terraform
TF_CMD = terraform -chdir=$(TF_DIR)
AWS_PROFILE ?= Personal
AWS_REGION  ?= eu-north-1

tf-init:
	$(TF_CMD) init

tf-plan:
	$(TF_CMD) plan

tf-apply:
	$(TF_CMD) apply

tf-enable-public:
	$(TF_CMD) apply -var 'enable_public_access=true'

tf-disable-public:
	$(TF_CMD) apply -var 'enable_public_access=false'
