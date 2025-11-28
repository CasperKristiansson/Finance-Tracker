# Finance Tracker – Overview

## Purpose
- Private-first personal finance tracker to replace spreadsheets with a trustworthy ledger, reporting, and budgeting experience.
- Support manual entry and bulk imports from bank exports (CSV/XLSX) with per-bank templates.
- Deliver clear reporting (month/quarter/year), net worth tracking, and loan awareness.

## Audience
- Data-conscious individuals managing their own finances (single-tenant).
- Users who already track in spreadsheets and want better accuracy, speed, and visuals.
- Comfortable with uploading bank exports; expect transparency and auditability.

## Value Proposition
- Double-entry backbone for accuracy; loan-aware ledger; category and budget controls.
- Fast insights: cash flow, category breakdowns, net worth trend, savings rate.
- Import-friendly: map bank exports once, reuse templates, review/flag imported rows.

## Scope (near-term)
- Accounts, transactions, categories, budgets, imports, reports, loans.
- Auth via Cognito; web UI with shadcn/Radix components; API layer in Python/SQLModel.
- Single currency (SEK) and single user.

## Non-Goals (for now)
- Multi-tenant, multi-currency, live bank sync, investment performance analytics, tax optimization.

## Principles
- Accuracy first: balanced legs, clear statuses (imported/reviewed/flagged), reproducible reports.
- Transparency: show errors inline; surface “as of” dates; expose import batches.
- Speed to insight: defaults for date ranges, quick filters, sensible empty states.
- Reuse components: prefer shadcn/Radix patterns; consult context7 MCP for current docs before custom work.

## Tech Snapshot
- Frontend: Vite + React 19 + TS + Tailwind + Redux Toolkit/Saga; shadcn + Radix UI; Recharts.
- Backend: Python (SQLModel/SQLAlchemy), Pydantic schemas, REST handlers for accounts/categories/transactions/loans/reporting; materialized views for reporting; loan accrual job.
- Infra: Terraform for Aurora (private by default with optional public toggle for local dev) and Cognito for auth.

## Privacy & Security Posture
- Single-tenant; bank files are user-provided. Avoid storing more than needed; document retention for imports.
- Auth via Cognito; bearer tokens to API. Prefer HTTPS only and least-privileged DB access.
- Respect PII: limit logging of descriptions/notes; redact sensitive fields in errors/logs.

## UX Notes
- Modern, data-forward UI (see brand.md): high legibility, chart-driven dashboards, strong empty/loading states, toasts for feedback.
- Imports: guided stepper with bank choice (Circle K Mastercard, SEB, Swedbank), XLSX-only; clear mapping preview; downloadable error report; status badges in tables.
- Accessibility: keyboard reachability, focus outlines, contrast targets (WCAG AA).
