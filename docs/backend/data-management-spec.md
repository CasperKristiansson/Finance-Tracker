# Data Management Specification

**Project**: Finance Tracker  
**Last Updated**: 2025-10-04  
**Status**: Draft for stakeholder review

---

## 1. Purpose & Scope

This document defines the data domain, persistence model, and validation rules for the Finance Tracker application. It targets the upcoming migration to a Python backend built on **SQLModel** (Pydantic + SQLAlchemy) and is intended to guide:

- Database schema design (tables, relations, constraints).
- Pydantic/SQLModel schemas exposed via API endpoints.
- Business rules for transactions, accounts, and loans.
- Reporting and analytics queries (monthly, yearly, total views).

Out-of-scope: UI layouts, React frontend specifics, infrastructure automation, and authentication/authorization flows.

---

## 2. Guiding Principles & Non-Functional Requirements

- **Single source of truth**: All monetary events flow through the transaction ledger to support consistent reporting.
- **Double-entry flexibility**: Enable single-account events (simple expenses/income) and multi-account events (transfers, loan payments) without duplicating business logic.
- **Strong typing**: Leverage SQLModel for shared ORM and validation definitions to minimize duplicated schema definitions across persistence and API layers.
- **Single tenant**: The system assumes one user profile, so cross-user scoping fields are unnecessary.
- **Single currency (SEK)**: All monetary values are stored in Swedish Krona; currency metadata is omitted for simplicity.
- **Auditability**: Every important mutation is timestamped and attributable to a creation source/import batch.
- **Extensible categories**: Categories are user-managed, but constrained to a single category per transaction to keep reports unambiguous.
- **Loan aware**: Debt accounts track principal, interest rate, amortization schedule, and payouts without treating scheduled payments as normal expenses.
- **Reporting ready**: Schema supports fast aggregation by time, account type, and category for monthly/yearly/total dashboards.

---

## 3. Conceptual Domain Model

```
Account ─┬─ Loan (0..1) ─┬─< LoanRateChange
         └─< BalanceSnapshot

Transaction ─┬─< TransactionLeg >─┬─ Account
             └─ LoanEvent (optional)

Category ─┬─< Transaction

Transaction ─┬─< Attachment (optional future)
```

- A `Transaction` captures the event metadata (category, description, timestamps).
- `TransactionLeg` models the accounting impact per account (supports transfers with two legs, single-leg expenses/income, loan payments spanning debt + funding account).
- `Account` may be flagged as a loan via the related `Loan` row. Loan-specific metadata is kept separate to avoid bloating normal accounts.

---

## 4. Entity Specifications

### 4.1 Account

| Field                       | Type                                 | Notes                                                  |
| --------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `id`                        | UUID                                 | Primary key (SQLModel `Field(default_factory=uuid4)`). |
| `display_order`             | Integer                              | UI ordering hint.                                      |
| `account_type`              | Enum(`normal`, `debt`, `investment`) | Drives business logic.                                 |
| `is_active`                 | Boolean                              | Soft delete.                                           |
| `created_at` / `updated_at` | DateTime                             | Auto timestamps.                                       |

**Indexes**: (`account_type`), (`is_active`).

**Behavior**:

- Debt accounts must reference exactly one `Loan` row.
- Investment accounts allow negative net change without classifying as expense; handled in reporting logic.
- Display labels can be managed externally (e.g., UI configuration) until a dedicated metadata field is reintroduced.

**Derived metrics**:

- `current_balance` is calculated from the cumulative sum of `TransactionLeg.amount` for each account (optionally filtered by an `as_of_date` when requested via API).

### 4.2 Loan

| Field                       | Type                               | Notes                                        |
| --------------------------- | ---------------------------------- | -------------------------------------------- |
| `id`                        | UUID                               | Primary key.                                 |
| `account_id`                | UUID FK -> Account                 | One-to-one (enforced via unique constraint). |
| `origin_principal`          | Decimal(18,2)                      | Original loan amount.                        |
| `current_principal`         | Decimal(18,2)                      | Updated as payments/interest occur.          |
| `interest_rate_annual`      | Decimal(6,4)                       | Nominal APR (e.g., 0.0450).                  |
| `interest_compound`         | Enum(`daily`, `monthly`, `yearly`) | Determines accrual cadence.                  |
| `minimum_payment`           | Decimal(18,2)                      | Optional; guides schedule generator.         |
| `expected_maturity_date`    | Date                               | Optional target payoff.                      |
| `created_at` / `updated_at` | DateTime                           | Audit trail.                                 |

**Related tables**:

- `LoanRateChange`: captures future APR adjustments (effective_date, new_rate).
- `LoanSchedule`: stores projected payments when user requests amortization plan.
- `LoanEvent`: derived from transactions (see §4.5) to track payments, interest accrual, disbursements.

**Business rules**:

- Interest accrual recorded via periodic background job that adds a `Transaction` (category = `interest_accrual`, type = `transfer`) with legs: debt account (+interest) & interest expense category (expense). Optionally post to dedicated accrual account.
- Loan payments treated as transfers: funding account leg negative, debt account leg positive; category identifies `loan_payment` to keep reporting separate from living expenses.

### 4.3 Category

| Field                       | Type                                                        | Notes                                      |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `id`                        | UUID                                                        | Primary key.                               |
| `name`                      | String(120)                                                 | Unique within the instance.                |
| `category_type`             | Enum(`income`, `expense`, `adjustment`, `loan`, `interest`) | Determines sign expectations in reporting. |
| `is_archived`               | Boolean                                                     | For history retention.                     |
| `created_at` / `updated_at` | DateTime                                                    | Audit.                                     |

**Notes**:

- Transfers do not require categories; if provided, category_type must be `adjustment` or `loan`.
- System seeds contain canonical categories (e.g., `income:salary`, `expense:groceries`, `loan:principal_payment`) which administrators can extend.

### 4.4 Transaction (Envelope)

| Field                       | Type                                                                    | Notes                                                            |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `id`                        | UUID                                                                    | Primary key.                                                     |
| `category_id`               | UUID FK -> Category                                                     | Optional for pure transfers; required for income/expense events. |
| `transaction_type`          | Enum(`income`, `expense`, `transfer`, `adjustment`, `investment_event`) | Derived from legs + category.                                    |
| `description`               | String(250)                                                             | User input.                                                      |
| `notes`                     | Text                                                                    | Optional.                                                        |
| `external_id`               | String(180)                                                             | Source system identifier (bank import). Unique within instance.  |
| `occurred_at`               | DateTime                                                                | Effective date (used for reporting bins).                        |
| `posted_at`                 | DateTime                                                                | When transaction was confirmed; defaults to occurred_at.         |
| `created_source`            | Enum(`manual`, `import`, `system`)                                      | Attribution for auditing.                                        |
| `created_at` / `updated_at` | DateTime                                                                | Audit.                                                           |
| `import_batch_id`           | UUID FK -> TransactionImportBatch                                       | Optional.                                                        |

**Constraints & Logic**:

- Must have ≥1 `TransactionLeg` (see below).
- `transaction_type` is calculated server-side based on net sums and account types; persisted for query efficiency.
- Single-category rule enforced at model level.

### 4.5 TransactionLeg (Accounting Entry)

| Field             | Type                   | Notes                                                           |
| ----------------- | ---------------------- | --------------------------------------------------------------- |
| `id`              | UUID                   | Primary key.                                                    |
| `transaction_id`  | UUID FK -> Transaction | Parent envelope.                                                |
| `account_id`      | UUID FK -> Account     | Impacted account.                                               |
| `amount`          | Decimal(18,2)          | Signed. Positive increases account balance, negative decreases. |
| `running_balance` | Decimal(18,2)          | Optional snapshot for audit (materialized via trigger/job).     |

**Rules**:

- Sum of legs per transaction must equal zero (double-entry). Enforced via SQL constraint or application check within a database transaction.
- For simple income/expense, there are two legs: one against the relevant account, and one against an implicit equity account (configurable). To reduce complexity, we will model the counter-leg as an auto-managed `SystemAccount` (see below).
- Transfers require exactly two user-visible accounts (origin negative, destination positive). Optionally additional legs for fees.
- All leg amounts are recorded in SEK; foreign currency support will require future schema extensions.

### 4.6 SystemAccount (virtual)

Purpose: Provide double-entry balancing without exposing bookkeeping complexity to users.

| Field         | Type                                                        | Notes                        |
| ------------- | ----------------------------------------------------------- | ---------------------------- |
| `id`          | UUID                                                        | Primary key.                 |
| `code`        | Enum(`retained_earnings`, `interest_expense`, `unassigned`) | Pre-seeded, not user facing. |
| `description` | Text                                                        |                              |

System accounts are referenced only in legs automatically generated by the backend. They are excluded from user reports except where explicitly required (e.g., net worth calculations).

### 4.7 TransactionImportBatch (optional, existing behavior)

Tracks bulk uploads; enables rollback/traceability.

### 4.8 LoanEvent (Derived View)

Materialized view or table that denormalizes loan-related transactions for faster analytics:

| Field            | Type                                                                                     | Source                        |
| ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| `loan_id`        | FK -> Loan                                                                               | From linked account.          |
| `transaction_id` | FK -> Transaction                                                                        |                               |
| `event_type`     | Enum(`disbursement`, `payment_principal`, `payment_interest`, `interest_accrual`, `fee`) | Derived by categorizing legs. |
| `amount`         | Decimal(18,2)                                                                            | For the debt-side leg.        |
| `occurred_at`    | DateTime                                                                                 |                               |

Populated via trigger or scheduled job. Used to compute remaining principal and interest paid YTD.

### 4.9 BalanceSnapshot (optional future optimization)

Stores end-of-day/month balances for reporting caching.

---

## 5. SQLModel & Pydantic Layering

### 5.1 Base Classes

- `TimestampMixin` adds `created_at`/`updated_at` with SQL defaults and Pydantic serialization.
- `UUIDPrimaryKeyMixin` standardizes primary key definition.
- `AuditSourceMixin` (new) surfaces `created_source` enumeration used on transactional models.

### 5.2 Model Variants

For each entity we expose three schema variants:

1. **ORM Model** (`Account`, `Transaction`, etc.) inheriting from `SQLModel`, `table=True`.
2. **Read Model** (`AccountRead`, `TransactionRead`) with relationship loading and computed fields (e.g., net amount).
3. **Create/Update Models** (`TransactionCreate`, `TransactionUpdate`) inheriting from `BaseModel` to validate payloads before ORM session interaction.

Validation rules (examples):

- `TransactionCreate.legs` must contain at least two entries and net to zero within precision tolerance.
- `LoanCreate` requires `account_type == debt` on associated account.
- `AccountCreate.account_type == debt` implies `loan_details` object is present.

### 5.3 Session & Repository Pattern

- Use SQLModel session dependency injection per request.
- Introduce repository services (`TransactionRepository`, `AccountRepository`, `LoanService`) to encapsulate complex unit-of-work operations (e.g., posting transactions with legs in a single database transaction).

---

## 6. Business Rules & Derived Logic

- **Sign conventions**: Income legs on tracked accounts are positive; expenses negative. Reporting converts to human-friendly totals (`income_total = sum(positive legs)`, `expense_total = sum(abs(negative legs))`).
- **Investment accounts**: Gains/losses booked as `investment_event` transactions. Losses map to investment account negative leg balanced by retained earnings system account; excluded from expense reports but included in net worth.
- **Transfers**: `category_id` optional. When absent, UI labels the transaction "Transfer" based on `transaction_type`.
- **Adjustments**: Utility transactions (e.g., reconciling bank balance) use category_type `adjustment`; flagged separately from discretionary spending.
- **Recurring payments**: Recurrence metadata stored outside core schema (future enhancement). For now, scheduler service can duplicate prior transactions.
- **Concurrency**: Unique constraint on `external_id` prevents duplicate imports from bank feeds.

---

## 7. Reporting & Analytics Support

### 7.1 Core Queries

- **Monthly overview**: Aggregate legs grouped by `date_trunc('month', occurred_at)` while excluding system accounts.
- **Yearly overview**: Similar aggregation at yearly granularity, optionally pivot by category.
- **Total overview**: Rolling sums from `occurred_at >= account.created_at`.

### 7.2 Precomputed Views

- `vw_monthly_account_totals`: `(account_id, month, income_total, expense_total, transfers_in, transfers_out)`.
- `vw_category_summary`: `(category_id, year, total_amount, transaction_count)`.
- `vw_net_worth`: Snapshot combining account balances + outstanding loan principal.

Materialized view refresh cadence: nightly via async job. On-demand refresh endpoint for manual recalculation (rate limited).

### 7.3 Performance Considerations

- Index `Transaction.occurred_at` for range queries.
- Composite indexes on `TransactionLeg(account_id, occurred_at)`.
- Partitioning option (by year) for large datasets; not MVP but planned.

---

## 8. API Surface (Draft)

| Endpoint                       | Method | Purpose                                             | Request Model                                                   | Response Model               |
| ------------------------------ | ------ | --------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| `/accounts`                    | GET    | List active accounts with current balances.         | Query params for filters (`as_of_date`, `include_inactive`).     | `List[AccountRead]`.         |
| `/accounts`                    | POST   | Create account (with optional loan details).        | `AccountCreate` (+ `LoanCreate`).                               | `AccountRead`.               |
| `/accounts/{id}`               | PATCH  | Update account type/order/loan metadata.            | `AccountUpdate`.                                                | `AccountRead`.               |
| `/categories`                  | GET    | List categories (active or archived).               | Query params for filters.                                       | `List[CategoryRead]`.        |
| `/categories`                  | POST   | Create new category.                                | `CategoryCreate`.                                               | `CategoryRead`.              |
| `/categories/{id}`             | PATCH  | Update category name/type/archive state.            | `CategoryUpdate`.                                               | `CategoryRead`.              |
| `/transactions`                | GET    | Filter by date range, account, category.            | Query: `start_date`, `end_date`, `account_ids`, `category_ids`. | Paginated `TransactionRead`. |
| `/transactions`                | POST   | Create transaction with legs.                       | `TransactionCreate`.                                            | `TransactionRead`.           |
| `/transactions/{id}`           | PATCH  | Update metadata or legs (rebalances automatically). | `TransactionUpdate`.                                            | `TransactionRead`.           |
| `/reports/monthly`             | GET    | Summary totals for given year/month.                | `year`, `month`.                                                | `MonthlyReportRead`.         |
| `/reports/yearly`              | GET    | Year-over-year summary.                             | `year`.                                                         | `YearlyReportRead`.          |
| `/reports/total`               | GET    | Lifetime totals + net worth.                        | Optional filters.                                               | `TotalReportRead`.           |
| `/loans`                       | POST   | Attach loan metadata to an account.                 | `LoanCreate`.                                                   | `LoanRead`.                  |
| `/loans/{account_id}`          | PATCH  | Update loan parameters (rate, minimum payment).     | `LoanUpdate`.                                                   | `LoanRead`.                  |
| `/loans/{account_id}/schedule` | GET    | Generated amortization schedule.                    | Query: `as_of_date`.                                            | `LoanScheduleRead`.          |
| `/loans/{account_id}/events`   | GET    | Timeline of loan events.                            | Pagination.                                                     | `List[LoanEventRead]`.       |

Authentication still required but multi-tenant scoping is unnecessary; endpoints operate on the single-tenant dataset.

---

## 9. Migration Strategy

1. **Schema creation**: Alembic migration derived from SQLModel metadata.
2. **Legacy data import**:
   - Map existing transactions to envelope/leg structure (expenses/income create synthetic counter-leg to `retained_earnings`).
   - Transfers detected by matching source/destination accounts from historical data.
   - Loans: populate `Loan` table for each debt account; compute `origin_principal` from earliest balance.
3. **Validation scripts**: Ensure net sum per transaction = 0; reconcile account balances with historical totals.
4. **Backfill reports**: Refresh materialized views after import.

---

## 10. Risks & Open Questions

- **Counter-leg handling**: Confirm acceptance of system-managed balancing account; alternative is explicit equity account per instance.
- **Loan interest accrual cadence**: Need business decision on how often to post interest (daily vs monthly) and whether compounding uses actual days or 30/360.
- **Investment performance reporting**: Define formulas for ROI vs. cash flow to ensure negative returns do not appear as expenses.
- **Future multi-currency support**: Would require reintroducing currency fields, FX tables, and gain/loss handling.
- **Automation cadence**: Background jobs for loan accrual and materialized view refresh need scheduling infrastructure (Celery, APScheduler?).

---

## 11. Next Steps

1. Review and confirm open questions with stakeholders.
2. Create detailed API contracts (request/response JSON examples) once schema is locked.
3. Implement Alembic migrations + SQLModel classes following this spec.
4. Build repository/service layer with end-to-end tests covering transactions, transfers, and loan payments.
5. Validate reporting outputs against historical data to confirm parity with existing system.

---

## 12. Background Jobs

### 12.1 Loan Interest Accrual

- **Purpose**: Automatically increase loan principal for accrued interest without manual postings.
- **Frequency**: Run on the first calendar day of each month at 01:00 UTC (cron `0 1 1 * *`).
- **Mechanics**: For each loan, compute `current_principal * (interest_rate_annual / periods_per_year)` using the loan's compounding setting. Post a system-generated expense transaction categorized as `interest`, crediting the debt account and debiting a configured interest-expense account.
- **Audit**: Every accrual transaction is stamped with `created_source = system` and produces an `interest_accrual` entry in `loan_events` for reporting parity.
- **Idempotency**: Job executes inside a database transaction; orchestration should ensure single execution per period (e.g., relying on a CloudWatch Events + Lambda schedule with dead-letter queue for retries).

---

## 13. Implementation Coverage

- **Models & Persistence**: All entities described in §4 (accounts, loans, categories, transactions, loan events) exist in code with the enforced constraints noted in the spec. Future optional tables (`LoanSchedule`, `BalanceSnapshot`) remain deferred.
- **API Endpoints**: REST handlers for accounts, categories, transactions, loans, and reporting endpoints match the contract in §8. Any missing endpoints are intentionally deferred (PATCH `/transactions/{id}` and future reporting extensions).
- **Background Processing**: Materialized view refresh utilities (§7.2) and the loan interest accrual job (§12.1) are implemented. Automated scheduling (Celery/Step Functions) is still an infrastructure decision and is documented as a follow-up action.
- **Deviations**: None outstanding at this time. Any future departures from the specification should be recorded here with rationale and linked implementation tickets.
