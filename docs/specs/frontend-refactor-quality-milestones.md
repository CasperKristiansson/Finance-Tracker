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

- [x] M2: Split `TotalDrilldownDialog` by “kind” renderers
  - Goal: Reduce the complexity of `apps/web/src/pages/reports/components/total-drilldown-dialog.tsx` by extracting per-kind UI sections into focused components.
  - Deliverables:
    - ✅ New folder: `apps/web/src/pages/reports/components/total-drilldown/` with components:
      - `category-source-panel.tsx` (category/source branch)
      - `account-panel.tsx`
      - `year-panel.tsx`
      - `investments-panel.tsx`
      - `debt-panel.tsx`
      - `net-worth-panel.tsx`
    - ✅ Kept the dialog “shell” (open/close, title, error surfaces) and shared memos (e.g. anomaly detection) in the entry component.
    - ✅ Added per-kind storybook smoke coverage and manual sanity checks for drilldown navigation.
  - Acceptance criteria:
    - ✅ `total-drilldown-dialog.tsx` now acts as a thin orchestrator that wires state and delegates rendering to the per-kind panels.
    - ✅ No visual/behavioral regressions in any drilldown kind (`category`, `source`, `account`, `year`, `investments`, `debt`, `netWorth`); parity verified via manual QA on the reports page.
  - Affected services/components (high level): Reports page drilldowns + charts/tables in the dialog.
  - Blockers (OQ-xx): None
  - Status notes:
    - Dialog file size was reduced substantially by moving per-kind UI to the new folder, improving readability and reviewability.
    - Follow-up hygiene: keep new panels colocated with shared hooks/utils inside `total-drilldown/` as future tweaks arise.

- [x] M3: Split `Reports` page into route orchestration + mode subpages
  - Goal: Make `apps/web/src/pages/reports/reports.tsx` primarily an orchestration layer by separating “total” and “yearly” mode logic/UI.
  - Deliverables:
    - ✅ Extracted route parsing + shared state into `apps/web/src/pages/reports/hooks/use-reports-route.ts`, keeping the URL contract unchanged while centralizing query/param parsing and feature-flag checks.
    - ✅ Created “total” and “yearly” subpage components:
      - `apps/web/src/pages/reports/total/total-reports-page.tsx`
      - `apps/web/src/pages/reports/yearly/yearly-reports-page.tsx`
    - ✅ Kept `Reports` as the stable route entry, responsible only for loading guards and delegating render to the matching subpage based on `mode`.
  - Acceptance criteria:
    - ✅ A developer can navigate the code by “mode” without scanning the entire file; each subpage co-locates its charts, tables, and view-model helpers.
    - ✅ Side-effect boundaries are clearer: `useReportsRoute` owns route validation + navigation helpers; subpages own data derivation/rendering.
    - ✅ No route behavior changes (URLs and navigation remain compatible) validated via manual QA of deep links and mode toggles.
  - Affected services/components (high level): `apps/web/src/pages/reports/reports.tsx`, `apps/web/src/pages/reports/hooks/use-reports-route.ts`, `apps/web/src/pages/reports/total/*`, `apps/web/src/pages/reports/yearly/*`.
  - Blockers (OQ-xx): None
  - Status notes:
    - Reports entry file is now ~⅓ smaller and reads as orchestration: imports → route state via `useReportsRoute` → subpage selection.
    - Follow-up hygiene: keep shared report helpers in `hooks/` or `components/` and avoid mode-specific logic leaking back into `reports.tsx`.

- [x] M4: Move “data shaping” out of JSX across report dialogs/cards
  - Goal: Reduce JSX noise and make chart/table preparation testable and readable.
  - Deliverables:
    - ✅ Replaced inline `map`/transformations in reports cards with memoized view-model helpers (e.g. `categoryRows`/`cells` in `total-category-by-year-card.tsx`, `categoryData` in `total-lifetime-categories-card.tsx`).
    - ✅ Introduced explicit view-model types for chart/table data and derived metrics (share %, YoY deltas, tooltip payloads) to keep render blocks focused on markup.
  - Acceptance criteria:
    - ✅ Chart components now render pre-shaped data and avoid deep transformation logic inside JSX, improving readability and testability.
    - ✅ Memo dependencies are explicit, and derived computations (heatmap shares, deltas, drilldown payloads) are centralized for reuse across tooltips/click handlers.
  - Affected services/components (high level): Reports cards + dialogs (especially drilldowns).
  - Blockers (OQ-xx): None
  - Status notes:
    - Heatmap cells, tooltip payloads, and drilldown parameters are computed via `useMemo`, reducing render churn and clarifying dependencies.
    - Future work: extend the same pattern to remaining charts/tables when adding new drilldown kinds or data series.

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
  - Status notes:
    - Accounts list page now uses page-local `components/` and `utils.ts` for header, reconciliation banner, account health, and icon/format helpers, reducing top-level JSX noise.
    - Remaining work: apply the same pattern to Loans, Dashboard, and the Account detail page.

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

- [x] M7: Add shared “composed UI” blocks (not new primitives)
  - Goal: Reduce repeated UI patterns (empty/error/loading/headers/confirm flows) without wrapping shadcn/Radix primitives just for naming.
  - Deliverables (only introduce when used in 3+ places):
    - ✅ `EmptyState` (icon + title + description + action) adopted across report cards (composition, lifetime categories, category mix) and ready for reuse in other pages.
    - ✅ `InlineError` (compact error surface with optional retry) used for drilldown errors and account transaction fetch errors.
    - Loading/Header/Confirm blocks remain optional; reuse existing shadcn/Radix primitives where they already fit.
  - Acceptance criteria:
    - ✅ Pages stop inlining bespoke “no data” and “error” boxes; use shared blocks where appropriate.
    - ✅ Shared blocks remain composition-level (use existing `components/ui/*` primitives internally).
  - Affected services/components (high level): Large pages and dialogs across `apps/web/src/pages/**`.
  - Blockers (OQ-xx): None
  - Status notes:
    - Empty/error surfaces now share styling and semantics; future pages should reach for these blocks before inlining new ad-hoc divs.

- [ ] M8: Consolidate chart containers and chart conventions
  - Goal: Reduce drift and boilerplate around charts (headers, actions, loading, empty states, tooltip formatting, axis styling).
  - Deliverables:
    - Consolidate the “chart card” pattern into a single shared component (there is already `apps/web/src/pages/reports/components/chart-card.tsx`, and Dashboard has a page-local `ChartCard`).
    - Establish a small set of chart conventions used everywhere (tooltip content, empty-state message, axis label formatting helpers).
  - Acceptance criteria:
    - Dashboard and Reports use the same chart container and styling conventions.
    - Chart-related formatting helpers come from the shared formatting milestone (M1) or a dedicated chart utils module (kept small).
  - Affected services/components (high level): `apps/web/src/pages/dashboard/*`, `apps/web/src/pages/reports/components/*`, other chart-heavy pages.
  - Blockers (OQ-xx): Decide whether to keep one container or allow minor per-page variants.

- [ ] M9: Standardize “table in a card” wrappers (scroll + truncation)
  - Goal: Reduce repeated table scaffolding (border/header/scroll/truncation) and make large tables consistent and easier to read.
  - Deliverables:
    - A small wrapper component for “carded tables” used in dialogs/cards (header row + scroll container + optional footer/action).
    - Consistent truncation patterns for long labels (e.g. account/category names) and consistent empty states.
  - Acceptance criteria:
    - Reports dialogs stop repeating `max-h-* overflow-auto rounded-md border ...` blocks inline.
    - Table layouts remain accessible and responsive (headers readable; columns consistent).
  - Affected services/components (high level): Reports dialogs (notably drilldowns), other pages with repeated table cards.
  - Blockers (OQ-xx): None

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
2. **M7 (composed UI blocks)** early: reduces repeated UI scaffolding and improves consistency quickly.
3. **M8/M9 (chart + table conventions)** early-to-mid: cuts a lot of repeated JSX once formatting is standardized.
4. **M2 (TotalDrilldownDialog split)** next: biggest localized complexity payoff.
5. **M3 (Reports page by mode)** to make future reports changes easier.
6. **M4 (data shaping)** as follow-up: makes charts/cards more maintainable once structure is improved.
7. **M5 (apply pattern to other pages)** incrementally, one page at a time.
8. **M6 (API boundary standardization)** once the team agrees on the preferred direction.

# 4. “Definition of done” metrics (lightweight)

Suggested heuristics to validate impact without over-engineering:
- Reduce top offender files by meaningful margins (e.g. >30–50%) while keeping good locality (new files live under the page folder).
- Eliminate duplicated formatting functions across `pages/`.
- Reduce JSX transformation density: chart/table components should mostly “render”, not “compute”.
- Keep imports stable and predictable (avoid circular/hidden dependencies).
