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
2. The UI must let users identify tax separately from operating expenses by providing a dedicated Taxes page (not by mixing tax into normal income/expense charts).
3. The UI must work for tax patterns that are monthly, quarterly, or yearly (e.g., monthly prelim tax vs annual settlement) by providing a monthly tax summary on the Taxes page.
4. Import review must support explicitly marking rows as tax payments or tax refunds, without requiring a “Tax” category.
5. Tax transactions must still affect ledger balances and net worth (they are real cashflow); the separation is only about reporting semantics.
6. All income/expense aggregations and plots must exclude tax transactions; tax is only visualized on the dedicated Taxes page. Net worth views must continue to include tax transactions.

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

- **Current behavior:** All `TransactionType.EXPENSE` rows contribute to “expense” totals and charts; “Tax” is mixed into operating expenses via categories.
- **New behavior:**
  - Reporting endpoints (`/reports/*`) continue to show **operating** income/expense only (tax excluded everywhere these metrics appear).
  - Tax is visualized exclusively via the Taxes page and `/tax/*` endpoints; reports/cash-flow do not include tax series or toggles.
  - Implementation ensures tax transactions are not classified as `INCOME`/`EXPENSE` for reporting purposes.

  ASSUMPTION: “Tax” is defined by the presence of a linked `TaxEvent` (not by category name), and tax-created transactions are stored as `TransactionType.TRANSFER` with `category_id = NULL` so they are naturally excluded by current reporting classifiers.

## Feature C: Taxes UI surface (visibility + workflow)

- **Current behavior:** Tax is not a first-class UI concept; users must infer it via category names.
- **New behavior:**
  - Add a new route/page “Taxes” that presents:
    - KPI cards: net tax paid YTD, net tax paid last 12 months, and largest net-tax month.
    - A chart: net tax paid by month (year selector), where refunds are negative values.
    - A table of tax events (or tax transactions) with drilldown to the underlying ledger transaction.
  - Reports/cash-flow pages remain operating-only (tax excluded) and link to the Taxes page for tax visibility.

# 5. Affected components

| Service/Repo | File/Module | Type of change | Reason it is affected |
|---|---|---|---|
| `apps/api` | `apps/api/shared/enums.py` | modify | Add `TaxEventType` (`payment`/`refund`) to keep tax event typing consistent with existing domain enums. |
| `apps/api` | `apps/api/models/tax.py` | new file | Introduce `TaxEvent` model linked to a ledger `Transaction`. |
| `apps/api` | `apps/api/models/__init__.py` | modify | Export the `TaxEvent` model so it is included in metadata/tests and available through the package. |
| `apps/api` | `apps/api/schemas/tax.py` | new file | Define request/response payloads for tax endpoints and reporting. |
| `apps/api` | `apps/api/services/tax.py` | new file | Centralize rules for creating and listing tax events and linking them to transactions. |
| `apps/api` | `apps/api/handlers/tax.py` | new file | Expose tax endpoints (e.g., list/create tax events and tax summaries). |
| `apps/api` | `apps/api/schemas/imports.py` | modify | Extend `ImportCommitRow` to carry a tax marker (`tax_event_type`). |
| `apps/api` | `apps/api/services/imports.py` | modify | On commit, route tax-marked rows through the tax subsystem instead of normal expense categorization. |
| `apps/api` | `apps/api/migrations/versions/*_tax_*.py` | new file | Create `tax_events` table (and any supporting enum/type changes). |
| `infra` | `infra/serverless/serverless.yml` | modify | Add Lambda functions/routes for `/tax/*` endpoints if introduced. |
| `apps/web` | `apps/web/src/types/schemas.ts` | modify | Extend import commit schema (`tax_event_type`) and add new schemas for `/tax/*` endpoints used by the Taxes page. |
| `apps/web` | `apps/web/src/pages/imports/imports.tsx` | modify | Add per-row “Tax: none/payment/refund” control and send `tax_event_type` in the commit payload (note: this file also defines its own Zod commit schema). |
| `apps/web` | `apps/web/src/pages/transactions/transaction-modal.tsx` | modify | Allow marking a manually created transaction as tax (payment/refund). |
| `apps/web` | `apps/web/src/pages/reports/reports.tsx` | modify (small) | Ensure labels/copy are “Operating” (tax excluded) and provide a link to the Taxes page. |
| `apps/web` | `apps/web/src/pages/cash-flow/cash-flow.tsx` | modify (small) | Ensure labels/copy are “Operating” (tax excluded) and provide a link to the Taxes page. |
| `apps/web` | `apps/web/src/pages/taxes/taxes.tsx` | new file | New Taxes page focused on tax payments/refunds and drilldowns. |
| `apps/web` | `apps/web/src/data/routes.ts` | modify | Add a `taxes` route entry. |
| `apps/web` | `apps/web/src/components/app-sidebar.tsx` | modify | Add “Taxes” navigation item. |
| `apps/web` | `apps/web/src/App.tsx` | modify | Route to the Taxes page. |
| `scripts` | `scripts/import_legacy_transactions.py` | modify | Treat legacy “Tax” category rows as tax events (not normal expense/category transactions). |
| `apps/api/tests` | `apps/api/tests/test_reporting_handlers.py` | modify/add | Validate: `/reports/*` income/expense ignore tax; `/tax/summary` represents refunds as negative net tax. |
| `apps/api/tests/integration` | `apps/api/tests/integration/test_reports_integration.py` | modify/add | End-to-end: import commit with `tax_event_type` creates a `TaxEvent`, and `/reports/*` income/expense remain unchanged (tax excluded). |

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
- **Planned changes (v1):** none. Operating reports exclude tax by ensuring tax-created transactions are stored as `TransactionType.TRANSFER` with `category_id = NULL`.

## Events / messaging

- None (no queue/webhook system present in repo).

## External APIs / integrations

- **Web ↔ API contracts:** existing REST endpoints under `/reports/*`, `/categories`, `/transactions`.
- Introduce new endpoints under `/tax/*` for creating/listing tax events and tax summaries. Reporting endpoints remain “operating-only” and do not gain tax series.

### New API: Tax events

- `POST /tax/events`
  - Purpose: create an income tax `TaxEvent` and its underlying ledger `Transaction` in one call.
  - Request (suggested):
    - `account_id: UUID` (cash/bank account affected)
    - `occurred_at: datetime` (and optionally `posted_at`; default = occurred_at)
    - `amount: Decimal` (positive amount in SEK)
    - `event_type: "payment" | "refund"`
    - `description: string` (e.g., “Skatteverket” or imported memo)
    - `note?: string`, `authority?: string` (default “Skatteverket”)
  - Behavior:
    - Creates a balanced transaction between `account_id` and the hidden `Offset` account.
    - Enforces `transaction.category_id = NULL` and stores the transaction as `TransactionType.TRANSFER` to keep it out of operating income/expense plots.
  - Response (suggested):
    - `tax_event: { id, transaction_id, event_type, authority, note, occurred_at, created_at }`
    - `transaction: TransactionRead` (optional convenience)

- `GET /tax/events`
  - Purpose: list tax events for the Taxes page and drilldowns.
  - Query (suggested): `start_date?`, `end_date?`, `limit?`, `offset?`, `account_ids?`
  - Response (suggested): `events: [{ tax_event fields + transaction summary fields }]`

### New API: Tax summary

- `GET /tax/summary`
  - Purpose: provide the Taxes page with monthly series and totals (tax-only; not part of `/reports/*`).
  - Query (suggested): `year?: int` (defaults to current year), optional `account_ids?`
  - Response (suggested):
    - `year: int`
    - `monthly: [{ month: 1..12, net_tax_paid: Decimal }]`
    - `totals: { net_tax_paid_ytd: Decimal, net_tax_paid_last_12m: Decimal }` (optional)
  - Sign convention:
    - Tax `payment` contributes `+amount` (net tax paid increases).
    - Tax `refund` contributes `-amount` (negative tax; reduces net tax paid).
    - `net_tax_paid` may be negative for months/periods dominated by refunds.

### Import contract change (tax marker)

- `POST /imports/{batch_id}/commit` (`apps/api/schemas/imports.py: ImportCommitRow`)
  - Add `tax_event_type: "payment" | "refund" | null`.
  - When provided, the row is committed through the tax subsystem:
    - ignore `category_id` (do not categorize tax)
    - create the ledger transaction + linked `TaxEvent`
    - keep the created transaction out of operating reports as described above

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
     - `POST /tax/events` (creates both the ledger transaction and the tax event in one call) **← chosen approach**
     - `GET /tax/events` (list with date/account filters)
     - `GET /tax/summary` (year/trailing totals for the Taxes page)

4. **Backend: import commit supports tax marker**
   - Goal: Let import review mark rows as tax without using categories.
   - Files: `apps/api/schemas/imports.py` (extend `ImportCommitRow`), `apps/api/services/imports.py` (commit logic).
   - Payload additions (suggested):
     - `tax_event_type: "payment" | "refund" | null` (tax row when non-null)
   - Behavior:
     - When `tax_event_type` is non-null, ignore `category_id` and create a tax event + ledger transaction (balanced against Offset).

5. **Backend: ensure operating reports exclude tax**
   - Goal: Guarantee that `/reports/*` income/expense plots exclude tax transactions.
   - Files: primarily `apps/api/services/tax.py` (create tax transactions as `TRANSFER` with `category_id=NULL`).
   - Approach:
     - Primary: enforce tax-created transactions are `TransactionType.TRANSFER` so existing report classifiers naturally exclude them.

6. **Frontend: imports UI marks rows as tax**
   - Goal: Provide a fast workflow during import review to mark payments/refunds as tax.
   - Files: `apps/web/src/pages/imports/imports.tsx`, `apps/web/src/types/schemas.ts`.
   - UX: a per-row select (“Tax: None / Payment / Refund”), plus bulk actions for selected rows.
   - Notes: update both the in-page Zod schema (`apps/web/src/pages/imports/imports.tsx: commitRowSchema`) and the shared schema (`apps/web/src/types/schemas.ts: importCommitRowSchema`).

7. **Frontend: manual transaction creation supports tax**
   - Goal: Enable marking manually created transactions as tax without using categories.
   - Files: `apps/web/src/pages/transactions/transaction-modal.tsx` (and any related API hook/saga), `apps/web/src/types/schemas.ts`.
   - Behavior: When “Tax payment/refund” is chosen, call `POST /tax/events` (preferred) instead of `POST /transactions`.

8. **Frontend: Taxes page + operating-only labels**
   - Goal: Add a dedicated Taxes page; label other income/expense plots as operating-only (tax excluded).
   - Files: `apps/web/src/pages/taxes/taxes.tsx` (new), `apps/web/src/data/routes.ts`, `apps/web/src/components/app-sidebar.tsx`, `apps/web/src/App.tsx`, plus small copy tweaks in `apps/web/src/pages/reports/reports.tsx` and `apps/web/src/pages/cash-flow/cash-flow.tsx`.
   - UX: Taxes page shows a monthly “Net tax paid” series where refunds contribute negative values (net can be negative if refunds exceed payments), plus a tax event table.

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

- Reporting excludes tax:
  - Create one normal income and one normal expense (categorized) and verify they appear in `/reports/*`.
  - Create a tax payment and tax refund via `POST /tax/events` and verify they do **not** change `/reports/*` income/expense values.
  - Suggested location: `apps/api/tests/test_reporting_handlers.py`.

- Tax event creation rules:
  - Creating a tax event requires a balanced ledger transaction and a valid `event_type` (`payment`/`refund`).
  - Verify refunds contribute negative values in the monthly “Net tax paid” summary series.
  - Suggested location: add a focused unit test module for `TaxService`.

## Integration / end-to-end tests

- Import → commit with `tax_event_type="payment"` produces a tax event and a ledger transaction, and operating reports remain unchanged (tax excluded from income/expense plots).
  - Suggested location: `apps/api/tests/integration/test_reports_integration.py`.
- Verify Taxes page data contract via `/tax/summary` (monthly net series with refunds negative, event list pagination if implemented).

## Regression checks

- Totals are internally consistent, and charts match those invariants.
- Category listing defaults (`include_special=false`) still behave as expected.
- Imports continue to work and committing non-tax rows is unaffected.

# 9. Risks and open questions

## Technical risks

- **User misclassification in imports:** marking the wrong row as tax changes reporting semantics.
  - Mitigation: allow editing after commit (convert a normal transaction to tax or remove tax marker), and show clear “Tax payment/refund” badges in the transaction list.
- **Tax accidentally counted in operating reports:** a tax-marked transaction might still be typed/categorized as `INCOME/EXPENSE`.
  - Mitigation: enforce tax-created transactions are `TRANSFER` with `category_id=NULL`, and optionally add an explicit “exclude if has `TaxEvent`” filter in reporting.
- **Semantic confusion:** Users may expect “net saved” to include tax; others want “operating net” excluding tax.
  - Mitigation: label report/cash-flow metrics as “Operating” (tax excluded) and surface taxes separately on the Taxes page.

## OPEN QUESTION items

- None for v1 (decisions captured in sections 3–4).

## Follow-ups / out-of-scope tasks

- None for v1.
