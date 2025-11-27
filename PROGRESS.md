# Task Handoff – Milestone 5 Prep

## What was done
- Added category icon metadata end-to-end on backend models/schemas/handlers (see `apps/api/models/category.py`, `apps/api/schemas/category.py`, `apps/api/handlers/categories.py`). Tests updated to cover icon create/update (`apps/api/tests/test_category_handlers.py`).
- Introduced budget domain skeleton:
  - Enum `BudgetPeriod` added to `apps/api/shared/enums.py`.
  - Model `Budget` with unique (category_id, period) and amount/note (`apps/api/models/budget.py`).
  - Schemas for create/update/read/list (`apps/api/schemas/budget.py`).
  - Repository (`apps/api/repositories/budget.py`) and service (`apps/api/services/budget.py`).
  - Handlers for list/create/update/delete budgets (`apps/api/handlers/budgets.py`).
  - BudgetService exported in `apps/api/services/__init__.py`.

## Work still incomplete / open questions
- Handlers are not wired into `apps/api/handlers/__init__.py` or any router/serverless config (if applicable). Need to export and hook endpoints.
- No migrations added for new fields/models: category `icon` column and `budgets` table. Alembic migration required.
- No backend tests for budgets: need handler tests (CRUD + validation + 404), repository/service coverage.
- Frontend untouched for categories icon or budgets:
  - Types (`apps/web/src/types/api.ts`) lack `icon` on Category and all budget interfaces; slices/sagas remain fetch-only for categories and nonexistent for budgets.
  - UI pages for category management and budgets not built; sidebar/routes still omit Budgets page.
- Reporting/logic integration for budgets (progress/rollups) not implemented.
- Data validation: budget amount > 0 enforced in schema, but service does not guard against duplicate unique constraint errors—consider user-friendly 400.

## Suggested next steps
1) Add Alembic migration for `categories.icon` and `budgets` table.
2) Export budget handlers in `apps/api/handlers/__init__.py` and wire into API routing/serverless if needed.
3) Add pytest coverage for budget handlers/service/repo (CRUD, validation, 404) and for category icon passthrough.
4) Frontend: extend Category type/slice/saga for icon; add Budget types + slice/sagas/selectors; build Budgets UI and Category management UI per Milestone 5 checklist.
5) Consider error handling for unique (category_id, period) constraint and map DB errors to 400.

## Docs/files to digest before continuing
- `docs/tasks.md` – Milestone 5 checklist and expectations.
- `docs/info.md` & `docs/brand.md` – product scope, principles, and UI/brand guidelines.
- `docs/data-management/data-management-spec.md` – domain model rules for categories/transactions/reporting.
- Current backend files touched: `apps/api/models/category.py`, `apps/api/models/budget.py`, `apps/api/schemas/category.py`, `apps/api/schemas/budget.py`, `apps/api/services/budget.py`, `apps/api/repositories/budget.py`, `apps/api/handlers/budgets.py`.
- Frontend starting points: `apps/web/src/types/api.ts`, categories slice/saga (`apps/web/src/features/categories`), and routing/nav (`apps/web/src/data/routes.ts`, `apps/web/src/components/app-sidebar.tsx`).
