.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate tf-write-web-env \
        tf-enable-public-db tf-disable-public-db \
        type-check format test deploy-layer deploy-api deploy deployWebsite

TF_DIR ?= infra/terraform
TF_CMD = terraform -chdir=$(TF_DIR)
AWS_PROFILE ?= Personal
AWS_REGION  ?= eu-north-1
ROOT_DOMAIN_NAME ?= casperkristiansson.com
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

deployWebsite:
	@set -e; \
	ROOT_DOMAIN_NAME="$${ROOT_DOMAIN_NAME:-$(ROOT_DOMAIN_NAME)}"; \
	ACCOUNT_ID="$${ACCOUNT_ID:-$$(aws sts get-caller-identity --profile "$(AWS_PROFILE)" --query Account --output text)}"; \
	STATIC_SITE_DOMAIN="finance-tracker.$$ROOT_DOMAIN_NAME"; \
	if [ -z "$(STATIC_SITE_BUCKET)" ]; then \
		STATIC_SITE_BUCKET="$$(printf '%s' "$$STATIC_SITE_DOMAIN" | tr '.' '-')-$$ACCOUNT_ID"; \
	else \
		STATIC_SITE_BUCKET="$(STATIC_SITE_BUCKET)"; \
	fi; \
	if [ -z "$(CLOUDFRONT_DISTRIBUTION_ID)" ]; then \
		CLOUDFRONT_DISTRIBUTION_ID="$$(aws cloudfront list-distributions --profile "$(AWS_PROFILE)" --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '$$STATIC_SITE_DOMAIN')].Id | [0]" --output text)"; \
	else \
		CLOUDFRONT_DISTRIBUTION_ID="$(CLOUDFRONT_DISTRIBUTION_ID)"; \
	fi; \
	if [ -z "$$STATIC_SITE_BUCKET" ] || [ "$$STATIC_SITE_BUCKET" = "None" ]; then \
		echo "ERROR: Unable to resolve STATIC_SITE_BUCKET. Set STATIC_SITE_BUCKET manually or check account/ROOT_DOMAIN_NAME."; \
		exit 1; \
	fi; \
	if [ -z "$$CLOUDFRONT_DISTRIBUTION_ID" ] || [ "$$CLOUDFRONT_DISTRIBUTION_ID" = "None" ]; then \
		echo "ERROR: Unable to resolve CLOUDFRONT_DISTRIBUTION_ID. Set CLOUDFRONT_DISTRIBUTION_ID manually or check CloudFront alias $$STATIC_SITE_DOMAIN."; \
		exit 1; \
	fi; \
	echo "Deploying to s3://$$STATIC_SITE_BUCKET (CloudFront $$CLOUDFRONT_DISTRIBUTION_ID)"; \
	npm run build -w apps/web; \
	aws s3 sync apps/web/dist s3://$$STATIC_SITE_BUCKET --delete --profile "$(AWS_PROFILE)" --region "$(AWS_REGION)"; \
	aws cloudfront create-invalidation --distribution-id "$$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*" --profile "$(AWS_PROFILE)"
