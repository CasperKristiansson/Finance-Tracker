# Ventures M3 Handoff Prompt

You are working in `/Users/casperkristiansson/programming/Finance-Tracker`.
Start by reading and following:

- `/Users/casperkristiansson/programming/Finance-Tracker/AGENTS.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-implementation-plan.html`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/specs/ventures-m2-handoff-prompt.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/brand.md`
- `/Users/casperkristiansson/programming/Finance-Tracker/docs/info.md`

Also inspect these visual references before building:

- `/Users/casperkristiansson/Desktop/inspiration/1.png` for the main graph screen.
- `/Users/casperkristiansson/Desktop/inspiration/2.png` for the selected-company bottom panel.

Treat the images as design direction, not exact implementation instructions. Keep the screen desktop-focused, functional, and aligned with the existing app. Do not add inert controls, do not copy nonsensical labels, and do not implement later milestone flows just because they appear in a reference image.

## Goal

Implement M3: the real `/ventures` main graph screen and selected-company bottom panel.

M1 provides the backend/contracts. M2 provides routes, sidebar navigation, Redux/Saga data layer, `useVenturesApi`, and minimal route shells. Replace the M2 `/ventures` shell with an interactive XY Flow graph experience while preserving the M2 data contracts and route behavior.

## Scope

- Use `@xyflow/react` for the main graph canvas.
- Build custom company nodes from `overview.companies`.
- Render a founder/root node above company nodes. This root can be frontend-derived for now; do not require a backend entity.
- Render ownership edges from `overview.ownership_edges`, including holding-company ownership where `owner_company_id` is present.
- Render direct founder/person ownership edges from the root node.
- Use the persisted layout payload from `overview.layout`.
- Persist node positions and viewport through the existing `updateVentureLayout` action after drag/viewport changes. Debounce persistence so dragging does not spam the API.
- Provide graph controls for zoom in, zoom out, and fit view using XY Flow APIs.
- Show KPI cards using the overview KPIs: paper value, risk-adjusted value, realized value, and illiquid context.
- Clicking a company node selects it and opens a bottom panel inspired by `2.png`.
- The bottom panel should show real selected-company data: status, paper value, risk-adjusted value, ownership, latest valuation, latest ownership, notes count, documents count, and recent activity if available.
- The bottom panel should include an `Open workspace` action routed to `/ventures/:companyId`.
- The bottom panel should have a close action.
- Keep loading, error, and empty states polished and functional.
- Keep `/ventures/:companyId` from M2 working; do not turn it into the M4 company workspace yet.

## Design Requirements

- The graph should feel like the winning references: crisp cards, straight or gently curved clean connectors, two visual rows when enough companies exist, and a clear founder/root node.
- Use restrained color by status: idea, ongoing, stale, exited, failed. Avoid making the whole screen one hue.
- Use company logo metadata if available in the data; otherwise use initials or a simple icon.
- Avoid decorative gradient blobs/orbs. Subtle graph-grid or dotted-canvas texture is acceptable if it does not reduce clarity.
- Keep text inside cards stable and non-overlapping at desktop widths.
- Do not use cards inside cards. Repeated company nodes and KPI cards are fine; do not wrap the whole page in a decorative card.
- Prefer lucide icons for controls and meaningful metadata.
- Hidden or disabled future actions are better than visible buttons that do nothing.

## Data And Behavior Details

- Preserve generated contract type usage. Do not hand-write duplicate DTOs.
- Keep Venture paper values only inside Ventures. Do not touch dashboard net worth, investments, accounts, or reports totals.
- If a company has no persisted layout node, compute a deterministic fallback layout. Prefer `dagre` if it helps produce stable rows; otherwise use a simple deterministic grid/tree layout.
- Persist only real company node positions in the backend layout payload. The founder/root node can remain frontend-derived and should not be sent as a company layout node.
- If the backend returns a viewport in `overview.layout.viewport`, restore it when the graph initializes.
- If no companies exist, show a graph-ready empty state instead of a blank canvas.
- If selected company detail is needed for the bottom panel, fetch it with `fetchCompany(companyId)` and show a lightweight loading state in the panel. If overview summary data is enough for the first render, use it immediately and hydrate with detail when available.
- Do not implement the add-company flow in this milestone unless you fully wire a minimal valid form. Otherwise omit the add-company button until M5.
- Do not implement valuation, notes, documents, ownership edit, or timeline management flows in this milestone.

## Suggested Files

You can adjust names to fit the existing style, but keep the Ventures feature grouped:

- `apps/web/src/pages/ventures/ventures.tsx`
- `apps/web/src/pages/ventures/components/venture-graph.tsx`
- `apps/web/src/pages/ventures/components/company-node.tsx`
- `apps/web/src/pages/ventures/components/founder-node.tsx`
- `apps/web/src/pages/ventures/components/venture-graph-toolbar.tsx`
- `apps/web/src/pages/ventures/components/company-bottom-panel.tsx`
- `apps/web/src/pages/ventures/components/venture-kpi-row.tsx`
- `apps/web/src/pages/ventures/utils/layout.ts`
- `apps/web/src/pages/ventures/utils/format.ts`

## Validation

Run:

- `npm run format -w apps/web`
- `npm run lint -w apps/web`

Then start the web app and smoke `/ventures` in the in-app browser:

- Verify the route loads without console/runtime errors.
- Verify empty state works when there are no companies or demo mode returns none.
- If data exists, verify nodes render, selection opens the bottom panel, `Open workspace` navigates to `/ventures/:companyId`, zoom/fit controls work, and dragging a node persists layout through the existing action.
- Take/inspect a desktop screenshot to confirm the graph is nonblank, correctly framed, and text does not overlap.

Report exactly what changed, what commands passed, and any remaining risks.
