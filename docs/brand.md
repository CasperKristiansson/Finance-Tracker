# Brand & UI Guidelines

## Core Principles
- Modern, confident finance aesthetic: clear hierarchy, high legibility, restrained gradients, purposeful depth (shadow blur + subtle borders).
- Data-first: charts and tables are the hero; emphasize clarity, comparisons, and trust.
- Consistency: prefer existing components before inventing new ones. Reuse tokens, spacing, and typography scales.

## Components & Libraries
- Primary UI primitives: shadcn/ui + Radix UI. When designing/implementing, first check if a shadcn or Radix component exists for the pattern. If unsure, fetch current docs via context7 MCP to confirm API and accessibility guidelines.
- Layout helpers: Sidebar, Tabs, Collapsible, Dialog/Sheet, DropdownMenu, Tooltip, Table, Skeleton, Chart wrapper.
- Forms: use shadcn Input, Select, Checkbox, Switch, Textarea; keep label + helper text; inline validation.
- Open to additional libs for animation/interaction (e.g., Framer Motion), charts, and data grids when justified—this is a private repo, so sensible deps are fine.

## Visual System
- Typography: modern geometric/humanist sans (e.g., "DM Sans" or "Satoshi"); tight line-height for headings; numeric font-variant for aligned figures.
- Color: one bold accent for actions; neutral surfaces with subtle contrast; distinct success/warn/error; vivid but readable chart palette. Avoid heavy purple bias; ensure WCAG contrast for text and key UI.
- Spacing: 4/8px scale; generous breathing room around KPIs and charts.
- Surfaces: use soft cards with 1px borders + gentle shadow; glassy overlays for modals only when they don’t hurt contrast.

## Layout Patterns
- Navigation: persistent sidebar (collapsible), top breadcrumb/header; consistent padding (16–24px).
- Dashboard/Reports: grid of cards; KPIs in a tight row; charts span full width on mobile, paired on desktop.
- Tables: sticky headers, sortable columns, column visibility toggle; inline chips/badges for status.
- Forms/Flows: stepper for multi-step (imports, onboarding); drawers for quick create; dialogs for confirmation.

## Data Visualization
- Chart types: stacked area (income vs expense), grouped bar (cash flow), donut/treemap (category share), line/area (net worth), bar (savings rate).
- Interactions: hover tooltips, legend toggles, click-to-drill; use the chart wrapper component for consistent theming.
- Color rules: income = green hues, expense = red/orange, transfers/neutral = slate/blue; keep consistent across charts and tables.

## States & Feedback
- Loading: skeletons for cards, charts, tables; spinners only for short actions.
- Empty: friendly illustration/icon + single CTA (import data / add transaction).
- Errors: inline messages near the control; toast for global failures; show retry where possible.
- Validation: inline, per-field messages; disable primary actions while submitting.

## Motion
- Use subtle motion: fade/slide for page/section entry, staggered card reveal, gentle hover lifts on cards/buttons.
- Prefer library support (e.g., Framer Motion) for orchestrated sequences; keep durations 150–250ms, easing out.

## Accessibility
- Respect Radix accessibility defaults; preserve focus outlines; ensure keyboard reachability for menus, dialogs, tables.
- Maintain color contrast (WCAG AA) for text and essential UI.

## Content & Tone
- Tone: clear, concise, financially literate but human. Avoid jargon where plain language works.
- Labels: action-first buttons (“Add transaction”, “Import file”), descriptive helper text, short tooltips.

## Implementation Notes
- Always check shadcn/Radix patterns before creating custom components; use context7 MCP to pull up-to-date docs for props and accessibility details.
- Keep tokens centralized (colors/spacing/typography); align chart palette with semantic colors.
- Favor composition over one-off styles; rely on utility classes (Tailwind) with `cn()` for variants.
