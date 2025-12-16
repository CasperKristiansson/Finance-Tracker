# 0. Milestones

- [ ] M1: Account-level bank type configuration
  - Goal: Let each account declare which bank statement format it uses (Swedbank, SEB, Circle K Mastercard, or none) so imports can infer parsers from the selected account.
  - Deliverables: DB migration + API field + Accounts UI control for bank type.
  - Acceptance criteria: User can set/clear bank type for an account; `/accounts` responses include the configured value; existing account create/update flows still work.
  - Affected services/components (high level): API accounts model/schema/handlers; Web accounts modal and types.
  - Rollout/flagging: Always-on (safe additive field).
  - Blockers (OQ-xx): OQ-01, OQ-02

- [ ] M2: Stateless import preview + commit API (no DB staging)
  - Goal: Replace “import session” DB-staging with a stateless backend flow: parse XLSX files + generate suggestions + return drafts without persisting; commit persists transactions only when user submits.
  - Deliverables: New request/response schemas, new handlers/routes, service functions reusing existing parsers/suggestion logic, and updated/added API tests.
  - Acceptance criteria: Preview endpoint returns parsed drafts and per-file errors without writing import files/rows/batches; commit endpoint persists transactions (and import batch metadata) from submitted drafts.
  - Affected services/components (high level): API imports handlers/services/schemas; serverless route config; API tests.
  - Rollout/flagging: Feature-flagged (`IMPORT_V2_ENABLED`) with legacy endpoints unchanged.
  - Blockers (OQ-xx): OQ-03, OQ-04, OQ-05, OQ-06

- [ ] M3: New /imports UI flow (upload → map accounts → parse → audit → submit)
  - Goal: Rebuild the frontend import screen UX around the new stateless API and account-level bank types.
  - Deliverables: New UI states + Redux slice/saga (or refactor existing imports feature) to manage draft rows client-side, account mapping, parsing, and submission.
  - Acceptance criteria: User can upload 1+ XLSX files, assign each to an account, click “Parse”, review/edit rows, then submit to create transactions; nothing persists until submit.
  - Affected services/components (high level): Web imports page, imports feature state, shared API hooks/types.
  - Rollout/flagging: Feature-flagged (same as M2) with a “Use legacy importer” fallback.
  - Blockers (OQ-xx): OQ-07, OQ-08

- [ ] M4: Category suggestions improved by history (deterministic) + contract hardening
  - Goal: Improve category suggestions using prior transactions/import rules, and make suggestion outputs align to existing categories (IDs) to reduce mismatch.
  - Deliverables: Server-side “history examples” builder, improved prompt/selection policy, response includes `suggested_category_id` (and optional reason/confidence).
  - Acceptance criteria: Preview returns stable category ID suggestions for a meaningful subset of rows based on history/rules; graceful fallback when no suggestion exists.
  - Affected services/components (high level): API imports service; schemas; tests; Web UI to display/apply suggestions.
  - Rollout/flagging: Behind feature flag or progressive enable in preview response.
  - Blockers (OQ-xx): OQ-09

- [ ] M5: Bedrock-powered category suggestions + infra enablement
  - Goal: Use AWS Bedrock to suggest categories using the user’s prior history as context, while keeping the preview stateless and privacy-conscious.
  - Deliverables: Bedrock invocation wiring, tightened prompt/JSON parsing, IAM permissions, and VPC connectivity (NAT or VPC endpoints) for Bedrock in `eu-north-1`.
  - Acceptance criteria: When enabled, preview uses Bedrock to return category ID suggestions with confidence/reason; system works in deployed VPC environment; automatic fallback when Bedrock unavailable.
  - Affected services/components (high level): API imports service; serverless IAM policy; Terraform VPC networking (and/or endpoints).
  - Rollout/flagging: Feature flag `IMPORT_BEDROCK_ENABLED` default off.
  - Blockers (OQ-xx): OQ-10, OQ-11

# 1. Overview

This spec defines a “v2” import flow for bank statement XLSX files. The key change is removing DB-staged import sessions: the backend parses and suggests categories in a stateless preview request, returns draft transactions to the client for audit, and only persists to the database at final submit.

Supported statement formats (existing parsers in `apps/api/services/imports.py`):
- Swedbank
- SEB
- Circle K Mastercard

Account-level configuration determines which parser to apply for a file (instead of selecting bank type per file on the import screen).

# 2. Current behavior and architecture

## Frontend (current)
- Route: `apps/web/src/data/routes.ts` uses `/imports`.
- `apps/web/src/pages/imports/imports.tsx` implements a “stage, review, commit” flow:
  - User uploads XLSX, selects `bank_type` per file, optionally selects `account_id`.
  - Frontend sends JSON payload with base64 file contents to `POST /imports`.
  - UI then edits row overrides and calls `POST /imports/{batch_id}/commit`.

## Backend (current)
- Endpoints configured in `infra/serverless/serverless.yml`:
  - `GET /imports`, `POST /imports`, `GET /imports/{batch_id}`, `POST /imports/{batch_id}/files`, `POST /imports/{batch_id}/commit`
- `apps/api/services/imports.py`:
  - Parses XLSX per-bank and writes:
    - `transaction_import_batches`
    - `import_files`
    - `import_rows`
    - `import_errors`
  - Applies deterministic rule matches (`import_rules`) + subscription suggestion + optional Bedrock suggestion (best-effort, currently can silently no-op).
  - Commit converts staged rows to actual `transactions` and `transaction_legs`, and records `import_rules` from user overrides.

## Key mismatch with desired behavior
- Desired: “Return parsed transactions to user without storing anything in the DB; only persist when user submits.”
- Current: Persists batches/files/rows/errors as soon as the user stages files.

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
- Category suggestions should use previous history and Bedrock AI when enabled.
- Preview must not persist import batches/files/rows/errors, and must not persist transactions.

## Non-functional constraints
- API is serverless and currently VPC-attached to private subnets; external calls (e.g., Bedrock) may require explicit network enablement (see OQ-10/OQ-11).
- Keep PII out of logs as much as practical (file contents, descriptions).
- Keep changes mergeable behind flags; preserve legacy importer until v2 is validated.

# 4. Proposed features and behavior changes

## 4.1 Account-level bank type
- Add optional `bank_import_type` to accounts.
- UI exposes a “Statement format” selector with:
  - None (maps to `null`) (ASSUMPTION AQ-01)
  - Swedbank (`swedbank`)
  - SEB (`seb`)
  - Circle K Mastercard (`circle_k_mastercard`)

## 4.2 Stateless preview endpoint
- New endpoint (name/path TBD; see OQ-03) accepts:
  - Files: `{ filename, content_base64, account_id }[]`
  - Optional `note` for UI only (not persisted at preview time)
  - Optional knobs: `use_bedrock`, limits, etc. (feature-flagged)
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
- Imports v2:
  - `apps/api/handlers/imports.py` (either add v2 handlers here or add a new handler module) (ASSUMPTION AQ-04)
  - `apps/api/schemas/imports.py` (add v2 schemas)
  - `apps/api/services/imports.py` (reuse parsing + suggestion helpers; add stateless preview/commit entrypoints)
  - `infra/serverless/serverless.yml` (add new routes; add IAM permissions for Bedrock)
  - `infra/terraform/resources/*` (VPC connectivity for Bedrock)
- Tests:
  - `apps/api/tests/test_import_handlers.py`
  - `apps/api/tests/integration/test_imports_integration.py`

## Frontend/Web
- Accounts UI:
  - `apps/web/src/pages/accounts/children/account-modal.tsx`
  - `apps/web/src/types/schemas.ts` (account schema additions)
- Imports v2 UI/state:
  - `apps/web/src/pages/imports/imports.tsx`
  - `apps/web/src/features/imports/importsSaga.ts` and `apps/web/src/features/imports/importsSlice.ts` (refactor or replace to store client-side drafts)
  - `apps/web/src/hooks/use-api.ts` (imports API wrapper)
  - `apps/web/src/types/schemas.ts` (new v2 request/response schemas)

# 6. Data model and external contracts

## 6.1 Account: add bank import type
- DB: `accounts.bank_import_type` nullable string (or enum), representing `BankImportType` when set. (ASSUMPTION AQ-01)
- API:
  - `AccountRead`/`AccountWithBalance`: include `bank_import_type?: BankImportType | null`
  - `AccountCreate`/`AccountUpdate`: accept optional `bank_import_type`

## 6.2 Import preview contract (v2)

Proposed request shape (new schema, separate from legacy `ImportBatchCreate`):
- `files[]`:
  - `filename: string`
  - `content_base64: string`
  - `account_id: UUID` (required in v2; see OQ-04)
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

## 6.3 Import commit contract (v2)

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
- `skipped_count` + `errors[]` (if partial commit allowed; see OQ-06)

# 7. Step-by-step implementation plan

## M1: Account-level bank type configuration
- [ ] Add nullable `bank_import_type` to `apps/api/models/account.py`.
- [ ] Add field to Pydantic schemas in `apps/api/schemas/account.py` for read + write.
- [ ] Update account handlers/services/repositories to allow setting/updating the field.
- [ ] Add Alembic migration under `apps/api/migrations/versions/*`.
- [ ] Update web account Zod schemas in `apps/web/src/types/schemas.ts` to include `bank_import_type`.
- [ ] Update `apps/web/src/pages/accounts/children/account-modal.tsx` to include a “Statement format” select (None/Swedbank/SEB/Circle K Mastercard).
- [ ] Definition of done:
  - API returns the new field for accounts.
  - UI can set and persist the value via existing update flow.
  - Existing account flows unaffected (acceptance criteria for M1).

## M2: Stateless import preview + commit API (no DB staging)
- [ ] Decide final routes and names for v2 preview/commit (OQ-03).
- [ ] Add new Pydantic schemas in `apps/api/schemas/imports.py` for:
  - v2 preview request/response
  - v2 commit request/response
- [ ] Add new handlers (either in `apps/api/handlers/imports.py` or a new handler module) to implement:
  - `POST /imports/preview` (or similar)
  - `POST /imports/commit` (or similar)
- [ ] In `apps/api/services/imports.py`, implement stateless functions:
  - Parse each file using existing `_extract_bank_rows` but resolve `bank_type` from the assigned account.
  - Build draft rows and enrich with deterministic suggestions (rules/subscriptions/transfers), without writing `TransactionImportBatch`, `ImportFile`, `ImportRow`, `ImportErrorRecord`.
  - Commit: create a new `TransactionImportBatch` and persist transactions/legs from submitted rows.
- [ ] Update `infra/serverless/serverless.yml` to expose new endpoints (behind feature flag where possible).
- [ ] Add/adjust tests:
  - Unit tests in `apps/api/tests/test_import_handlers.py` for preview/commit v2.
  - Integration tests in `apps/api/tests/integration/test_imports_integration.py` for end-to-end preview → commit.
- [ ] Definition of done:
  - Preview produces rows + errors and does not create import_* records in DB.
  - Commit persists transactions and associates them with a newly created import batch.

## M3: New /imports UI flow (upload → map accounts → parse → audit → submit)
- [ ] Add new web API schemas/types for v2 preview/commit in `apps/web/src/types/schemas.ts`.
- [ ] Update `apps/web/src/hooks/use-api.ts` to add v2 calls (preview + commit).
- [ ] Refactor `apps/web/src/features/imports/*` to store:
  - Selected files + account mapping
  - Preview response (draft rows + per-file errors)
  - Local edits (description/date/amount/category/etc.) before submit
- [ ] Rework `apps/web/src/pages/imports/imports.tsx` UX:
  - Step 1: Upload files (XLSX only).
  - Step 2: For each file, choose an account (required) and display derived bank type badge.
  - Step 3: “Parse files” button calls preview endpoint.
  - Step 4: Audit table: inline edits + apply suggestion controls; show errors clearly; support deleting rows.
  - Step 5: “Submit” calls commit endpoint, then navigates/refreshes transactions.
- [ ] Add feature flag gate + “Use legacy importer” path (or query param) to reduce rollout risk (ASSUMPTION AQ-05).
- [ ] Definition of done:
  - Full v2 flow works against local API, and no import session is created prior to submit.

## M4: Category suggestions improved by history (deterministic) + contract hardening
- [ ] Extend backend preview enrichment:
  - Build “history examples” from recent transactions that already have category/subscription assigned.
  - Prefer deterministic import rules first, then history-based suggestions.
  - Return `suggested_category_id` (not just category name) by mapping to existing categories.
- [ ] Tighten suggestion schema contracts and UI behavior:
  - If suggestion category cannot be mapped, return `null` with a reason.
  - Ensure the UI can “apply all suggestions” safely.
- [ ] Add targeted tests covering history suggestion mapping and rule precedence.
- [ ] Definition of done:
  - Preview suggestions are stable and consistent with existing category IDs.

## M5: Bedrock-powered category suggestions + infra enablement
- [ ] Infra/network:
  - Confirm whether Lambda has outbound access in the target environment (it is attached to private subnets via `infra/serverless/serverless.yml` and the Terraform VPC currently omits IGW/NAT unless public DB is enabled). (See OQ-10/OQ-11)
  - Add either:
    - A NAT gateway + route tables, or
    - Interface VPC endpoints for Bedrock runtime (preferred if supported in `eu-north-1`), plus SG rules.
  - Add IAM permission for `bedrock:InvokeModel` (and any required actions) to the Serverless role.
- [ ] Backend:
  - Update Bedrock prompt to require strictly valid JSON output.
  - Include:
    - allowed categories list (IDs + names),
    - compact history examples,
    - current transactions.
  - Implement robust parsing, timeouts, and fallback to deterministic suggestions.
  - Gate with `IMPORT_BEDROCK_ENABLED` and optionally per-request `use_bedrock`.
- [ ] Tests:
  - Add unit tests with a fake Bedrock client (pattern exists in investment tests) validating JSON parsing and fallbacks.
- [ ] Definition of done:
  - In an environment with Bedrock connectivity, preview returns Bedrock suggestions.
  - In environments without Bedrock, preview still works and degrades gracefully.

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
  - New handler tests for preview/commit v2.
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
  - Tests for deterministic history suggestion mapping to category IDs and rule precedence.

## M5
- Backend:
  - Fake Bedrock tests for prompt formatting and JSON parsing.
- Infra:
  - Deploy smoke test in `eu-north-1` verifying Bedrock calls succeed from Lambda (out-of-band from unit tests).

# 9. Risks and open questions

## Technical risks
- VPC connectivity: current Terraform VPC omits IGW/NAT by default; Bedrock may be unreachable from Lambda (mitigate via VPC endpoints or NAT) (OQ-10/OQ-11).
- IAM: current Serverless IAM statements do not include Bedrock invoke permissions (mitigate by adding explicit actions).
- Payload size: base64 XLSX uploads could exceed API Gateway limits for large statements (mitigate with file size limits + future S3 presigned upload path).
- Duplicate imports: without stable external IDs in bank exports, repeated imports may create duplicate transactions (mitigate with optional dedupe checks and/or hashing) (OQ-09).
- Privacy: prompts may include transaction descriptions; minimize prompt size and avoid logging raw payloads.

## OPEN QUESTION OQ-xx
- OQ-01: Should account “none” be represented as `null` or a distinct enum value like `"none"` across API/DB/UI?
- OQ-02: Should bank type be settable on account create, or only editable after creation?
- OQ-03: What exact v2 endpoints/paths should we use (e.g., `POST /imports/preview` + `POST /imports/commit` vs `/imports/v2/*`)?
- OQ-04: In v2, is `account_id` required for every uploaded file before parsing, or can the backend infer account some other way?
- OQ-05: Should v2 completely replace legacy endpoints, or run side-by-side behind a flag for a period?
- OQ-06: Should commit be “all-or-nothing” (transactional) or allow partial success with per-row errors?
- OQ-07: UX: Do you want a strict stepper UI (wizard) or keep it as a single page with sections?
- OQ-08: Should users be able to override the derived bank type per file during import (e.g., if account bank type is wrong), or force them to fix the account setting first?
- OQ-09: What is the desired dedupe behavior on commit (warn/skip/allow duplicates), and what matching heuristic is acceptable?
- OQ-10: Confirm target deployment mode: are Lambdas always in private subnets without NAT, or is outbound internet allowed in production?
- OQ-11: If outbound is not allowed, do we prefer adding NAT (cost) or using VPC interface endpoints for `bedrock-runtime` (if available in `eu-north-1`)?

## ASSUMPTION AQ-xx
- AQ-01: “None” bank type is represented as `null` (not a new enum member) in API/DB, and UI shows a “None” option.
- AQ-02: We keep creating `TransactionImportBatch` at commit time for audit grouping, even though preview is stateless.
- AQ-03: The v2 audit UI continues to support optional `tax_event_type` and `subscription_id` fields (as current importer does), unless scoped out later.
- AQ-04: v2 handlers can live alongside legacy handlers in `apps/api/handlers/imports.py` (no need for a new module).
- AQ-05: A feature flag (env or build-time) is acceptable to gate v2 UI/API until stable.
