React Hook Form + Zod Adoption
==============================
Goal: full-stack type-safe validation and leaner renders by using react-hook-form with zod resolvers on every user input surface, and zod schemas for every API response wired through `apiFetch`/sagas. Perfect state = zero uncontrolled state shims for forms, all network payloads parsed/guarded, and fewer needless controlled-input re-renders.

Current coverage
- Account modal uses react-hook-form + zod (debt-only requirements handled).
- Response validation via `apiFetch.schema` for: accounts, categories, budgets, transactions (list/recent/create/update), reports (monthly/yearly/quarterly/total/net-worth), subscription summary.

Remaining tasks
- API schemas: add zod schemas for imports (sessions, commits), investments (snapshots list/detail, transactions, metrics, parse/save), goals, settings, cash-flow forecasts, warmup/status, auth/whoami if applicable. Keep number/string money fields tolerant (string | number) and optional/nullability aligned to `types/api.ts`.
- Wire schemas: plug the new schemas into saga calls and any direct `apiFetch` usage (imports, investments, goals, settings, warmup, auth redirects), ensuring decode happens before state updates.
- Form migrations to react-hook-form + zod: categories create/update, budgets CRUD, transactions modal/create flows, goals create/edit, settings profile/theme, imports mapping/commit UI, investments paste/upload/draft edits, subscription inline matcher edits, login/cover forms. Trim/normalize payloads in resolvers and avoid local useState field tracking.
- Type plumbing: reuse `z.infer` types where possible (e.g., list item DTOs) and coerce numeric strings in schemas to reduce downstream casting. Add helpers for common money/date coercion.
- Smoke tests: after each migration, re-run lint/tsc and sanity-click paths for the affected form to ensure no uncontrolled-to-controlled warnings and that API validation errors surface in the UI.
