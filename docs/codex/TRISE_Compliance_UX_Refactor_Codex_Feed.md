# TRISE India — Compliance UX Redesign and Guided Workflow Implementation

## Codex master implementation feed

**Repository (UI):** `~/wrk/lre/trise-ui`  
**Related architecture:** `~/wrk/lre/trise-architecture`  
**Related Rails API:** `~/wrk/lre/trise-api`  
**Scope:** Business Verification, Service Provider Compliance Center, Platform Approval Inbox, evidence/document UX, request wizard, and shared UI patterns.

### Mission

Implement a guided, business-friendly, permission-aware compliance experience across the three workspaces. **Do not merely restyle the screenshots.** Preserve existing Rails/API contracts, architecture decisions, security rules, multi-tenant/provider scoping, immutable approved versions, document scanning, and platform-only review permissions. Replace long walls of forms, generic JSON editing, giant modals, confusing tabs, and non-actionable empty states with task-oriented pages that clearly answer:

1. Where am I and whose records am I managing?
2. What is the current server-authoritative status?
3. What, exactly, needs attention and why?
4. What can I do next with my permissions?
5. What happens after I submit?

Current user screenshots are UI evidence, not proof of backend failures. Verify behavior against repository code, actual backend responses, and documented policies. Do not invent data, scores, eligibility criteria, workflow states, APIs, or permissions.

### Screenshot-based findings to investigate

- Provider navigation shows both **Operations** and **Compliance Center** titles and repeats the provider context. Choose one primary title and one compact provider context.
- Provider summary shows `ELIGIBLE` despite 0 business licence associations and 0 approved territories. This may be valid for general access; explain the limited scope of the authoritative eligibility result rather than recalculating or silently contradicting it.
- **2 authorized agents** are displayed on an Agent Certifications card. Provider authorization is not proof of current credentials; use distinct labels and statuses.
- **13 active provider assets** are displayed under Asset Approvals with **0 published requirements**. Active asset lifecycle and regulatory approval are different facts; do not equate them.
- Eight provider tabs, repeated four-card summary, long asset-card listings, a large mostly empty wizard modal, and inactive/unclear buttons create poor task focus.
- The licence view says no approved business licences are available. Explain the authorized next step; do not offer a request that cannot be fulfilled.
- Documents show lifecycle `available` and scan state `not scanned` together. Both states may be independent, but unscanned/ineligible evidence must not be treated as cleared or activatable. Preserve scanning gates (including ClamAV).
- Empty requests, activity history, and requirements provide little information about whether the state means zero data, nothing applicable, lack of permissions, or a failure to load.
- Business Verification still exposes raw JSON, long stacked Legal Identity/GST/Registrations/Licences/Supporting Documents forms, and approval controls embedded in licence cards.
- Platform Compliance Review mixes licence decisions into the page above a separate review queue; reviewers cannot first see a simple list of requests, changes, evidence, and allowed actions.
- Multiple similar-looking pending/revision-requested/approved licence cards require proper grouping by source licence, provider, authorization reference, revision, and request history to avoid apparent duplicates.
- Distinguish global platform review, business-scoped history, and provider-scoped My Requests; these are different datasets and permissions.

## Phase 0 — audit and decision inventory, before code changes

1. Inspect the UI routes and navigation, current pages/components, shared styles, API clients, generated OpenAPI types, feature permissions, design tokens, tests, and ADRs.
2. Inspect relevant Rails controllers/services/policies and platform domain models only as needed to validate contracts. Do not change backend behavior just to make a UI render.
3. Produce a **screen/action/API/permission matrix** with every existing feature and button. Record source of truth, server state, allowed action, error behavior, and evidence/authorization requirements.
4. Produce a **scenario matrix**: first time, pending, approved, rejected, revision requested, no requirement, no licence, unscanned document, no permitted action, permission denied, network failure, stale revision.
5. Identify genuine backend/API gaps; document them and seek an architectural decision when needed. Do not fabricate endpoints, enums, required fields, or compliance rules.
6. Preserve existing routes/deep links, or implement explicit redirects when navigation changes. Preserve request IDs and exact resource scope.
7. Implement in small, reviewable batches and report actual validation; avoid a single huge rewrite.

## Navigation and page architecture

### Provider workspace — primary navigation

**Compliance Center** with four top-level views at most:

- **Overview:** compact provider identity and server eligibility; next actions/alerts; four category summaries; recent requests.
- **Requirements:** categories Agent Qualifications, Asset Approvals, Business Licences, and Operating Territories; select one to open a dedicated detail view. Put search/filter/pagination inside the selected category, not a 13-card wall.
- **My Requests:** provider-scoped request list, drafts where supported, statuses, revision feedback, next action, details and history.
- **Documents:** private provider evidence library, classifications, version, upload, scan/verification states, authorized preview/download.

Activity History is a contextual link/secondary section accessible from a request or Documents, not necessarily another permanent crowded tab. Hide repeated summary cards when inside individual detail pages. The current provider context should be compact and obvious.

### Business workspace

**Business Verification**: overview/checklist -> Legal Identity -> GST Associations -> Registrations & Brands -> Business Licences -> My Submissions/History. Each section has its own focused page or panel. Business actions are not automatically platform review actions. GST is optional unless applicable server policy requires it. Preserve business ownership vs provider authorization boundaries.

### Platform administration

**Approval Inbox**: global server-authoritative queue -> select request -> diff, evidence, reviewer assignment, decision, version/audit. Show licence authorization requests as one supported request category rather than a separate page of inline approval forms. Review roles only; no provider or ordinary business role should gain platform reviewer powers.

### Shared design patterns

Build or reuse consistent `PageHeader`, `ContextBadge`, `ComplianceStatusSummary`, `GuidedStepLayout`, `RequirementFormRenderer`, `EvidencePicker`, `RequestList`, `RequestDetails`, `FieldChangeComparison`, `AuditTimeline`, `EmptyState`, `PermissionNotice`, `ErrorState` and `ConfirmDecisionDialog` components where justified. Use existing repo conventions. Do not overabstract features with different domain rules.

## UX/content rules

- One primary action per view; secondary actions clearly separated.
- Each page must communicate: **Current status / Why it matters / Next step / What happens after submission**.
- Use meaningful business/agent/asset/licence names; show UUIDs in copyable technical details, not as prominent primary labels.
- Use readable typography, stable alignment, consistent button widths and spacing, accessible contrast, responsive design and keyboard navigation.
- Avoid displaying raw JSON as the normal editing interface; render server-published schema fields as labels, selects, dates, text, checkboxes, document selectors and validation messages. An advanced, permission-controlled JSON inspector may be read-only.
- Do not repeat large banners and summary cards on every tab. Use breadcrumbs, back navigation and compact context on detail views.
- Do not use a full-page dialog with enormous whitespace. Prefer a dedicated wizard route or a bounded, scrollable dialog with a sticky footer. Preserve Back/Continue/Cancel and unsaved-change warning.
- Any disabled action must explain the blocker or point to a permitted next action. Differentiate: loading, no data, no requirements configured, no access, not eligible, and error.
- Count labels must match actual semantics and the query scope. Never display a partial-page count as a global count.
- Date/time displays must include a consistent business timezone policy, user-readable date and access to exact UTC timestamps when appropriate.

## Provider Compliance detailed flows

### A. Overview

- Primary heading: `Compliance Center` (remove duplicate `Operations` headline from this page if not part of global shell).
- Compact provider name and switcher; clear workspace scope.
- Eligibility badge and explanation come **only from the authoritative eligibility API**. If the API does not provide detailed scope/reasons, show a conservative explanation (`Current provider-level eligibility; individual activities may require additional approval`) rather than inventing rules.
- Four task cards: **Agent Qualifications**, **Asset Regulatory Approvals**, **Business Licence Authorizations**, **Operating Territories**. Cards show only grounded counts/statuses, with names matching their semantics.
- A **Next steps** panel surfaces known server-provided blockers, returned actions, or explicit state-derived actions that are already authorized. If no server blockers are returned, show `No additional actions reported` rather than `All compliant`.
- Recent requests with state and next action; empty CTA opens the wizard when permitted.

### B. Agent qualifications

- Show authorized provider agents; separate affiliation/membership status from certification/permit approval and expiry.
- Search, filter, pagination; agents do not need to appear as large repeated cards.
- Agent details: identity, current provider relationship, applicable published requirements, certification documents, validity where returned, status, next permitted action.
- Request creation may target an authorized agent only. Do not grant work eligibility from mere file upload or account membership.

### C. Asset regulatory approvals

- Search/filter/page provider-accessible assets using meaningful family/type/name/location, and distinct lifecycle vs regulatory approval status.
- Applicable requirements must come from dynamic asset taxonomy, published requirements, and jurisdiction rules. TRISE must remain multi-industry; no elevator-only hardcoding.
- If the API reports no published requirement, explain `No published regulatory requirement is configured for this asset/category` (as appropriate), not `Approved`.
- Asset detail contains applicable requirements, existing approvals, evidence and the start-request action if supported. No 13-card wall.

### D. Business licence authorization

- Show licences that the currently authorized provider can associate, with owning business, licence label/reference, activities, jurisdiction, validity, available scope, and existing authorization status.
- If none are approved or available, explain what is missing and offer a **permission-safe** route to a business owner or business verification process only if that route exists and the user has access. Otherwise show who to contact without inventing a workflow.
- Provider cannot enlarge source licence scope or see private business documents beyond permission.

### E. Operating territory

- Show current requested/approved territory list, with jurisdiction, allowed activities where provided, scope, effective date, and current state.
- Guided request: choose supported scope -> country -> state/UT/area where required -> reason -> evidence if required -> review -> submit.
- Requested territory is not authorization until required approval is effective.

### F. Documents

- Retain private provider-scoped storage and short-lived authorized preview/download.
- Clearly separate **lifecycle** (`uploaded`, `available` if API says so) from **scan status** (`not scanned`, `pending`, `clean`, `infected`, etc. only as actually defined) and from **usable as compliance evidence**.
- A document with `not scanned` must not pass any evidence-finalization/activation gate that requires a clean scan. Do not bypass ClamAV or turn a client-only flag into acceptance.
- Provider logos are not automatically compliance evidence. Show appropriate document classification and request-specific eligible evidence.
- No raw storage keys or unrestricted URLs; preserve versioning and private visibility.

### G. My Requests

- Server-side filtering, sorting and pagination; selected provider scope is explicit.
- Each row: meaningful request title, target, category, submitter, date, current server status, next permitted action.
- Details: summary, current authoritative status, proposed changes, evidence readiness, submissions/versions, reviewer feedback visible to the role, readable timeline.
- Editing a draft or resubmitting a correction is allowed only if the API supports that status transition and permission.

## Common guided New Compliance Request wizard

Use a stepper with **no more than one focused task per step**, showing progress and validation. Suggested structure (adapt to existing API):

1. **What do you need?** Show simple task cards for server-published, role-permitted categories. Hide or explain unsupported categories. Examples: Agent certification, Asset approval, Business licence authorization, Operating territory, Other published provider requirement.
2. **Which record?** Show authorized agents, assets, available licences, or supported jurisdictions based on selected category; searchable selector; contextual descriptions; clear no-options state.
3. **Required information**: dynamically render correct schema fields and inline help. Do not ask for `approval details (JSON)` or `licence, registration and scope values (JSON)` in the normal UI.
4. **Supporting evidence**: list required evidence, select/upload, show scan/activation readiness, explain any blocking document. Avoid selecting unscanned evidence as valid when server policy disallows it.
5. **Review & submit**: human-readable summary; reason; evidence state; clear declarations; explicit irreversible implication where applicable; send exactly once with server-defined idempotency/revision handling.

After success: close/re-route to the created request, display authoritative state/reference, next expected step and My Requests link. `Save draft` only if the API has actual draft semantics; autosave only with supported contracts. Back navigation preserves entered valid data. Cancel warns about unsaved changes. All loading and network errors are actionable.

## Business Verification workflow

- Overview card/checklist for Legal Identity, GST Associations, Registrations & Brands, Business Licences, and Submissions; show status and action grounded in the backend.
- Legal Identity: approved values read-only; proposed values through structured controls; required reason; evidence if required; immutable review request, not direct overwrite.
- GST: association to canonical tax registration only; never edit GST source data here or set billing default; only require where policy says so.
- Registrations & Brands: published business requirement picker -> dynamic form -> evidence -> review -> submit -> track.
- Licence list: approved source licences and provider authorizations, grouped by provider/source and request/version. Avoid repeated same-looking status cards with inline platform decisions.
- Supporting documents: a focused documents section, not a huge upload region embedded among several unrelated forms.
- The business page may link to request status but may not expose unauthorized platform reviewer assignment/decision controls.

## Platform Approval Inbox workflow

- Queue first: searchable/filterable/paginated authoritative requests; status, scope, submitted date, category, business/provider, assigned reviewer, next allowed action.
- Selecting a request opens a focused page/panel. Show one primary action and distinct tabs/sections: Overview, Changes, Evidence, Review, Activity.
- Render changed fields as `Current approved value` -> `Proposed value`, including nested and null changes; keep raw JSON as a secondary technical view only.
- Reviewer assignment separate from final decision; require reason where backend requires; users cannot assign/review outside actual authorization.
- Decision: approve/reject/request revision only where backend-defined; require decision reason and confirmation, detect stale revision, use idempotency, refresh authoritative state.
- Never treat the success toast as proof before API response confirms. Respect evidence readiness and segregation-of-duties policies.
- Immutable versions, timestamps, reviewer actions and audit history displayed readably and scoped safely.

## Scenarios that MUST work (test matrix)

1. New provider, eligibility unknown or limited: show accurate server status, no invented green check.
2. Provider eligible for general use but lacks business licence and territory approvals: show scoped eligibility and restrictions without contradiction.
3. Two authorized agents, no published credential requirements: display membership correctly; never call them certified solely because authorized.
4. Thirteen active assets, zero published requirements: display lifecycle accurately; do not claim regulatory compliance/approval.
5. No available approved licence: clear empty state and permitted business follow-up; no dead-end enabled submission.
6. No territory requests: new territory action only if permitted, with explanatory next step.
7. Uploaded file is `available` but `not scanned`: separate labels and block its use as evidence when scanning required; no bypass.
8. Selected published requirement demands evidence: show it, validate it, prevent invalid finalization.
9. Draft -> submitted -> awaiting review -> revision requested -> corrected resubmission -> approved, only when these transitions exist on the backend.
10. Rejected submission: show reason and next allowed action; do not silently allow edits to approved versions.
11. Multiple providers belonging to same business: no access leakage across siblings.
12. Unauthorized user attempts reviewer assignment/approval: server rejects and UI clearly explains permission.
13. Two admins make concurrent decisions: show stale revision error and refresh/reconcile state safely.
14. Slow/error/offline APIs: no blank infinite spinner, fake zero, double submission or invalid optimistic approval.
15. Mobile 390px, tablet 768px, desktop 1440px: no clipping or giant blank wizard; complete keyboard navigation.

## Architecture and security requirements

- Enforce authorization in Rails/server; UI permission gating is supplementary.
- Preserve tenant/business/provider isolation and platform-wide vs scoped queue separation.
- Preserve existing immutable compliance approved versions, audit events, schema-based requirement catalogs, document policy and malware scan gates.
- Reuse current API resource IDs and version/revision/idempotency strategy. No client-generated fake approval/status transitions.
- Preserve existing capabilities, deep links, route compatibility, business logic, tests, and accessibility as you refactor.
- Do not hardcode GST applicability, asset industry, jurisdiction rules, licence eligibility, mandatory evidence or approver policies.
- If the existing API lacks a field to fulfill the UX (e.g. eligibility scope, next allowed actions, evidence readiness), document a specific backend contract proposal; implement a cautious UI until approved.
- No unrelated database migrations or broad backend rewrites. Update ADR only for actual new architectural decisions.

## Implementation batches / checkpoints

**Batch 1 — Discovery and UI foundation:** baseline existing features, action/API matrix, regression inventory, breadcrumbs/header, provider context, accessible shared components, and navigation. Report before proceeding.

**Batch 2 — Provider Overview and Requirements:** summary status semantics, appropriate empty states, Agents/Assets/Licences/Territories detail views, search/pagination, status distinctions.

**Batch 3 — Guided request wizard:** category -> target -> details -> evidence -> review; required fields, allowed options, blockers, error handling, draft support only where real.

**Batch 4 — Requests and Documents:** My Requests statuses/history/feedback, scanning UX, evidence selection, read-only technical details, private transfers.

**Batch 5 — Business Verification:** split giant admin business page into guided subviews, structured forms, evidence, licence grouping, clear business-only permissions.

**Batch 6 — Platform Approval Inbox:** queue/detail change comparison, authorized reviewer assignment/decision, readable audit/version histories, no inline platform decisions in business overview.

**Batch 7 — Hardening and delivery:** responsive and visual testing, end-to-end role tests, accessibility, API failure paths, concurrency/idempotency, documentation.

In each batch: implement actual source changes, do not stop at planning; keep changes reviewable; run appropriate lint/typecheck/unit tests/build; use browser tests/screenshots if environment supports them. Never report tests as passed unless executed. Maintain a concise change log (what, files, APIs, permissions, tests, gaps). Halt only for genuinely blocked decisions or security-critical uncertainty.

## Required deliverables

- Updated React UI in `trise-ui`, not just mockups.
- Screen and role-based user-journey matrix.
- Existing vs target component/route/API mapping.
- Complete scenario/test matrix and automated tests.
- Screenshot comparison and accessibility findings for 1440, 768, 390 widths, if browser environment is available.
- UI capability checklist updates and links to relevant architecture decisions/work plan.
- Explicit unresolved API/backend gaps with proposed, *not invented*, contract changes.
- Final implementation report including batch results and failed/skipped tests.

**Definition of Done:** An authorized nontechnical user can determine whose records they are viewing, understand current compliance state, find the next action, complete a guided request without writing JSON, submit secure evidence, track decisions, and view immutable history. An authorized platform reviewer can understand changes and evidence before deciding. Every view preserves authoritative permissions, status transitions, document scanning, and resource scope.
