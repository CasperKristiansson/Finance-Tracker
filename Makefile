.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate \
        tf-enable-bastion tf-disable-bastion bastion-copy bastion-shell

TF_DIR ?= infra/terraform
TF_CMD = terraform -chdir=$(TF_DIR)
AWS_PROFILE ?= Personal
AWS_REGION  ?= eu-north-1
PYTHON ?= python3

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

# Toggle bastion host provisioning

tf-enable-bastion:
	$(TF_CMD) apply -var 'enable_bastion=true'

tf-disable-bastion:
	$(TF_CMD) apply -var 'enable_bastion=false'

bastion-copy:
	@test -n "$(FILE)" || { echo "Usage: make bastion-copy FILE=path [REMOTE=/remote/dir]"; exit 1; }
	REMOTE_DIR=$${REMOTE:-/home/ec2-user}; \
	$(PYTHON) scripts/bastion_copy.py "$(FILE)" --remote-dir "$$REMOTE_DIR" --tf-dir "$(TF_DIR)" --profile "$(AWS_PROFILE)" --region "$(AWS_REGION)"

bastion-shell:
	$(PYTHON) scripts/bastion_shell.py --tf-dir "$(TF_DIR)" --profile "$(AWS_PROFILE)" --region "$(AWS_REGION)"
