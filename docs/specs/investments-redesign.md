# 1. Overview

This change scraps the current `/investments` page and rebuilds it around a “portfolio over time” (net worth-style) view plus per-investment-account breakdowns derived from snapshots and ledger cashflows. The work spans the frontend (`apps/web`) for a complete UI rewrite and the backend (`apps/api`) to extend `GET /investments/overview` with a cashflow time series required for a second chart: contributions vs market growth over time. This matters because users need to distinguish market-driven changes from deposits/withdrawals and understand how each investment account has contributed and grown over time.

# 2. Current behavior and architecture

- **Repo: Frontend (`apps/web`)**
  - `apps/web/src/pages/investments/investments.tsx: Investments`
    - Renders the current Investments page using `useInvestmentsApi().fetchOverview()` and `overview` from Redux.
    - Shows:
      - Portfolio value over time (area chart from `overview.portfolio.series`).
      - A “Portfolio details” card with cashflow totals for 30d and 12m, plus “growth excluding transfers” for 12m and since start.
      - Per-account cards with a sparkline, 12m cashflow (added/withdrawn), and 12m growth excluding transfers.
      - A secondary “focused account” mini-chart (last 18 points) based on a dropdown.
      - A “Recent deposits / withdrawals” table from `overview.recent_cashflows`.
    - Uses custom helpers (`formatSek`, `formatCompact`, etc.) and the shared `ChartContainer` wrapper.
  - `apps/web/src/hooks/use-api.ts:299: useInvestmentsApi`
    - Exposes `fetchOverview()` which dispatches a saga action.
  - `apps/web/src/features/investments/investmentsSaga.ts:88: handleFetchOverview`
    - Calls `GET /investments/overview` (via `callApiWithAuth`) and stores the result in Redux.
  - `apps/web/src/features/investments/investmentsSlice.ts: setOverview`
    - Stores `overview?: InvestmentOverviewResponse` and a generic `loading`/`error` state.
  - `apps/web/src/types/schemas.ts:1082: investmentOverviewResponseSchema`
    - Zod schema for `InvestmentOverviewResponse` expected by the frontend.

- **Repo: Backend (`apps/api`)**
  - `apps/api/handlers/investments.py:204: investment_overview`
    - `GET /investments/overview` handler; loads `InvestmentSnapshotService.investment_overview()` and validates via `InvestmentOverviewResponse`.
  - `apps/api/services/investments.py:124: class InvestmentSnapshotService`
    - `InvestmentSnapshotService.investment_overview()`
      - Uses `AccountType.INVESTMENT` accounts plus `InvestmentSnapshot` rows to build value series for:
        - Portfolio total (`portfolio.series`)
        - Each investment account (`accounts[].series`)
      - Computes cashflow using ledger `TransactionLeg` rows for investment accounts, but only for transactions that also involve a non-investment account (filters internal transfers and investment-only activity):
        - `cashflow_sums()` aggregates deposits/withdrawals between `[start_dt, end_dt]`.
        - Returns totals for 30d, YTD, 12m, and uses “since start” internally to compute lifetime growth (but does not currently return those cashflow totals).
      - Computes growth excluding transfers:
        - `growth_12m_ex_transfers` and `growth_since_start_ex_transfers` at the portfolio level.
        - `growth_12m_ex_transfers` at the account level.
      - Returns `recent_cashflows` (up to 12) sourced from recent transactions that touch investment accounts and non-investment legs.
  - `apps/api/schemas/investments.py:229: class InvestmentOverviewResponse`
    - Contract for `/investments/overview` response:
      - `portfolio` includes `series`, `cashflow` (30d/ytd/12m), and growth (12m/since start).
      - `accounts[]` includes `series`, 12m cashflow (added/withdrawn), and 12m growth excluding transfers.
  - Persistence models (snapshot-based valuation source):
    - `apps/api/models/investment_snapshot.py: InvestmentSnapshot`
    - `apps/api/models/investment_holding.py: InvestmentHolding`
    - `apps/api/models/investment_transaction.py: InvestmentTransaction`
  - Infra routing:
    - `infra/serverless/serverless.yml:760: investmentOverview`
      - Maps `GET /investments/overview` → `apps/api/handlers/investments.investment_overview`.

End-to-end flow today for `/investments`:

- UI mount → `apps/web/src/pages/investments/investments.tsx: useEffect(fetchOverview)` → `apps/web/src/features/investments/investmentsSaga.ts: handleFetchOverview` → `GET /investments/overview` → `apps/api/handlers/investments.py: investment_overview` → `apps/api/services/investments.py: InvestmentSnapshotService.investment_overview` → DB (`accounts`, `investment_snapshots`, `transaction_legs`, `transactions`) → JSON response → rendered charts/cards/tables.

# 3. Requirements and constraints

## Functional requirements

1. Replace the current `/investments` UI with a redesigned page focused on “investment net worth”: total portfolio value over time as the primary chart.
2. Add a second chart that visualizes contributions vs market growth over time (requires a cashflow time series API; see Section 6).
3. The page must clearly show deposited vs withdrawn amounts, and the net contributions to investments (12m and since start).
4. The page must clearly show “growth excluding deposits/withdrawals” (i.e., value change not explained by contributions) for the portfolio (12m and since start).
5. The page must provide a clear breakdown per investment account (at minimum: current value, deposited/withdrawn/net contributions, and growth excluding transfers).
6. “Since start” must be defined as the earliest of (first snapshot date, first cashflow date) and used consistently for totals and growth.
7. The redesigned page must remove the current “Recent deposits / withdrawals” table and legacy sections from the existing page (full rebuild, not incremental).
8. Per-account breakdown must be derived from investment accounts + ledger cashflows + snapshot valuations only; do not use holdings (`investment_snapshots.holdings`) since holdings are not reliable. (Account-level only.)

## Non-functional requirements

- UX: Modern, data-first layout consistent with `docs/brand.md` (cards, clear hierarchy, strong empty/loading states).
- Accessibility: Clickable rows/controls must be keyboard reachable and preserve focus outlines (Radix/Sheet patterns).
- Performance: `/investments` should render smoothly with typical series lengths (snapshots are usually sparse); avoid expensive per-render computations (use `useMemo`).

## Constraints

- The backend currently derives investment value from snapshots (`investment_snapshots`) rather than broker APIs; the redesign must work with snapshot-based valuation.
- `/investments/overview` is already used by the frontend; any API contract changes must be coordinated with frontend Zod schemas.
- Holdings are not reliable for this redesign; do not use `investment_snapshots.holdings` for holdings-level UI or calculations.
- Do not introduce new external dependencies unless necessary (ASSUMPTION: prefer existing `recharts`, `ChartContainer`, shadcn/Radix).
- Prefer extending `GET /investments/overview` over adding new routes (ASSUMPTION: keep infra routing unchanged).

# 4. Proposed features and behavior changes

## 4.1 Portfolio “Investment Net Worth” header + primary chart

- **Current behavior:** Portfolio chart + a separate “Portfolio details” card containing a subset of cashflow and growth numbers.
- **New behavior:**
  - A single primary “Investment Net Worth” card (or header section + chart card) shows:
    - Current portfolio value (as-of date).
    - Market growth (excluding transfers) for 12m and since start.
    - Deposited/withdrawn/net contributions for the same periods.
  - A time-window selector controls which cashflow/growth figures are emphasized (e.g., `30d`, `YTD`, `12m`, `All-time`).
    - `ASSUMPTION:` The UI needs at least those four windows because the backend already computes 30d/YTD/12m and “since start” growth.

## 4.2 “Contributions vs Growth” explanation (decomposition)

- **Current behavior:** Growth is shown as a single number; deposits/withdrawals are shown separately, but the relationship is not explicit.
- **New behavior:**
  - Add a concise decomposition row/mini-card explaining:
    - `End Value = Start Value + Net Contributions + Market Growth`
  - Add a second chart that visualizes contributions vs market growth over time (requires a cashflow time series API; see Section 6).

## 4.3 Per-account breakdown list with drill-in

- **Current behavior:** Grid of account cards + optional focused-account chart; cashflow and growth limited to 12m; no drill-in detail panel.
- **New behavior:**
  - Replace the account card grid with a compact, sortable table (or dense card list) showing per account:
    - Current value + as-of date
    - Deposited/withdrawn/net contributions (12m and since start)
    - Growth excluding transfers (12m and since start)
  - Clicking a row opens a right-side Sheet (“account details”) that includes:
    - Account value over time chart (using the existing `series`)
    - The same cashflow and growth metrics shown in the table
  - The global “Recent deposits/withdrawals” table is removed in the redesign.

## 4.4 Empty and partial-data states

- **Current behavior:** If no series, shows “No investment values yet.”
- **New behavior:**
  - If no investment snapshots exist:
    - Show a clear empty state explaining that investments are snapshot-based and prompting the user to add snapshots (copy-only; no new import UI implied).
  - If snapshots exist but the user has no investment accounts:
    - Show “No investment accounts found” and link to Accounts page to create/mark investment accounts.
  - If snapshots exist but cashflow detection finds none:
    - Show “No deposits/withdrawals detected” (still show growth and value charts).

# 5. Affected components

| Service/Repo       | File/Module                                                                       | Type of change    | Reason it is affected                                                                                       |
| ------------------ | --------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/web`         | `apps/web/src/pages/investments/investments.tsx`                                  | modify (rewrite)  | Replace the entire Investments page UI/structure and interactions.                                          |
| `apps/web`         | `apps/web/src/components/ui/sheet.tsx` (existing)                                 | reuse             | Use the established right-side Sheet pattern for account drill-in.                                          |
| `apps/web`         | `apps/web/src/features/investments/investmentsSaga.ts`                            | modify (optional) | Only needed if the request/endpoint changes; otherwise keep existing fetch and state wiring.                |
| `apps/web`         | `apps/web/src/types/schemas.ts`                                                   | modify            | Update Zod schemas for the extended `/investments/overview` response (cashflow series + since-start totals). |
| `apps/api`         | `apps/api/services/investments.py: InvestmentSnapshotService.investment_overview` | modify            | Add cashflow time series + since-start totals aligned to the “since start” definition.                      |
| `apps/api`         | `apps/api/schemas/investments.py`                                                 | modify            | Extend response schemas for cashflow series and new since-start fields.                                      |
| `apps/api/tests`   | `apps/api/tests/integration/test_investments_integration.py`                      | extend            | Add coverage for `GET /investments/overview` including cashflow series and since-start totals.              |
| `infra/serverless` | `infra/serverless/serverless.yml`                                                 | none (likely)     | The endpoint remains `GET /investments/overview` unless a new endpoint is introduced.                       |

# 6. Data model and external contracts

## Data models / DB tables / schemas

- **Investment valuation source:** `investment_snapshots` (and optional `investment_holdings`).
  - `apps/api/models/investment_snapshot.py: InvestmentSnapshot`
    - Key fields: `snapshot_date`, `portfolio_value`, `parsed_payload`, `cleaned_payload`.
  - Invariant: portfolio/account value history is snapshot-based; missing days are expected.

- **Cashflow source:** ledger transactions via `transactions` + `transaction_legs` and `accounts.account_type == investment`.
  - `apps/api/services/investments.py: InvestmentSnapshotService.investment_overview.cashflow_sums`
    - Invariant (current): cashflow counts only when an investment-account leg is part of a transaction that also involves at least one non-investment account leg; excludes `TransactionType.ADJUSTMENT`.
  - `ASSUMPTION:` This is the desired definition of deposits/withdrawals for the investments page (i.e., external cash movement, not trades/rebalancing).

## External APIs / integrations

### Existing API: `GET /investments/overview`

- **Current response (backend → frontend):**
  - `InvestmentOverviewResponse`
    - `portfolio.series[]`: date/value points
    - `portfolio.cashflow`: `added_30d`, `withdrawn_30d`, `net_30d`, `added_ytd`, `withdrawn_ytd`, `net_ytd`, `added_12m`, `withdrawn_12m`, `net_12m`
    - `portfolio.growth_12m_ex_transfers`, `portfolio.growth_since_start_ex_transfers`
    - `accounts[]`: per-account series and 12m cashflow/growth
    - `recent_cashflows[]`: recent deposit/withdraw events

### Proposed API extension (required)

To support the redesigned page (including the required contributions-vs-growth chart), extend the response to include:

- Lifetime (“since start”) cashflow totals aligned with the “since start” definition used for growth.
- A cashflow time series suitable for charting contributions over time (portfolio-level; optionally per-account).

- **Proposed additions (backend + frontend schema updates required):**
  - `portfolio.cashflow.added_since_start`, `withdrawn_since_start`, `net_since_start`
  - `portfolio.cashflow_series[]` (monthly buckets recommended): `{ period, added, withdrawn, net }`
  - For each account:
    - `accounts[].cashflow_since_start_added`, `accounts[].cashflow_since_start_withdrawn`, `accounts[].cashflow_since_start_net`
    - `accounts[].growth_since_start_ex_transfers`
    - `accounts[].cashflow_series[]` (optional; only if needed for per-account charts) `ASSUMPTION`

“Since start” definition (decided): earliest of (first snapshot date, first cashflow date).

All-time deposited/withdrawn definition (decided): computed from the same “since start” anchor above (portfolio/account), not from an arbitrary fixed calendar range.

# 7. Step-by-step implementation plan

1. **Audit current `/investments` UI and desired layout**
   - Goal: Establish the exact UI sections to keep/remove from `apps/web/src/pages/investments/investments.tsx`.
   - Files: `apps/web/src/pages/investments/investments.tsx`, `docs/brand.md`.
   - Output: final wireframe-level plan (sections, KPIs, interactions, empty states).

2. **Define the new “time window” model**
   - Goal: Standardize the windows used across KPIs and charts (e.g., `30d`, `YTD`, `12m`, `All`).
   - Files: `apps/web/src/pages/investments/investments.tsx`.
   - Notes:
     - Map UI windows directly to fields available from `overview.portfolio.cashflow` and growth fields.
     - If `All` requires backend extension, gate it behind the optional API change.

3. **Rewrite the portfolio section**
   - Goal: Implement the new header + chart card and KPI layout.
   - Files: `apps/web/src/pages/investments/investments.tsx`.
   - Behavior:
     - Keep using `useInvestmentsApi().fetchOverview()`.
     - Add clear labeling for “Market growth (excl. transfers)” and “Net contributions”.
     - Preserve loading skeletons and error banners.

4. **Replace account cards with a breakdown table**
   - Goal: Provide a dense, scannable per-account breakdown.
   - Files: `apps/web/src/pages/investments/investments.tsx`, `apps/web/src/components/ui/table.tsx` (reuse).
   - Behavior:
     - Table rows show key metrics; values are derived from `overview.accounts[]`.
     - Maintain a good mobile layout (stacked rows or horizontal scroll).

5. **Add right-side account detail Sheet**
   - Goal: Clicking an account opens a sidebar with account chart + metrics.
   - Files: `apps/web/src/pages/investments/investments.tsx`, `apps/web/src/components/ui/sheet.tsx` (reuse).
   - Behavior:
     - Keyboard accessibility: row is focusable; Enter/Space selects.
     - Include a “View transactions” action if needed (ASSUMPTION).

6. **Extend `/investments/overview` with cashflow series + since-start totals**
   - Goal: Support the required contributions-vs-growth chart and consistent “since start” numbers.
   - Backend files:
     - `apps/api/services/investments.py: InvestmentSnapshotService.investment_overview`
     - `apps/api/schemas/investments.py: InvestmentCashflowSummaryRead` (and optionally `InvestmentAccountOverviewRead`)
     - `apps/api/handlers/investments.py: investment_overview`
   - Frontend files:
     - `apps/web/src/types/schemas.ts: investmentCashflowSummarySchema` (and account schema if extended)
     - `apps/web/src/pages/investments/investments.tsx` (render new fields)

7. **Run formatting/linting**
   - Goal: Keep repo quality gates green.
   - Frontend: `npm run format -w apps/web` and `npm run lint -w apps/web`.
   - Backend (if changed): `make format` and `make type-check`.

# 8. Test plan

## Unit tests

- **Backend:**
  - Add/extend integration coverage for `/investments/overview` (cashflow series + since-start totals).
  - Location: `apps/api/tests/integration/test_investments_integration.py`
  - Scenarios:
    - No investment accounts → empty overview structure (already handled in service).
    - Investment accounts + snapshots → non-empty `portfolio.series` and `accounts[].series`.
    - Transfers into/out of investment accounts affect cashflow totals (deposit vs withdrawal).
    - Validate presence and consistency of since-start totals (e.g., `net = added - withdrawn`).
    - Validate cashflow series period ordering and totals (series sums match totals over the same window).

## Integration / end-to-end tests

- **Manual UI validation (frontend):**
  - Run: `npm run dev -w apps/web`
  - Verify on `/investments`:
    - Loading skeletons appear and resolve.
    - Portfolio chart renders from snapshot series; empty state appears when no series.
    - Time window selector updates KPI labels/values.
    - Account breakdown table renders; clicking a row opens the detail Sheet.
    - Sheet “View transaction” navigation (if included) works and closes the sheet.

## Regression checks

- Ensure `FetchInvestmentOverview` still works and error handling is visible (`apps/web/src/features/investments/investmentsSaga.ts`).
- Ensure `GET /investments/overview` remains compatible with the frontend Zod schema (especially if backend extensions are introduced).

# 9. Risks and open questions

## Technical risks

- **Snapshot sparsity:** Investment value series may have few points; charts can look “flat” or misleading. Mitigation: show “As of” + “Last snapshot date” prominently and avoid implying daily continuity.
- **Cashflow attribution:** Cashflow logic intentionally ignores investment-only transactions and internal transfers; users may expect broker “deposits” vs “trades” to be counted differently. Mitigation: explain in UI copy/tooltips what counts as deposits/withdrawals (external cash movement).
- **Account matching by name:** Snapshot payload account names are matched heuristically (`apps/api/services/investments.py: _match_account`); mismatches can skew per-account breakdown. Mitigation: show account names used and allow manual mapping later (out of scope).

## OPEN QUESTION

- Decision: use monthly buckets for the contributions-vs-growth time series (readability + stable aggregation).

## Follow-ups / out-of-scope

- Add a UI flow to upload/parse Nordnet exports and create snapshots (backend endpoints exist, but no frontend flow currently).
- Add per-holding performance and allocation views (requires more robust investment transaction semantics and/or holdings rollups).
