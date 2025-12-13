# 1. Overview

This change introduces first-class support for income tax transactions (payments to and refunds from Skatteverket) in Finance Tracker, replacing the legacy assumption that “tax is just an expense category”. The goal is to treat tax as its own subsystem (similar in spirit to loans) so tax transactions are recorded as ledger transactions but are not counted as operating expenses, while still being visualized clearly. The work spans `apps/api` (new tax models + import integration + reporting changes + endpoints), `apps/web` (imports UI support + tax reporting UI + a Taxes view), plus updates to the legacy import script.

# 2. Current behavior and architecture

- **Repo: Backend (`apps/api`)**
  - `apps/api/models/transaction.py: Transaction, TransactionLeg`
    - `Transaction` stores `category_id`, `transaction_type`, timestamps, and status; legs provide double-entry balancing and per-account impact.
    - There is no dedicated “tax” concept; tax is represented only indirectly through `Category` selection.
  - `apps/api/models/category.py: Category`
    - Categories have `name`, `category_type` (`income`, `expense`, plus special types), and archive metadata.
    - There is no tax subsystem; “Tax” can only be represented by selecting a category named “Tax”, which makes it indistinguishable from operating expenses in reporting.
  - `apps/api/repositories/category.py: CategoryRepository.list`
    - By default the API treats only `CategoryType.INCOME` and `CategoryType.EXPENSE` as “normal” categories; other types are “special” and excluded unless `include_special=true`.
  - `apps/api/services/transaction.py: TransactionService._infer_transaction_type`
    - Infers `TransactionType` primarily from `CategoryType`, otherwise falls back to leg sign heuristics.
    - There is no “tax transaction type”; tax is indistinguishable from other expenses at the transaction-type level.
  - `apps/api/repositories/reporting.py: ReportingRepository.fetch_transaction_amounts`
    - Builds aggregated `TransactionAmountRow` records by joining `transactions`, `transaction_legs`, and `categories`, and summing leg amounts per transaction.
    - The `TransactionAmountRow` includes category name/icon/color, but not any tax metadata because categories do not have it.
  - `apps/api/services/reporting.py: ReportingService`
    - `monthly_report`, `yearly_report`, `total_report` compute `income`, `expense`, `net` by classifying rows via `TransactionType` (`TRANSFER` excluded; `INCOME` and `EXPENSE` counted).
    - As a result, any tax payment recorded as an `EXPENSE` contributes to expenses, distorting monthly/annual comparisons when tax is infrequent (e.g., yearly settlement).
  - `apps/api/handlers/reporting.py`
    - Exposes `/reports/*` endpoints (e.g., `/reports/monthly`, `/reports/yearly-overview`, `/reports/total-overview`) that return income/expense/net totals and category breakdowns.
    - No reporting endpoint currently exposes a “tax” breakdown.
  - Legacy migration tooling
    - `scripts/import_legacy_transactions.py: ensure_categories`
      - Imports legacy categories and infers `CategoryType` from legacy “Income/Expense” types.
      - Under this importer, “tax” becomes just another `CategoryType.EXPENSE` category, with no special behavior.

- **Repo: Frontend (`apps/web`)**
  - `apps/web/src/pages/categories/categories.tsx`
    - UI supports creating/editing categories, but the “selectable types” are effectively limited to `income` and `expense`.
    - There is no UI to mark a transaction as income tax (payment/refund) during import review or manual entry.
  - `apps/web/src/pages/reports/reports.tsx`
    - Displays yearly and total reporting views using `/reports/yearly-overview` and `/reports/total-overview`.
    - “Expense” numbers include everything classified as `TransactionType.EXPENSE`, which includes tax payments today.
  - `apps/web/src/pages/cash-flow/cash-flow.tsx`
    - Uses the monthly/quarterly report series to show inflow/outflow; tax is included as outflow with no separation.
  - `apps/web/src/pages/transactions/*`
    - Transactions show type badges (`Income`, `Expense`, etc.) but have no “Tax” badge or linking to any tax concept.
  - `apps/web/src/components/app-sidebar.tsx` and `apps/web/src/data/routes.ts`
    - No “Taxes” route exists today.

End-to-end flow today (reporting example):
- `GET /reports/monthly` → `apps/api/handlers/reporting.py: monthly_report` → `apps/api/services/reporting.py: ReportingService.monthly_report` → `apps/api/repositories/reporting.py: ReportingRepository.fetch_transaction_amounts` → sums legs and classifies by `TransactionType` → returns `income/expense/net` only.

# 3. Requirements and constraints

## Functional requirements

1. The system must support classifying certain transactions as “tax” in a way that is durable, queryable, and user-manageable (not only via naming conventions).
2. The UI must let users identify tax separately from operating expenses in reports (monthly/quarterly/yearly/total) without losing the ability to view “all expenses”.
3. The UI must work for tax patterns that are monthly, quarterly, or yearly (e.g., monthly prelim tax vs annual settlement), primarily by separating tax from operating expense series and providing clear tax-specific summaries.
4. Import review must support explicitly marking rows as tax payments or tax refunds, without requiring a “Tax” category.
5. Tax transactions must still affect ledger balances and net worth (they are real cashflow); the separation is only about reporting semantics.

## Non-functional requirements

- **Performance:** Reporting endpoints should not introduce materially slower query plans. Tax separation should reuse existing reporting aggregation flows and avoid N+1 category lookups.
- **UX:** Tax must be understandable at a glance: “Operating expense” vs “Tax” vs “All expense”, with strong empty/loading states and explanatory helper text (per `docs/brand.md`).
- **Security:** Tax metadata is user-owned; new tables/fields must respect user scoping via `UserOwnedMixin` and session criteria filtering.

## Constraints

- **No backward compatibility requirement:** API response shapes and enums may change as needed, as long as `apps/web` is updated in lockstep.
- **No data migration requirement:** we can treat this as v1 (no existing users/data). Deleting and re-importing is acceptable.
- **Tax scope:** tax means *income tax payments/refunds* (Skatteverket). We do not track per-transaction VAT or sales tax on ordinary purchases.
- Serverless deployment model: each new endpoint requires a function entry in `infra/serverless/serverless.yml` and a handler under `apps/api/handlers/*`.

# 4. Proposed features and behavior changes

## Feature A: Tax subsystem (tax events linked to ledger transactions)

- **Current behavior:** Tax is represented as a normal `expense` category (e.g., a category named “Tax”), so it is counted as operating expense and mixed into category reporting.
- **New behavior:**
  - Tax is modeled explicitly as a `TaxEvent` that references a normal ledger `Transaction`.
  - Marking something as tax is **per transaction**, not per category.
  - Import review gains a per-row control to mark a row as either a tax `payment` or a tax `refund` (the `TaxEvent.event_type`).
  - Manual transaction creation gains an option to mark the transaction as tax (payment/refund) without setting a category.

  ASSUMPTION: In v1, tax is always external cashflow and is represented as a balanced transaction between a user account and the existing hidden “Offset” account.

## Feature B: Tax breakdown in reporting (separate from operating expenses)

- **Current behavior:** All `TransactionType.EXPENSE` rows contribute to “expense” totals and charts.
- **New behavior:**
  - Reporting excludes tax-marked transactions from operating expense totals and category breakdowns.
  - Reporting adds a dedicated tax breakdown alongside operating metrics:
    - `tax_paid` (sum of tax payments)
    - `tax_refund` (sum of tax refunds)
    - `tax_net` (paid - refund)
  - Reporting returns both operating and after-tax nets to avoid ambiguity:
    - `operating_income`, `operating_expense`, `operating_net`
    - `after_tax_net` (operating_net - tax_net)
  - Yearly/total overview responses expose tax KPIs (YTD and trailing windows) and “largest tax month”.
  - UI adds toggles on reports/cash-flow views:
    - “All outflow” (operating + tax)
    - “Operating (ex tax)”
    - “Tax only”

  ASSUMPTION: “Tax” is defined by the presence of a linked `TaxEvent` (not by category name).

## Feature C: Taxes UI surface (visibility + workflow)

- **Current behavior:** Tax is not a first-class UI concept; users must infer it via category names.
- **New behavior:**
  - Add a new route/page “Taxes” that presents:
    - KPI cards: tax paid YTD, tax refunded YTD, tax net YTD, tax net last 12 months, and largest tax month.
    - A chart: tax paid vs refund by month (year selector).
    - A table of tax events (or tax transactions) with drilldown to the underlying ledger transaction.
  - Reports page receives a small enhancement: show “Operating vs Tax” split in the headline stats and in relevant charts.

## Feature D (Optional v1.5): Tax obligations (scheduling)

- **Current behavior:** No concept of scheduled obligations; only recorded transactions exist.
- **New behavior (optional, if included in scope):**
  - Introduce “Tax obligations” that represent due amounts and due dates for monthly/quarterly/yearly income tax events.
  - Taxes page includes an “Upcoming” section (next 30/90 days) and supports marking an obligation as paid by linking a transaction.

OPEN QUESTION: Do we need a tax calendar/obligation system for v1, or is recording payments/refunds only sufficient?

# 5. Affected components

| Service/Repo | File/Module | Type of change | Reason it is affected |
|---|---|---|---|
| `apps/api` | `apps/api/shared/enums.py` | modify | Add `TaxEventType` (`payment`/`refund`) to keep tax event typing consistent with existing domain enums. |
| `apps/api` | `apps/api/models/tax.py` | new file | Introduce `TaxEvent` model linked to a ledger `Transaction`. |
| `apps/api` | `apps/api/models/__init__.py` | modify | Export the `TaxEvent` model so it is included in metadata/tests and available through the package. |
| `apps/api` | `apps/api/schemas/tax.py` | new file | Define request/response payloads for tax endpoints and reporting. |
| `apps/api` | `apps/api/services/tax.py` | new file | Centralize rules for creating and listing tax events and linking them to transactions. |
| `apps/api` | `apps/api/handlers/tax.py` | new file | Expose tax endpoints (e.g., list/create tax events and tax summaries). |
| `apps/api` | `apps/api/repositories/reporting.py` | modify | Join tax events into `TransactionAmountRow` (or a parallel query) so reports can exclude tax from operating expense and emit tax series. |
| `apps/api` | `apps/api/services/reporting.py` | modify | Split operating expense vs tax using tax event linkage; handle refunds as tax refunds (not operating income). |
| `apps/api` | `apps/api/schemas/reporting.py` | modify | Add/adjust report payload fields to include tax breakdown and operating vs total metrics. |
| `apps/api` | `apps/api/handlers/reporting.py` | modify | Return the new tax breakdown fields in report endpoints. |
| `apps/api` | `apps/api/schemas/imports.py` | modify | Extend `ImportCommitRow` to carry a tax marker (`tax_event_type`). |
| `apps/api` | `apps/api/services/imports.py` | modify | On commit, route tax-marked rows through the tax subsystem instead of normal expense categorization. |
| `apps/api` | `apps/api/migrations/versions/*_tax_*.py` | new file | Create `tax_events` table (and any supporting enum/type changes). |
| `infra` | `infra/serverless/serverless.yml` | modify | Add Lambda functions/routes for `/tax/*` endpoints if introduced. |
| `apps/web` | `apps/web/src/types/schemas.ts` | modify | Extend import commit schema + reports schemas to include `tax_event_type` and tax breakdown fields. |
| `apps/web` | `apps/web/src/pages/imports/imports.tsx` | modify | Add per-row “Tax: none/payment/refund” control and send `tax_event_type` in the commit payload (note: this file also defines its own Zod commit schema). |
| `apps/web` | `apps/web/src/pages/transactions/transaction-modal.tsx` | modify | Allow marking a manually created transaction as tax (payment/refund). |
| `apps/web` | `apps/web/src/pages/reports/reports.tsx` | modify | Show operating vs tax split and toggles; add tax KPIs and charts. |
| `apps/web` | `apps/web/src/pages/cash-flow/cash-flow.tsx` | modify | Support toggling outflow series: operating-only vs tax-only vs combined. |
| `apps/web` | `apps/web/src/pages/taxes/taxes.tsx` | new file | New Taxes page focused on tax payments/refunds and drilldowns. |
| `apps/web` | `apps/web/src/data/routes.ts` | modify | Add a `taxes` route entry. |
| `apps/web` | `apps/web/src/components/app-sidebar.tsx` | modify | Add “Taxes” navigation item. |
| `apps/web` | `apps/web/src/App.tsx` | modify | Route to the Taxes page. |
| `scripts` | `scripts/import_legacy_transactions.py` | modify | Treat legacy “Tax” category rows as tax events (not normal expense/category transactions). |
| `apps/api/tests` | `apps/api/tests/test_reporting_handlers.py` | modify/add | Validate: tax payment excluded from operating expense; refund shown as tax refund; tax KPIs correct. |
| `apps/api/tests/integration` | `apps/api/tests/integration/test_reports_integration.py` | modify/add | End-to-end: import commit with `tax_event_type`, reports show tax series, and operating totals exclude tax. |

# 6. Data model and external contracts

## Data models / DB tables / schemas

### Tax events (`tax_events`)

- **New structure (v1):**
  - `id`, `user_id`, timestamps
  - `transaction_id` (FK → `transactions.id`, unique per transaction)
  - `event_type` (`TaxEventType`: `payment` | `refund`)
  - `authority` (optional string, default “Skatteverket”)
  - `note` (optional)
- **Invariants:**
  - A given `transactions.id` may have at most one `tax_events` row.
  - The referenced ledger transaction must be balanced (already enforced by transaction creation).
  - Tax payments/refunds are external cashflow and should use the existing hidden “Offset” account as counterparty. (Enforced by tax service when creating tax events.)
- **Migration required:** Yes (Alembic) to create the new table.

### Categories (`categories`)

- **No changes in v1:** tax is not modeled as a category and does not add category metadata.

### Reporting row projection (`TransactionAmountRow`)

- **Current structure:** includes `category_name/icon/color_hex` and aggregates transaction amount.
- **Planned changes:** extend the projection to include tax metadata by joining `tax_events` (e.g., `has_tax_event`, `tax_event_type`) so reporting services can (a) exclude tax from operating expense and (b) produce tax series without additional lookups.

### (Optional) Tax obligations

If Feature D is in-scope:
- New table `tax_obligations` (user-scoped) with:
  - `id`, `user_id`, timestamps
  - `name`
  - `period_start`, `period_end` (optional; for fiscal year/period tracking)
  - `due_date`
  - `amount_due` (Decimal)
  - `status` (`planned`, `due`, `paid`, `overdue`) or similar
- New nullable column on `tax_events`: `tax_obligation_id` to link a tax payment/refund event to an obligation (optional).

OPEN QUESTION: Do we need tax obligations in the DB for v1, or is recording payments/refunds only sufficient?

## Events / messaging

- None (no queue/webhook system present in repo).

## External APIs / integrations

- **Web ↔ API contracts:** existing REST endpoints under `/reports/*`, `/categories`, `/transactions`.
- Proposed changes may include breaking changes to existing report payloads and/or new endpoints under `/tax/*` (exact paths to be defined), since `apps/web` and `apps/api` are updated together.

# 7. Step-by-step implementation plan

1. **Define the tax event contract**
   - Goal: Lock down what “tax” means in v1 (Skatteverket payments/refunds only) and how it is represented.
   - Files: `docs/specs/tax-system.md`.
   - Outcome: `TaxEventType = payment | refund`; tax events always reference a ledger transaction; no category involvement.

2. **Backend: add `TaxEvent` model + migration**
   - Goal: Persist tax events as a first-class subsystem.
   - Files: `apps/api/shared/enums.py` (modify), `apps/api/models/tax.py` (new), `apps/api/models/__init__.py` (modify), `apps/api/migrations/versions/<new>_tax_events.py` (new).
   - Notes: `tax_events.transaction_id` should be unique to prevent double-marking a transaction.

3. **Backend: add tax schemas + service + handlers**
   - Goal: Provide a supported API for creating/listing tax events and summarizing tax.
   - Files: `apps/api/schemas/tax.py` (new), `apps/api/services/tax.py` (new), `apps/api/handlers/tax.py` (new).
   - Endpoints (suggested):
     - `POST /tax/events` (creates both the ledger transaction and the tax event in one call)
     - `GET /tax/events` (list with date/account filters)
     - `GET /tax/summary` (year/trailing totals for the Taxes page)

4. **Backend: import commit supports tax marker**
   - Goal: Let import review mark rows as tax without using categories.
   - Files: `apps/api/schemas/imports.py` (extend `ImportCommitRow`), `apps/api/services/imports.py` (commit logic).
   - Payload additions (suggested):
     - `tax_event_type: "payment" | "refund" | null` (tax row when non-null)
   - Behavior:
     - When `tax_event_type` is non-null, ignore `category_id` and create a tax event + ledger transaction (balanced against Offset).

5. **Backend: reporting excludes tax from operating expense and emits tax series**
   - Goal: Ensure tax transactions are not counted as operating expenses, but are still visible as tax.
   - Files: `apps/api/repositories/reporting.py`, `apps/api/services/reporting.py`, `apps/api/schemas/reporting.py`, `apps/api/handlers/reporting.py`.
   - Approach:
     - Join `tax_events` in `fetch_transaction_amounts` (or add a dedicated query path) so each row can be identified as tax/non-tax.
     - Update the income/expense classifier so tax rows do not contribute to operating `income`/`expense`.
     - Define unambiguous report fields: `operating_income`, `operating_expense`, `operating_net`, plus `tax_paid`, `tax_refund`, `tax_net`, and `after_tax_net`.

6. **Frontend: imports UI marks rows as tax**
   - Goal: Provide a fast workflow during import review to mark payments/refunds as tax.
   - Files: `apps/web/src/pages/imports/imports.tsx`, `apps/web/src/types/schemas.ts`.
   - UX: a per-row select (“Tax: None / Payment / Refund”), plus bulk actions for selected rows.
   - Notes: update both the in-page Zod schema (`apps/web/src/pages/imports/imports.tsx: commitRowSchema`) and the shared schema (`apps/web/src/types/schemas.ts: importCommitRowSchema`).

7. **Frontend: manual transaction creation supports tax**
   - Goal: Enable marking manually created transactions as tax without using categories.
   - Files: `apps/web/src/pages/transactions/transaction-modal.tsx` (and any related API hook/saga), `apps/web/src/types/schemas.ts`.
   - Behavior: When “Tax payment/refund” is chosen, call `POST /tax/events` (preferred) instead of `POST /transactions`.

8. **Frontend: reporting UI and Taxes page**
   - Goal: Visualize operating vs tax clearly and add a dedicated Taxes page.
   - Files: `apps/web/src/pages/reports/reports.tsx`, `apps/web/src/pages/cash-flow/cash-flow.tsx`, `apps/web/src/pages/taxes/taxes.tsx` (new), `apps/web/src/data/routes.ts`, `apps/web/src/components/app-sidebar.tsx`, `apps/web/src/App.tsx`.
   - UX: toggles for outflow series + tax KPIs; taxes page shows paid/refund/net charts and an event table.

9. **Legacy import script treats “Tax” as tax events**
   - Goal: Ensure `scripts/import_legacy_transactions.py` does not create/keep a “Tax” category and does not import those rows as normal expense transactions.
   - Files: `scripts/import_legacy_transactions.py`.
   - Behavior:
     - When legacy row category equals `"Tax"` (or matches a Skatteverket pattern), do not create/keep a `Category` for it.
     - Create the normal ledger `Transaction` (balanced against Offset) and a linked `TaxEvent`.
     - Map legacy row type to tax event type:
       - legacy `Type == "Expense"` → `TaxEventType.PAYMENT`
       - legacy `Type == "Income"` → `TaxEventType.REFUND`

10. **Tests**
   - Goal: Validate tax is excluded from operating expenses and refunds are handled.
   - Files: `apps/api/tests/test_reporting_handlers.py`, `apps/api/tests/integration/test_reports_integration.py`, plus targeted unit tests for `TaxService`.

# 8. Test plan

## Unit tests (backend)

- Reporting tax split:
  - Seed income, normal expense, and a tax payment/refund (via `TaxEvent`) in the same month.
  - Verify:
    - Operating `expense` excludes tax payments.
    - `tax_paid`, `tax_refund`, `tax_net` match the tax events.
    - Any invariant chosen for reports (e.g., `all_outflow = operating_expense + tax_paid`) holds.
  - Suggested location: `apps/api/tests/test_reporting_handlers.py` and/or `apps/api/tests/test_reporting_repository.py`.

- Tax event creation rules:
  - Creating a tax event requires a balanced ledger transaction and a valid `event_type` (`payment`/`refund`).
  - Suggested location: add a focused unit test module for `TaxService`.

## Integration / end-to-end tests

- Import → commit with `tax_event_type="payment"` produces a tax event and a ledger transaction, and reports show tax series while operating totals exclude tax.
  - Suggested location: `apps/api/tests/integration/test_reports_integration.py`.
- (If obligations exist) `/tax/obligations` CRUD and linking to transactions.

## Regression checks

- Totals are internally consistent (per chosen invariant), and charts/toggles match those invariants.
- Category listing defaults (`include_special=false`) still behave as expected.
- Imports continue to work and committing non-tax rows is unaffected.

# 9. Risks and open questions

## Technical risks

- **User misclassification in imports:** marking the wrong row as tax changes reporting semantics.
  - Mitigation: allow editing after commit (convert a normal transaction to tax or remove tax marker), and show clear “Tax payment/refund” badges in the transaction list.
- **Reporting complexity creep:** Adding toggles/fields across multiple report endpoints can increase maintenance surface.
  - Mitigation: centralize tax split computation in `ReportingService` helpers and keep endpoint shapes consistent across report granularities.
- **Semantic confusion:** Users may expect “net saved” to include tax; others want “operating net” excluding tax.
  - Mitigation: expose both “Operating net” and “After-tax net” explicitly where relevant.

## OPEN QUESTION items

- OPEN QUESTION: Should default report KPIs show “Operating net” (ex tax) or “After-tax net”?
- OPEN QUESTION: Do we want tax refunds to be shown as negative tax (preferred) or as separate “refund” series everywhere?
- OPEN QUESTION: Do we need explicit “tax obligations” with due dates in v1, or is recording payments/refunds only sufficient?
- OPEN QUESTION: Should tax marking be done via a dedicated `POST /tax/events` API (recommended), or by extending `POST /transactions` with tax fields?

## Follow-ups / out-of-scope tasks

- Automatic tax estimation (e.g., accrual-based income tax estimation) and “tax optimization” logic.
- Accounting-grade liability/equity modeling (beyond the current “Offset” balancing approach).
- Multi-entity support (multiple companies) and multi-currency tax handling.
