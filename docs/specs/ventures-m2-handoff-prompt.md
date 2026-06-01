# Ventures M2 Handoff Prompt

You are working in `/Users/casperkristiansson/programming/Finance-Tracker`.
Start by reading and following:

- `/Users/casperkristiansson/programming/Finance-Tracker/AGENTS.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-implementation-plan.html`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/brand.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/info.md`

Also inspect the visual references in `/Users/casperkristiansson/Desktop/inspiration`, especially `1.png` for the main Ventures graph direction and `2.png` for the selected-company bottom panel direction. Treat these as direction, not literal requirements. Do not copy nonsensical controls from the images, do not add buttons that do nothing, and do not overbuild the graph screen in this milestone.

## Goal

Implement M2: Frontend Data Layer And Navigation end-to-end.

M1 is already implemented and exposes the backend/API contract foundation for Ventures. This milestone should make Ventures reachable in the app, wire the generated API contracts into Redux Toolkit/Saga, and provide a minimal desktop route shell that proves navigation and data loading work. Leave the full XY Flow graph, rich selected bottom panel, add-company flow, valuation forms, documents UI, and ownership editor for later milestones unless a tiny placeholder is needed to keep M2 coherent.

## Scope

- Add `PageRoutes.ventures` as `/ventures`.
- Add `PageRoutes.ventureCompany` as `/ventures/:companyId`.
- Register both routes in `apps/web/src/App.tsx` inside the existing `NavigationWrapper` pattern with title `Ventures`.
- Add a sidebar entry for Ventures using a suitable lucide icon, for example `Network`, `GitBranch`, or another icon that reads as company graph/ownership.
- Add `apps/web/src/features/ventures/venturesSlice.ts`.
- Add `apps/web/src/features/ventures/venturesSaga.ts`.
- Register the reducer in `apps/web/src/app/store.ts`.
- Register the saga in `apps/web/src/app/rootSaga.ts`.
- Add `useVenturesApi` to `apps/web/src/hooks/use-api.ts`.
- Add minimal route components under `apps/web/src/pages/ventures/`, such as `ventures.tsx` and `company-workspace.tsx`.
- Add empty/demo payload support if required by the existing demo-mode pattern. Prefer honest empty Ventures data over fake inflated financial values.

## API Contracts

Use generated contract types from `apps/web/src/types/contracts.ts` and the endpoint request helper in `apps/web/src/lib/apiEndpoints.ts`. Do not hand-write duplicate DTOs.

M1 endpoint names currently generated:

- `venturesOverview`
- `createVentureCompany`
- `getVentureCompany`
- `updateVentureCompany`
- `deleteVentureCompany`
- `createVentureValuation`
- `createVentureOwnershipEvent`
- `listVentureNotes`
- `createVentureNote`
- `updateVentureNote`
- `deleteVentureNote`
- `listVentureDocuments`
- `createVentureDocument`
- `deleteVentureDocument`
- `updateVentureLayout`
- `presignVentureUpload`

Expected data layer behavior:

- Fetch overview on `/ventures`.
- Fetch company detail on `/ventures/:companyId`.
- Expose saga actions/hooks for create/update/delete company, create valuation, create ownership event, note CRUD, document CRUD, layout update, and upload/download presign.
- Refresh affected overview/detail state after mutations.
- Keep loading and error state specific enough for future UI flows, not one global ambiguous boolean for every operation.
- Use existing `callApiWithAuth`, `buildEndpointRequest`, typed `EndpointRequest`, and typed `EndpointResponse` patterns.
- Keep Venture paper values inside the Ventures feature only. Do not sync these values into dashboard net worth or existing investments.

## Route Shell Expectations

The route shell is intentionally not the final M3 graph UI. It should still be useful:

- `/ventures` should load overview and render a desktop-focused shell with loading, error, empty, and basic populated states.
- `/ventures/:companyId` should load company detail and render a minimal workspace shell with enough company metadata to prove the route works.
- Company navigation should use real company IDs from the overview/detail data.
- Any visible action button must either dispatch a real wired action or be omitted until its milestone.
- Keep styling aligned with the app's shadcn/Tailwind conventions and the Ventures visual direction, but avoid implementing the full image-driven design in M2.

## Non-Goals

- Do not implement the XY Flow graph yet.
- Do not implement draggable node persistence UI beyond wiring the saga/action.
- Do not implement the full selected bottom panel.
- Do not implement add-company, annual valuation, documents, timeline, notes, or ownership edit screens beyond data-layer actions and harmless route-shell placeholders.
- Do not add mobile-specific layout work; desktop is the target for this feature.
- Do not change backend contracts unless you find a blocking issue. If you must change a backend contract, keep it minimal, update `apps/api/contracts/http.py`, regenerate API contracts, and run the backend gates.

## Validation

Run:

- `npm run format -w apps/web`
- `npm run lint -w apps/web`

If any backend/API contract file changes, also run:

- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" npm run generate:api-contracts`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make format`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" make type-check`
- `PATH="/Users/casperkristiansson/programming/Finance-Tracker/.venv/bin:$PATH" bash scripts/check_api_contract_drift.sh`

Before finishing, start the web app if needed and smoke the `/ventures` route in the browser. Report exactly what changed, what commands passed, and any remaining risks.
