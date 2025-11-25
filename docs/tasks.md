# Tasks & Repo Digest

> Mark items complete by replacing `[ ]` with `[x]` after finishing the work.

## Current State

- Backend (apps/api): SQLModel domain models for accounts, loans, categories, transactions, legs, loan events, import batches. REST-style Lambda handlers for accounts, categories, transactions, loans (events/schedules), and reporting (monthly/yearly/total). Loan interest accrual job exists; materialized view helpers for monthly totals, yearly category totals, and net worth. Extensive pytest coverage for handlers/repos/jobs.
- Frontend (apps/web): Vite + React 19 + TS + Tailwind v4 + Redux Toolkit + Redux Saga. Auth wired to AWS Cognito via Amplify (env vars required). Routing + protected redirect logic in place. UI kit (shadcn-derived) includes sidebar, tables, charts, tabs, dropdowns, toasts. Pages: Dashboard (hero only), Accounts (static mock data for cash/investments/cc + net-worth chart + summary), Login, Cover, 404. Navigation menu lists additional routes (Transactions, Reports, Cash Flow, Loans, Investments, Goals, Settings) but only Dashboard/Accounts are implemented.
- Infra/Tooling: Terraform under infra/ for Aurora + bastion; Make targets for bastion lifecycle. Python tooling configured (black/isort/pylint/mypy/pyright). Tailwind/ESLint/Prettier configured for web app.

## Milestones & Checklists

### Milestone 1 – Foundation & Auth

- [ ] API client + saga plumbing: base API URL, Cognito bearer injection, shared fetch helper (retry + 401 handling), global loading/error toasts, typed hooks for accounts/categories/transactions/reports/imports/loans.
- [ ] Auth UX + flows: connect login form to saga (validation, inline errors, disabled during submit), demo mode toggle (mock user), logout entry visible in header + collapsed sidebar, remember-me flag.
- [ ] Loading/skeletons: page-level spinner while auth initializes; skeleton shells for nav/content; unauthenticated state messaging.
- [ ] Backend alignment: confirm Cognito config + API auth scheme; provide local dev env templates for Amplify + API base.

### Milestone 2 – Dashboard (reporting baseline)

- [ ] Backend: ensure reporting endpoints accept account/category filters; add net worth history endpoint (area) if missing.
- [ ] Redux slices/sagas: reporting fetch (monthly/yearly/total), net worth history, recent transactions (limit N), cache by period key; selectors for KPIs.
- [ ] KPI cards: net worth, cash flow (toggle month/quarter/year), budget vs actual placeholder (wired once budgets exist), upcoming bills placeholder.
- [ ] Charts: stacked area for income vs expense; donut for category breakdown; bar for savings rate (%).
- [ ] Layout: 2-column grid with KPIs top, charts middle, recent transactions list bottom with status tags and inline loading placeholders.
- [ ] Quick actions: primary buttons for “Add transaction” and “Import file” opening stubs; empty state CTA to import when no data.

### Milestone 3 – Accounts & Loans

- [ ] Backend: confirm account list supports `as_of` filter; extend account update with bank template metadata if needed.
- [ ] Redux slice/saga: accounts list with balances, create/update/archive, loan read/attach/update flows.
- [ ] UI: replace mocks with live data; sortable/filterable list; status pill (active/inactive); archive toggle; balance as-of control if supported.
- [ ] Modals: Add/Edit account (type picker normal/debt/investment), loan metadata for debt (principal, rate, min payment, maturity), validation + error display.
- [ ] Debt views: loan schedule table and metrics; events list preview; loading skeletons + “add first account” empty state.

### Milestone 4 – Transactions & Imports

- [ ] Backend: add transaction update/delete + status flags (imported/reviewed/flagged); ensure validation errors are UI-friendly. Implement import upload endpoint (CSV/XLSX) with bank template selection, mapping preview, job status + per-row errors; support multi-file upload in one session (e.g., multiple accounts). Persist import batch summary.
- [ ] Backend AI assist: integrate AWS Bedrock model (category suggestion) for imported rows; accept optional user-provided example transactions to improve suggestions; return suggested category + confidence. Add backend-side transfer matcher to detect intra-account transfers by amount/date proximity and flag paired rows.
- [ ] Redux slices/sagas: transactions list with filters/pagination, transaction mutations, status updates; import job creation/status polling; selectors for running balance.
- [ ] UI table: virtualized rows; columns (date, payee/description, account, category, amount, status, notes); sortable headers; column visibility; bulk select + actions (categorize/delete/mark reviewed); running balance per account.
- [ ] Filters/search: date range, account multi-select, category, amount range, status, text search; sticky filter bar; inline loading state on filter change.
- [ ] Manual transaction modal: leg builder with balanced validation, inline category edit, notes, occurred/posted dates; status badge and error display.
- [ ] Imports flow UI: stepper (multi-file dropzone supporting multiple accounts, bank template picker per file, mapping preview table with error highlights + AI-suggested categories + transfer match flags, confirm), summary screen with imported/skipped/errors and download errors link; inline edit of suggested categories/transfer links before submit; bank template management per account (select parser, override mapping).
- [ ] Loading/empty: table skeletons; “add/import transactions” empty card; progress indicators during import.

### Milestone 5 – Categories & Budgets

- [ ] Backend: ensure category CRUD supports color/icon metadata; add budget models/endpoints (category budgets with period + amount).
- [ ] Redux slices/sagas: categories CRUD; budgets fetch/create/update; selectors for rollups and progress.
- [ ] UI: category management table with color/emoji/icon picker, archive toggle, inline edit; filter by type (income/expense/etc).
- [ ] Budgets: inputs per category (period selector monthly/quarterly/yearly), progress bars with spent vs budget; rollup cards for total budget vs actual.
- [ ] Empty/wizard: guided first-time budget setup using top categories by spend; skeleton rows/cards.

### Milestone 6 – Reports & Analytics (fully featured)

- [ ] Backend: extend reporting to support quarter + custom date range; add net worth history endpoint if absent; ensure filters for account/category; CSV/XLSX export endpoints for reports.
- [ ] Redux slices/sagas: reporting fetch keyed by granularity (month/quarter/year/custom), cache + revalidate; export actions; drill-down fetch for category/account detail.
- [ ] Layout: top row controls (period selector, compare toggle vs prior period, account/category chips, export buttons); bottom grid of charts/tables.
- [ ] Charts: stacked area (income vs expense), grouped bar (cash flow by period), donut/treemap for category share, line/area for net worth history, bar for savings rate, and Sankey flow (income sources → categories/accounts). Sankey should group tiny nodes under “Other” below a threshold and support hover details.
- [ ] Drill-down: click category slice to open detail panel/table; click bar point to show period breakdown; CSV export of detail.
- [ ] Loading/empty: chart skeletons matching shapes; empty copy prompting to import/add data; inline spinner on compare toggle.

### Milestone 7 – Settings, Goals, Cash Flow

- [ ] Settings: theme toggle, profile info, bank template management UI, API base URL/env info display; saga to persist settings if backend allows.
- [ ] Goals: tracker cards (target, amount, due date) with placeholders; connect once backend model exists.
- [ ] Cash Flow: focused inflow/outflow chart (stacked bars) with month/quarter toggle using reporting data; quick filters by account.
- [ ] Loading/empty: consistent skeletons + guided copy; avoid dead-end pages.

### Milestone 8 – Investments (Nordnet text uploads; sample data in `docs/data/nordnet/`)

- [ ] Backend: endpoint to accept raw text + parsed payload from Nordnet monthly exports (see samples in `docs/data/nordnet/transactioner.md`, `docs/data/nordnet/portfolio-rapport.md`, `docs/data/nordnet/portfolio-repport-2.md`); persist dated snapshots; optional Bedrock assist to clean/classify rows.
- [ ] Parsing: lightweight pre-parser (section split, date/number extraction, currency handling) before AI; handle Swedish formatting; allow manual edits.
- [ ] UI flow: paste/upload multiple files in one session; show parsed holdings/value over time; chart portfolio value trend; holdings delta table. Inline edits and approvals before saving.
- [ ] Bedrock usage: model selection for classification/cleanup; limit tokens; surface confidence; allow user override. Consider fallback to rules when AI unavailable.
- [ ] Loading/empty: skeletons and guided “paste your report” empty state.

### Milestone 8 – Tooling & DX

- [ ] Document env vars for web (Cognito pool/client, API URL) and backend (DB settings, DATABASE_URL for SQLite dev); add sample `.env` files.
- [ ] Add API client mocks/fixtures and saga/hook integration tests.
- [ ] Align lint/format scripts across workspace; CI steps for web build/test and api tests.
