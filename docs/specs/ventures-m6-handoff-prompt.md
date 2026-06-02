# Ventures M6 Handoff Prompt

You are working in `/Users/casperkristiansson/programming/Finance-Tracker`.
Start by reading and following:

- `/Users/casperkristiansson/programming/Finance-Tracker/AGENTS.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-implementation-plan.html`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-m5-handoff-prompt.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/brand.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/info.md`

Also inspect these reference images before building:

- `/Users/casperkristiansson/Desktop/inspiration/6.png` for the full timeline tab direction.
- `/Users/casperkristiansson/Desktop/inspiration/7.png` for the notes/reflection direction. Do not create a separate Lessons model or tab.
- `/Users/casperkristiansson/Desktop/inspiration/8.png` for the documents tab direction.
- `/Users/casperkristiansson/Desktop/inspiration/3.png` for the company workspace shell and tab context.

Treat the images as visual direction, not literal requirements. Every visible control must either work, be clearly disabled with a reason, or be omitted.

## Goal

Implement M6: the full Timeline, Notes, and Documents tabs inside `/ventures/:companyId`.

M1-M2 provide backend/contracts and frontend data plumbing. M3 provides the graph and selected company panel. M4 provides the company workspace overview. M5 wires create/edit mutation sheets. M6 should turn the disabled workspace tabs into useful, real data views and add first-build document upload/download management.

## Product Constraints

- Venture paper values stay inside Ventures only. Do not sync them into dashboard net worth, investments, reports, or existing account views.
- Keep paper value, risk-adjusted value, realized value, and liquidity distinct.
- Do not create a standalone Lessons model, Lessons tab, or lesson-specific backend entity. Use notes with tags such as `lesson`, `reflection`, `risk`, `fundraising`, `board`, or `strategy`.
- Documents are evidence for companies, valuations, ownership events, notes, and timeline events. They are not just decorative file cards.
- Logos and documents must use S3-backed storage through presigned URLs.
- Document preview is out of scope. Upload, download, metadata, health, filtering, and delete are enough.
- Desktop is the target. Avoid mobile-specific work beyond preventing broken overflow.

## Scope

### 1. Enable Workspace Tabs

- In `/ventures/:companyId`, enable the existing tabs:
  - Overview
  - Timeline
  - Valuation
  - Notes
  - Documents
- Keep the Overview tab from M4 intact, but make any action buttons continue to use the M5 sheets.
- Use the existing company detail payload where possible. If a tab needs fresh notes/documents after a mutation, use the existing list actions or company-detail refresh path.

### 2. Timeline Tab

- Build a full Timeline tab using `detail.timeline`.
- Group events by year, newest first.
- Add filters for event types: valuation, ownership, note, document, and milestone/other.
- Include search by title/description.
- Show linked context when available:
  - valuation event link/title when `valuation_event_id` exists
  - ownership event link/title when `ownership_event_id` exists
  - note title when `note_id` exists
  - document title when `document_id` exists
- Keep event cards compact and scannable. Use visual type markers/icons and date rails similar to the reference.
- Empty state should explain that valuation, ownership, note, and document actions will populate the timeline.

### 3. Valuation Tab

- Build a full Valuation tab using `detail.valuations`.
- Include the existing valuation chart plus a chronological valuation table/list.
- Show paper value, risk-adjusted value, realized value, haircut, source, liquidity, confidence, linked evidence count, and note.
- Add filters for source and liquidity level.
- Add a real "Add valuation" action wired to the M5 valuation sheet.
- Do not imply private-company values are liquid cash.

### 4. Notes Tab

- Build a full Notes tab using `detail.notes`.
- Include search, tag filtering, pinned-first sorting, and date sorting.
- Render Markdown with `react-markdown` and `remark-gfm`.
- Add real "Add note" and "Edit note" actions wired to the M5 note sheet.
- Show linked timeline event and linked document references when available.
- Keep tags flexible. Do not add hardcoded lesson behavior beyond allowing normal tags.

### 5. Documents Tab

- Build a full Documents tab using `detail.documents` and `detail.document_health`.
- Show a document health panel with missing categories and warnings.
- Group or filter by category, document type, status, and linked event type.
- Add real document upload:
  - Request a presigned URL with `presignVentureUpload` using `operation: "upload"`, `purpose: "document"`, and the current `company_id`.
  - Upload the file to the returned S3 URL.
  - Create document metadata with `createVentureDocument`.
  - Refresh company detail/documents after success.
- Add real document download:
  - Request a presigned URL with `operation: "download"` and either `document_id` or `storage_key`.
  - Start a browser download/open for the returned URL.
  - Do not implement inline preview.
- Add delete/remove document metadata using `deleteVentureDocument`.
- Capture document metadata: title, document type, category, status, document date, linked valuation event, linked ownership event, linked timeline event, file name, MIME type, and file size.
- Use real loading and error states for presign/upload/create/download/delete.

## Integration Requirements

- Reuse generated contract types from `apps/web/src/types/contracts.ts`; do not hand-write duplicate DTOs.
- Keep API calls in the existing Ventures Redux/Saga flow unless there is a concrete reason to add a small helper.
- If a new saga/action is needed for document download request tracking, keep it scoped and typed.
- Prefer existing shadcn/Radix primitives, `sonner`, `react-markdown`, `remark-gfm`, and current Ventures components before adding dependencies.
- No dead buttons. If a control is visible, it must be wired or intentionally disabled with a clear reason.
- Keep all labels financially honest: documents can support a paper valuation, but they do not make the value liquid.
- Do not add mobile-specific behavior.

## Suggested Files

Use or adapt these paths:

- `apps/web/src/pages/ventures/company-workspace.tsx`
- `apps/web/src/pages/ventures/components/venture-workspace-tabs.tsx`
- `apps/web/src/pages/ventures/components/venture-timeline-tab.tsx`
- `apps/web/src/pages/ventures/components/venture-valuation-tab.tsx`
- `apps/web/src/pages/ventures/components/venture-notes-tab.tsx`
- `apps/web/src/pages/ventures/components/venture-documents-tab.tsx`
- `apps/web/src/pages/ventures/components/venture-document-sheet.tsx`
- `apps/web/src/pages/ventures/components/venture-mutation-sheets.tsx`
- `apps/web/src/pages/ventures/utils/format.ts`
- `apps/web/src/features/ventures/venturesSaga.ts`
- `apps/web/src/features/ventures/venturesSlice.ts`
- `apps/web/src/hooks/use-api.ts`

If backend gaps block real upload/download/delete functionality, keep changes minimal and update:

- `apps/api/schemas/ventures.py`
- `apps/api/handlers/ventures.py`
- `apps/api/services/ventures.py`
- `apps/api/repositories/ventures.py`
- `apps/api/contracts/http.py`
- `infra/serverless/serverless.yml`
- Generated contracts via `npm run generate:api-contracts`

## Validation

Run:

- `npm run format -w apps/web`
- `npm run lint -w apps/web`
- `npm run build -w apps/web`

If backend/contracts change, also run:

- `npm run generate:api-contracts`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make format`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make type-check`
- Targeted backend tests for changed service/handler paths.

For targeted backend test slices, use `PYTHONPATH=.` and avoid committing coverage artifacts. If you run a slice, use `--no-cov` unless you intend to run the full coverage suite.

Smoke the UI in the in-app browser:

- `/ventures/:companyId` renders all enabled tabs with no console errors.
- Timeline filters/search work.
- Valuation tab keeps paper/risk-adjusted/realized/liquidity labels distinct.
- Notes tab renders Markdown and edit/add flows still work.
- Documents tab can validate upload fields. If authenticated S3-backed testing is available, upload and then download a small safe test document.
- Delete document metadata only after confirming it is a test document.
- Confirm document preview is not present.

Report exactly what changed, what passed, what could not be smoke-tested because of auth/S3 environment limits, and any remaining risks.
