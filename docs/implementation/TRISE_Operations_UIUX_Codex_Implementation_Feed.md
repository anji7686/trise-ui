# TRISE India — Service Provider Operations UI/UX
## Codex implementation feed — unified Dashboard, Requests, Bookings, Jobs and My Work

**Design authority:** `TRISE_Service_Provider_Operations_UIUX_Master.pdf` (single consolidated visual reference).
**Application:** `~/wrk/lre/trise-ui` — Operations workspace (discover actual workspace/package structure; do not assume a file path).
**Architecture:** `~/wrk/lre/trise-architecture` — ADRs, logical schema, OpenAPI, UI capability checklist, and implementation roadmap.
**Backend for contract investigation only, unless explicitly approved:** `~/wrk/lre/trise-api` (Ruby on Rails).
**Principle:** The designs propose UI behavior. Existing implemented and authorized API contracts govern fields, state transitions, permissions, and data. Do not manufacture backend behavior.

---

## COPY THIS TASK TO CODEX

### Frozen Platform Administration boundary

All work in this feed is provider-side Operations work. Platform Administration
screens, navigation, routes, permissions, styling, and behavior are frozen and
must not change as part of these batches. Shared primitives may be added only
when they are provider-scoped or when tests prove that Platform Administration
rendering remains unchanged. Every batch must include an explicit platform
non-regression check in its acceptance evidence.

You are the implementation engineer for TRISE India. Update the **Service Provider Operations** React UI to follow the consolidated UX reference PDF for five connected workspaces:

1. Overview / Operations Dashboard
2. Service Requests — list, create, detail and edit
3. Bookings / Appointments — list, calendar, create, confirm and reschedule
4. Jobs — list, detail, assignment, execution, evidence and history
5. My Work — current signed-in operational user's actionable assignments

### 0. Non-negotiable preliminary audit

- Read applicable per-repository `AGENTS.md` and other local developer instructions.
- Find and examine the actual Operations React entry point, its routes, CSS/design tokens, components, API client, query/cache strategy, authorization guards, tests and build scripts. Check the repository state; don't overwrite unrelated changes.
- Inspect `trise-architecture` ADRs, OpenAPI contracts and current `docs/ui-capability-checklist.md` (if present), plus the lifecycle decisions for ServiceRequest, Appointment/Booking, ServiceJob, AgentAssignment, ServiceVisit, service evidence, entitlement and document governance.
- Verify the reference PDF exists locally. The expected path is `~/wrk/lre/trise-architecture/docs/design/TRISE_Service_Provider_Operations_UIUX_Master.pdf`; if missing, ask where the user stored it and proceed with code/contract audit only until the visual source is available. Treat the PDF as a design reference, not a backend schema.
- Capture a **current state inventory**: existing implemented, partially implemented, not supported, and API-blocked capabilities. Include route names, actual endpoints, permissions and tested workflow gaps.
- State the implementation plan and expected touch points before modifying code. Ship small, reviewable PR-sized batches.

### 1. Navigation and shared UI foundation

- Keep the TRISE navy header/sidebar branding and provider switcher. Align consistent sidebar order with design: **Overview**; **Operations** (Requests, Bookings, Jobs, optionally Schedule & Dispatch and My Work when justified by permissions); **Customers & Assets** (Customers, Sites/Service Locations, Assets); **Contracts** (AMC & Maintenance); **Workforce**; **Commercial**; **Insights**; **Administration** (Business Profile, Configuration, Compliance, Subscription/Usage, Audit History, Team & Access).
- Do not introduce navigation items for functionality that does not exist; use permission-aware conditional visibility. My Work may be a tab within Jobs rather than a duplicate primary route.
- Use a reusable shell, section headings, compact status/KPI cards, filter toolbars, data tables/list rows, status/priority badges, tabs, right-side drawers, accordions, dialogs, confirmation prompts, accessible toasts and empty/loading/error states.
- Support desktop first but remain responsive for tablet/mobile: no horizontal overflow; allow card stacking and drawers to become full-screen dialogs on small screens. Keep keyboard focus, proper labels, ESC/back behavior and correct aria semantics.
- Preserve active list filters, pagination and scroll when opening/closing a drawer or tab; support shareable deep links to records where authorized.

### 2. Overview dashboard

- Organize widgets around daily workflow: requests requiring triage, booking confirmations, unassigned jobs, jobs in progress, overdue/blocked work, due visits, agent load/capacity, and AMC renewals when backed by an available endpoint.
- Each widget must link into a correctly filtered queue and respect provider scope and roles. Use bounded/paginated API data and server-provided totals where available; never present a first-page record count as a full total.
- Avoid hard-coded figures, synthetic timestamps, fabricated trend arrows or SLA indicators.
- Make urgent/overdue actions visible before lower-priority reporting; only display metrics whose authoritative definitions are documented.

### 3. Service Requests — one working context

- Build list/index with debounced search (ID, issue, customer, site or asset as supported), status/priority/date filters, concise rows, sorting and bounded pagination.
- Create in a focused modal or side panel, prioritizing customer, service location, asset, request type, impact/priority, description and attachments only where supported.
- Keep detail/edit in a right-side drawer with tabs or accordions such as Overview, Contact, Linked Booking/Job, Activity and Edit (if authorized). Use explicit Save/Cancel and unsaved-changes guards.
- Contact resolution is evidence and **must not** claim to have confirmed an appointment or dispatched an agent. Offer such actions only as separate, authorized workflows.
- Reflect real request statuses and allowed transitions from server responses; never infer available actions from status label alone.

### 4. Bookings / Appointments — no navigation maze

- Provide a List / Calendar toggle on the same route, shared status filters and search, and a detail drawer with Summary, Schedule/Capacity, Contact and Activity tabs/accordions.
- Create new booking in a focused modal. Confirm, reschedule and cancel via action-specific dialogs, retaining visible booking context on the underlying page.
- Render requested window as a readable date/time interval in provider-local timezone (not raw ISO and never `[object Object]`); handle absent/invalid windows gracefully.
- For any mutation, use the backend-required `capacity_pool_id`, `expected_revision`, idempotency key and other required fields **only per actual contract**. Do not guess IDs, fake capacity, bypass validations or retry unconditionally after a conflict.
- On 409/revision conflict, show "This booking has changed. Refresh and review the latest details"; refetch and require a fresh decision. Show actionable field-level validation, not raw internal parameter names as the main message.
- Crucial separation: **confirming a booking does not implicitly assign an agent, start a job or complete a visit**.

### 5. Jobs — one workspace, contextual tabs

- Jobs list: KPI strip for Open/Assigned/In Progress/Needs Attention only if authoritative counts exist; search, status/priority/date filters, job ID, concise service/site/asset info, schedule, assignee and next permitted action. Keep Jobs / My Work toggle.
- Job detail: short job header and compact summary (ID, priority, customer/site, asset, schedule, assignee, attention state), then tabs **Overview / Assignment / Execution / Evidence / History** within the same route. Do not render five giant always-expanded cards.
- Assignment: open a right-side drawer with server-provided eligible agents, skill/region/shift/holiday/leave/capacity information where available, date/time and review/confirmation. Honor expected revision and idempotency. Offer reassign only when authorized; don't imply an agent is assigned until success response confirms it.
- Execution: use a checklist/progress view with optional accordions (work session, notes, measurements). Show **only server-authorized** Start/Pause/Resume/Complete actions; do not render contradictory actions simultaneously. Apply mandatory checklist/evidence/approval gates exactly as returned/defined by backend.
- Evidence: tabs or expandable panels for notes, part usage, photos/documents and service proof. Preserve internal vs customer-visible note rules, quantity/unit validation, and current security policy: private files remain inactive/inaccessible until required anti-malware scanning succeeds.
- History: inline timeline (actor, timestamp, transition, revision) based on authorized history, with a link to broader audit history when available; no fabricated entries.
- If a job titled “finished” is still in CREATED state, show the true lifecycle state and avoid reinterpreting the title as its status.

### 6. My Work — actor scoped

- My Work lists only assignments the authenticated actor or authorized team can see. Do not show unassigned jobs as "assigned to me".
- Show assigned/due today/in-progress/needs update indicators if trustworthy server-sourced data exists. Enable quick accept/decline/start/update actions **only** when permitted.
- List view is required; board view is optional if the existing API and available scope justify it. Keep an easy path back to the current job details.

### 7. Data, safety and permission contract

- Every endpoint is tenant/provider scoped by backend authorization, not just client-side filtering; preserve existing provider context switching and clear stale caches when switching provider.
- Client role checks are a UX convenience, **never** the sole authorization boundary. Use server-provided allowed actions, permissions and authoritative lifecycle state. Never hard-code sample records into production UI.
- Keep optimistic locking (`expected_revision` or equivalent) and idempotency keys for commands when required. Refetch affected records after mutation; do not silently overwrite concurrent work.
- Map API validation and permission errors to user-facing explanations while preserving safe diagnostic detail for developers. 401, 403, 404, 409, 422 and network failures need distinct handling.
- Dates: readable locale formatting with consistent timezone and clear label; use machine ISO only for API payloads.
- Preserve accessibility, audit trails, XSS-safe rendering, document malware gates, and least-privilege visibility.
- Do not relax tests, remove security controls, create mock-backend success paths in production, or introduce new production credentials.

### 8. Reusable UI architecture (adapt to actual repo)

Prefer composition from reusable patterns instead of copy-paste per module:

- `OperationsShell` / provider context header
- `WorkspaceToolbar`, `SummaryMetric`, `StatusBadge`, `PriorityBadge`
- `FilterableRecordList`, `RecordDetailDrawer`, `ConfirmActionDialog`
- `RecordTabs`, `AccordionSection`, `ActionFeedback`, `EmptyState`
- `RequestForm` / `AppointmentForm` / `AssignmentForm`
- `JobOverview`, `JobAssignment`, `JobExecution`, `JobEvidence`, `JobHistory`
- Permission-aware `AllowedActions` and consistent API error translation

Names are illustrative; reuse existing components where possible. Do not introduce a new global UI library unnecessarily. Prefer current styling, type system and API tooling.

### 9. Delivery batches — stop at reviewable boundaries

**Batch 0: Audit / contract matrix.** Identify existing routes/actions, map UI components to exact OpenAPI endpoints and allowed permissions; record missing endpoints and forbidden assumptions. No feature changes.

**Batch 1: Shared UX shell.** Navigation consolidation, responsive components, reusable status/priority/filter/drawer/dialog primitives; tests and screenshots.

**Batch 2: Dashboard.** Real counters and actionable cards; provider-scoped query behavior; empty/loading/error states.

**Batch 3: Requests.** List plus create/edit/detail drawer and contact-resolution safety, using existing APIs only.

**Batch 4: Bookings.** List/calendar toggle, booking detail drawer, create/confirm/reschedule dialogs and correct capacity/revision/error handling.

**Batch 5: Jobs & My Work.** List/actor-scoped toggle, job detail tabs, assignment drawer, execution accordions, evidence, history, action gating.

**Batch 6: Validation, architecture sync and handoff.** Type-check, lint, test suites, production builds, accessibility and responsive checks; update `docs/ui-capability-checklist.md`, relevant ADR/design notes and route/permission/API mapping. Do not modify a frozen ADR without an approved amendment.

After each batch: show changed files, screenshots or component previews where possible, exact verification commands/results, API blockers, and items deferred. Ask for confirmation before changes outside approved scope, including Rails migrations/new endpoints.

### 10. Acceptance checklist — must be verified

1. Existing deep links continue to work; Dashboard -> Request -> Booking -> Job path is navigable and back navigation keeps filters.
2. Requests list/create/detail/edit use bounded authorized data, with validation and empty states.
3. Bookings list/calendar/detail/modal workflows stay in one working page and show human-readable date/time ranges; no `[object Object]` anywhere.
4. Booking mutation includes backend-required parameters; conflicts lead to review/refresh, not blind retry.
5. Jobs list and My Work are distinct scopes; My Work contains no unrelated/unassigned records.
6. Job detail tabs and assignment drawer avoid the long-scroll form; notes, parts, documents, history are usable only when authorized.
7. Lifecycle buttons are mutually valid for actual current state; no false "completed" indicators.
8. Backend remains the source of truth for provider scope, authorization and lifecycle; every command checks permission/revision rules.
9. File evidence activation does not bypass malware scanning and policy enforcement.
10. Desktop/tablet/mobile layouts, keyboard-only interactions and error/loading/empty states are verified.
11. `git diff --check`, lint, type-check, test and build pass (use repo's real commands; report numbers).
12. Architecture design, API mapping and UI capability checklist are synchronized without unsupported promises.
13. Platform Administration remains unchanged: provider-only changes do not alter platform routes, navigation, permissions, styling, or behavior.

**Output format from Codex:** First post an audit and proposed batch plan; then implement batches incrementally. Summarize changed files, implementation decisions, test/build results, screenshots, known API gaps, deferred tasks and next recommended batch. Avoid reporting unverified functionality as completed.

---

## Reference document installation (on the user's Mac)

After downloading the PDF to `~/Downloads/TRISE_Service_Provider_Operations_UIUX_Master.pdf`:

```bash
mkdir -p ~/wrk/lre/trise-architecture/docs/design
cp ~/Downloads/TRISE_Service_Provider_Operations_UIUX_Master.pdf \
  ~/wrk/lre/trise-architecture/docs/design/TRISE_Service_Provider_Operations_UIUX_Master.pdf
```

Optionally copy this Codex feed into the architecture repository under `docs/implementation/` as a change-controlled workplan.

## Notes on the design mockups

Screenshots contain **illustrative content**, not real data. The PDF includes dashboard, request, booking and job designs with Jobs/My Work tabs, Job Detail and operational drawers. Always cross-check screenshots against live capabilities, permissions, accessibility and backend contracts. A proposed label/button without a permitted API action is not permission to implement a fake success flow.
