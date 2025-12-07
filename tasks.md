# React Hook Form + Zod Adoption – Remaining Work

Goal: finish end-to-end migration to `react-hook-form` + `@hookform/resolvers/zod` with runtime-validated API responses and fewer controlled re-renders.

Open tasks

- Imports UI: migrate file mapping/commit overrides to RHF + zod; trim payloads before POST; decode import session/list responses with schemas everywhere.
- Investments flows: move paste/upload/draft edit forms to RHF + zod; ensure parse/save/metrics/transactions responses use schemas and normalized numeric coercion.
- Auth/whoami/warmup: add whoami/auth session schema (if backend available) and validate redirects; ensure warmup/status UI uses RHF where applicable and surfaces schema errors.
- Subscriptions: extend matcher form to cover inline create/edit flows if any; reuse `z.infer` types to reduce interface/schema drift.
- Verification: after each migration, run `npm run lint -w apps/web` and sanity-click the migrated forms to confirm no uncontrolled warnings and API validation errors appear.\*\*\* End Patch
