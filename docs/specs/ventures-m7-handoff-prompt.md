# Ventures M7 Handoff Prompt

You are working in `/Users/casperkristiansson/programming/Finance-Tracker`.
Start by reading and following:

- `/Users/casperkristiansson/programming/Finance-Tracker/AGENTS.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-implementation-plan.html`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-m6-handoff-prompt.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/brand.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/info.md`

Also inspect the Ventures reference images in `/Users/casperkristiansson/Desktop/inspiration/`, especially:

- `1.png` for the main `/ventures` graph direction.
- `2.png` for the selected company bottom panel.
- `3.png` for the company workspace shell.
- `4.png` and `5.png` for mutation bottom-sheet direction.
- `6.png`, `7.png`, and `8.png` for timeline, notes, and documents tabs.

Treat the images as visual direction, not literal requirements. Every visible control must either work, be intentionally disabled with a clear reason, or be omitted.

## Goal

Implement M7: Polish, Desktop QA, and release readiness for the Ventures feature.

M1-M6 should already provide the backend foundation, generated contracts, data layer, graph screen, company workspace overview, mutation sheets, and the Timeline/Valuation/Notes/Documents workspace tabs. M7 is the final pass to make the feature coherent, trustworthy, and ready to use on desktop.

## Product Constraints

- Venture paper values stay inside Ventures only. Do not sync them into dashboard net worth, investments, reports, existing account views, or transaction flows.
- Keep paper value, risk-adjusted value, realized value, and liquidity distinct everywhere.
- Do not add a Lessons model, Lessons tab, or lesson-specific backend entity. Notes with flexible tags are enough.
- Documents are private S3-backed evidence. Upload/download/delete metadata can exist; inline preview is out of scope.
- Desktop is the target. Mobile-specific redesign is out of scope, but desktop and narrow desktop overflow must not be broken.

## Scope

### 1. Product Coherence

- Walk through `/ventures` and `/ventures/:companyId` and remove any remaining dead, duplicate, misleading, or placeholder controls.
- Ensure all actions route to real flows from M5/M6:
  - Add company
  - Add valuation
  - Edit ownership
  - Add note
  - Edit note
  - Upload document
  - Download document
  - Delete document metadata
- Confirm copy never implies private-company paper value is liquid cash or part of normal net worth.
- Confirm the status model is only: `idea`, `ongoing`, `stale`, `exited`, and `failed`.

### 2. Desktop Visual QA

- Use the in-app browser on desktop widths to inspect:
  - Main graph screen
  - Selected company bottom panel
  - Company workspace overview
  - Timeline tab
  - Valuation tab
  - Notes tab
  - Documents tab
  - Add company sheet
  - Add valuation sheet
  - Edit ownership sheet
  - Note sheet
  - Document upload sheet
- Fix text overlap, awkward truncation, broken spacing, hidden buttons, table overflow issues, and visually inconsistent panels.
- Keep the design aligned with the existing Finance Tracker theme and the reference images, but improve the images where they show odd inputs or non-functional decoration.
- Avoid broad redesigns unless they remove an actual usability issue.

### 3. Empty, Loading, Error, And Edge States

Check and polish these states:

- No venture companies.
- Company with no valuations.
- Company with no notes.
- Company with no documents.
- Company with missing document categories or warnings.
- Idea-stage company.
- Stale company.
- Failed company.
- Exited company.
- Holding-company ownership where one company owns shares in another.
- Presign/upload/download/delete errors.
- Demo mode where S3 operations are intentionally unavailable.

### 4. Technical Readiness

- Keep Ventures isolated from Investments and the rest of the finance system.
- Check that generated contract types are used instead of hand-written DTO copies.
- Check that successful mutations refresh the relevant company/overview data.
- Check that no coverage artifacts are present or committed.
- Do not add new dependencies unless a concrete M7 issue requires one.

## Validation

Run:

- `npm run format -w apps/web`
- `npm run lint -w apps/web`
- `npm run build -w apps/web`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make format`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make type-check`

If backend behavior changes, also run targeted backend tests with `PYTHONPATH=.` and `--no-cov` unless you intend to run the full coverage suite.

Smoke the UI in the in-app browser. If authenticated/S3-backed company data is not available, state exactly what could not be tested and verify the demo-accessible screens instead.

Report exactly what changed, what passed, what could not be browser-tested, and any remaining release risks.
