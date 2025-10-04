# Backend Implementation Checklist

> Mark items complete by replacing `[ ]` with `[x]` after finishing the work.

This checklist translates the data management specification into actionable steps. Follow the tasks in order and keep each atomic so work can be reviewed before proceeding. When working with unfamiliar libraries (e.g., SQLModel, FastAPI), consult Context7 MCP docs before coding.

## Foundation

- [x] **Task 1 — Scaffold API package**  
      Create the `apps/api/` package with subpackages for `shared/`, `models/`, `repositories/`, `services/`, `schemas/`, and `routes/`. Add `__init__.py` files and a short README pointing to `docs/data-management-spec.md`.

- [ ] **Task 2 — Configure shared library core**  
      Implement shared base classes (`TimestampMixin`, `UUIDPrimaryKeyMixin`, `AuditSourceMixin`) and utility modules in `apps/api/shared/`. Include SQLModel session helpers and a validation function for net-zero transaction legs.

- [ ] **Task 3 — Domain enums & constants**  
      Define enums for account, category, transaction, system account codes, and created source. Add SEK currency constant plus helper functions enforcing sign conventions.

## Data Models

- [ ] **Task 4 — Account & loan models**  
      Implement SQLModel tables for `Account`, `Loan`, `LoanRateChange`, and `BalanceSnapshot` per spec §4.1–4.2. Enforce the one-loan-per-debt-account constraint and expose relationships.

- [ ] **Task 5 — Category & system account models**  
      Implement `Category` and `SystemAccount` tables with seed data hooks as described in spec §4.3 and §4.6.

- [ ] **Task 6 — Transaction & support models**  
      Implement `Transaction`, `TransactionLeg`, `LoanEvent`, and `TransactionImportBatch` schemas with validators ensuring SEK-only amounts and double-entry balancing.

- [ ] **Task 7 — Alembic & migrations setup**  
      Configure Alembic to autogenerate migrations from SQLModel metadata and document migration commands.

## Data Access Layer

- [ ] **Task 8 — Database session configuration**  
      Build DB connection utilities using the pattern in `temp.py`, reading credentials from environment variables (DB endpoint, name, user, password).

- [ ] **Task 9 — Account repository & services**  
      Implement repositories/services for account CRUD, balance calculation, and loan linkage logic. Add unit tests covering balance derivation.

- [ ] **Task 10 — Category repository & services**  
      Provide create/update/archive operations for categories with uniqueness enforcement and tests.

- [ ] **Task 11 — Transaction repository & services**  
      Implement posting logic for transactions and transfers, including validation of legs and generation of loan events. Add tests for double-entry enforcement.

- [ ] **Task 12 — Reporting utilities**  
      Implement aggregation helpers for monthly/yearly/total reports and materialized view refresh hooks.

## API Layer

- [ ] **Task 13 — Account endpoints & tests**  
      Expose `/accounts` routes returning balances and supporting create/update operations. Include API and repository integration tests.

- [ ] **Task 14 — Category endpoints & tests**  
      Implement `/categories` routes for list/create/update with accompanying tests.

- [ ] **Task 15 — Transaction endpoints & tests**  
      Implement `/transactions` routes for listing and creation with validation of legs, plus tests covering transfers and loan payments.

- [ ] **Task 16 — Loan endpoints & tests**  
      Implement `/loans` POST/PATCH plus `/loans/{account_id}/schedule` and `/loans/{account_id}/events` endpoints. Include tests for schedule generation and event retrieval.

- [ ] **Task 17 — Reporting endpoints & tests**  
      Implement `/reports/monthly`, `/reports/yearly`, and `/reports/total` endpoints with aggregation tests.

## Background Jobs & Views

- [ ] **Task 18 — Materialized views implementation**  
      Create SQL definitions or ORM equivalents for monthly totals, category summaries, and net worth views, along with refresh utilities.

- [ ] **Task 19 — Loan interest accrual job**  
      Stub background job logic for periodic interest accrual postings and document scheduling plan.

## Infrastructure & Deployment

- [ ] **Task 20 — Serverless configuration**  
      Update `infra/serverless/serverless.yml` to deploy the API Lambda within the Aurora VPC. Configure `vpc.securityGroupIds`, `vpc.subnetIds`, environment variables (`DB_ENDPOINT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` via SSM), and IAM statements allowing `ssm:GetParameter(s)` on `arn:aws:ssm:eu-north-1:#{AWS::AccountId}:parameter/personal/db/*`. Comment any deviations from the example snippet.

- [ ] **Task 21 — Terraform alignment**  
      Ensure Terraform outputs expose `LAMBDA_SG`, `SUBNET_A`, `SUBNET_B`, and SSM parameter paths. Update modules or documentation so Serverless can consume them.

## Documentation & Support

- [ ] **Task 22 — Developer guide updates**  
      Add `docs/backend-setup.md` summarizing environment configuration, migration workflow, and deployment steps.

- [ ] **Task 23 — Spec cross-check**  
      Once implementation stabilizes, revisit `docs/data-management-spec.md` to document any deviations and confirm coverage.
