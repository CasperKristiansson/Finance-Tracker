# Ventures M5 Handoff Prompt

You are working in `/Users/casperkristiansson/programming/Finance-Tracker`.
Start by reading and following:

- `/Users/casperkristiansson/programming/Finance-Tracker/AGENTS.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-implementation-plan.html`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-m4-handoff-prompt.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/brand.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/info.md`

Also inspect these reference images before building:

- `/Users/casperkristiansson/Desktop/inspiration/4.png` for the annual valuation bottom sheet direction.
- `/Users/casperkristiansson/Desktop/inspiration/5.png` for the add-company bottom sheet and live node preview direction.
- `/Users/casperkristiansson/Desktop/inspiration/9.png` for the edit-ownership bottom sheet direction.
- `/Users/casperkristiansson/Desktop/inspiration/2.png` and `/Users/casperkristiansson/Desktop/inspiration/3.png` for where actions are launched from.

Treat the images as visual direction, not literal requirements. If an image shows fields or buttons that conflict with the product decisions below, follow the product decisions and implement useful functionality instead of copying the sketch.

## Goal

Implement M5: the real create/edit mutation flows for Ventures.

M1 provides backend/contracts. M2 provides the frontend data layer. M3 provides the `/ventures` graph and selected-company bottom panel. M4 provides the read-only `/ventures/:companyId` workspace overview. M5 should make the primary visible actions work end-to-end.

## Product Constraints

- Venture paper values stay inside Ventures only. Do not sync them into dashboard net worth, investments, reports, or existing account views.
- Keep paper value, risk-adjusted value, realized value, and liquidity distinct.
- Risk-adjusted value is computed from paper value and haircut percentage. The UI should preview that calculation before submitting valuation forms.
- Consulting or operating companies may use `account_balance_sync` valuation mode with linked accounts, but the resulting value still belongs only to Ventures.
- Logos and documents must use S3-backed storage through presigned URLs. Do not store file contents in the database.
- Holding-company ownership must be supported. A company can own another company.
- Do not create a standalone Lessons model or tab. Notes with tags are the correct mechanism.
- Desktop is the target. Avoid broken overflow, but do not spend milestone time on mobile-specific UX.

## Scope

Build the flows below using the existing Redux/Saga actions, generated contract types, and repo UI patterns. Use `react-hook-form` plus `zod` where form validation is useful.

### 1. Add Company Flow

- Add a real "Add company" action from `/ventures`.
- Use a bottom sheet, not a route change.
- Capture: company name, legal name, description, company type, status, role, valuation mode, industry/stage/country, founded/joined dates, node color, initial ownership, and optional initial valuation.
- Support logo upload, logo replacement, and logo removal:
  - Request a presigned URL with `presignVentureUpload` using `purpose: "logo"`.
  - Upload the file to the returned URL.
  - Submit `logo_storage_key`, `logo_file_name`, and `logo_content_type` with `createVentureCompany`.
  - Show an initials fallback when no logo is selected.
- For `account_balance_sync`, let the user select linked accounts and submit `account_links`. Reuse existing account data/hooks where practical.
- Include a live node preview that reflects name, status, color/logo/initials, ownership, and paper/risk-adjusted value.
- After success, refresh overview data and close the sheet. The new company should appear in the graph.

### 2. Add Annual Valuation Flow

- Add a real "Add valuation" action from the selected-company bottom panel and the company workspace.
- Use a bottom sheet.
- Capture: event date, label, event type, paper value SEK, haircut percentage, realized value SEK, valuation source, liquidity level, confidence score, note, and linked document IDs when available.
- Show a before/after preview using the current latest valuation and the form values.
- Compute and display risk-adjusted value as `paper value * (1 - haircut / 100)`.
- Submit through `createVentureValuation`.
- After success, refresh both the selected company detail and overview data.

### 3. Edit Ownership Flow

- Add a real "Edit ownership" action from the selected-company bottom panel and the company workspace.
- Use a bottom sheet.
- Capture: owner type, owner company when owner type is company, effective date, reason, direct ownership, fully diluted ownership, shares owned, total shares, share class, voting rights, invested capital, option/warrant notes, note, and linked document IDs when available.
- Support holding-company structures by listing other venture companies as possible owners.
- Prevent self-ownership in the UI.
- Show current vs new ownership and a simple before/after paper-value impact preview.
- Submit through `createVentureOwnershipEvent`.
- After success, refresh both the selected company detail and overview data.

### 4. Add/Edit Note Flow

- Add real "Add note" and "Edit note" actions where notes are shown in M3/M4.
- Use the existing note endpoints: `createVentureNote` and `updateVentureNote`.
- Capture: title, Markdown body, tags, pinned flag, note date, optional linked timeline event, and optional linked documents.
- Render Markdown previews with `react-markdown` and `remark-gfm`.
- Include small formatting helpers for headings, lists, bold, italic, and links if practical; a textarea editor is acceptable for M5.
- Do not add a lessons-specific entity. If a note is a lesson/reflection, it should just use tags like `lesson` or `reflection`.
- After success, refresh the relevant company detail and notes list.

## Integration Requirements

- Any visible mutation button must be fully wired, disabled with a clear reason, or hidden.
- Reuse generated contract request/response types from `apps/web/src/types/contracts.ts`; do not hand-write duplicate DTOs.
- Keep mutations in existing Ventures Saga/API flow unless there is a concrete reason to change it.
- Use existing shadcn/Radix primitives and the current Ventures visual language.
- Surface operation-specific loading and error states. Do not rely only on global toasts.
- Use `sonner` to confirm successful create/update actions where it fits existing app behavior.
- Keep optimistic UI conservative. Prefer submit, refresh, then close/update.
- Do not implement full Timeline, Notes, or Documents tabs from M6 beyond what is needed for these mutation flows.
- Do not implement document preview. Upload/download and metadata are enough for first build.

## Suggested Files

Use or adapt these paths:

- `apps/web/src/pages/ventures/ventures.tsx`
- `apps/web/src/pages/ventures/company-workspace.tsx`
- `apps/web/src/pages/ventures/components/company-bottom-panel.tsx`
- `apps/web/src/pages/ventures/components/add-company-sheet.tsx`
- `apps/web/src/pages/ventures/components/valuation-event-sheet.tsx`
- `apps/web/src/pages/ventures/components/ownership-event-sheet.tsx`
- `apps/web/src/pages/ventures/components/venture-note-sheet.tsx`
- `apps/web/src/pages/ventures/components/logo-upload-field.tsx`
- `apps/web/src/pages/ventures/utils/format.ts`
- `apps/web/src/hooks/use-api.ts`
- `apps/web/src/features/ventures/venturesSaga.ts`
- `apps/web/src/features/ventures/venturesSlice.ts`

If backend gaps block real functionality, keep changes minimal and update:

- `apps/api/schemas/ventures.py`
- `apps/api/handlers/ventures.py`
- `apps/api/services/ventures.py`
- `apps/api/repositories/ventures.py`
- `apps/api/contracts/http.py`
- `infra/serverless/serverless.yml`
- Generated contracts via `npm run generate:api-contracts`

## Validation

Run the required frontend checks:

- `npm run format -w apps/web`
- `npm run lint -w apps/web`
- `npm run build -w apps/web`

If you touch backend routes, schemas, repositories, services, migrations, Serverless, or contracts, also run:

- `npm run generate:api-contracts`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make format`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make type-check`
- Targeted backend tests for the changed service/handler paths.

Smoke the UI in the in-app browser:

- `/ventures`: open add company, validate required fields, create a company if an authenticated test session is available, and verify the graph refreshes.
- `/ventures/:companyId`: open add valuation, edit ownership, and add/edit note. Verify validation, loading states, successful refresh, and no console errors.
- Verify there are no dead action buttons.
- Verify venture paper values remain clearly labeled as venture-only and excluded from main net worth.

Report exactly what changed, what passed, what could not be smoke-tested because of auth/environment limits, and any remaining risks.
