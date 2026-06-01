# Ventures M4 Handoff Prompt

You are working in `/Users/casperkristiansson/programming/Finance-Tracker`.
Start by reading and following:

- `/Users/casperkristiansson/programming/Finance-Tracker/AGENTS.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-implementation-plan.html`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-m3-handoff-prompt.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/brand.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/info.md`

Also inspect `/Users/casperkristiansson/Desktop/inspiration/3.png` before building. Treat it as visual direction, not a literal source of truth. If the image shows a label that conflicts with product decisions, follow the product decisions in the spec.

## Goal

Implement M4: the full read-only company workspace overview at `/ventures/:companyId`.

M1 provides backend/contracts. M2 provides navigation and Ventures Redux/Saga hooks. M3 provides the main graph and selected-company bottom panel. M4 should replace the minimal M2 company workspace shell with a polished overview page using real company detail data.

## Scope

- Keep `/ventures/:companyId` routed through the existing `CompanyWorkspace` page.
- Load company detail with `fetchCompany(companyId)` and use `companyDetails[companyId]`.
- Build a reusable company header section with back navigation, company identity, status, role/type, description, and last updated.
- Show top metrics for ownership, paper value, risk-adjusted value, liquidity, confidence, and last update.
- Add an ownership relationship strip showing who owns the company. For person-owned companies, show `Casper -> Company`. For holding-company-owned companies, show `Holding Company -> Company` using known company details or overview data when available.
- Add a valuation history chart using existing charting patterns in the repo, preferably Recharts. Use real `detail.valuations`, sorted chronologically. Show paper value and risk-adjusted value clearly; do not imply either is liquid cash.
- Add an ownership and risk profile panel using latest ownership and latest valuation fields: direct ownership, fully diluted ownership, share class, voting rights, valuation source, liquidity level, haircut, confidence score, and document evidence status where available.
- Add timeline highlights from `detail.timeline`, recent notes from `detail.notes`, and a documents checklist/health panel from `detail.documents` and `detail.document_health`.
- Add a simple tab/header structure if useful for future M6 tabs, but only the overview content needs to be implemented in M4.
- Keep loading, error, not-found, and empty-data states polished.

## Product Constraints

- Venture paper values stay inside Ventures only. Do not sync them into dashboard net worth, investments, accounts, or reports.
- Do not show "included in net worth" as a positive/default state. If you mention net worth, say these values are venture-only and excluded from main net worth.
- Keep "paper value", "risk-adjusted value", "realized value", and "liquidity" distinct.
- Do not create a separate "lessons learned" concept. Notes and tags are enough.
- Desktop is the target. Do not spend time on mobile-specific layout beyond avoiding broken overflow.

## Non-Goals

- Do not implement add valuation, add note, edit company, edit ownership, document upload, or document download flows in M4. Those belong to M5/M6 unless a control is fully wired and validated.
- Do not implement the full Timeline, Notes, or Documents tabs from references `6.png`, `7.png`, and `8.png`; only overview highlights/checklists belong here.
- Do not change backend contracts unless a blocking data gap is found. If a backend change is unavoidable, keep it minimal, update contracts, regenerate frontend types, and run backend gates.
- Do not alter the M3 graph except for small integration fixes needed to link to the workspace.

## Suggested Files

Use or adapt these paths:

- `apps/web/src/pages/ventures/company-workspace.tsx`
- `apps/web/src/pages/ventures/components/company-header.tsx`
- `apps/web/src/pages/ventures/components/company-metric-strip.tsx`
- `apps/web/src/pages/ventures/components/valuation-history-chart.tsx`
- `apps/web/src/pages/ventures/components/ownership-risk-panel.tsx`
- `apps/web/src/pages/ventures/components/company-relationship-strip.tsx`
- `apps/web/src/pages/ventures/components/timeline-highlights.tsx`
- `apps/web/src/pages/ventures/components/recent-notes-card.tsx`
- `apps/web/src/pages/ventures/components/document-health-card.tsx`
- `apps/web/src/pages/ventures/utils/format.ts`

Keep component boundaries practical. Do not add abstraction just to match these names.

## Validation

Run:

- `npm run format -w apps/web`
- `npm run lint -w apps/web`

Then start the web app and smoke `/ventures/:companyId` in the in-app browser:

- Verify loading/error/not-found states.
- Verify a populated company renders without runtime or console errors.
- Verify chart axes and labels do not overlap.
- Verify action buttons are either hidden, disabled with a clear reason, or fully wired.
- Verify the back link returns to `/ventures`.
- Inspect a desktop screenshot for layout density, text overflow, and consistency with `3.png`.

Report exactly what changed, what commands passed, and any remaining risks.
