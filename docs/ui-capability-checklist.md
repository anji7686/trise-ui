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
| C | Customer `/documents`, `/documents/:id` | Document/version reads and signed attachment download authorization | Association visibility; finalized `NOT_SCANNED`, legacy `CLEAN`/`EXEMPT`, and available version required | Implemented | Typecheck/build | Malware scanning is disabled; browser transfer not run |
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
| Customer documents | PARTIAL | Read/download UI accepts authorized finalized versions; private storage remains required and malware scanning is disabled by platform policy. |
| Operations appointments/capacity | IMPLEMENTED | Provider list/calendar/detail/create/confirm/reschedule/cancel controls preserve requested-window semantics; authenticated provider list/calendar/create-dialog and readable-window checks passed; mutation success remains unexecuted to avoid changing demo data. |
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

The current Operations layout pass adds a compact 232px desktop sidebar, 64px header, route-specific titles for `/#overview`, `/#bookings`, `/#jobs`, `/#quotations`, `/#configuration`, `/#workforce`, and `/#audit`, responsive mobile navigation, and a self-profile editor inside the account panel using `GET /me` and `PATCH /me`. Workforce permission failures now show a forbidden state without presenting Retry as the primary action. Provider Jobs now has contextual Overview/Assignment/Execution/Evidence/History tabs and an assignment drawer; provider requests and appointments use focused list/detail workflows without new API contracts. Authenticated provider browser evidence remains pending when the local API is unavailable; signed-out desktop and narrow-width secure-workspace renders were smoke-tested.

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

## Operations navigation authority audit (2026-10-03)

The navigation now follows the capabilities that the current authenticated
session actually exposes. `GET /me` provides `platform_admin` and
`platform_capabilities`, but it does not provide provider membership roles or
an effective provider capability set. The client therefore does not infer
Provider Admin, Operations, Dispatcher, or Agent access from email, role
labels, selected provider, or route names.

| Actor/context | Visible navigation | Evidence and status |
|---|---|---|
| Platform Administrator | Platform Overview; Providers | `Session.platformAdmin` from `/me`; provider directory/detail remain read-only. Implemented from the current contract. |
| Provider Admin | Customers, Onboarding, Configuration; plus any additional capabilities returned for that provider | `provider_capabilities` is derived from active `PROVIDER_ADMIN`/`ADMIN` membership or existing `CUSTOMER_ADMIN` policy. Implemented. |
| Operations / Service Manager | Overview, Requests; Workforce/Audit only when returned | `provider_capabilities` is derived from existing `OPERATIONS`/provider-operations policy. Implemented. |
| Dispatcher | Bookings, Jobs | Existing `DISPATCHER` membership context. Implemented. |
| Agent | My Work | Existing `AGENT` membership context. Implemented; API still scopes records to assignments. |
| User without Workforce/Audit capability | Workforce and Audit are omitted from navigation; direct routes show an unavailable/forbidden state | No matching server capability means no menu or direct-route access. Implemented safe default. |
| User with both platform and provider authority | Platform navigation is separate; provider workspace is entered through the explicit provider context/account menu | Platform routes do not send a provider context header. Provider-side role split remains blocked until the session contract supplies it. |

Unimplemented platform modules—provider lifecycle mutations, SaaS plans and
subscriptions, billing, support access, and runtime platform configuration—are
not exposed as navigation entries. The required follow-up is an approved
server capability representation is now part of `/me`; provider API
authorization remains authoritative and independent of menu visibility.

### Capability contract

`GET /api/v1/me` and the Google session exchange now return
`attributes.provider_capabilities`. Each entry is `{ provider_id,
display_name, capabilities[] }` for one active, effective provider
membership. The UI selects the entry matching the selected provider and does
not union capabilities across providers. Inactive/revoked memberships and
customer/provider relationships without memberships are excluded.

The capability values are navigation projections, not new roles or grants:
`customers`, `onboarding`, `configuration`, `requests`, `bookings`, `jobs`,
`my_work`, `workforce`, and `audit`. They are derived from the existing
membership contexts and scoped role permissions documented in
`trise-architecture/architecture/authorization.md`.

| Area | List route | Detail route | Actions | Pagination | Tests | Browser |
|---|---|---|---|---|---|---|
| Jobs | `#jobs` | `#jobs/<job-id>` | Contextual Overview/Assignment/Execution/Evidence/History tabs, assignment drawer, visit creation, execution panel, notes, parts, My work accept/decline | Existing bounded job collection; next/previous cursor controls remain limited by the job adapter | Typecheck/build; existing transport tests | Authenticated provider Jobs/detail tabs/drawer and narrow-width overflow verified; My Work hidden when server capability is absent |
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

## Elevator breakdown journey slice (2026-10-02)

The broader elevator installation/AMC/breakdown feature-user audit is
authoritative in `trise-architecture/docs/domain/elevator-use-case-user-coverage.md`.
This UI checklist records only screen/operation evidence; it does not promote
generic API primitives to complete elevator business workflows.

| Step | Route | Existing API | Implementation | Evidence | Exact blocker |
|---|---|---|---|---|---|
| Customer selects authorized asset/service and requested window | `#/asset/:assetId/request` | `GetAsset`, `GetServiceType`, `CreateServiceBooking` | Implemented; selectors use authorized records and no internal UUID input | Existing customer transport tests; browser pending | This persists booking intent, not a breakdown `ServiceRequest` |
| Customer reports a breakdown case | `#/asset/:assetId/request` | `CreateServiceRequest` | Not implemented in this slice because its required `request_type_id` has no authorized customer discovery operation | Contract inspection | Current OpenAPI requires `request_type_id`; no `/request-types` or equivalent authorized discovery operation exists. The UI does not guess or request the UUID |
| Customer reviews request progress | `#/requests`, `#/request/:requestId` | `ListServiceRequest`, `GetServiceRequest` | Implemented detail route with authorized asset/location relationship labels and truthful pending state | Automated type/test validation; browser pending | Full booking/request/job relationship is only shown when supplied by the API |
| Operations triages and resolves contact | `#/requests/:requestId` | `GetServiceRequest`, `ListContactRoutingResolution`, `CreateContactRoutingResolution` | Implemented focused request detail and purpose-specific routing action | Transport path coverage added in source; browser pending | Routing evidence is not automatically attached to appointments/jobs and does not confirm or dispatch |
| Operations schedules/assigns | `#/bookings/:bookingId`, `#/jobs/:jobId` | Existing booking appointment and assignment operations | Existing UI wiring retained; journey linkage remains record-dependent | Existing UI implementation; browser pending | No new operation added |
| Agent executes assigned work | `#/jobs/:jobId` / My work | `ListWorkSession`, `StartWorkSession`, `PauseWorkSession`, `ResumeWorkSession`, `EndWorkSession`, checklist/notes/parts operations | Pause/resume/finish controls added; timer is derived from persisted intervals and is display-only | New pause/resume transport test; browser pending | Requires a real assigned-agent identity, visit, and server prerequisites; no impersonation or crew controls |
| Customer sees persisted outcome/history | `#/bookings`, `#/requests/:requestId` | Existing authorized booking/request/job reads | Existing progress views retained and request detail added | Browser pending | Customer-visible job relationship/history depends on explicit API relationships |

### Current journey classification

The supported UI journey is implemented through booking intent → Operations review/routing → existing appointment/job/assignment → agent persisted session execution, subject to the server’s existing lifecycle gates. A complete customer-created breakdown case is **BLOCKED BY THE EXISTING CONTRACT** until authorized request-type discovery is provided. This batch does not add a contract or reintroduce customer-entered UUIDs.

### Local elevator demo data (2026-10-02)

The development-only loader `trise-api/db/seeds/demo_elevator.rb` is invoked
from `trise-api/db/seeds.rb`. It creates provider-scoped synthetic records for
one standalone building, a three-building community, a common location,
nine elevator assets, contacts/responsibilities, explicit warranty/AMC asset
scopes, three jobs/assignments, and ACTIVE/PAUSED/ENDED work-session examples.
It does not create or alter Google identity mappings. The seed was run twice
against `trise_api_development` without duplicate records. Browser inspection
is available for the local Operations session; its exact Google-account
identity still requires explicit confirmation before it is treated as
real-account acceptance.

### Guided property onboarding (2026-10-02)

| Step | Actor | Route | API | Status | Browser evidence |
|---|---|---|---|---|---|
| Select existing customer relationship | Provider Operations | `#/onboarding` | `GET /customers`, `GET /customer-relationships` | IMPLEMENTED | PASS with local Operations session |
| Create community and three buildings | Provider Operations | `#/onboarding` | `POST /locations` | IMPLEMENTED | PASS; records persisted and survived reload |
| Capture Indian address and map coordinates | Provider Operations | `#/onboarding` | `POST /locations` (`address_lines`, `time_zone`, optional `latitude`/`longitude`) | IMPLEMENTED | Rendered form inspected; coordinates are persisted as location data, with no live tracking |
| Choose standalone property template | Provider Operations | `#/onboarding` | `POST /locations` with generic `classification` | IMPLEMENTED | PASS for standalone building; commercial/industrial/tech-park classifications remain configuration examples, not industry branches |
| Capture typed floors, homes/units and elevator market metadata | Provider Operations | Future property/asset screens | No normalized floor/unit contract; asset metadata requires configured `AssetDefinition` attributes | BLOCKED BY API/DATA MODEL | Not fabricated; typed hierarchy and metadata schema are required |
| Register six elevator assets | Provider Operations | `#/onboarding` | `GET /asset-definitions`, `POST /assets` | IMPLEMENTED | PASS; all six building-qualified labels persisted |
| Create association/manager/security parties | Provider Operations | `#/onboarding` | No approved party-creation flow in current UI/API | BLOCKED | Not run |
| Create contacts/responsibilities/representation/management | Provider Operations | `#/onboarding` | Existing APIs require existing authorized party IDs | PARTIAL | Blocker shown; no fabricated records |
| Grant customer access | Provider administrator/customer authority | Existing membership/invitation operations | No complete onboarding UI for this property access step | PARTIAL | Not run |

The walkthrough uses the distinct label **Green Meadows Walkthrough** and
resumes existing records by name rather than silently duplicating them. The
browser evidence is from the locally authenticated Operations session; its
intended Google-account identity should be confirmed before treating it as
real-account acceptance. A rendered address/map form was captured at
`trise-ui/docs/evidence/onboarding-address-map-form.png`.

## Platform administration slice (2026-10-03)

### Visual correction batch (2026-10-04)

Applied to Operations only, using the local UBold Orders PDF as the directory
reference. The requested account-settings PDF was not present in the local
reference directory, so the existing Operations form primitives were used for
the grouped provider form pattern; no external or scratch-path reference was
used.

| Area | Change | Automated evidence | Rendered evidence |
|---|---|---|---|
| Operations shell | Natural-ratio logo sizing, 64px header geometry, 232px sidebar, viewport-bounded account menu, narrow-width overflow protection | 35 UI tests; typecheck/lint/build/budget pass | NOT RUN: local dev services/browser session unavailable in this execution |
| Navigation | Local SVG icons with consistent stroke/size; removed Unicode sidebar glyphs | SVG accessibility regression tests; typecheck pass | NOT RUN |
| Provider directory | Orders-style toolbar, readable status labels, accessible table caption, icon-labelled filters/details/pagination | Existing data/navigation tests plus new SVG tests | NOT RUN |
| Provider forms | Grouped identity/address sections, paired responsive fields, required markers, consistent action footer, Save/Submit icons | Typecheck/lint/build pass | NOT RUN |
| Provider detail | Human-readable statuses and audit actions; clearer review/document empty states | Typecheck/build pass | NOT RUN |
| Customer application | No source or styling changes in this batch | Customer build remains 69.42 KB gzip | Not inspected in this batch |

Visual reference index: [UBold reference index](../../trise-architecture/docs/ubold-reference-index.md).

| Route | Actor | API operations | Implementation | Automated evidence | Browser evidence |
|---|---|---|---|---|---|
| `#/platform/overview` | Explicit platform administrator | `GET /platform/overview` | IMPLEMENTED: authoritative provider status summaries; no subscription data is presented | API integration test; UI typecheck | NOT RUN: no designated platform-admin Google identity enrolled |
| `#/platform/businesses` | Explicit platform administrator | `GET /platform/businesses`, `GET /platform/providers?filter[business_id]=...` | IMPLEMENTED: searchable, cursor-paginated Business directory with provider-account counts; rows open the server-filtered child-account directory or start registration with Business preselected. Business-level profile/detail workflows are not implied by the summary API | API integration test; routing/data tests; typecheck/lint/build | NOT RUN: Chromium launch remains blocked; no rendered screenshots or interactions |
| `#/platform/providers` | Explicit platform administrator | `GET /platform/providers` with supported status and Business filters | IMPLEMENTED: UBold-style searchable, status/Business-filtered, cursor-paginated read-only directory | API integration test; UI tests; typecheck | NOT RUN |
| `#/platform/providers/:providerId` | Explicit platform administrator | `GET /platform/providers/:providerId`, `PATCH /platform/providers/:providerId` | IMPLEMENTED: detail, bounded audit history, allowlisted profile edit; lifecycle remains read-only | API/UI tests; typecheck/build | NOT RUN |
| `#/platform/providers/new` | Explicit platform administrator with `PLATFORM_PROVIDER_REGISTER` | `POST /platform/providers` | IMPLEMENTED: choose an existing Business or create one with the first provider account using compact Existing/New Business radio options, then choose exactly one searchable Business Operation. Modal and full-page entry share the same form. Continues into the existing six provider-onboarding stages | API/UI tests; route tests; typecheck/build | NOT RUN: Chromium launch remains blocked |
| `#/platform/providers/:providerId/business-profile/edit` Business | Platform administrator with `PLATFORM_PROVIDER_PROFILE_WRITE`; explicit target provider, no provider membership required | `GET/PATCH /platform/providers/:providerId/business-profile`, `POST /platform/providers/:providerId/business-profile/submit`, provider-operation API | IMPLEMENTED: platform-scoped edit/save/submit; one searchable Business Operation is preloaded from registration; operation changes are pre-activation only and separately confirmed; profile and operation edits save as separate requests | API request tests; platform header-isolation data test; typecheck/build | NOT RUN: Chromium launch remains blocked |
| Provider onboarding stepper | Capability-gated platform administrator or authorized delegated onboarding manager for explicit provider | Existing provider, business, contact, office, document, plan/request and verification reads | IMPLEMENTED: six stages show backend-derived states; direct navigation is limited by existing UI capabilities; operational lifecycle remains separate from registration review | `provider-detail-model.test.ts`, routing tests, typecheck/lint/build | Browser NOT RUN; Chromium launch previously blocked |
| `#/platform/providers/:providerId/onboarding` Contacts & locations | Platform administrator with onboarding authority or delegated manager assigned to the target provider | `GET/POST/PATCH /platform/providers/:providerId/onboarding/contacts`, `POST .../:contactId/end`, `GET/POST/PATCH /platform/providers/:providerId/onboarding/locations` | IMPLEMENTED: persisted primary/secondary contacts require email + mobile; landline is optional; office addresses are India-only with six-digit PIN validation and optional persisted latitude/longitude. No identity, membership, customer-access or service-coverage side effects | `platform_administration_api_test.rb` (18 tests/124 assertions); UI typecheck/build; API contract reconciliation | NOT RUN: no browser connector/authenticated real-account evidence. PIN lookup is wired but production data import remains blocked pending the official CSV |
| `#/platform/providers/:providerId/onboarding/review` Review & Activate | `PLATFORM_PROVIDER_READ`; separate lifecycle action requires its explicit server capability | Existing provider/profile, documents, verification reviews, contacts/offices, plan/subscription/request, and invitation reads | IMPLEMENTED: compact readiness summary and six collapsible evidence groups; activation CTA routes to separate lifecycle screen and API remains authoritative; scan state is represented exactly | Model/routing tests; typecheck/lint/build | Browser NOT RUN; no new screenshots or rendered workflow evidence |
| `#/platform/providers/:providerId/onboarding/subscription` Plan & Approval | Platform plan/subscription read; request actions require `PLATFORM_SUBSCRIPTION_WRITE` | Published plan versions, subscriptions, requests, usage, changes and timeline operations | IMPLEMENTED: dynamic published-plan comparison cards precede accepted subscription, entitlements/usage, validity, upgrade request and approval details; default demo plan policy remains API-owned | Subscription workflow tests; typecheck/lint/build | Browser NOT RUN; no new screenshots or rendered workflow evidence |
| `#/platform/providers/:providerId/onboarding` India address entry | Platform administrator or delegated onboarding manager | Existing onboarding location API; PIN reference API remains available for future consumers | UI uses fully manual India address entry. State, District, City, PIN and landmark are entered by the operator; PIN is format-validated only and never autofills fields | Operations tests/typecheck/lint/build | Browser NOT RUN |

### Provider onboarding foundation (2026-10-05)

The Platform workspace now has a persisted Contacts & locations step reachable
from provider detail. Completion is derived from the server lists, not from
visiting the route. A contact is a provider-owned contact point plus an
explicit responsibility assignment; an office is a provider office record,
not an asset service location. Primary uniqueness is enforced per provider
and responsibility type. Neither action creates a login, membership, grant,
customer relationship, AMC coverage or notification.

Delegated onboarding requires both an active platform grant containing
`PLATFORM_PROVIDER_ONBOARD` and an active assignment for the explicit target
provider. Assignment creation and ending remain platform-lifecycle actions;
review/verification authority is not inherited. The assignment APIs are
`POST /api/v1/platform/provider-manager-assignments` and
`POST /api/v1/platform/provider-manager-assignments/:assignmentId/end`.

Remaining onboarding blockers are registration/licence-specific typed
evidence, support-team membership, document transfer/scanning, section-level
feedback, amendment workflows and real Google/browser acceptance.
Delegated managers also cannot create a provider until the API has an
approved pre-provider onboarding-scope representation; the current create
provider action remains limited to `PLATFORM_PROVIDER_REGISTER`.
| `#/platform/providers/:providerId` Documents | Explicit platform administrator with `PLATFORM_PROVIDER_DOCUMENTS`; explicit target provider | `GET /platform/providers/:providerId/documents` plus targeted generic document transfer operations where configured | IMPLEMENTED: bounded document metadata/version and explicit `NOT_SCANNED` state; transfer remains private and fails closed when storage is unavailable | API document authorization regressions; UI build | NOT RUN |
| `#/platform/providers/:providerId/business-profile/edit` Provider logo | Platform administrator with `PLATFORM_PROVIDER_DOCUMENTS`, or provider operations in its own provider context | Generic private document create/upload-finalization plus `GET/POST/DELETE /platform/providers/:providerId/logo` and provider logo equivalents | IMPLEMENTED: exact current `NOT_SCANNED` image version association, replacement history, private signed retrieval, local preview, and storage failure states | Focused logo API tests; Operations tests/typecheck/build | Browser NOT RUN; malware scanning is disabled |
| Provider logo crop modal | Same authorized actors | Uses the existing processed-file upload lifecycle; no new API contract | IMPLEMENTED: accessible square crop modal, contain-fit wide-logo handling, drag/touch positioning, keyboard nudges, zoom, reset, alternate image, cancel, transparent preview, decoded-dimension and input validation, processed Blob checksum/metadata | `logo-crop.test.ts` (validation and contain-fit); lint/typecheck/build/bundle required | Browser NOT RUN; real private-storage upload not run |
| `#/platform/providers/:providerId` Review history | Explicit platform administrator | `GET /platform/providers/:providerId/business-profile/reviews`, `POST /platform/providers/:providerId/verification-reviews/:reviewId/decision` | IMPLEMENTED: exact revision-bound review history and lifecycle-capability actions | API profile/review tests; UI typecheck/build | NOT RUN |
| `#/business-profile` | Provider administrator with server capability `business_profile` | `GET/PATCH /providers/business-profile`, `POST /providers/business-profile/submit`, `GET /providers/business-profile/reviews`, `GET /documents`, `POST /documents/:documentId/versions/:versionId/reviews` | IMPLEMENTED: edit, save, submit, correction/rejection visibility, resubmission, revision/conflict handling, authorized document metadata and exact-version review submission; transfer remains fail-closed when adapters are unavailable | 32 UI tests; focused API/document tests; typecheck/build | Authenticated browser NOT RUN |
| Provider activation, verification, membership setup and lifecycle mutations | Explicit platform administrator | No operation exposed in this batch | NOT IMPLEMENTED / DEFERRED | No mutation route is exposed | NOT RUN |
| Non-platform route access | Provider/customer/agent | Same platform operations | IMPLEMENTED: forbidden state and API denial; no provider role escalation | API integration test | NOT RUN |

### Platform boundary notes

The platform route is separate from provider workspace context. A platform
grant does not grant provider customer, job, or commercial data access. The
development seed contains an explicit local grant for `<PRIVATE_EMAIL>`,
but no Google identity mapping is created by the seed; normal verified identity
enrollment is still required for browser login. SaaS plans, subscriptions,
usage limits, trials, renewal, payment and subscription enforcement remain
NOT IMPLEMENTED / deferred to a separate approved batch.

### Platform management capability verification

| Area | Status | Evidence / route | Follow-on |
|---|---|---|---|
| Platform overview | IMPLEMENTED | `apps/operations/src/platform-admin.tsx`, `#/platform/overview`, `GET /platform/overview` | Add only authoritative platform summaries when contracts exist |
| Provider directory/detail | IMPLEMENTED | `#/platform/providers`, `#/platform/providers/:providerId`; read-only GET operations | Real platform-admin browser verification remains pending |
| Platform-admin identity lifecycle | PARTIAL | Server grant/bootstrap exists; no real Google enrollment verified | Complete controlled owner enrollment and revocation evidence |
| Provider onboarding/lifecycle | MISSING IN THIS BATCH | No provider mutation routes exposed | Separate approved provider-lifecycle batch |
| SaaS plans, subscriptions, trials, renewals | MISSING | No supported API or UI | Define and approve SaaS subscription architecture |
| Entitlements and usage limits | MISSING | No supported API or UI | Implement server-side entitlement model after plan decision |
| Invoicing/payments | MISSING | No supported API or UI | Separate billing/payment design and integration |
| Audited support access/reporting | PARTIAL | Existing audit history is read-only provider metadata | Define least-privilege cross-provider support policy |
| Runtime domain/workflow configuration | PARTIAL | Provider configuration routes are separate and provider-scoped | Keep platform-wide configuration out of this surface until authorized |

## UBold-style admin pattern adaptation (2026-10-03)

No UBold package, source tree, or product license was found in the repository
or installed dependencies. The implementation therefore uses the existing
React/Vite system and TRISE tokens, adapting general dashboard patterns only.

| Feature | Existing route | Existing API support | UI status | Pattern applied or remaining gap |
|---|---|---|---|---|
| Platform provider directory | `#platform/overview`, `#platform/providers/:id` | Platform overview, provider list/detail read APIs | Implemented | Guarded platform layout, authoritative summaries, provider directory and read-only detail; real platform-admin browser evidence pending. Registration and lifecycle are deferred. |
| Customer/property/elevator CRM | `#/assets`, `#/asset/:id`, `#/onboarding` | Authorized assets, locations, definitions, staged location/asset creation | Partial | Existing cards/forms retained; customer/property detail and contact relationship views remain incomplete |
| Requests and contact routing | `#requests`, `#requests/:id` | Request reads and contact-routing resolution | Implemented but unverified | Compact list/detail, filter toolbar, routing evidence; does not dispatch or confirm appointments |
| Appointments/jobs | `#bookings`, `#bookings/:id`, `#jobs`, `#jobs/:id` | Booking, appointment, assignment, job, visit, session operations | Implemented but unverified | List → detail → action flow and task sections; populated authenticated browser evidence pending |
| Agent My Work/work sessions | Jobs/execution sections | Assignment and persisted work-session operations | Partial | Session controls and persisted-duration display exist; dedicated agent-only route and recovery remain limited by current contracts |
| Workforce | `#workforce`, `#workforce/:id` | Bounded agents/teams/skills/availability operations | Partial | Bounded list/detail pattern; full workforce administration relationships are not all wired |
| Quotations/AMC | Customer quotations; Operations `#quotations`; `#coverage` | Quotation decisions and coverage reads | Partial | Commercial cards and status hierarchy; invoice/payment, preventive scheduling and renewal remain unavailable |
| Invoices/payments | No supported route | No complete invoice/payment execution contract | Not implemented | No fabricated finance controls |
| Installation projects | No supported route | Installation stage/dependency/commissioning coverage incomplete | Not implemented | No simulated progress |
| Documents/audit | Customer documents; Operations `#audit` | Authorized document/download and timeline reads | Implemented but unverified | Detail cards and privacy-safe history; storage remains environment-dependent and scanning is disabled |
| Calendar/notifications/reporting | Alerts and bounded operational previews | Notifications and selected calendar/availability reads | Partial | Existing notification/list patterns; delivery acknowledgement and full reporting aggregates remain unverified |

The shared visual primitives now include `PageHeader`, `FilterToolbar`,
`DetailSection`, `Status`, `Button`, and `StatePanel`. Operations list/detail
routes use the compact page-header and filter-toolbar pattern. No business
state, totals, permissions, or unsupported API operations were introduced.

## Provider-side route inventory and dashboard application (2026-10-03)

Customer routes are intentionally excluded from this pass. The following
routes are provider-side Operations routes and remain server-authorized; menu
visibility is not treated as permission evidence.

| Role experience | Route | Existing API-backed capability | Dashboard treatment | Status/blocker |
|---|---|---|---|---|
| Provider Admin / Operations | `#overview` | Bounded requests, bookings, jobs, provider context | Compact overview shell, summary cards labelled as previews, work/attention panels | Implemented; aggregate totals remain unavailable |
| Operations / Service Manager | `#requests`, `#requests/:id` | Request reads, contact-routing resolution | Filtered list → detail → focused routing action | Implemented; routing does not dispatch or confirm |
| Dispatcher | `#bookings`, `#bookings/:id` | Booking, appointment creation/confirmation/reschedule | Compact list/detail and lifecycle action footer | Implemented; populated browser evidence pending |
| Dispatcher / Operations | `#jobs`, `#jobs/:id` | Job reads, visits, assignments, notes, parts, checklists, sessions | Separate job management, assignment, execution, evidence sections | Implemented; one-active-assignment invariant remains |
| Agent / Technician | Jobs `My work` tab | Authorized assignments and persisted work sessions | Focused work tab, next session action, persisted duration | Partial; no dedicated route, crew/recovery unsupported |
| Provider Admin / Operations | `#customers` | Bounded customer/asset previews | Compact record cards and forbidden/empty states | Partial; customer/property detail relationships are limited by API payloads |
| Provider Admin / Operations | `#onboarding` | Staged customers, locations, definitions, assets | Step-based onboarding with compact forms | Implemented; contacts/party creation and access workflow blocked |
| Provider Admin / Operations | `#quotations` | Provider quotation reads | Compact list/detail status hierarchy | Partial; provider draft mutation and invoice/payment unsupported |
| Provider Admin / Operations | `#configuration`, `#configuration/:type/:id` | Typed registry CRUD/review/activation/archive | List → typed form → review/action structure | Implemented; browser mutation evidence pending |
| Provider Admin / Workforce manager | `#workforce`, `#workforce/:id` | Agents, teams, skills, selected availability data | Bounded directory/detail pattern | Partial; full qualifications/leave/territory administration is not one complete screen |
| Provider Admin / Auditor | `#audit`, `#audit/:id` | Timeline/audit reads | Read-only compact history/detail pattern | Implemented but unverified |
| Explicit platform admin | `#platform/overview`, `#platform/providers/:id` | Platform provider overview/list/detail read APIs | Isolated platform layout and forbidden state | Implemented; real platform-admin browser access pending |
| Explicit platform plan manager | `#platform/plans`, `#platform/plans/new`, `#platform/plans/:id`, `#platform/plans/:id/edit` | Plan catalogue list/detail/create/draft update/validation/publish/retire | Search/filter table, grouped editor, readiness blockers, version history, retirement warning and provider-facing preview | Implemented locally; capability-gated; authenticated desktop/mobile browser evidence pending; provider self-service excluded |
| Provider-side profile/context | Account menu / profile panel | `GET/PATCH /me`, provider selection, preferences | Compact account menu; selected provider stays visible | Implemented; authority remains server-side |
| Provider Admin / Operations | Contacts, responsibilities, coverage, calendar, installation projects | No complete provider route for each capability | Not exposed as fake navigation | Contacts/coverage/install/calendar screens require additional UI/API integration |

The compact shell styling is now Operations-only in `apps/operations/src/`.
The shared primitive exports remain available, but their dashboard CSS is not
loaded from the shared package, preventing this provider pass from changing
Customer rendering.

## Provider onboarding foundation (2026-10-05)

| Step | Route/API | Status | Exact boundary |
|---|---|---|---|
| Provider identity | `#platform/providers/new` → `POST /api/v1/platform/providers` | Implemented | Creates a pending provider only; no identity, membership, activation, subscription, or notification |
| Business profile | `#platform/providers/:id/business-profile/edit` → `GET/PATCH .../business-profile` | Implemented | Revisioned legal/address profile; save is separate from submit |
| Submit/review | Existing provider detail review actions | Implemented | Exact submitted revision; correction/reject reasons; reviewer decision remains platform-authorized |
| Contacts, locations and support teams | Existing independent APIs | Partial | No complete platform onboarding selectors or persisted wizard resource |
| Documents | Provider/platform document metadata and review | Partial | Private transfer remains storage-dependent; scanning is disabled and no clean result is fabricated |
| Approved-information amendments | No approved operation | Not implemented | Material profile edits invalidate current verification; a pending amendment policy/API is still required |

The new provider form presents the supported identity → business profile
sequence and clearly labels later steps as not started. It does not imply
that unsupported contacts, locations, teams, documents, or approvals were
created by the wizard.

## Platform subscription administration UI standardization (2026-10-11)

| Screen | Route / API | Status | Exact boundary |
|---|---|---|---|
| Plans & Pricing | `#platform/plans`, plan detail routes; plan list/detail/version APIs | Implemented | Cursor paging; server name/industry/plan-state filters; billing-cycle filtering applies to loaded records; immutable publication remains server controlled |
| Provider Subscriptions | `#platform/subscriptions`, `#platform/subscriptions/:id`; subscription/detail/change APIs | Implemented | Dedicated subscription detail URL and commercial snapshot; lifecycle activation remains separate; non-list change history remains loaded-page scoped |
| Requests & Approvals | `#platform/subscription-requests`, `#platform/subscription-requests/:id`; request/decision/evidence/activation APIs | Implemented | Review is primary list action; separate capability gates and transitions; required review reason retained; no provider editing from queue |
| Usage & Limits | `#platform/subscription-usage`; provider-scoped usage API | Implemented | API-projected metrics and limits only; absent entitlement, unlimited and finite limit display distinctly; elevator deduplication remains server authoritative |
| Billing & Payments | `#platform/subscription-billing`, `#platform/subscription-billing/new`, `#platform/subscription-billing/:invoiceId`; invoice, billing-context, tax-preview, evidence, email and PDF APIs | Implemented with browser evidence blocked | Four-step invoice wizard, server-backed eligible subscription search, authoritative billing context/tax preview, immutable issue flow, inline authenticated PDF preview with explicit download, payment/delivery actions; server does not expose a separate invoice audit endpoint |

Shared platform admin header, filter, data table, empty state and pagination
components are in `platform-admin-ui.tsx` and reused by provider and
subscription administration. Subscription API filtering is partial for
requests, subscriptions, changes and invoices; affected screens label loaded
page scope. Typecheck, lint, 143 tests, builds and bundle budgets pass. Formal
Playwright visual/browser acceptance remains blocked by the preserved Chromium
launch crash; see the dated evidence in `docs/testing/browser-readiness-report.md`.

Tax Management (`#platform/taxes`) is implemented locally with API-backed
templates, draft rules, legal sources, imports and readiness actions. Its
authenticated browser evidence remains blocked by the host-level Chromium,
Chrome and WebKit launch crashes documented in `docs/browser-environment-blocker.md`.

## Business Operations single-operation provider accounts (2026-10-12)

The Platform shell now exposes a Business directory using the existing
read-only paginated Business API. It presents only returned name, ID and
provider-account count. “Add provider account” starts the existing provider
registration workflow with that Business selected; the server remains
authoritative for Business membership and exactly-one-operation assignment.
The six provider onboarding stages remain unchanged. Business-level legal
profile, documents, approvals and detail mutations are not represented as
implemented UI because the accepted Business summary contract does not expose
those shared workflows.

| Capability | Route / API | Status | Exact boundary |
|---|---|---|---|
| Business Profile operation selection | `#platform/providers/:id/business-profile/edit`; catalogue and provider-operation APIs | Implemented | One searchable single-select loads the registration-saved operation; draft account changes are revision checked, and activated accounts are locked until a controlled transition workflow exists. The selected option remains visible if it is no longer selectable for new accounts |
| Provider Detail Business Operation | `#platform/providers/:id?tab=operations`; platform provider-operation APIs | Partial | Displays one selected operation, its Industry, actual association status and provider subscription state; changes are available only before activation. Workspace readiness remains unavailable from the current API |
| Plan applicability | `#platform/plans`; plan-version APIs | Partial | Draft form, list filter, detail and catalogue labels use canonical Business Operation IDs/names; Industry remains a separate sector field; provider-type eligibility and operation-specific entitlements are not yet modeled |
| Platform catalogue management UI | Business Operation catalogue APIs | Not implemented | Existing provider-profile-write authority protects APIs; no catalogue list/create/edit screen is exposed yet |
| Operations workspace switcher and operation-scoped records | Operations shell and operational APIs | Not implemented | No workspace switcher is exposed because operation-level workforce grants and operation-filtered operational records are not yet implemented server-side |

The Operations provider selector remains an authorized provider-account
context selector, not an operation-only workspace selector. It lists provider
accounts returned to the authenticated user; membership in one Business-owned
provider account does not imply access to its siblings. A selected operation or
a saved preference cannot grant provider access. The registration existing/new
Business radio options use compact, fully clickable inline labels with the
native controls kept at intrinsic dimensions by scoped form CSS.

## Global responsive form layout and alignment (2026-10-12)

| Capability | Status | Exact boundary |
|---|---|---|
| Shared admin page and form widths | Implemented | Operations admin content uses up to 1280px and provider form cards up to 1120px, within the shell’s available width |
| Responsive form sections and grids | Implemented | Two columns are used when the form container allows; fields stack at narrow container widths, including dialogs |
| Provider Registration and six-stage stepper | Implemented in source | Related identity/business fields align in columns; the stepper adapts to six, three or two columns without a forced horizontal minimum |
| Business Profile, Contacts and Offices | Implemented in source | Address/name spans and contact groupings are explicit; office coordinates keep geolocation beside the coordinate fields and action footer |
| Operations onboarding forms | Implemented in source | Existing onboarding form controls use the shared container-aware two-column pattern |
| Typed configuration editor | Implemented in source | Editor and draft fields use a responsive split/list layout with full-width multiline inputs and stacked actions at narrow container widths |
| Rendered viewport and modal acceptance | Blocked | No screenshots or browser rendering checks are claimed because the earlier terminal Chromium CLI launch failed; see `docs/testing/browser-readiness-report.md` |

The UI changes preserve Business Operation single-select, API payloads,
validation and server authorization. Typecheck, lint, 148 tests, both builds,
bundle budgets and `git diff --check` passed. The Customer application CSS was
not changed.

## Roles & Permissions — 2026-10-12

- Implemented: platform default role catalogue/draft editor, permission matrix, independent review/publish and delegation controls guarded by explicit server capabilities.
- Implemented: provider Settings → Team & Access; Members role badges and multi-select assignment; locked platform defaults; delegated custom-role create/edit/enable/disable; assigned-member view; existing administrator invitation history.
- Implemented: generated OpenAPI types, account-scoped signed pagination, stale-response/context cleanup, validation/error/loading presentation and Operations-only design components. Customer build source experience remains separate.
- Automated: 154 frontend tests, application/browser typechecks, lint, both builds and bundle budgets passed; Rails full suite 566 tests / 3,984 assertions; OpenAPI strict validation zero findings (20 access / 491 total operations).
- Browser: host-terminal Chromium with sandbox enabled passed 24 checks at desktop/tablet/mobile, including independent default publication, default/custom enable/disable, read-only defaults, persisted custom permissions and three roles on one existing member. Four inventory/cleanup repetitions were intentionally desktop-only; complete role workflows ran at every Operations width. Sixty-three real screenshots and diagnostics are preserved. See [browser readiness report](testing/browser-readiness-report.md).
- Remaining live case: matching selected-operation catalogue/assignment; approved demo providers have no active Business Operation recorded and the specific local configuration choice remains unanswered. Backend operation eligibility regressions pass.
- Cleanup: separately approved temporary local platform grants revoked; original member roles/delegation restored; verification roles disabled with immutable history retained. Google local-origin rejection recorded separately; approved local credential authentication used.
- Current catalogue: nine existing enforced capabilities; unsupported action checkboxes omitted. Sensitive role assignment and platform authority provisioning remain separately controlled.

## Team & Access simplification follow-up — 2026-10-12

- Implemented: Members / Invitations / Available Roles at `/team-access`, truthful legacy membership labels, compact role badges, Add Member invitation form with multiple role choices, and a signed-in recipient acceptance view. The new staff invitation currently targets an existing verified TRISE user; it creates no outbound email. Platform default definitions remain read-only to providers. Custom-role actions appear only when the server's provider policy permits them. When custom-role management is disabled, disabled historical custom roles are omitted from Available Roles; existing member assignments remain visible.
- Implemented: platform page at `#platform/roles`, version/history controls, readable applicable-action matrix and a platform custom-role policy control. Navigation requires `PLATFORM_ACCESS_READ`; authoring, independent review and publishing have separate server grants. No active local platform grant exists now, so authenticated browser coverage of this page is pending separate named authority approval.
- Verified: 156 component tests, app/browser TypeScript checks, ESLint, both production builds, nine terminal Playwright checks at three widths for signed-out Customer/Operations and authenticated provider Team & Access. The current provider has no eligible published default role, so Add Member's empty state is visible and submission is disabled. Invitation creation/acceptance and multi-role persistence were verified by Rails integration tests, not this browser run.
- Outstanding: publish canonical templates after action/scope checks, demonstrate a full invitation flow in a normally authenticated browser with eligible roles, and isolate future browser fixture mutation. See [browser evidence](testing/browser-readiness-report.md) and [ADR-067](../../trise-architecture/adr/067-role-governed-team-memberships.md).
# Platform Roles & Permissions redesign — 12 October 2026

## Compliance review ownership correction — 2026-10-14

- Platform Compliance is limited to Business and Service Provider governance requests; Agent and Asset requests are not actionable in that queue.
- Provider Operations now has a real Provider-owned compliance review queue for Agent and Asset requests, backed by scoped Rails APIs and explicit Provider compliance capabilities.
- Provider review assignment and decisions use the shared governance service, revision protection and maker-checker rules; no frontend-only approval state is used.
- Customer Complaints and Service Jobs remain in their operational modules and are not represented as compliance review requests.
- Provider queue browser approval remains `IMPLEMENTED_NOT_VERIFIED` pending an authenticated Provider reviewer fixture with the explicit review capabilities.

- [x] Default Roles, Provider Role Settings and Permission Delegation are separate tabs.
- [x] Role search, lifecycle/operation/version filters, sorting and 10/25/50 cursor pages are server-backed.
- [x] Row actions are compact and capability/state aware; published definitions create successor drafts.
- [x] Category/module/action checkboxes expose native mixed state and preserve protected descendants.
- [x] Draft and delegation edits show unsaved state and retain revision/audit commands.
- [x] Provider-policy search and filters use the authorized server dataset and show policy impact context.
- [x] Current-page selection is explicit; no all-results bulk action is implied.
- [ ] Historical browser-verification roles need reliable provenance before ordinary views can exclude them safely.
- [ ] Dedicated role security-audit pagination and atomic multi-role lifecycle APIs remain gaps.

## Compliance UX refactor — 2026-10-15

## Platform human-readable references — 2026-10-15

- [x] Added typed human-readable display infrastructure with UUID-safe fallbacks and tests.
- [x] Added a full UI inventory covering Platform, Business, Provider, Customer, Operations, documents, notifications and exports.
- [x] Business Compliance primary tables and selectors use names, published titles, status and version numbers.
- [ ] Remaining user-facing raw identifiers are documented where current API responses expose only foreign keys or technical review references.
- [ ] Backend summary projections are required before linked Approval Inbox, licence, Provider Compliance, Customer and notification/export surfaces can be completed without N+1 lookups or cross-tenant risk.

### Business Compliance workspace

- [x] Business directory opens a focused seven-tab Business Compliance workspace using real server data.
- [x] Legal identity and GST association forms are modal and preserve the existing governed APIs.
- [x] Business requirements use published names without exposing internal codes or synthetic fixtures.
- [x] Documents use private upload/finalization, scan-state gating and authorized inline image/PDF previews.
- [x] Requests, approved versions and audit history use server-backed ten-record pages.
- [x] Platform reviewer assignment and decision controls remain in the Approval Inbox.
- [x] India-only country and State/UT selectors use the shared geography master list.
- [ ] Business document list server pagination and Business-filtered licence authorization endpoint are backend contract gaps.
- [ ] Authenticated browser execution of the 51 acceptance scenarios remains pending the private development admin fixture.

- [x] Provider Compliance Center uses server eligibility, provider-scoped records, guided request steps and private document APIs.
- [x] Optional request audit history no longer blanks the page when omitted by a valid API response.
- [x] Host-browser evidence covers responsive Agent Compliance Center, provider-scoped Asset Compliance and Document Transfer workflows.
- [x] Screen/action/API/permission and scenario matrices are recorded in `docs/compliance-ux-action-api-matrix.md`.
- [x] Business Legal Identity and GST Association entry uses structured fields while preserving the existing governed API payload and canonical GST source-of-truth boundary.
- [ ] Consolidate the visible provider navigation to the four feed views while preserving deep links.
- [ ] Add server-published requirement field schemas and server-side request query pagination before claiming those capabilities.
- [x] Platform Approval correction requests expose structured common fields while preserving the compatibility payload editor; Business legal identity, GST and registration/brand entry are structured.
- [ ] Remove the compatibility payload editor after the API publishes complete field-level requirement schemas.
- [ ] Production-only expiry scheduling, external notification delivery, strict CLEAN malware scanning and broader legal-variant authorization review remain `PRODUCTION_PENDING`.

## Provider Operations AI criteria

- Make changes only to provider Operations screens and provider-scoped shared components.
- Treat Platform Administration screens, routes, navigation, permissions, styling, and behavior as frozen.
- Do not change backend contracts, database schema, generated API types, tenant isolation, revisions, or security controls without explicit approval.
- Do not invent totals, relationships, statuses, permissions, assignments, or successful business actions.
- Use server-returned authorization and lifecycle transitions as the source of truth.
- Every batch must include a Platform Administration non-regression check.

## Elevator sales and installation workstream — ELP-01

- [x] Audited existing provider UI, Rails models/routes/services, OpenAPI,
  checked-in schema and live local PostgreSQL catalog before proposing physical
  design.
- [x] Confirmed provider Operations UI can reuse Customer/ServiceLocation,
  Asset, Quotation, ServiceCase/ServiceStage, ServiceJob, Document,
  MaintenanceContract and Warranty sources.
- [x] Recorded missing Lead, Site Survey/Requirement Revision,
  Material/Shipment, Provider-to-Customer Payment, and persisted Inspection
  sources in the architecture audit.
- [x] Recorded that Platform Administration, Customer application boundaries,
  existing Service Jobs/My Work and existing AMC workflows remain protected.
- [x] ELP-01 server catalogue is implemented with disabled, elevator-operation-
  scoped marketing role templates and server-derived `sales_marketing`
  capability metadata. The Provider navigation is capability-gated; no active
  marketing authority has been granted to a development browser identity.
- [ ] ELP-02 — Add Provider-only Leads, site survey, and requirements screens
  using the server capability projection and the existing Operations visual
  primitives. API integration and UI implementation are present. Focused API
  verification passes 2 runs / 10 assertions; the full UI suite, typecheck,
  lint, builds, bundle budget and diff checks pass. Authenticated browser
  evidence remains pending until an approved local marketing role is assigned.
