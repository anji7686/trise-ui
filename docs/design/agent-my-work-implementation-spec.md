# TRISE Agent / My Work — implementation-ready design specification

Status: PROPOSED UI implementation specification  
Scope: Operations Agent-facing `Jobs` → `My Work` experience  
Authoritative domain/API source: `trise-architecture`  
Application: `trise-ui/apps/operations`

## Codex implementation instruction

Implement the Agent `My Work` redesign in the Operations application using the
existing React/Vite architecture, generated API types, authorization checks,
design tokens and server-owned workflow state.

Before editing, read:

- `trise-ui/AGENTS.md`
- `trise-architecture/AGENTS.md`
- `trise-architecture/architecture/agent-application.md`
- `trise-architecture/architecture/workforce.md`
- `trise-architecture/architecture/service-operations.md`
- `trise-architecture/architecture/authorization.md`
- `trise-architecture/docs/ubold-reference-index.md`

Use the existing `Jobs` implementation in
`apps/operations/src/jobs.tsx`, `jobs.css`, `operations-shared.tsx`,
`operations-status.tsx`, `execution.tsx`, and `data.ts`. Keep the existing API
operations and server authorization behavior. Do not create mock records,
client-owned workflow state, new routes, migrations, authentication bypasses,
or new permissions.

Implement the visual hierarchy below:

1. Keep the Operations shell and provider context selector.
2. Make `My Work` a focused queue rather than a long undifferentiated list.
3. Add a compact summary strip for counts that are already available from the
   authorized API response. Do not invent totals; omit a card when its source
   value is unavailable.
4. Add one filter row for search, status and date/queue scope. Filters must
   operate only on records already returned by the API unless a supported API
   filter exists.
5. Render assignment rows with this order: status/priority, job title,
   authorized site or asset context, scheduled time/SLA metadata when supplied,
   then one clear next action.
6. Keep proposed assignment actions as `Accept` and `Decline`. Preserve
   idempotency keys, expected revisions, busy states and server error handling.
7. Move visit, transition and evidence controls into an expanded row or detail
   drawer. Do not show execution actions as a dense button cluster in every row.
8. Preserve the distinction between assignment, visit, work session and job
   lifecycle. The UI must not imply that login, GPS, opening a visit or starting
   a work session proves completion.
9. Keep customer, site, asset, SLA, emergency and safety details limited to
   fields returned by the authorized API response.
10. Use accessible labels, keyboard focus, semantic buttons, visible focus
    states, sufficient contrast and touch targets of at least 44px on narrow
    screens.

After implementation, run the required Operations typecheck, Vitest tests,
lint, production build, bundle check and `git diff --check`. For browser
verification, first establish Chromium through terminal Playwright with the
repository sandbox enabled. If launch fails, preserve the crash log and mark
browser acceptance blocked; do not retry or bypass the sandbox.

## Visual direction

The design is a calm, compact field-operations queue:

- deep TRISE navy navigation and header accents;
- pale blue-gray application background;
- white cards with thin borders and restrained shadows;
- blue for assigned/in-progress actions;
- amber for proposed assignments;
- green for completed work;
- red/orange only for explicit high-priority or emergency indicators;
- no charts, payment fields, maps, ecommerce labels or unsupported metrics;
- no status communicated by color alone; always include text labels.

The primary reading path is:

`My Work` → summary → filters → assignment status/title/time → next action →
optional detail/execution evidence.

## Responsive layouts

### Web desktop — 1440 × 1000 reference

- Fixed or compact left sidebar around 220px.
- White top bar around 64px with provider/account context.
- Main content uses a two-column layout: queue approximately 65–70%, selected
  assignment detail approximately 30–35%.
- Summary cards appear in one horizontal row.
- Queue rows remain one line of metadata plus one primary action.
- Detail panel may remain sticky while the queue scrolls.

Reference image: [agent-my-work-web-v1.png](agent-my-work-web-v1.png)

### iPad portrait — 834 × 1194 reference

- Replace the permanent sidebar with a compact menu/top navigation treatment.
- Summary cards use a two-by-two grid.
- Queue remains the primary surface; selected work opens as a slide-over or
  lower detail panel.
- Use larger touch targets and avoid dense inline controls.
- Keep the primary action visible without requiring horizontal scrolling.

Reference image: [agent-my-work-ipad-v1.png](agent-my-work-ipad-v1.png)

### Tablet landscape — 1180 × 820 reference

- Use a narrow sidebar with labels where space allows.
- Keep queue and selected-work detail side by side.
- Preserve the desktop information hierarchy but increase row height for touch.
- Keep filters in one row only when they fit without compression.

Reference image: [agent-my-work-tablet-v1.png](agent-my-work-tablet-v1.png)

### Mobile portrait — 390 × 844 reference

- No permanent sidebar; use a menu button and compact top bar.
- Summary cards become a horizontal scroll strip or two-column compact grid.
- Search is full-width; filters stack below it.
- Assignment cards stack metadata and place the primary action full width.
- Proposed assignments use full-width `Accept` and `Decline` actions.
- Detail/execution opens as a full-screen route, sheet or disclosure panel.
- Never require horizontal scrolling for a job card or action.

Reference image: [agent-my-work-mobile-v1.png](agent-my-work-mobile-v1.png)

## Component contract

Suggested Operations components; reuse existing primitives where equivalent
components already exist:

```text
MyWorkPage
├── WorkSummaryStrip
├── WorkFilterBar
├── AssignmentQueue
│   └── AssignmentRow
│       ├── AssignmentStatus
│       ├── AssignmentMeta
│       └── AssignmentNextAction
└── WorkDetailPanel
    ├── WorkDetailHeader
    ├── WorkDetailTabs
    ├── ExecutionTimeline
    └── EvidenceSummary
```

Required states:

- loading;
- empty authorized queue;
- proposed assignment;
- accepted/assigned assignment;
- in-progress execution;
- completed assignment;
- stale revision or conflict response;
- forbidden/unauthorized response;
- retryable API failure;
- narrow viewport with detail closed and open.

## API and authorization boundaries

Use only existing Operations data methods and response fields. The server
remains authoritative for:

- provider context;
- assignment visibility;
- agent eligibility;
- accept/decline permission;
- job state and allowed transitions;
- visit creation;
- check-in/start/complete commands;
- evidence/report requirements;
- revision conflicts and idempotency.

Do not:

- infer access from an email address, role label, route or hidden button;
- expose an unrestricted agent/customer catalogue;
- calculate authoritative priority, SLA, eligibility, availability or capacity
  in the client;
- treat a successful button click as a completed business action before the
  mutation response confirms it;
- add fabricated summary counts or placeholder customer data.

## UBold visual references

These PDFs are visual references only. Adapt their layout patterns to TRISE
terminology and returned API data; do not copy sample records, ecommerce labels,
payment fields or template code.

- [UBold List.pdf](../../../trise-architecture/Template%20design%20screen%20shot%20files%20from%20Ubold/List.pdf) — queue/list spacing and row hierarchy.
- [UBold Tables.pdf](../../../trise-architecture/Template%20design%20screen%20shot%20files%20from%20Ubold/Tables.pdf) — readable metadata columns and action alignment.
- [UBold Task Details.pdf](../../../trise-architecture/Template%20design%20screen%20shot%20files%20from%20Ubold/Task%20Details.pdf) — selected work detail and action grouping.
- [UBold Time Line Template.pdf](../../../trise-architecture/Template%20design%20screen%20shot%20files%20from%20Ubold/Time%20Line%20Template.pdf) — execution timeline treatment.
- [UBold Form Validataions.pdf](../../../trise-architecture/Template%20design%20screen%20shot%20files%20from%20Ubold/Form%20Validataions.pdf) — inline validation and error presentation.
- [UBold Dashboard 2.pdf](../../../trise-architecture/Template%20design%20screen%20shot%20files%20from%20Ubold/Dashboard%202.pdf) — restrained summary-card hierarchy.
- [UBold reference index](../../../trise-architecture/docs/ubold-reference-index.md) — governing mapping and adaptation rules.

## Architecture references

- [Agent application contract](../../../trise-architecture/architecture/agent-application.md)
- [Workforce model](../../../trise-architecture/architecture/workforce.md)
- [Service operations lifecycle](../../../trise-architecture/architecture/service-operations.md)
- [Authorization](../../../trise-architecture/architecture/authorization.md)
- [Current browser readiness evidence](../testing/browser-readiness-report.md)

## Acceptance checklist

### Visual

- [ ] Web desktop matches the two-column queue/detail composition.
- [ ] iPad portrait remains readable without horizontal scrolling.
- [ ] Tablet landscape preserves queue/detail split and touch-friendly controls.
- [ ] Mobile uses stacked cards and full-width primary actions.
- [ ] Long queues remain scannable; repeated rows do not dominate the viewport.
- [ ] Status, priority and next action are visually distinct and text-labelled.
- [ ] Light and dark theme tokens remain legible if the existing app supports both.

### Workflow

- [ ] Only API-returned assignments are shown.
- [ ] Accept/decline uses the existing authorized mutation and revision handling.
- [ ] Open visit, check-in, start and complete remain separate server commands.
- [ ] Evidence controls remain gated by the current visit/job state and API response.
- [ ] Conflict, forbidden, validation and retry states are visible and actionable.
- [ ] No browser-only success message is shown before the API confirms success.

### Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run check:bundle`
- [ ] `git diff --check`
- [ ] Terminal Playwright Chromium launch established with sandbox enabled.
- [ ] Authenticated Web, iPad/tablet and Mobile screenshots captured from the
      real React application, if browser launch succeeds.
- [ ] Console errors, uncaught exceptions, HTTP errors and failed requests
      recorded separately from visual acceptance.

