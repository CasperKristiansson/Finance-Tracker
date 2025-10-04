.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate tf-write-web-env \
        tf-enable-bastion tf-disable-bastion bastion-copy bastion-shell \
        type-check format test deploy-layer deploy-api deploy

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
	$(MAKE) tf-write-web-env

tf-destroy:
	$(TF_CMD) destroy

tf-fmt:
	$(TF_CMD) fmt -recursive

tf-validate:
	$(TF_CMD) validate

tf-write-web-env:
	@$(PYTHON) scripts/write_web_env.py \
		--tf-dir "$(TF_DIR)" \
		--env-path "apps/web/.env" \
		--aws-region "$(AWS_REGION)" \
		--aws-profile "$(AWS_PROFILE)"

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

# Quality gates

type-check:
	black --check .
	isort --check-only .
	PYTHONPATH=. pylint apps/api
	pyright
	mypy apps/api

format:
	isort .
	black .

test:
	pytest apps/api/tests

deploy-layer:
	$(MAKE) -C infra/layers build
	cd infra/layers && npx serverless deploy

deploy-api:
	cd infra/serverless && npx serverless deploy

deploy: deploy-layer deploy-api
