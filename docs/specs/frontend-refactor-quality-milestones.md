# 0. Milestones

This spec is a refactor roadmap (recommendations only). It focuses on reducing complexity in the largest screens and improving code quality without over-componentizing.

- [ ] M1: Standardize shared formatting utilities
  - Goal: Remove duplicated currency/date/percent formatting helpers across pages and make formatting consistent.
  - Deliverables:
    - New shared module (suggested: `apps/web/src/lib/format.ts`) exporting currency/compact currency/percent + common date labels.
    - Replace local copies in key hotspots (at least Dashboard + Loans + Reports).
  - Acceptance criteria:
    - No duplicated implementations of `currency`/`compactCurrency` remain in `apps/web/src/pages/**`.
    - Date formatting helpers are used instead of repeated `toLocaleDateString("sv-SE", …)` blocks in reports dialogs.
    - Formatting output is unchanged for existing screens.
  - Affected services/components (high level): `apps/web/src/pages/dashboard/*`, `apps/web/src/pages/loans/*`, `apps/web/src/pages/reports/*`.
  - Blockers (OQ-xx): None

- [ ] M2: Split `TotalDrilldownDialog` by “kind” renderers
  - Goal: Reduce the complexity of `apps/web/src/pages/reports/components/total-drilldown-dialog.tsx` by extracting per-kind UI sections into focused components.
  - Deliverables:
    - New folder (suggested): `apps/web/src/pages/reports/components/total-drilldown/` with components like:
      - `category-source-panel.tsx` (category/source branch)
      - `account-panel.tsx`
      - `year-panel.tsx`
      - `investments-panel.tsx`
      - `debt-panel.tsx`
      - `net-worth-panel.tsx`
    - Keep the dialog “shell” (open/close, title, error surfaces) and shared memos (e.g. anomaly detection) in the entry component.
  - Acceptance criteria:
    - `total-drilldown-dialog.tsx` becomes a thin orchestrator (e.g. < ~250–350 LOC is a good target).
    - No visual/behavioral regressions in any drilldown kind (`category`, `source`, `account`, `year`, `investments`, `debt`, `netWorth`).
  - Affected services/components (high level): Reports page drilldowns + charts/tables in the dialog.
  - Blockers (OQ-xx): None

- [ ] M3: Split `Reports` page into route orchestration + mode subpages
  - Goal: Make `apps/web/src/pages/reports/reports.tsx` primarily an orchestration layer by separating “total” and “yearly” mode logic/UI.
  - Deliverables:
    - Extract route parsing + shared state into a hook (suggested: `apps/web/src/pages/reports/hooks/use-reports-route.ts`).
    - Create `total` and `yearly` subpage components (suggested folders):
      - `apps/web/src/pages/reports/total/total-reports-page.tsx`
      - `apps/web/src/pages/reports/yearly/yearly-reports-page.tsx`
    - Keep `Reports` as the stable route entry that selects which subpage to render.
  - Acceptance criteria:
    - A developer can navigate the code by “mode” without scanning the entire file.
    - Side-effect boundaries are clearer: route validation, data loading, and derived analysis are separated and named.
    - No route behavior changes (URLs and navigation remain compatible).
  - Affected services/components (high level): `apps/web/src/pages/reports/reports.tsx` and adjacent reports components/hooks.
  - Blockers (OQ-xx): None

- [ ] M4: Move “data shaping” out of JSX across report dialogs/cards
  - Goal: Reduce JSX noise and make chart/table preparation testable and readable.
  - Deliverables:
    - Replace inline IIFEs and large `map` transformations inside JSX with:
      - `useMemo` blocks producing `chartData`/`rows` arrays, or
      - small pure functions in `reports-utils`/local `utils.ts`.
    - Prefer explicit types for “view models” used by charts/tables (e.g. `type NetWorthSeriesPoint = { ... }`).
  - Acceptance criteria:
    - Chart components primarily render prepared `data` arrays and don’t contain deep transformation logic.
    - Derived computations have stable memo dependencies and are easy to follow.
  - Affected services/components (high level): Reports cards + dialogs (especially drilldowns).
  - Blockers (OQ-xx): None

- [ ] M5: Adopt “page-local modules” pattern for other large pages
  - Goal: Apply the same proven structure used in `pages/reports/` to other multi-thousand-line pages without fragmenting UI into tiny components.
  - Deliverables:
    - For each target page, introduce a page-local `components/` and (optionally) `hooks/` folder and extract cohesive sections:
      - `apps/web/src/pages/loans/` (largest page; has multiple concerns: charts, schedule, dialogs, tables, parsing/formatting)
      - `apps/web/src/pages/dashboard/` (extract reusable page components like `ChartCard`, “Recent transactions” section, etc.)
      - `apps/web/src/pages/accounts/` (`account.tsx` is large; split detail panels/dialogs/table sections)
    - Move page-only helpers (e.g. “render icon” helpers) into `pages/<page>/utils.ts` rather than `lib/` unless reused elsewhere.
  - Acceptance criteria:
    - The main page file reads as: imports → state/hooks → derived data → render layout.
    - New files are grouped by page scope; shared code only moves up to `components/` or `lib/` when reused.
  - Affected services/components (high level): `apps/web/src/pages/loans/*`, `apps/web/src/pages/dashboard/*`, `apps/web/src/pages/accounts/*`.
  - Blockers (OQ-xx): None

- [ ] M6: Standardize client API access and schema validation boundaries
  - Goal: Reduce mixed patterns where pages call `apiFetch` directly while other flows go through sagas/hooks, and centralize schema validation.
  - Deliverables (pick one approach, avoid mixing):
    - Option A (service modules): Introduce `apps/web/src/services/*` modules that own `apiFetch` + zod schema parsing and are used by both sagas and components.
    - Option B (saga-only): Move remaining direct `apiFetch` calls into feature sagas and keep components “data-source agnostic”.
  - Acceptance criteria:
    - Each API endpoint has one obvious “front door” on the client side.
    - Schema selection/parsing lives next to the endpoint definition, not scattered across pages.
  - Affected services/components (high level): Reports/Dashboard pages, `apps/web/src/hooks/use-api.ts`, feature sagas.
  - Blockers (OQ-xx): Decide which option fits the repo’s direction.

# 1. Background and motivation

The frontend has several extremely large route screens (1k–2k+ LOC) and at least one very large dialog component. The symptoms are:
- difficult navigation/review (large diffs, lots of scroll),
- duplicated helpers (formatting, labels),
- heavy data transformation inside JSX, and
- mixed data-fetching patterns.

This spec proposes refactors that keep the UI stable and reduce cognitive load by introducing clear boundaries: “route orchestration”, “analysis/data shaping”, and “rendering”.

# 2. Goals / non-goals

## Goals
- Reduce file size and cognitive complexity of the largest pages and dialogs.
- Improve consistency (formatting, date labels, error/loading handling patterns).
- Keep module boundaries aligned with the domain (reports/yearly/total; drilldown kinds).
- Avoid “over-componentization”: extract cohesive sections, not every `div`.

## Non-goals
- No feature changes, visual redesign, or routing changes.
- No broad state-management rewrite (Redux Toolkit + sagas remain).
- No new dependencies unless clearly justified.

# 3. Suggested sequencing (practical roadmap)

1. **M1 (format helpers)** first: safe, mechanical change; reduces noise in every later refactor.
2. **M2 (TotalDrilldownDialog split)** next: biggest localized complexity payoff.
3. **M3 (Reports page by mode)** to make future reports changes easier.
4. **M4 (data shaping)** as follow-up: makes charts/cards more maintainable once structure is improved.
5. **M5 (apply pattern to other pages)** incrementally, one page at a time.
6. **M6 (API boundary standardization)** once the team agrees on the preferred direction.

# 4. “Definition of done” metrics (lightweight)

Suggested heuristics to validate impact without over-engineering:
- Reduce top offender files by meaningful margins (e.g. >30–50%) while keeping good locality (new files live under the page folder).
- Eliminate duplicated formatting functions across `pages/`.
- Reduce JSX transformation density: chart/table components should mostly “render”, not “compute”.
- Keep imports stable and predictable (avoid circular/hidden dependencies).

