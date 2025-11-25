# Tasks & Repo Digest

> Mark items complete by replacing `[ ]` with `[x]` after finishing the work.

## Current State

- Backend (apps/api): SQLModel domain models for accounts, loans, categories, transactions, legs, loan events, import batches. REST-style Lambda handlers for accounts, categories, transactions, loans (events/schedules), and reporting (monthly/yearly/total). Loan interest accrual job exists; materialized view helpers for monthly totals, yearly category totals, and net worth. Extensive pytest coverage for handlers/repos/jobs.
- Frontend (apps/web): Vite + React 19 + TS + Tailwind v4 + Redux Toolkit + Redux Saga. Auth wired to AWS Cognito via Amplify (env vars required). Routing + protected redirect logic in place. UI kit (shadcn-derived) includes sidebar, tables, charts, tabs, dropdowns, toasts. Pages: Dashboard (hero only), Accounts (static mock data for cash/investments/cc + net-worth chart + summary), Login, Cover, 404. Navigation menu lists additional routes (Transactions, Reports, Cash Flow, Loans, Investments, Goals, Settings) but only Dashboard/Accounts are implemented.
- Infra/Tooling: Terraform under infra/ for Aurora + bastion; Make targets for bastion lifecycle. Python tooling configured (black/isort/pylint/mypy/pyright). Tailwind/ESLint/Prettier configured for web app.

## Milestones & Checklists

### Milestone 1 – Foundation & Auth

- [ ] API client layer with base URL, Cognito bearer injection, error/loading normalization, typed hooks for accounts/categories/transactions/reports/imports/loans.
- [ ] Auth UX: wire login form to saga (validation, errors, disable while loading), add demo mode toggle, ensure logout visible in header/sidebar collapsed states.
- [ ] Route guards: keep redirect logic, add friendly unauthenticated states/loader skeletons.

### Milestone 2 – Dashboard

- [ ] KPI cards: net worth, cash flow (period toggle), budget vs actual, upcoming bills placeholder.
- [ ] Charts: income vs expense, category breakdown (donut), savings rate.
- [ ] Activity: recent transactions list with inline category/status tags.
- [ ] Quick actions: buttons for “Add transaction” and “Import file”.
- [ ] Empty states: import CTA when no data.

### Milestone 3 – Accounts

- [ ] Replace mock data with live accounts + balances; sorting/filtering; archive toggle.
- [ ] Add “Add/Edit account” modal (normal/debt/investment) including loan metadata for debt.
- [ ] Show balance as-of selector if backend supports timestamp filter.
- [ ] Debt accounts: surface loan schedule/metrics (uses loan endpoints).

### Milestone 4 – Transactions & Imports

- [ ] Transactions table with pagination/virtualization, filters (date/account/category/amount/status), search, bulk select, running balance per account.
- [ ] Manual transaction modal with leg builder, inline category edit, status badges (imported/reviewed/flagged).
- [ ] Imports flow: account picker, bank template picker, file dropzone (CSV/XLSX), mapping preview, inline error surfacing, import summary.
- [ ] Bank template management per account (select predefined parser config, allow overrides).

### Milestone 5 – Categories & Budgets

- [ ] Category management page (list, create, edit, archive, color/icon).
- [ ] Budget inputs per category (monthly/quarterly/yearly), progress bars and rollup.
- [ ] Empty states/wizard for first budget setup.

### Milestone 6 – Reports & Analytics

- [ ] Reports page with month/quarter/year toggles, compare vs prior period, drill-down by category/account.
- [ ] Charts: stacked/line/donut options, export CSV/XLSX.
- [ ] Net worth history view (line/area) if endpoint available.

### Milestone 7 – Loans/Investments/Cash Flow/Goals/Settings

- [ ] Scaffold pages to match sidebar (empty states + navigation) to avoid 404s.
- [ ] Loans: events list + schedule display; Investments: performance placeholders; Cash Flow: inflow/outflow view; Goals: tracker cards; Settings: theme/profile/bank template management.

### Milestone 8 – UI/UX Polish

- [ ] Responsive sidebar states, focus outlines, keyboard shortcuts for review flows.
- [ ] Skeleton/empty/error states standardized across pages; toasts on success/failure.
- [ ] Theme tokens (colors/spacing/typography) and chart palette consolidation.

### Milestone 9 – Tooling & DX

- [ ] Document env vars for web (Cognito pool/client, API URL) and backend (DB settings, DATABASE_URL for SQLite dev).
- [ ] Add API client mocks/fixtures and saga/hook integration tests.
- [ ] Align lint/format scripts across workspace; CI steps for web build/test and api tests.

### Backend Enablers (parallel)

- [ ] Transactions: add update/delete endpoints; expose status flags (imported/reviewed/flagged); leg validation errors suitable for UI.
- [ ] Imports: upload endpoint with bank template selection, mapping preview, job status + per-row errors; persist import batch summary.
- [ ] Categories/Budgets: extend models/endpoints for budgets or at least category pagination + color/icon metadata.
- [ ] Reporting: ensure filters for account/category; add quarter/custom range; net worth history endpoint for charts.
- [ ] Auth: confirm Cognito config + API auth scheme; provide local dev env templates.
