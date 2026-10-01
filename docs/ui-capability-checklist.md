# UI capability checklist

This matrix records the current frontend state against implemented API contracts. “Implemented” means a route and typed transport exist; browser verification remains separate.

| Group | Actor / route | API operation(s) | Authority boundary | Implementation | Tests | Browser |
|---|---|---|---|---|---|---|
| A | Customer `/profile` | `GetCurrentUser`, `UpdateCurrentUser` | Authenticated identity; expected revision | Implemented | 2 contract tests; typecheck/build | API/browser route verified; mutation uses synthetic conflict test |
| A | Customer `/alerts` | `ListNotifications`, `MarkNotificationRead` | Recipient/provider scope | Implemented | 1 mutation contract test; typecheck/build | Seeded recipient notification exists; customer-authorized read/reload still requires customer browser session |
| A | Customer `/quotations` | `ListQuotations`, `ApproveQuotation`, `RejectQuotation` | Customer relationship and quotation revision | Implemented | 1 mutation contract test; typecheck/build | Two issued seeded quotations visible to provider preview; customer-authorized approve/reject still requires customer browser session |
| Existing | Customer `/assets`, `/asset/:id` | Asset list/get, location get | Asset/provider authorization | Implemented | Existing UI tests | Pending authenticated session |
| Existing | Customer `/asset/:id/request`, `/bookings` | Service type, booking, request, job reads | Asset/location authority; server lifecycle | Implemented | Existing UI tests | Pending authenticated session |
| Existing | Operations `/overview`, `/requests`, `/bookings`, `/jobs` | Request/booking/capacity/job/assignment/visit operations | Provider context and workforce authority | Implemented | Existing UI tests | Pending authenticated session |
| B | Operations agent execution | Visit/check-in/work-session/checklist/proof/parts/notes operations | Assigned-agent authority | Assignment/job detail, server-created visits, checklist discovery/create/update/complete, work-session start/end, notes, and parts controls wired | 3 focused operations transport tests plus existing UI tests; server lifecycle remains authoritative | Booking → job → eligible assignment browser-verified after seeded working-calendar binding; agent-authenticated visit/checklist/session execution remains blocked because the seeded agent has no Google identity and operator cannot impersonate it |
| C | Customer `/coverage` | Warranty and maintenance-contract list reads | Beneficiary/provider scope; unknown facts preserved | Implemented | Typecheck/build | API/browser empty state verified; populated coverage pending fixture |
| C | Customer `/documents`, `/documents/:id` | Document/version reads and signed download authorization | Association visibility; clean scan and available version required | Implemented | Typecheck/build | API/browser empty state verified; upload/scanner integration pending |
| D | Operations `/customers`, `/quotations`, `/configuration`, `/workforce` | Customer, quotation, typed configuration, agents/teams/skills reads; all Configuration lifecycle operations | Provider context, typed adapter validation, independent review authority | Complete typed form/adapters for all 20 registry kinds; create/edit/review/approve/revoke/activate/archive commands wired with revisions and idempotency | Configuration lifecycle transport test; typecheck/build | Configuration list and typed service-type form browser-verified; mutation/review requires a distinct authorized reviewer session |
| E | Operations `/audit` | Timeline read | Authorized provider/resource scope | Read-only bounded preview implemented | Typecheck/build | Pending populated browser verification |

Known contract boundaries: the customer booking API exposes requested windows, while confirmed appointment data must come from the explicit appointment relationship; the UI does not infer confirmation from a requested or rescheduled status. Document storage/scanning depends on the configured local adapters and is not represented as a fake success state. The development seed adds customer, dispatcher, operator, and agent personas plus two issued quotations and one in-app notification; only the operator is linked to a Google identity. Checklist/proof execution requires an authenticated assigned-agent identity; provider operators are correctly denied by the backend. The current local agent also lacks a working-calendar binding, so assignment correctly returned `NOT_WORKING` rather than creating false execution evidence.

## Audit notes

This checklist distinguishes route/transport implementation from workflow evidence. A control is not complete merely because it renders or has a handler.

| Area | Actual classification | Evidence or exact dependency |
|---|---|---|
| Customer home/assets/booking shell | IMPLEMENTED BUT UNVERIFIED | Typed transport and loading/error states exist; real authenticated customer journey remains pending browser evidence. |
| Customer quotations and notifications | IMPLEMENTED BUT UNVERIFIED | Mutation handlers preserve revisions/idempotency; customer-authorized populated approval/read-reload evidence still requires a customer session. |
| Customer coverage | PARTIAL | Authorized list reads exist; populated entitlement/allowance fixture and browser evidence are missing. |
| Customer documents | BLOCKED BY EXACT DEPENDENCY | Read/download UI exists; upload/finalization/scan acceptance requires the configured local storage and ClamAV adapters. |
| Operations appointments/capacity | IMPLEMENTED BUT UNVERIFIED | Existing API wiring is present; populated confirmation/reschedule browser evidence is incomplete. |
| Operations jobs/assignment | PARTIAL | Dispatcher controls exist, but assignment requires a valid working-calendar binding and an authenticated eligible agent. |
| Agent execution | BLOCKED BY EXACT DEPENDENCY | Checklist/session/proof/parts controls exist; the seeded Agent identity is not linked and the operator cannot impersonate that actor. |
| Configuration administration | PARTIAL | Typed adapters cover the accepted registry; lookup-dependent types with no authorized lookup operation remain blocked and independent reviewer browser evidence is pending. |
| Workforce and audit | IMPLEMENTED BUT UNVERIFIED | Bounded reads exist; populated role-specific browser evidence and mutation coverage are incomplete. |

### Known UX audit findings

- The customer service request screen exposes server-provided service choices, but request-type discovery is not available in the current contract; it must not be described as full request workflow support.
- Several legacy detail cards still expose technical identifiers as fallback text. These are diagnostics, not user-facing labels, and remain a cleanup item until the API supplies the corresponding human-readable relationship.
- Lists currently expose bounded previews rather than full pagination controls. They must not present preview counts as provider-wide totals.
- Configuration review identity is server-produced after submission; users must not type an internal review UUID. Types requiring unavailable authorized lookups remain blocked rather than accepting arbitrary identifiers.

## Operations layout refinement

The Operations header now uses one account/workspace menu for the authorized provider selector, language, appearance, self-profile editing, and sign-out. The selected provider remains visible in the workspace context panel. Provider switching reloads through the existing session-storage/context invalidation path; it does not grant or infer roles. There is no separate Operations profile route; the account panel reuses the approved `/me` self-profile flow.

The current Operations layout pass adds a compact 232px desktop sidebar, 64px header, route-specific titles for `/#overview`, `/#bookings`, `/#jobs`, `/#quotations`, `/#configuration`, `/#workforce`, and `/#audit`, responsive mobile navigation, and a self-profile editor inside the account panel using `GET /me` and `PATCH /me`. Workforce permission failures now show a forbidden state without presenting Retry as the primary action. Jobs now has the list/detail/assignment/evidence split described above; appointments, requests, quotations, workforce, and configuration still need the same focused list/detail refinement without new API contracts.

## Menu purpose and field coverage

This is the product-facing purpose of each Operations menu. Technical identifiers, revisions, idempotency keys, provider IDs, and actor IDs are context supplied by the authenticated session and selected records; they are never manual form inputs.

| Menu | Intended actors and objective | List / detail information | Commands and required inputs | Existing operations | Current classification / exact gap |
|---|---|---|---|---|---|
| Overview | Dispatcher, operator, provider administrator; understand the current bounded work queue and choose a next task | Bounded request, appointment, and job previews; actionable appointment records | Open the relevant queue; no fabricated aggregate action | `ListServiceRequests`, `ListServiceBookings`, `ListServiceJobs` | Implemented preview; API has no provider-wide aggregate totals in this screen |
| Appointments | Dispatcher/operator; confirm or change an actual appointment | Requested window, status, capacity context, and appointment detail when returned | Create, confirm, reschedule; selected booking, window, timezone, expected revision, idempotency handled by the client | `ListServiceBookings`, `ListCapacityPools`, `CreateAppointment`, `ConfirmAppointment`, `RescheduleAppointment` | Partial; list/detail separation and explicit relationship presentation remain to be applied |
| Jobs | Dispatcher/operator; find authorized jobs and assign eligible work | Searchable bounded jobs list; focused job overview with service label, schedule, status, revision, assignment and relationships when supplied | Assign/reassign through an authorized agent selector; expected revision and idempotency are context-derived | `ListServiceJobs`, `ListAgents`, `CreateAssignment`, `ListVisits`, `CreateVisit`, `ListAssignments` | Implemented structural split; explicit job-detail relationship response is not exposed, so missing asset/customer/location data is an API response gap, not inferred by UI |
| My work | Assigned agent or another actor with assignment authority; act only on work assigned to the current context | Own assignments, status, scheduled window, and focused execution detail | Accept/decline proposed assignment; assignment revision and idempotency are context-derived | `ListAssignments`, `AcceptAssignment`, `DeclineAssignment` plus visit/execution operations | Implemented controls; full agent browser evidence depends on a linked authenticated agent and valid execution prerequisites |
| Requests | Dispatcher/operator; triage incoming service requests | Summary, status, revision, creation time, bounded list | Open request and progress to supported booking action | `ListServiceRequests`, `GetServiceRequest` | Partial; current page is still list-oriented and lacks a focused detail/action flow |
| Quotations | Customer, dispatcher, approver, provider administrator according to server authority; review commercial scope | Line-item quotation records, totals, revision, expiry, decision state | Create/edit/submit/approve/reject with exact revision and authority | `ListQuotations`, quotation lifecycle operations | Partial; API-supported actions exist, but list/detail and populated role-separated browser evidence remain incomplete |
| Customers & assets | Authorized provider operator; locate a customer/asset relevant to service work | Human-readable records only where API supplies names; protected relationships and history | Open authorized detail; no ownership or asset transfer inferred from provider access | `ListCustomers`, asset read operations | Read-only bounded preview; customer/asset detail relationships and mutations remain contract-dependent |
| Workforce | Provider administrator/dispatcher; manage or select eligible people and teams | Agents, teams, skills, territories, leave/availability where authorized | Use eligible selection for assignment; workforce mutations only where implemented | `ListAgents`, `ListTeams`, `ListSkills`, `ListServiceTerritories`, `ListLeaveRequests` | Partial; current page combines several bounded previews and does not expose every administration mutation |
| Configuration | Provider administrator and independent reviewer; publish typed capability policy revisions | Typed registry list/detail, draft state, review state, version/predecessor | Create/edit draft, submit review, approve/revoke, activate, archive; typed fields and review authority are server-validated | Configuration list/detail/create/update/review/approve/revoke/activate/archive operations | Implemented typed forms for accepted registry; lookup-dependent types remain blocked when the contract has no authorized lookup |
| Audit history | Provider administrator/operator with audit authority; understand persisted business activity | Bounded timeline with action, actor where authorized, time, and outcome | Filter/paginate only through supported query parameters | `ListTimeline` | Read-only bounded preview; broader filters depend on the existing timeline contract |

### Job form field audit

| Form | User input | Context/server-derived | Optional/read-only | Guard and recovery |
|---|---|---|---|---|
| Assignment | Eligible agent selected from the authorized directory | Provider, job, actor, effective time, revision, idempotency key | Current assignment/status | Server eligibility/capacity and revision conflict are shown as errors; no agent UUID entry |
| Visit creation | No technical identifiers; optional human note is currently fixed to the supported operation | Provider, job, actor, idempotency key | Visit status and timestamps | Server lifecycle determines whether a visit can be created |
| Work note | Note text | Provider, job, actor, timestamp, revision/idempotency | Visibility is fixed to the supported internal-note contract in this form | Full-width labelled textarea; failed submission retains text |
| Part usage | Description, quantity, unit | Provider, job, actor, timestamp, usage kind, idempotency | Price, tax, stock, and inventory are not exposed because the API does not support them here | Numeric bounds and server validation; failed submission retains fields |
| Agent execution | Visit/job action data supplied by selected records | Agent authority, visit, effective time, expected revision, idempotency | Checklist/proof prerequisites are server-owned | Next action and unmet prerequisites are shown by the execution component |

The Jobs page now keeps administrative assignment separate from My work, uses “Showing N jobs in this bounded page” rather than a false total, and presents notes/parts in labelled task forms. Browser screenshots and authenticated workflow verification remain pending because browser tooling is unavailable in this execution environment; automated validation is run separately below.

## Operations route restructuring

| Area | List route | Detail route | Actions | Pagination | Tests | Browser |
|---|---|---|---|---|---|---|
| Jobs | `#jobs` | `#jobs/<job-id>` | Assignment form, visit creation, execution panel, notes, parts, My work accept/decline | Existing bounded job collection; next/previous cursor controls remain limited by the job adapter | Typecheck/build; existing transport tests | Pending browser tooling/authenticated verification |
| Appointments | `#bookings` | `#bookings/<booking-id>` | Confirm and reschedule with revision/idempotency; cancellation is not exposed because no approved UI operation is present in the current adapter | Server `page.next` plus bounded previous cursor history | Typecheck/build; existing transport tests | Pending |
| Requests | `#requests` | `#requests/<request-id>` | Read-only authorized detail; no additional lifecycle command is exposed by the current Operations adapter | Server cursor links | Typecheck/build | Pending |
| Quotations | `#quotations` | `#quotations/<quotation-id>` | Read-only provider detail; customer approval/rejection remains in the Customer flow; provider draft mutation is not yet wired in this screen | Server cursor links | Typecheck/build | Pending |
| Configuration | `#configuration` | `#configuration/<type>/<record-id>` | Existing typed draft/review editor; direct detail opens the authorized revision and returns to the editor | Existing typed registry list; cursor controls are not yet exposed by `ConfigurationAdmin` | Typecheck/build; existing configuration transport test | Pending |
| Workforce | `#workforce` | `#workforce/<agent-id>` | Authorized agent detail; no unsupported workforce mutation controls added | Server cursor links over agents | Typecheck/build | Pending |
| Audit | `#audit` | `#audit/<event-id>` | Read-only privacy-filtered event detail | Server cursor links and status filter | Typecheck/build | Pending |

### Remaining exact gaps

- Job list/detail responses still do not expose complete customer, asset, and location display relationships in the current UI adapter; the UI states when those relationships are not supplied rather than issuing one lookup per row.
- Workforce currently lists authorized agents; team, qualification, availability, leave, and territory detail routes require their corresponding relationship/detail operations to be wired separately.
- Configuration’s typed editor still uses its existing bounded list loader and does not yet expose cursor navigation for every registry type.
- No browser connector is available in this execution environment, so direct-route reload, Back behavior, visual screenshots, and authenticated action results remain browser-unverified.
