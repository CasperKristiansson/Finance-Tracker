# Ventures M8 Handoff Prompt

You are working in `/Users/casperkristiansson/programming/Finance-Tracker`.
Start by reading and following:

- `/Users/casperkristiansson/programming/Finance-Tracker/AGENTS.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-implementation-plan.html`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-m7-handoff-prompt.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/brand.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/info.md`

## Goal

Implement M8: Deployment and authenticated data QA for Ventures.

M1-M7 should already provide the feature implementation. This milestone is not a redesign pass. It should make sure the deployed/backend-authenticated version is actually usable with real data, private S3 files, and safe cleanup of any test artifacts.

## Product Constraints

- Venture paper values stay inside Ventures only. Do not sync them into dashboard net worth, investments, reports, accounts, or transaction flows.
- Keep paper value, risk-adjusted value, realized value, and liquidity distinct.
- Do not add a Lessons model or tab. Notes with flexible tags are enough.
- Documents are private S3-backed evidence. Upload/download/delete metadata is in scope; inline preview is still out of scope.
- Do not log private company details, document contents, file URLs, presigned URLs, account identifiers, or personal financial data.

## Scope

### 1. Environment And Deployment Readiness

- Verify required AWS/Serverless/Terraform configuration for Ventures exists in the target environment:
  - Ventures API routes and Lambda handlers.
  - Ventures database tables/migrations.
  - Private encrypted S3 bucket for Ventures files.
  - SSM parameters for Ventures file bucket, prefix, and URL expiry.
- Use AWS profile `Personal` and region `eu-north-1` unless instructed otherwise.
- Do not run destructive infrastructure commands.
- If deployment is requested or needed, use the repo's existing deploy workflow and report exactly what was deployed.

### 2. Authenticated Desktop QA

Use authenticated app access, not demo mode, to verify:

- `/ventures` loads real overview data.
- Add company can create a safe test company with a logo or initials fallback.
- Selected company bottom panel opens from the graph.
- `/ventures/:companyId` renders Overview, Timeline, Valuation, Notes, and Documents tabs.
- Add valuation creates timeline activity and keeps paper/risk-adjusted/realized/liquidity labels distinct.
- Edit ownership supports person ownership and holding-company ownership where applicable.
- Add/edit Markdown note works and renders Markdown.
- Document upload uses presigned S3 upload, document metadata is created, download uses presigned S3 download, and document metadata deletion works.
- No document preview is shown.

### 3. Isolation Checks

After creating safe test Venture data, confirm it does not alter:

- Dashboard net worth.
- Investments pages.
- Reports.
- Accounts balances.
- Transactions.

If account-linked valuation is tested, confirm it only affects Ventures valuation display and does not mutate source account balances.

### 4. Cleanup And Real-Data Checklist

- Delete only test document metadata and test companies created during this milestone.
- Do not delete user data.
- Produce a short checklist for adding the user's actual companies:
  - Company identity and status.
  - Ownership history.
  - Annual valuations and haircuts.
  - Documents to upload.
  - Notes/tags to capture.
  - Holding-company relationships.

## Validation

Run:

- `npm run format -w apps/web`
- `npm run lint -w apps/web`
- `npm run build -w apps/web`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make format`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make type-check`

If backend code changes, also run targeted backend tests with `PYTHONPATH=.` and `--no-cov` unless you intend to run the full coverage suite.

Use the in-app browser for desktop QA. Report exactly what was verified, what environment was used, which test artifacts were created/deleted, and any remaining blockers.
