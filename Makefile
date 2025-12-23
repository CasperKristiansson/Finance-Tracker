.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate tf-write-web-env \
        tf-enable-public-db tf-disable-public-db \
        type-check format test deploy-layer deploy-api deploy

TF_DIR ?= infra/terraform
TF_CMD = terraform -chdir=$(TF_DIR)
AWS_PROFILE ?= Personal
AWS_REGION  ?= eu-north-1
PYTHON ?= python3
PYLINTHOME ?= $(CURDIR)/.cache/pylint

# Terraform helpers

tf-write-web-env:
	@$(PYTHON) scripts/write_web_env.py \
		--tf-dir "$(TF_DIR)" \
		--env-path "apps/web/.env" \
		--aws-region "$(AWS_REGION)" \
		--aws-profile "$(AWS_PROFILE)"

tf-enable-public-db:
	@set -e; \
	ACCOUNT_ID=$$(aws sts get-caller-identity --profile "$(AWS_PROFILE)" --query Account --output text); \
	echo "Using AWS account ID $$ACCOUNT_ID"; \
	$(TF_CMD) apply -var 'enable_public_db_access=true' -var "account_id=$$ACCOUNT_ID"

tf-disable-public-db:
	@set -e; \
	ACCOUNT_ID=$$(aws sts get-caller-identity --profile "$(AWS_PROFILE)" --query Account --output text); \
	echo "Using AWS account ID $$ACCOUNT_ID"; \
	$(TF_CMD) apply -var 'enable_public_db_access=false' -var "account_id=$$ACCOUNT_ID"

# Quality gates

type-check:
	black --check apps/api
	isort --check-only apps/api
	@mkdir -p "$(PYLINTHOME)"
	PYLINTHOME="$(PYLINTHOME)" PYTHONPATH=. pylint apps/api
	pyright apps/api
	mypy apps/api

format:
	isort apps/api
	black apps/api

test:
	PYTHONPATH=. pytest apps/api/tests

deploy-layer:
	$(MAKE) -C infra/layers build
	cd infra/layers && npx serverless deploy

deploy-api:
	cd infra/serverless && npx serverless deploy

deploy: deploy-layer deploy-api
