# Finance Tracker – Agent Guide

Purpose-built notes for automation agents working on this repo. Assume you often have full filesystem and network access; follow these steps every time.

## Ground Rules

- Use the context7 MCP to pull up-to-date docs for libraries/services (shadcn/Radix UI, Vite/React 19, Redux Toolkit/Saga, AWS Amplify, Terraform, etc.) instead of relying on memory.
- Default to least surprise: avoid destructive commands; if unsure about user intent, ask.
- AWS: when running AWS/Terraform/Serverless CLI commands, use profile `Personal` (matches `Makefile` defaults) and region `eu-north-1` unless told otherwise.
- Frontend: ship visually pleasing, modern UI—lean on shadcn/Radix patterns, strong empty/loading states, intentional color/typography choices (see brand docs) rather than defaults.

## Repo Snapshot

- Frontend: `apps/web` (Vite + React 19 + TS + Tailwind + Redux Toolkit/Saga, shadcn/Radix UI). Scripts: `npm run dev|build|lint|format|preview -w apps/web`.
- Backend/API: `apps/api` (Python 3.13, SQLModel/SQLAlchemy, Pydantic). Quality tools via `make type-check`, formatting via `make format`.
- Infra: `infra/terraform` with `Makefile` targets (`tf-*`) plus Serverless layers/API deploys.

## Frontend Stack & Usage

- Structure: `apps/web/src/pages` (route screens via `react-router`), `components/ui` (shadcn-style Radix primitives + Tailwind), `features` (Redux Toolkit slices + sagas), `lib|hooks|types` (helpers, shared hooks, DTOs).
- Styling/layout: Tailwind 4 + `tailwindcss-animate`, `clsx`/`tailwind-merge` + `class-variance-authority` for variants; prefer existing utility patterns over ad-hoc CSS.
- UI primitives: Lean on Radix UI components already installed (`dialog`, `dropdown-menu`, `tabs`, `tooltip`, `switch`, etc.) and lucide-react icons; favor accessibility-first patterns before adding new deps.
- Forms & validation: `react-hook-form` + `zod` schemas via `@hookform/resolvers`; keep schemas alongside form modules and derive types from `zod.infer` to avoid manual DTOs.
- State/data: Redux Toolkit for slices/selectors, `redux-saga` for side effects (auth, warmup, settings, data fetches); reuse typed hooks `useAppDispatch`/`useAppSelector`.
- Motion: `framer-motion` for purposeful, light transitions (page/section entrances, list reorders, dialog/sheet open); avoid heavy/parallax effects—keep durations/snappiness aligned with existing patterns.
- Visualization/UX: `recharts` for charts, `@tanstack/react-virtual` for large lists, `sonner` for toasts, `next-themes` for theme toggles; prefer these before adding alternatives.

## Backend Stack & Usage

- Structure: `handlers` (entrypoints), `services` (business logic), `repositories` (DB access), `models` (SQLModel/SQLAlchemy tables), `schemas` (Pydantic request/response models), `jobs` (scheduled/background), `shared` (cross-cutting utilities), `migrations` (Alembic).
- Validation/contracts: Pydantic drives input/output schemas; align service/repository boundaries with these models to keep type-safety and validation centralized.
- Patterns: Keep SQLModel models thin; map to Pydantic schemas for API IO; keep side effects inside services/repositories, not handlers; reuse existing auth/settings utilities under `shared`.

## Required Workflow for Any Change

- Understand & plan: skim relevant code, confirm entrypoints, capture assumptions.
- Implement: keep changes minimal and commented only when non-obvious.
- **Always run formatting and linting before finishing**:
  - Frontend: `npm run format -w apps/web` then `npm run lint -w apps/web`.
  - Backend: `make format` then `make type-check` (runs isort/black/pylint/pyright/mypy).
- Validate: run targeted tests when touched areas have coverage (e.g., `pytest apps/api/tests` or component-level checks as applicable).
- Summarize: report what changed, commands run, and remaining risks/todos.

## Access & Safety Notes

- Assume you may have full access; still avoid global/destructive operations (e.g., resetting user changes).
- Keep secrets out of logs/commits; redact PII in examples.
- Infrastructure toggles: `make tf-enable-public-db` / `make tf-disable-public-db` change DB exposure—use cautiously.

## Quick Command Reference

- Dev server: `npm run dev -w apps/web`
- Format/lint (frontend): `npm run format -w apps/web` && `npm run lint -w apps/web`
- Format/type-check (backend): `make format` && `make type-check`
- Tests (backend): `pytest apps/api/tests`
- Terraform helpers: `make tf-plan` / `make tf-apply` / `make tf-destroy` (profile `Personal`)

If something seems off or unsafe, pause and ask for direction before proceeding.
