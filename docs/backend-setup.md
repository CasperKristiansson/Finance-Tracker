# Backend Setup Guide

This guide summarizes the steps required to develop, test, and deploy the Finance Tracker backend.

## 1. Environment Configuration

1. **Python**: Install the project’s Python version (check `.python-version`) and create a virtual environment.
   ```bash
   pyenv install $(cat .python-version)
   pyenv virtualenv $(cat .python-version) finance-tracker
   pyenv activate finance-tracker
   pip install -r requirements.txt
   ```
2. **Database access**: The API runs inside a VPC and reads connection details from AWS Systems Manager Parameter Store. Export these when running locally:
   ```bash
   export DB_ENDPOINT=$(aws ssm get-parameter --name /finance-tracker/dev/db/endpoint --query 'Parameter.Value' --output text)
   export DB_NAME=$(aws ssm get-parameter --name /finance-tracker/dev/db/name --query 'Parameter.Value' --output text)
   export DB_USER=$(aws ssm get-parameter --name /finance-tracker/dev/db/user --query 'Parameter.Value' --output text)
   export DB_PASSWORD=$(aws ssm get-parameter --with-decryption --name /finance-tracker/dev/db/password --query 'Parameter.Value' --output text)
   ```
3. **Local settings**: Copy `.env.example` (if present) to `.env` for developer-specific overrides and activate it with your preferred shell helper.

## 2. Database Migrations

1. **Autogenerate a migration** after model changes:
   ```bash
   alembic revision --autogenerate -m "Describe change"
   ```
2. **Review the migration** to ensure the generated SQL is correct and check it into version control.
3. **Apply migrations locally** before running tests:
   ```bash
   alembic upgrade head
   ```
4. **Apply in the cloud**: the deployment pipeline (or operator) should run `alembic upgrade head` against the Aurora cluster after the new container or Lambda code is deployed.

## 3. Deployment Steps

1. **Provision infrastructure** (initial run or when VPC/DB settings change):
   ```bash
   cd infra/terraform
   terraform init
   terraform workspace select dev   # or create/select appropriate workspace
   terraform apply
   ```
   Capture the outputs (`lambda_security_group_id`, `private_subnet_a_id`, `private_subnet_b_id`, and `db_parameter_paths`) for the next step.
2. **Deploy the API** using Serverless Framework:
   ```bash
   cd ../../
   export LAMBDA_SG=$(terraform output -raw lambda_security_group_id)
   export SUBNET_A=$(terraform output -raw private_subnet_a_id)
   export SUBNET_B=$(terraform output -raw private_subnet_b_id)
   serverless deploy --stage dev
   ```
3. **Post-deploy verification**:
   - Run `serverless info --stage dev` to inspect the deployed endpoints.
   - Execute the automated API test suite (`pytest apps/api/tests`) against the deployed stage using environment variables that point to the live API (consider a smoke-test script).
4. **Rollback plan**: if the deployment fails, use `serverless rollback --stage dev --timestamp <previous>` or redeploy the last known-good build. Infrastructure changes can be rolled back via `terraform apply` with the previous state file.

Keep this guide in sync with infrastructure or deployment tooling changes.
