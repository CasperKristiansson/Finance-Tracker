# 0. Milestones

- [x] M1: Account-level bank type configuration
  - Goal: Let each account declare which bank statement format it uses (Swedbank, SEB, Circle K Mastercard, or none) so imports can infer parsers from the selected account.
  - Deliverables: DB migration + API field + Accounts UI control for bank type.
  - Acceptance criteria: User can set/clear bank type for an account; `/accounts` responses include the configured value; existing account create/update flows still work.
  - Affected services/components (high level): API accounts model/schema/handlers; Web accounts modal and types.
  - Rollout/flagging: Always-on (safe additive field).
  - Blockers (OQ-xx): None

- [x] M2: Replace imports API with stateless preview + commit
  - Goal: Remove DB-staged import sessions and replace the existing `/imports*` endpoints with a stateless flow: preview parses + suggests without persisting; commit persists only final reviewed transactions.
  - Deliverables: Updated request/response schemas, updated handlers/routes, refactored import service logic, and updated/added API tests.
  - Acceptance criteria: Preview returns parsed drafts and per-file errors without writing import files/rows/errors/batches; commit persists transactions (and a commit-time import batch for grouping).
  - Affected services/components (high level): API imports handlers/services/schemas; serverless route config; API tests.
  - Rollout/flagging: Always-on; legacy endpoints removed.
  - Blockers (OQ-xx): None

- [x] M3: Rebuild /imports UI as strict stepper
  - Goal: Implement a wizard-style UX: upload → map each file to an account → parse → audit → submit.
  - Deliverables: New page flow and client-side state for drafts + edits; calls the new preview/commit endpoints.
  - Acceptance criteria: User can upload 1+ XLSX files, assign each to an account (required), parse using the account’s configured bank type, audit/edit rows, and submit to create transactions; nothing is persisted until submit.
  - Affected services/components (high level): Web imports page, imports feature state, shared API hooks/types.
  - Rollout/flagging: Always-on; legacy UI removed.
  - Blockers (OQ-xx): None

- [x] M4: Bedrock suggestions with history context + infra enablement
  - Goal: Use AWS Bedrock to suggest categories using prior user history as context, with robust fallback and privacy-conscious prompts.
  - Deliverables: A non-VPC Bedrock suggestion endpoint (no DB access), tightened prompt/JSON parsing, and IAM permissions for `bedrock:InvokeModel`.
  - Acceptance criteria: Main import preview remains deterministic (no Bedrock calls); the Bedrock suggestion endpoint returns category ID suggestions using client-provided history and draft transactions.
  - Affected services/components (high level): API Bedrock suggestion handler + schemas; serverless IAM policy.
  - Rollout/flagging: Always-on (best-effort with fallback).
  - Blockers (OQ-xx): None

# 1. Overview

This spec defines a restructured import flow for bank statement XLSX files. The key change is removing DB-staged import sessions: the backend parses and suggests categories in a stateless preview request, returns draft transactions to the client for audit, and only persists to the database at final submit.

Supported statement formats (existing parsers in `apps/api/services/imports.py`):
- Swedbank
- SEB
- Circle K Mastercard

Account-level configuration determines which parser to apply for a file (instead of selecting bank type per file on the import screen).

# 2. Current behavior and architecture

## Frontend (current)
- Route: `apps/web/src/data/routes.ts` uses `/imports`.
- `apps/web/src/pages/imports/imports.tsx` implements a strict stepper flow:
  - Upload 1+ XLSX files.
  - Map each file to an `account_id` (required); bank parsing uses each account’s configured `bank_import_type`.
  - Parse via `POST /imports/preview`, audit locally (no persistence), then submit via `POST /imports/commit`.

## Backend (current)
- Endpoints configured in `infra/serverless/serverless.yml`:
  - `POST /imports/preview`, `POST /imports/commit`
- `apps/api/services/imports.py`:
  - Preview parses XLSX per-bank and returns per-file errors + draft rows without persisting import files/rows/errors.
  - Commit persists reviewed rows as transactions atomically, creating `transaction_import_batches` at commit-time only.

## Key mismatch with desired behavior
- Desired: “Return parsed transactions to user without storing anything in the DB; only persist when user submits.”
- Current: Matches desired behavior: preview is read-only (DB reads only); commit persists atomically.

# 3. Requirements and constraints

## Functional requirements
- Account-level field for statement format: Swedbank / SEB / Circle K Mastercard / none.
- Import screen flow:
  1. Upload one or multiple XLSX files (templates under `docs/data/bank transactions/*`).
  2. Assign each uploaded file to an account.
  3. Click “Parse” to get transactions + category suggestions.
  4. Audit/edit transactions (description, amount, date, category, etc.).
  5. Submit to persist to DB.
- Parsing supported only for the 3 formats above.
- Category suggestions should use previous history and Bedrock AI via the isolated suggestion endpoint when enabled.
- Preview must not persist import batches/files/rows/errors, and must not persist transactions.

## Non-functional constraints
- API is serverless and VPC-attached to private subnets; Bedrock calls should be done via a separate non-VPC Lambda to avoid NAT costs.
- Keep PII out of logs as much as practical (file contents, descriptions).

# 4. Proposed features and behavior changes

## 4.1 Account-level bank type
- Add optional `bank_import_type` to accounts.
- UI exposes a “Statement format” selector with:
  - None (maps to `null`) (ASSUMPTION AQ-01)
  - Swedbank (`swedbank`)
  - SEB (`seb`)
  - Circle K Mastercard (`circle_k_mastercard`)

## 4.2 Stateless preview endpoint
- Preview endpoint `POST /imports/preview` accepts:
  - Files: `{ filename, content_base64, account_id }[]`
  - Optional `note` for UI only (not persisted at preview time)
  - Optional guard-rail knobs: limits, etc.
- Backend looks up each account’s `bank_import_type` and selects parser.
- Returns:
  - Per-file parse summary + errors
  - A flat list of draft transaction rows with:
    - `client_row_id` (server-generated UUID)
    - `account_id` (from file mapping)
    - `occurred_at` (ISO date)
    - `amount` (decimal string)
    - `description`
    - Optional suggestions:
      - `suggested_category_id` + `confidence` + `reason`
      - `suggested_subscription_id` + metadata (optional)
      - `transfer_match` metadata (optional)

No DB writes occur during preview (except reads required for category/subscription/rule/history suggestions).

## 4.3 Stateless commit endpoint
- New endpoint persists submitted draft transactions:
  - Creates one `TransactionImportBatch` (post-audit) to retain audit grouping (ASSUMPTION AQ-02).
  - For each draft row not marked deleted:
    - Builds balanced legs using the selected account and a system “Offset” account (existing pattern), unless user chose a transfer account.
    - Writes `Transaction`, `TransactionLeg`, and optional `TaxEvent` if supported by UI (ASSUMPTION AQ-03).
    - Records/updates `ImportRule` from user-provided final category/subscription selections (reusing existing logic), since this is “history” rather than “staging”.

## 4.4 Category suggestion strategy (layered)
1. Deterministic import rules (`import_rules`) win.
2. History-based heuristic: mine recent transactions to suggest category/subscription for similar descriptions (M4).
3. Bedrock AI suggestion (M5) using:
   - Allowed categories list (IDs + names)
   - A small set of prior labeled examples (history)
   - The current preview transactions
4. Fallback: no suggestion.

# 5. Affected components

## Backend/API
- Accounts:
  - `apps/api/models/account.py`
  - `apps/api/schemas/account.py`
  - `apps/api/handlers/accounts.py`
  - `apps/api/services/account.py`
  - Alembic migration under `apps/api/migrations/versions/*`
- Imports (restructured):
  - `apps/api/handlers/imports.py` (legacy handlers removed; new preview/commit handlers added)
  - `apps/api/schemas/imports.py` (new preview/commit schemas; legacy session schemas removed)
  - `apps/api/services/imports.py` (reuse parsing + suggestion helpers; add stateless preview/commit entrypoints)
  - `infra/serverless/serverless.yml` (update routes; add IAM permissions for Bedrock)
  - `infra/terraform/resources/*` (add NAT for VPC egress)
- Tests:
  - `apps/api/tests/test_import_handlers.py`
  - `apps/api/tests/integration/test_imports_integration.py`

## Frontend/Web
- Accounts UI:
  - `apps/web/src/pages/accounts/children/account-modal.tsx`
  - `apps/web/src/types/schemas.ts` (account schema additions)
- Imports UI/state:
  - `apps/web/src/pages/imports/imports.tsx`
  - `apps/web/src/features/imports/importsSaga.ts` and `apps/web/src/features/imports/importsSlice.ts` (refactor or replace to store client-side drafts)
  - `apps/web/src/hooks/use-api.ts` (imports API wrapper)
  - `apps/web/src/types/schemas.ts` (new preview/commit request/response schemas)

# 6. Data model and external contracts

## 6.1 Account: add bank import type
- DB: `accounts.bank_import_type` nullable string (or enum), representing `BankImportType` when set. (ASSUMPTION AQ-01)
- API:
  - `AccountRead`/`AccountWithBalance`: include `bank_import_type?: BankImportType | null`
  - `AccountCreate`/`AccountUpdate`: accept optional `bank_import_type`

## 6.2 Import preview contract (preview)

Proposed request shape (new schema; legacy `ImportBatchCreate` removed):
- `files[]`:
  - `filename: string`
  - `content_base64: string`
  - `account_id: UUID` (required)
- `note?: string`
- `options?`:
  - `use_bedrock?: boolean`
  - `max_rows_per_file?: number` (guard rails)
  - `max_files?: number`

Proposed response shape:
- `files[]` summary:
  - `client_file_id: UUID`
  - `filename`
  - `account_id`
  - `bank_import_type` (derived)
  - `row_count`
  - `error_count`
  - `errors[]` (row_number + message)
  - `preview_rows[]` (small sample for UI)
- `rows[]` (draft transactions):
  - `client_row_id: UUID`
  - `client_file_id: UUID`
  - `row_index: number`
  - `account_id: UUID`
  - `occurred_at: string (ISO date)`
  - `amount: string (decimal)`
  - `description: string`
  - `suggested_category_id?: UUID | null`
  - `suggested_confidence?: number | null`
  - `suggested_reason?: string | null`
  - `suggested_subscription_id?: UUID | null`
  - `transfer_match?: { transfer_account_id: UUID, confidence?: number, reason?: string } | null` (optional)

## 6.3 Import commit contract (commit)

Proposed request shape:
- `note?: string`
- `source_name?: string` (optional override)
- `rows[]`:
  - `client_row_id: UUID` (for UI correlation only)
  - `account_id: UUID`
  - `occurred_at: string (ISO date)`
  - `amount: string (decimal)`
  - `description: string`
  - `category_id?: UUID | null`
  - `subscription_id?: UUID | null`
  - `transfer_account_id?: UUID | null`
  - `tax_event_type?: TaxEventType | null` (optional; see AQ-03)
  - `delete?: boolean`

Proposed response shape:
- `import_batch_id: UUID`
- `created_transaction_ids: UUID[]`
- Commit is all-or-nothing; errors are returned as a single failure response with validation details.

# 7. Step-by-step implementation plan

## M1: Account-level bank type configuration
- [x] Add nullable `bank_import_type` to `apps/api/models/account.py`.
- [x] Add field to Pydantic schemas in `apps/api/schemas/account.py` for read + write.
- [x] Update account handlers/services/repositories to allow setting/updating the field.
- [x] Add Alembic migration `apps/api/migrations/versions/20251217_01_account_bank_import_type.py`.
- [x] Update web account Zod schemas in `apps/web/src/types/schemas.ts` to include `bank_import_type`.
- [x] Update `apps/web/src/pages/accounts/children/account-modal.tsx` to include a “Statement format” select (None/Swedbank/SEB/Circle K Mastercard).
- [x] Definition of done:
  - [x] API returns the new field for accounts.
  - [x] UI can set and persist the value via existing create/update flows.
  - [x] Verified by `PYTHONPATH=. pytest apps/api/tests/test_account_handlers.py -q`, `make type-check`, `npm run lint -w apps/web`.

## M2: Replace imports API with stateless preview + commit
- [x] Replace existing `/imports*` endpoints with:
  - `POST /imports/preview` (parse + suggest, stateless)
  - `POST /imports/commit` (persist reviewed rows, all-or-nothing)
  - Remove legacy: `GET /imports/{batch_id}`, `POST /imports/{batch_id}/files`, `POST /imports/{batch_id}/commit` (and any unused list endpoints if not needed).
- [x] Add new Pydantic schemas in `apps/api/schemas/imports.py` for preview/commit; remove legacy session schemas.
- [x] Update `apps/api/handlers/imports.py` to expose only the new endpoints.
- [x] In `apps/api/services/imports.py`, implement stateless functions:
  - Parse each file using existing per-bank parsers, resolving `bank_type` from the assigned account’s `bank_import_type` (no per-file override).
  - Build draft rows and enrich with deterministic suggestions (rules/subscriptions/transfers), without writing `TransactionImportBatch`, `ImportFile`, `ImportRow`, `ImportErrorRecord`.
  - Commit: create a new `TransactionImportBatch` (commit-time only) and persist transactions/legs from submitted rows; commit is transactional (all-or-nothing).
- [x] Update `infra/serverless/serverless.yml` to expose only the new endpoints.
- [x] Add/adjust tests:
  - Unit tests in `apps/api/tests/test_import_handlers.py` for preview/commit.
  - Integration tests in `apps/api/tests/integration/test_imports_integration.py` for end-to-end preview → commit.
- [x] Definition of done:
  - [x] Preview produces rows + errors and does not create import_* records in DB.
  - [x] Commit persists transactions and associates them with a newly created import batch.
  - [x] Verified by `make test`, `make type-check`.

## M3: Rebuild /imports UI as strict stepper
- [x] Add new web API schemas/types for preview/commit in `apps/web/src/types/schemas.ts`.
- [x] Update `apps/web/src/hooks/use-api.ts` to add preview + commit calls.
- [x] Refactor `apps/web/src/features/imports/*` to store:
  - Selected files + account mapping
  - Preview response (draft rows + per-file errors)
  - Local edits (description/date/amount/category/etc.) before submit
- [x] Rework `apps/web/src/pages/imports/imports.tsx` UX:
  - Step 1: Upload files (XLSX only).
  - Step 2: Map each file to an account (required) and show the account’s configured bank type; parsing fails if the bank type is wrong/missing.
  - Step 3: “Parse files” calls preview endpoint.
  - Step 4: Audit table: inline edits + apply suggestion controls; show errors clearly; support deleting rows; allow `tax_event_type` marking per row.
  - Step 5: “Submit” calls commit endpoint (all-or-nothing), then navigates/refreshes transactions.
- [x] Definition of done:
  - [x] Full flow works against the API, and no import session is created prior to submit.
  - [x] Verified by `npm run format -w apps/web`, `npm run lint -w apps/web`.

## M4: Bedrock suggestions with history context + infra enablement
- [x] Infra/network:
  - [x] Add IAM permission for `bedrock:InvokeModel` to the Serverless role.
  - [x] Add a dedicated non-VPC Lambda endpoint: `POST /imports/suggest-categories` (no DB access; not attached to the VPC).
- [x] Endpoint behavior:
  - [x] Accept client-provided `categories`, `history` (existing categorized transactions), and `transactions` needing suggestions.
  - [x] Require strictly valid JSON output and implement robust JSON extraction/parsing.
  - [x] Return suggestions as `{id, category_id, confidence, reason}`.
- [x] Tests:
  - [x] Unit test with a fake Bedrock client validating suggestion parsing + category ID mapping.
- [x] Definition of done:
  - [x] Main import preview remains deterministic (no Bedrock calls).
  - [x] Suggestion endpoint returns Bedrock suggestions when available and fails clearly otherwise.

# 8. Test plan

## M1
- Backend:
  - Unit tests for account update/read include `bank_import_type`.
  - Run: `make format` then `make type-check`.
- Frontend:
  - Validate account modal form includes the new field and PATCH payload.
  - Run: `npm run format -w apps/web` then `npm run lint -w apps/web`.

## M2
- Backend:
  - New handler tests for preview/commit.
  - Integration test preview → commit persists `transactions` and does not persist `import_files/import_rows` at preview time.
  - Run: `pytest apps/api/tests`.

## M3
- Frontend:
  - Manual flow check:
    - Upload sample files from `docs/data/bank transactions/*`
    - Map to accounts with configured bank types
    - Parse, edit, submit
    - Verify new transactions appear under `/transactions`
  - Run: `npm run build -w apps/web` (optional), plus format/lint commands.

## M4
- Backend:
  - Unit test exercises suggestion handler with a fake client.
  - Run: `make type-check` and `PYTHONPATH=. pytest apps/api/tests -q`

## M5
- Backend:
  - Fake Bedrock tests for prompt formatting and JSON parsing.
- Infra:
  - Deploy smoke test in `eu-north-1` verifying Bedrock calls succeed from Lambda (out-of-band from unit tests).

# 9. Risks and open questions

## Technical risks
- IAM: Bedrock invoke permission must exist in the deployed role (included in `infra/serverless/serverless.yml`).
- Misconfiguration: ensure the Bedrock suggestion function is not attached to the VPC; otherwise it may require NAT and incur costs.
- Payload size: base64 XLSX uploads could exceed API Gateway limits for large statements (mitigate with file size limits + future S3 presigned upload path).
- Duplicate imports: without stable external IDs in bank exports, repeated imports may create duplicate transactions (mitigate with optional dedupe warnings during preview and/or future hashing-based dedupe).
- Privacy: prompts may include transaction descriptions; minimize prompt size and avoid logging raw payloads.

## Resolution log (RESOLVED items; keep IDs stable)
- AQ-01 (RESOLVED): “None” bank type is represented as `null` (not a new enum member) in API/DB/UI. Answer: “do null”.
- AQ-02 (RESOLVED): Commit-time grouping via `TransactionImportBatch`. Decision: keep it (commit-time only), per “up to you”.
- AQ-03 (RESOLVED): Per-transaction `tax_event_type` marking remains supported in the audit/commit flow. Answer: “Yes”.
- AQ-04 (RESOLVED): Legacy import handlers/UI are removed; no migration/compat concerns. Answer: “delete legacy handler… delete anything legacy”.
- AQ-05 (RESOLVED): No feature flags; flow is always-on. Answer: “No feature flag… always included”.

- OQ-01 (RESOLVED): None representation. Answer: `null`.
- OQ-02 (RESOLVED): Bank type settable on create and update. Answer: “both”.
- OQ-03 (RESOLVED): No versioned endpoints; overwrite existing import API surface. Decision: use `/imports/preview` + `/imports/commit` under the same base path and remove legacy session endpoints.
- OQ-04 (RESOLVED): Account inference. Answer: do not infer; user must select `account_id` per uploaded file.
- OQ-05 (RESOLVED): Replacement strategy. Answer: total replace; no parallel legacy.
- OQ-06 (RESOLVED): Commit semantics. Answer: all-or-nothing.
- OQ-07 (RESOLVED): UX. Answer: strict stepper UI.
- OQ-08 (RESOLVED): Bank type overrides. Answer: no; account bank type must be correct, otherwise parsing fails (user responsibility).
- OQ-09 (RESOLVED): Dedupe policy. Decision: allow duplicates initially; optionally surface “possible duplicates” warnings during preview as a non-blocking UX enhancement.
- OQ-10 (RESOLVED): Infra check result. Repo shows Lambdas run in private subnets and Terraform has no NAT/VPC endpoints; assume no outbound egress today.
- OQ-11 (RESOLVED): Preferred infra approach. Decision: add NAT gateway + private subnet routing (copying the existing “private subnets + SG egress” posture, but enabling egress via NAT) and add `bedrock:InvokeModel` IAM permissions.
