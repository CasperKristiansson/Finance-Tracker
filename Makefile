.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate tf-write-web-env \
        tf-enable-public-db tf-disable-public-db \
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

# Toggle public database exposure (for local development)

tf-enable-public-db:
	$(TF_CMD) apply -var 'enable_public_db_access=true'

tf-disable-public-db:
	$(TF_CMD) apply -var 'enable_public_db_access=false'

# Quality gates

type-check:
	black --check apps/api
	isort --check-only apps/api
	PYTHONPATH=. pylint apps/api
	pyright apps/api
	mypy apps/api

format:
	isort apps/api
	black apps/api

test:
	pytest apps/api/tests

deploy-layer:
	$(MAKE) -C infra/layers build
	cd infra/layers && npx serverless deploy

deploy-api:
	cd infra/serverless && npx serverless deploy

deploy: deploy-layer deploy-api

startdev:
	npm run dev -w apps/web
