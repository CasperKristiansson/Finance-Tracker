Zod-Only Typing Plan (api.ts Decommission)
=========================================

Objective: remove duplicated TS interfaces in `apps/web/src/types/api.ts` and rely on Zod schemas + `z.infer` for all DTOs, while keeping enums and request-shape helpers where needed.

Steps
- Inventory: list all consumers of `api.ts` types (sagas, hooks, pages). Note which types are request-only (keep) vs read/response (migrate to Zod).
- Schema coverage: ensure `schemas.ts` exports Zod definitions for every API payload (requests and responses). Add shared coercers (money/date/nullable-number) and reuse them.
- Type aliases: replace `api.ts` read/response interfaces with `export type X = z.infer<typeof xSchema>` in `schemas.ts` (or a new `types.ts` co-located) and update imports across the app to use the inferred types.
- Requests: for request payloads, either add Zod schemas (with `.parse` before send) or keep minimal TS types if validation is handled by forms; prefer schemas for consistency.
- Enums/constants: keep enums in a small module (can stay in `api.ts` or split to `enums.ts`) and import into schemas via `z.nativeEnum`/`z.enum`.
- Cleanup: after replacements, delete unused interfaces from `api.ts`; run `npm run lint -w apps/web` + `npm run format -w apps/web` and fix import paths.
- Verification: run targeted flows to ensure type imports resolve and response decoding uses schemas everywhere; watch for drift or any unchecked `any`.
