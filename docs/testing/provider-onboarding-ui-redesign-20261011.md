# Advanced provider onboarding redesign — analysis and implementation record

## Phase 1 — existing behavior and design review

The Platform Administration flow has six domain stages: Provider Identity,
Business Profile, Contacts & Locations, Documents, Plan & Approval, and Review
& Activate. Routes already exist for provider identity, business profile,
contacts, offices, document transfer, subscription request, and final review.
The contacts stage has two subroutes. Existing forms call the current platform
API methods and preserve expected revisions and idempotency keys. Contact
records are provider coordination details and do not create authenticated
members. Office addresses are India-only, require a six-digit PIN, and preserve
optional coordinates independently from post-office reference data.

The current progress bar has no API-derived statuses; it marks only the current
step and optionally accepts a `completed` list that callers do not populate. It
uses a five-column desktop grid for six steps and collapses into one column on
small screens. The Business Profile form saves and submits through separate
revision-bound operations, but a successful save immediately routes to
Contacts & Locations. Its identity and address fields are in separate cards;
logo editing is below the form. Contacts are edited in a dialog, while office
creation and editing share a full inline form above the table. Empty states are
plain text. Plan selection is dynamic and defaults to the catalogue-marked
onboarding plan when no existing request applies. The Review & Activate route
renders a long vertical checklist plus identity, contacts, administrator
handoff, business, documents, review history, readiness, lifecycle mutation,
and a second full subscription manager.

The saved provider-review screenshot
[`provider-review-desktop.png`](../evidence/local-platform-e2e-20261011/provider-review-desktop.png)
shows the most serious problem: lifecycle administration and subscription
history take most of the page, pushing the registration decision far below the
fold. The saved onboarding screenshots also show long form content and a
persistent sidebar consuming narrow-width space. These screenshots are actual
historical browser captures; this redesign's current rendering has not yet
been captured.

### Review & Activate redesign proposal

Replace the stacked content with a compact readiness summary, followed by
collapsible evidence groups: Business and identity, Contacts and offices,
Document verification, Administrator setup, Subscription, and Review history.
Each group shows actual status and a short evidence summary plus a direct link
to its existing workflow. The provider lifecycle is displayed separately from
registration verification. Activation currently has one confirmed API gate:
the current business profile must be `VERIFIED`; other evidence is presented
as review context, not invented blockers. Final activation actions link to a
separate operational lifecycle screen and remain capability-gated, confirmed,
revision-bound and server-authoritative. The page will not duplicate forms or
mount a second subscription manager.

### Proposed UI components and files

- Add focused shared onboarding presentation components for the six-step
  navigation, API-derived state badges, consistent section headers/forms,
  actionable empty/error states, review groups, readiness summary, action
  toolbar and confirmation affordances. Reuse TRISE `PageHeader`,
  `DetailSection`, `StatePanel`, `OperationsDialog`, status primitives and
  existing form/validation logic; add no UI dependency.
- Update `platform-admin.tsx` to calculate progress from provider, business
  profile, contact, office, document, subscription-request and review records;
  modernize the five requested screens; split lifecycle controls into a
  distinct route; and preserve existing mutation APIs.
- Update provider onboarding route parsing and focused model/routing tests for
  the lifecycle route and progress state/permission behavior.
- Add Operations-only responsive styles in `operations-design.css` and/or
  `operations-pages.css`; do not alter Customer or shared primitive rendering.
- Update `docs/ui-capability-checklist.md` and this implementation record after
  verification. No architecture ADR, API contract, database or permission
  change is proposed.

### Contract and policy boundaries

The Rails API remains authoritative for verification decisions, activation,
subscription assignment, revision checks, idempotency, provider isolation and
current authorization. The accepted ADR-063 default plan is catalog-driven;
its 14-day validity starts at the provider's verified business timestamp and
is assigned in the first activation transaction only when no explicit plan
request is pending or accepted. Paid requests keep separate review and payment
verification. Document malware scanning is currently disabled: transfer and
finalization remain private and record `NOT_SCANNED`; the UI must not display a
clean/approved scan or bypass server checks. Provider-admin invitations have
a provider-scoped read operation and expose current status. Manager assignment
history is not included in the readiness evidence used by this screen. No
consolidated onboarding-readiness or workflow timeline endpoint is present.

## Implemented phases

The six-step navigation now uses existing routes and derives states from
provider/profile, contacts/offices, documents, subscription/request, and
business-verification records. Direct step links are hidden from users without
the corresponding existing capability. Review status follows business
verification and remains independent from operational lifecycle state.

Business Profile is grouped into Legal Identity, Registered Address, and
Branding and Logo. Save Draft stays on the form, submit remains a separate
revision-bound operation, and route changes prompt when edits are dirty.
Contacts and offices have separate tabs, concise saved-record tables, action
empty states, and focused create/edit dialogs. Existing India PIN and optional
coordinate validation remains in place.

Plan & Approval starts with dynamic published-plan comparison cards, then
shows existing subscription terms, validity, usage, upgrade, approval and
timeline workflows. The default demonstration plan remains catalogue-driven
and the backend assigns it at the recorded business-verification event.

Review & Activate now presents the API's confirmed business-verification
blocker, non-blocking evidence notes, and six collapsible evidence groups.
Unavailable reads are reported as unavailable and can be retried. It does not
duplicate forms or mount another subscription manager. Operational lifecycle
actions moved to a separate route with a confirmation dialog and existing
server-side capability, revision and audit enforcement.

Files changed for this redesign: `apps/operations/src/platform-admin.tsx`,
`platform-provider-routing.ts`, `platform-provider-routing.test.ts`,
`provider-detail-model.ts`, `provider-detail-model.test.ts`,
`provider-onboarding-ui.tsx`, `provider-onboarding-review.tsx`,
`platform-provider-subscription.tsx`, `operations-design.css`, this record,
`docs/ui-capability-checklist.md`, and the browser readiness report.
No API/schema/permission changes were introduced. Existing API reads and
mutation contracts remain the dependencies.

The production/customer application is unchanged. Rendered layout, keyboard
behavior, form validation and authenticated workflow outcomes remain
unverified because Chromium launch failed earlier with the recorded
Crashpad/Mach permission error. No retry or sandbox change was made; browser
acceptance remains blocked. No new screenshots or viewport claims are
presented as evidence.
